"""Serve an isolated read-only calculator on a private address."""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import build_opener, ProxyHandler
from urllib.error import URLError


class Preview(SimpleHTTPRequestHandler):
    files = {
        '/calculator.html', '/request.html', '/calculator-stepwise.js',
        '/calculator-stepwise.css', '/calculator-mode.js', '/calculator-preview-pricing.js',
        '/calculator-pricing-store.js', '/stair-configurator.js', '/stair-configurator.css',
        '/stair-geometry-engine.js', '/quantity-engine.js', '/quantity-engine-calculator-adapter.js',
        '/quantity-engine-supabase-runtime.js', '/supabase-config.js', '/lead-tracker.js',
        '/contact-component.css', '/contact-component.js', '/site-unified.css',
        '/styles.css', '/site-unify.css',
    }
    pricing_url = ''
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Robots-Tag', 'noindex')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/content/site.json' or path.startswith('/rest/v1/') and path.rsplit('/', 1)[-1] in {
            'settings', 'stair_defaults', 'stair_material_rules', 'stair_scenario_rates', 'stair_pricing_regions',
            'quantity_engine_settings', 'materials_catalog', 'railing_types'
        }:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{}' if path == '/content/site.json' else b'[]')
            return
        if path == '/rest/v1/stepwise_pricing_settings':
            try:
                with build_opener(ProxyHandler({})).open(
                    self.pricing_url, timeout=4
                ) as response:
                    body = response.read()
            except (URLError, TimeoutError):
                self.send_error(503)
                return
            if 'application/vnd.pgrst.object+json' in self.headers.get('Accept', ''):
                rows = json.loads(body)
                if len(rows) != 1:
                    self.send_error(503)
                    return
                body = json.dumps(rows[0]).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)
            return
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/calculator.html?interface=stepwise')
            self.end_headers()
            return
        allowed_asset = (
            path.startswith('/docs/assets/calculator-preview/')
            and '..' not in path and '%' not in path
            and Path(path).suffix in {'.webp', '.svg'}
        )
        if path not in self.files and not allowed_asset:
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        self.send_error(405)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bind', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--pricing-url', required=True)
    args = parser.parse_args()
    Preview.pricing_url = args.pricing_url
    ThreadingHTTPServer((args.bind, args.port), Preview).serve_forever()
