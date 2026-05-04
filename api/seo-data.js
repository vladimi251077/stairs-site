const SUPABASE_URL = 'https://rhnlykqqhwweaywjopvm.supabase.co';

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function checkAdmin(req) {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, error: 'No user session' };
  }
  const userToken = header.slice(7);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${userToken}` }
  });
  if (!response.ok) return { ok: false, status: 401, error: 'Bad user session' };
  return { ok: true, key };
}

async function db(path, key) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

function summarize(rows) {
  const shows = rows.reduce((sum, row) => sum + Number(row.shows || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const positioned = rows.filter(row => row.avg_show_position !== null && row.avg_show_position !== undefined);
  const avg = positioned.length ? positioned.reduce((sum, row) => sum + Number(row.avg_show_position || 0), 0) / positioned.length : null;
  return { shows, clicks, ctr: shows ? Number(((clicks / shows) * 100).toFixed(2)) : 0, avgPosition: avg === null ? null : Number(avg.toFixed(1)), queryCount: rows.length };
}

export default async function handler(req, res) {
  try {
    const admin = await checkAdmin(req);
    if (!admin.ok) return json(res, admin.status, { ok: false, error: admin.error });
    const limit = Math.min(Number(req.query?.limit || 300), 1000);

    const stats = await db(`seo_query_stats?select=*&order=period_end.desc,shows.desc&limit=${limit}`, admin.key);
    const tracked = await db('seo_tracked_queries?select=*&active=eq.true&order=group_name.asc,sort_order.asc', admin.key);
    const runs = await db('seo_sync_runs?select=*&order=started_at.desc&limit=10', admin.key);

    const latestPeriodEnd = stats[0]?.period_end || null;
    const latestRows = latestPeriodEnd ? stats.filter(row => row.period_end === latestPeriodEnd) : [];
    const trackedMap = new Map(tracked.map(item => [String(item.query || '').toLowerCase(), item]));
    const latestByQuery = new Map(latestRows.map(row => [String(row.query || '').toLowerCase(), row]));
    const trackedRows = tracked.map(item => {
      const row = latestByQuery.get(String(item.query || '').toLowerCase());
      return { ...item, latest: row || null, shows: row?.shows || 0, clicks: row?.clicks || 0, ctr: row?.ctr || 0, avg_show_position: row?.avg_show_position ?? null };
    });
    const untrackedRows = latestRows.filter(row => !trackedMap.has(String(row.query || '').toLowerCase()));

    return json(res, 200, { ok: true, latestPeriodEnd, summary: summarize(latestRows), latestRows, trackedRows, untrackedRows, runs });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
