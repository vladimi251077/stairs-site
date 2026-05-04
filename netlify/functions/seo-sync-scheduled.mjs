import syncHandler from './seo-sync.mjs';

export default async (req, context) => {
  const originalUrl = new URL(req.url);
  const secret = (() => {
    try { return Netlify.env.get('SEO_SYNC_SECRET') || ''; } catch { return process.env.SEO_SYNC_SECRET || ''; }
  })();

  if (secret && !originalUrl.searchParams.get('secret')) {
    originalUrl.searchParams.set('secret', secret);
  }

  const proxyRequest = new Request(originalUrl.toString(), {
    method: 'GET',
    headers: req.headers
  });

  await syncHandler(proxyRequest, context);
};

export const config = {
  schedule: '15 3 * * *'
};
