import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class OllamaMockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/":
            self.send_error(404, "Not found")
            return

        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        if self.path != "/api/generate":
            self.send_error(404, "Not found")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(content_length))

        if payload.get("model") != "mistral":
            self.send_error(400, "Unexpected model")
            return

        if not payload.get("prompt"):
            self.send_error(400, "Prompt is required")
            return

        response = {
            "model": "mistral",
            "response": (
                "### Rapport d'Audit\n\n"
                "Site en bon état. Les analyses sont terminées."
            ),
            "done": True,
        }

        body = json.dumps(response).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print("[ollama-mock]", format % args)


if __name__ == "__main__":
    print("Ollama CI mock listening on port 11434")
    HTTPServer(("0.0.0.0", 11434), OllamaMockHandler).serve_forever()
