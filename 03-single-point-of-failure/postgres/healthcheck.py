from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result = subprocess.run(
                ["psql", "-h", "localhost", "-U", "admin", "-d", "ecommerce",
                 "-tAc", "SELECT pg_is_in_recovery();"],
                capture_output=True, text=True, timeout=2
            )
            if result.stdout.strip() == "f":
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"primary")
            else:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"replica")
        except Exception:
            self.send_response(503)
            self.end_headers()
            self.wfile.write(b"down")

    def log_message(self, format, *args):
        pass

import socket

class DualStackHTTPServer(HTTPServer):
    address_family = socket.AF_INET6
    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

DualStackHTTPServer(("::", 8008), Handler).serve_forever()
