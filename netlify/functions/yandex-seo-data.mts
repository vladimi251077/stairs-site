declare const Netlify: { env: { get: (name: string) => string | undefined } };

function getEnv(name: string) {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function numberValue(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function verifyAdmin(request: Request) {
  const token = request.headers.get("authorization") || "";
  if (!token.startsWith("Bearer ")) return false;

  const base = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: serviceKey, authorization: token }
  });
  return response.ok;
}

async function supabase(path: string) {
  const base = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export default async (request: Request) => {
  try {
    if (!(await verifyAdmin(request))) return json({ error: "Нужно войти в админку" }, 401);

    const [rows, trackedQueries, syncRuns] = await Promise.all([
      supabase("/rest/v1/seo_query_stats?select=*&order=date_to.desc,synced_at.desc,shows.desc&limit=1000"),
      supabase("/rest/v1/seo_tracked_queries?select=*&active=eq.true&order=sort_order.asc,query.asc"),
      supabase("/rest/v1/seo_sync_runs?select=*&order=started_at.desc&limit=8")
    ]);

    const latestDateTo = rows?.[0]?.date_to || null;
    const latestRows = latestDateTo ? rows.filter((row: any) => row.date_to === latestDateTo) : rows;
    const totalShows = latestRows.reduce((sum: number, row: any) => sum + numberValue(row.shows), 0);
    const totalClicks = latestRows.reduce((sum: number, row: any) => sum + numberValue(row.clicks), 0);
    const positions = latestRows.filter((row: any) => row.avg_position !== null && row.avg_position !== undefined);
    const avgPosition = positions.length ? positions.reduce((sum: number, row: any) => sum + numberValue(row.avg_position), 0) / positions.length : null;

    return json({
      summary: {
        latestDateTo,
        rows: latestRows.length,
        totalShows,
        totalClicks,
        ctr: totalShows ? (totalClicks / totalShows) * 100 : 0,
        avgPosition
      },
      rows: latestRows,
      trackedQueries,
      syncRuns
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};

export const config = { path: "/admin/api/yandex-seo-data" };
