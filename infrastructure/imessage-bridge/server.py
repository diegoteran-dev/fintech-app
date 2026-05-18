#!/usr/bin/env python3
"""
iMessage Bridge Server
Receives POST /send { "message": "..." } and sends via Messages.app using osascript.
Runs on port 5580. n8n calls it via http://host.docker.internal:5580/send
"""
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

RECIPIENT = "+59178511766"
PORT = 5580

SCRIPT = '''tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "{to}" of targetService
    send "{msg}" to targetBuddy
end tell'''


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/send":
            self._respond(404, {"ok": False, "error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        message = body.get("message", "").replace('"', "'").replace("\n", "\\n")
        recipient = body.get("to", RECIPIENT)
        script = SCRIPT.format(to=recipient, msg=message)
        result = subprocess.run(["osascript", "-e", script],
                                capture_output=True, text=True)
        if result.returncode == 0:
            self._respond(200, {"ok": True, "sent": message[:60]})
        else:
            self._respond(500, {"ok": False, "error": result.stderr.strip()})

    def _respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence access logs


if __name__ == "__main__":
    print(f"iMessage bridge running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
