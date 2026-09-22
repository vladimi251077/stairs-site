# SEO statistics on the homelab site

The public site is served by nginx. The SEO page calls `/api/seo-data` and
`/api/seo-sync-admin`, which still run on the existing Vercel deployment at
`stairs-site.vercel.app`. The nginx config proxies only those two routes and
passes the Supabase session bearer token to Vercel. The daily sync remains on
Vercel. `/admin/seo` serves the existing static page.

Build the website image with `deployment/seo/Dockerfile.web` and attach the
container to the `tekstura-edge` network. Keep the Vercel project and its SEO
environment variables active while this proxy is in use.

Unauthenticated smoke checks:

```sh
curl -i https://tekstura.shop/admin/seo       # 200 HTML
curl -i https://tekstura.shop/api/seo-data    # 401 JSON: No user session
curl -i -H 'Authorization: Bearer invalid-test-token' https://tekstura.shop/api/seo-data
                                             # 401 JSON: Bad user session
```

For a full check, sign in at `/admin/seo` and confirm the latest date and query
rows appear. The page's “Синхронизировать сейчас” button uses the second
proxied route. If Vercel is unavailable, the static site stays available but
SEO statistics cannot load until the API is restored.
