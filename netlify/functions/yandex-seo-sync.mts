declare const Netlify: { env: { get: (name: string) => string | undefined } };

function env(name: string, fallback = "") {
  const value = Netlify.env.get(name) || fallback;
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstText(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function classify(query: string) {
  const value = query.toLowerCase();
  if (value.includes("tekstura") || value.includes("текстура")) return "Брендовые";
  if (value.includes("обшив") || value.includes("отделк") || value.includes("облицов")) return "Обшивка каркаса";
  if (value.includes("ступен") || value.includes("подступ")) return "Ступени";
  if (value.includes("дерев") || value.includes("лестниц")) return "Деревянные лестницы";
  return "Прочие";
}

function indicator(item: Record<string, unknown>, key: string) {
  const direct = item[key] ?? item[key.toLowerCase()];
  if (direct !== undefined) return direct;
  const indicators = item.indicators;
  if (indicators && typeof indicators === "object" && !Array.isArray(indicators)) {
    const value = (indicators as Record<string, unknown>)[key];
    if (value && typeof value === "object") return (value as Record<string, unknown>).value;
    return value;
  }
  return undefined;
}

function items(payload: Record<string, unknown>) {
  for (const key of ["queries", "search_queries", "items", "data", "results"]) {
    if (Array.isArray(payload[key])) return payload[key] as Record<string, unknown>[];
  }
  return [];
}

async function supabase(path: string, init: RequestInit = {}) {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function verifyAdmin(request: Request) {
  const token = request.headers.get("authorization") || "";
  if (!token.startsWith("Bearer ")) return false;
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, authorization: token } });
  return response.ok;
}

async function getYandexUserId(token: string) {
  const configured = Netlify.env.get("YANDEX_WEBMASTER_USER_ID");
  if (configured) return configured;
  const response = await fetch("https://api.webmaster.yandex.net/v4/user", { headers: { authorization: `OAuth ${token}` } });
  if (!response.ok) throw new Error(`Yandex user API ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const id = data.user_id || data.userId || data.id;
  if (!id) throw new Error("Yandex API did not return user_id");
  return String(id);
}

async function fetchPopularQueries(token: string, userId: string, dateFrom: string, dateTo: string) {
  const hostId = env("YANDEX_WEBMASTER_HOST_ID", "https:tekstura.shop:443");
  const url = new URL(`https://api.webmaster.yandex.net/v4/user/${encodeURIComponent(userId)}/hosts/${encodeURIComponent(hostId)}/search-queries/popular`);
  url.searchParams.set("order_by", "TOTAL_SHOWS");
  url.searchParams.append("query_indicator", "TOTAL_SHOWS");
  url.searchParams.append("query_indicator", "TOTAL_CLICKS");
  url.searchParams.append("query_indicator", "AVG_SHOW_POSITION");
  url.searchParams.set("device_type_indicator", "ALL");
  url.searchParams.set("date_from", dateFrom);
  url.searchParams.set("date_to", dateTo);
  url.searchParams.set("limit", "500");
  const response = await fetch(url, { headers: { authorization: `OAuth ${token}`, accept: "application/json" } });
  if (!response.ok) throw new Error(`Yandex queries API ${response.status}: ${await response.text()}`);
  return await response.json();
}

async function logRun(status: string, startedAt: string, message: string) {
  await supabase("/rest/v1/seo_sync_runs", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify([{ source: "yandex_webmaster", status, started_at: startedAt, finished_at: new Date().toISOString(), message }])
  });
}

async function runSync() {
  const startedAt = new Date().toISOString();
  try {
    const token = env("YANDEX_WEBMASTER_TOKEN");
    const userId = await getYandexUserId(token);
    const dateFrom = isoDate(-14);
    const dateTo = isoDate(-1);
    const payload = await fetchPopularQueries(token, userId, dateFrom, dateTo);
    const rows = items(payload).map((item) => {
      const query = firstText(item.query_text, item.query, item.text, item.name);
      const url = firstText(item.url, item.page_url, item.path);
      const avg = item.avg_show_position ?? item.avg_position ?? item.position ?? indicator(item, "AVG_SHOW_POSITION");
      return {
        source: "yandex_webmaster",
        date_from: dateFrom,
        date_to: dateTo,
        device: "ALL",
        query,
        url,
        shows: toNumber(item.total_shows_count ?? item.shows ?? indicator(item, "TOTAL_SHOWS")),
        clicks: toNumber(item.total_clicks_count ?? item.clicks ?? indicator(item, "TOTAL_CLICKS")),
        avg_position: avg === undefined || avg === null ? null : toNumber(avg, NaN),
        group_name: classify(query),
        payload: item
      };
    }).filter((row) => row.query);

    if (rows.length) {
      await supabase("/rest/v1/seo_query_stats?on_conflict=source,date_from,date_to,device,query,url", {
        method: "POST",
        headers: { prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows)
      });
    }

    await logRun("success", startedAt, `Загружено запросов: ${rows.length}`);
    return { ok: true, count: rows.length, dateFrom, dateTo };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logRun("error", startedAt, message).catch(() => undefined);
    throw error;
  }
}

export default async (request: Request) => {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const isSchedule = (request.headers.get("x-nf-event") || "").toLowerCase() === "schedule";
    if (!isSchedule && !(await verifyAdmin(request))) return json({ error: "Нужно войти в админку" }, 401);
    return json(await runSync());
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};

export const config = { path: "/admin/api/yandex-seo-sync", schedule: "0 4 * * *" };
