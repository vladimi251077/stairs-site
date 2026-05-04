import seoSync from './seo-sync.js';

const SUPABASE_URL = 'https://rhnlykqqhwweaywjopvm.supabase.co';

function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

async function isValidAdminRequest(req) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  const authHeader = req.headers.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;

  const userToken = authHeader.slice(7);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${userToken}`
    }
  });

  return response.ok;
}

export default async function handler(req, res) {
  try {
    const allowed = await isValidAdminRequest(req);
    if (!allowed) return json(res, 403, { ok: false, error: 'Forbidden' });

    req.query = {
      ...(req.query || {}),
      secret: process.env.SEO_SYNC_SECRET || process.env.CRON_SECRET || ''
    };

    return seoSync(req, res);
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
