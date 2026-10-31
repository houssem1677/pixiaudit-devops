import json
from http.server import BaseHTTPRequestHandler, HTTPServer


REPORT = {
    "categories": {
        "performance": {"score": 0.90}
    },
    "audits": {
        "server-response-time": {"numericValue": 300},
        "largest-contentful-paint": {"numericValue": 1800},
        "cumulative-layout-shift": {"numericValue": 0.05},
    },
}


class LighthouseMockHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "status": "ok",
                "service": "lighthouse",
            })
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/audit":
            self.send_json(404, {"error": "Not found"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(content_length))

        url = payload.get("url")
        strategy = payload.get("strategy", "mobile")

        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            self.send_json(400, {"error": "Invalid URL"})
            return

        if strategy not in ("mobile", "desktop"):
            self.send_json(400, {"error": "Invalid strategy"})
            return

        self.send_json(200, REPORT)

    def log_message(self, format, *args):
        print("[lighthouse-mock]", format % args)


if __name__ == "__main__":
    print("Lighthouse CI mock listening on port 8003")
    HTTPServer(("0.0.0.0", 8003), LighthouseMockHandler).serve_forever()
