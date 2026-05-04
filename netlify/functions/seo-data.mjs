const SUPABASE_URL = 'https://rhnlykqqhwweaywjopvm.supabase.co';

function env(name) {
  try {
    return Netlify.env.get(name) || '';
  } catch (error) {
    return process.env[name] || '';
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function requireAdmin(req) {
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, error: 'No Supabase user token' };
  }

  const token = auth.slice(7);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return { ok: false, status: 401, error: 'Invalid Supabase user token' };
  return { ok: true, serviceKey };
}

async function supabaseGet(path, serviceKey) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json'
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

function summarize(rows) {
  const shows = rows.reduce((sum, row) => sum + Number(row.shows || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const withPosition = rows.filter(row => row.avg_show_position !== null && row.avg_show_position !== undefined);
  const avgPosition = withPosition.length
    ? withPosition.reduce((sum, row) => sum + Number(row.avg_show_position || 0), 0) / withPosition.length
    : null;
  return {
    shows,
    clicks,
    ctr: shows ? Number(((clicks / shows) * 100).toFixed(2)) : 0,
    avgPosition: avgPosition === null ? null : Number(avgPosition.toFixed(1)),
    queryCount: rows.length
  };
}

export default async (req) => {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return jsonResponse({ ok: false, error: admin.error }, admin.status);

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || 300), 1000);

    const stats = await supabaseGet(
      `seo_query_stats?select=*&order=period_end.desc,shows.desc&limit=${limit}`,
      admin.serviceKey
    );
    const tracked = await supabaseGet(
      'seo_tracked_queries?select=*&active=eq.true&order=group_name.asc,sort_order.asc',
      admin.serviceKey
    );
    const runs = await supabaseGet(
      'seo_sync_runs?select=*&order=started_at.desc&limit=10',
      admin.serviceKey
    );

    const latestPeriodEnd = stats[0]?.period_end || null;
    const latestRows = latestPeriodEnd ? stats.filter(row => row.period_end === latestPeriodEnd) : [];
    const trackedMap = new Map(tracked.map(item => [String(item.query || '').toLowerCase(), item]));
    const latestByQuery = new Map(latestRows.map(row => [String(row.query || '').toLowerCase(), row]));

    const trackedRows = tracked.map(item => {
      const row = latestByQuery.get(String(item.query || '').toLowerCase());
      return {
        ...item,
        latest: row || null,
        shows: row?.shows || 0,
        clicks: row?.clicks || 0,
        ctr: row?.ctr || 0,
        avg_show_position: row?.avg_show_position ?? null
      };
    });

    const untrackedRows = latestRows.filter(row => !trackedMap.has(String(row.query || '').toLowerCase()));

    return jsonResponse({
      ok: true,
      latestPeriodEnd,
      summary: summarize(latestRows),
      latestRows,
      trackedRows,
      untrackedRows,
      runs
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }
};

export const config = {
  path: '/admin/api/seo-data'
};
