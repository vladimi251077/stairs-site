"""Serve an isolated read-only calculator on a private address."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import build_opener, ProxyHandler


class Preview(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Robots-Tag', 'noindex')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/rest/v1/stepwise_pricing_settings':
            with build_opener(ProxyHandler({})).open(
                'http://127.0.0.1:18771/stepwise_pricing_settings?id=eq.1', timeout=4
            ) as response:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response.read())
            return
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/calculator.html?interface=stepwise')
            self.end_headers()
            return
        if path != '/favicon.ico' and not Path(self.translate_path(self.path)).is_file():
            self.send_error(404)
            return
        super().do_GET()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bind', required=True)
    parser.add_argument('--port', type=int, required=True)
    args = parser.parse_args()
    ThreadingHTTPServer((args.bind, args.port), Preview).serve_forever()
