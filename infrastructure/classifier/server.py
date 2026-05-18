#!/usr/bin/env python3
"""
Jarvis Message Classifier — port 5595
Determines message complexity tier and language using Gemini Flash.
Falls back to Haiku 4.5 if Gemini is unavailable (notifies caller).

POST /classify  { "message": "..." }
→ { "tier": 1-4, "model": "...", "language": "en|es|other",
    "timeout": 30-300, "fallback_used": false }
"""
import json
import os
import subprocess
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 5595
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyAJ4KAYa0v7rzHIjB1Uga9NGKVBcVDtFQ0")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
)
CLAUDE_BIN = "/opt/homebrew/bin/claude"

MODEL_MAP = {
    1: "claude-haiku-4-5-20251001",
    2: "claude-sonnet-4-6",
    3: "claude-sonnet-4-6",
    4: "claude-opus-4-7",
}
TIMEOUT_MAP = {1: 30, 2: 60, 3: 180, 4: 300}

CLASSIFY_PROMPT = """You are a message complexity classifier for an AI assistant called Jarvis.
Classify the message below into one of these tiers and detect its language.

Tiers:
1 (trivial)  — greetings, "hi/hello/how are you", "what's your name", yes/no, small talk
2 (easy)     — questions needing brief reasoning, status checks, short explanations, simple requests
3 (complex)  — multi-step tasks, writing/reviewing code, analysis, creating content, debugging, planning
4 (max)      — ONLY if the message explicitly says "use opus" or "use opus 4.7"

Language codes: "en" (English), "es" (Spanish), "other"

Message: "{message}"

Reply with ONLY valid JSON, no explanation:
{{"tier": <1-4>, "language": "<en|es|other>"}}"""


def classify_with_gemini(message: str) -> dict:
    prompt = CLASSIFY_PROMPT.format(message=message.replace('"', "'")[:500])
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 60},
    }).encode()
    req = urllib.request.Request(
        GEMINI_URL, data=payload,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=8) as r:
        data = json.loads(r.read())
    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    start, end = text.find("{"), text.rfind("}") + 1
    return json.loads(text[start:end])


def classify_with_haiku(message: str) -> dict:
    prompt = (
        f'Classify this message for an AI assistant. Reply ONLY with JSON like {{"tier":2,"language":"en"}}.\n'
        f'Tiers: 1=trivial greeting/small-talk, 2=easy question, 3=complex multi-step task, '
        f'4=ONLY if message says "use opus". Language: en/es/other.\n'
        f'Message: "{message[:300]}"'
    )
    result = subprocess.run(
        [CLAUDE_BIN, "--model", "claude-haiku-4-5-20251001", "-p", prompt,
         "--dangerously-skip-permissions"],
        capture_output=True, text=True, timeout=20
    )
    text = result.stdout.strip()
    start, end = text.find("{"), text.rfind("}") + 1
    return json.loads(text[start:end])


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"ok": True, "service": "classifier"})
        else:
            self._respond(404, {})

    def do_POST(self):
        if self.path == "/classify":
            self._classify()
        else:
            self._respond(404, {"error": "not found"})

    def _classify(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        message = body.get("message", "").strip()

        if not message:
            self._respond(400, {"error": "message required"})
            return

        # Fast pre-check for explicit opus request
        msg_lower = message.lower()
        if "use opus" in msg_lower or "opus 4.7" in msg_lower:
            self._respond(200, {
                "tier": 4, "model": MODEL_MAP[4],
                "language": "en", "timeout": TIMEOUT_MAP[4],
                "fallback_used": False,
            })
            return

        fallback_used = False
        result = None

        try:
            result = classify_with_gemini(message)
        except Exception as e:
            print(f"Gemini failed ({e}), trying Haiku fallback", flush=True)
            fallback_used = True
            try:
                result = classify_with_haiku(message)
            except Exception as e2:
                print(f"Haiku fallback also failed ({e2}), using safe default", flush=True)
                result = {"tier": 2, "language": "en"}

        tier = max(1, min(4, int(result.get("tier", 2))))
        language = result.get("language", "en")

        self._respond(200, {
            "tier": tier,
            "model": MODEL_MAP[tier],
            "language": language,
            "timeout": TIMEOUT_MAP[tier],
            "fallback_used": fallback_used,
        })

    def _respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"Classifier running on port {PORT}", flush=True)
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
