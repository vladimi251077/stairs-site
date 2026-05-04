const SUPABASE_URL = 'https://rhnlykqqhwweaywjopvm.supabase.co';
const WEBMASTER_API_BASE = 'https://api.webmaster.yandex.net/v4';
const HOST_ID = 'https:tekstura.shop:443';

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function twoWeeksWindow() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 13);
  return { from: formatDate(start), to: formatDate(end) };
}

function getSecret(req) {
  const querySecret = req.query?.secret || '';
  const authHeader = req.headers.authorization || '';
  if (querySecret) return String(querySecret);
  if (authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice(7);
  return '';
}

function assertEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function supabaseRequest(path, options = {}) {
  const serviceKey = assertEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function createSyncRun(periodStart, periodEnd) {
  const rows = await supabaseRequest('seo_sync_runs', {
    method: 'POST',
    body: JSON.stringify({ status: 'running', source: 'yandex_webmaster', period_start: periodStart, period_end: periodEnd })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function finishSyncRun(id, patch) {
  if (!id) return;
  await supabaseRequest(`seo_sync_runs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ finished_at: new Date().toISOString(), ...patch })
  });
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickMetric(row, names) {
  for (const name of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    if (row?.metrics && Object.prototype.hasOwnProperty.call(row.metrics, name)) return row.metrics[name];
    if (row?.indicators && Object.prototype.hasOwnProperty.call(row.indicators, name)) return row.indicators[name];
  }
  return null;
}

function normalizeQueryRow(row, periodStart, periodEnd) {
  const query = row.query || row.query_text || row.text || row.name || row?.dimensions?.query || '';
  const url = row.url || row.page || row.path || row?.dimensions?.url || null;
  const shows = normalizeNumber(pickMetric(row, ['shows', 'total-shows-count', 'TOTAL_SHOWS_COUNT', 'shows_count', 'impressions', 'TOTAL_SHOWS'])) || 0;
  const clicks = normalizeNumber(pickMetric(row, ['clicks', 'total-clicks-count', 'TOTAL_CLICKS_COUNT', 'clicks_count', 'TOTAL_CLICKS'])) || 0;
  const avgShowPosition = normalizeNumber(pickMetric(row, ['avg_show_position', 'avg-show-position', 'AVG_SHOW_POSITION', 'position', 'avg_position']));
  const avgClickPosition = normalizeNumber(pickMetric(row, ['avg_click_position', 'avg-click-position', 'AVG_CLICK_POSITION']));
  return {
    source: 'yandex_webmaster',
    period_start: periodStart,
    period_end: periodEnd,
    query: String(query || '').trim().toLowerCase(),
    query_id: row.query_id || row.id || null,
    url,
    device_type: row.device_type || row.device || 'ALL',
    region: row.region || null,
    shows,
    clicks,
    avg_show_position: avgShowPosition,
    avg_click_position: avgClickPosition,
    raw: row
  };
}

async function getYandexUserId(token) {
  const response = await fetch(`${WEBMASTER_API_BASE}/user/`, { headers: { authorization: `OAuth ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(`Yandex user error ${response.status}: ${JSON.stringify(data)}`);
  return data.user_id || data.userId || data.id;
}

async function fetchYandexQueries(token, userId, from, to) {
  const params = new URLSearchParams({
    order_by: 'TOTAL_SHOWS',
    query_indicator: 'TOTAL_SHOWS,TOTAL_CLICKS,AVG_SHOW_POSITION,AVG_CLICK_POSITION',
    device_type_indicator: 'ALL',
    date_from: from,
    date_to: to,
    limit: '500'
  });
  const url = `${WEBMASTER_API_BASE}/user/${encodeURIComponent(userId)}/hosts/${encodeURIComponent(HOST_ID)}/search-queries/popular?${params.toString()}`;
  const response = await fetch(url, { headers: { authorization: `OAuth ${token}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Yandex popular queries error ${response.status}: ${JSON.stringify(data)}`);
  const rows = data?.queries || data?.query_indicators || data?.data || data?.items || [];
  return { rows: Array.isArray(rows) ? rows : [], raw: data, endpoint: url };
}

async function upsertRows(rows) {
  if (!rows.length) return [];
  return supabaseRequest('seo_query_stats?on_conflict=source,period_start,period_end,device_type,query,url_norm', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  });
}

async function syncYandex({ from, to }) {
  const token = assertEnv('YANDEX_WEBMASTER_OAUTH_TOKEN');
  const userId = process.env.YANDEX_WEBMASTER_USER_ID || await getYandexUserId(token);
  const result = await fetchYandexQueries(token, userId, from, to);
  const normalized = result.rows.map(row => normalizeQueryRow(row, from, to)).filter(row => row.query);
  await upsertRows(normalized);
  return {
    userId,
    endpoint: result.endpoint,
    imported: normalized.length,
    totals: {
      shows: normalized.reduce((sum, row) => sum + row.shows, 0),
      clicks: normalized.reduce((sum, row) => sum + row.clicks, 0)
    }
  };
}

export default async function handler(req, res) {
  const expectedSecret = process.env.SEO_SYNC_SECRET || process.env.CRON_SECRET || '';
  const providedSecret = getSecret(req);
  if (expectedSecret && providedSecret !== expectedSecret) return json(res, 403, { ok: false, error: 'Forbidden' });
  const window = twoWeeksWindow();
  const from = req.query?.from || window.from;
  const to = req.query?.to || window.to;
  const run = await createSyncRun(from, to);
  try {
    const result = await syncYandex({ from, to });
    await finishSyncRun(run?.id, { status: 'success', rows_imported: result.imported, totals: result.totals, message: `Imported ${result.imported} rows from Yandex Webmaster` });
    return json(res, 200, { ok: true, period: { from, to }, ...result });
  } catch (error) {
    await finishSyncRun(run?.id, { status: 'error', message: error.message });
    return json(res, 500, { ok: false, period: { from, to }, error: error.message });
  }
}
