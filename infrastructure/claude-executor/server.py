#!/usr/bin/env python3
"""
Claude Code Executor Service
Runs on port 5590. n8n calls this to execute Claude Code headless sessions.
Each call runs `claude -p "<prompt>"` and returns the output.
Uses Diego's $20/month Claude Max subscription — no API costs.

POST /run
{
  "agent": "Backend",           # agent name (used to load Obsidian context)
  "task": "Add X to Y",         # the task instruction
  "context": "...",             # optional extra context from previous agent
  "project": "fintech-app",     # project to work in (default: fintech-app)
  "timeout": 300                # seconds (default 300)
}

Response:
{ "ok": true, "output": "...", "agent": "Backend", "duration": 42.1 }
"""
import json
import os
import subprocess
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = 5590
PROJECT_ROOT = Path.home() / "Projects" / "fintech-app"
OBSIDIAN_ROOT = Path.home() / "Documents" / "Obsidian" / "Jarvis"
CLAUDE_BIN = "/opt/homebrew/bin/claude"


def load_agent_context(agent: str) -> str:
    identity_path = OBSIDIAN_ROOT / "Agents" / agent / "identity.md"
    learnings_path = OBSIDIAN_ROOT / "Agents" / agent / "learnings.md"
    project_status = OBSIDIAN_ROOT / "Vault App" / "status.md"
    project_decisions = OBSIDIAN_ROOT / "Vault App" / "decisions.md"

    parts = []
    for path, label in [
        (identity_path, "AGENT IDENTITY"),
        (learnings_path, "AGENT LEARNINGS (apply these)"),
        (project_status, "PROJECT STATUS"),
        (project_decisions, "PROJECT DECISIONS"),
    ]:
        if path.exists():
            parts.append(f"=== {label} ===\n{path.read_text().strip()}")
    return "\n\n".join(parts)


def append_learning(agent: str, task: str, learning: str):
    path = OBSIDIAN_ROOT / "Agents" / agent / "learnings.md"
    today = time.strftime("%Y-%m-%d")
    entry = f"\n- {today} | {task[:60]} | {learning[:200]}"
    with open(path, "a") as f:
        f.write(entry)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"ok": True, "service": "claude-executor"})
        else:
            self._respond(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path == "/run":
            self._run_agent()
        elif self.path == "/health":
            self._respond(200, {"ok": True, "service": "claude-executor"})
        else:
            self._respond(404, {"ok": False, "error": "not found"})

    def _run_agent(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")

        agent = body.get("agent", "Jarvis")
        task = body.get("task", "")
        extra_context = body.get("context", "")
        project = body.get("project", "fintech-app")
        timeout = body.get("timeout", 300)

        if not task:
            self._respond(400, {"ok": False, "error": "task is required"})
            return

        # Build the full prompt
        agent_context = load_agent_context(agent)
        prompt = f"""You are the {agent} agent in the Jarvis system.

{agent_context}

{"=== CONTEXT FROM PREVIOUS AGENT ===" + chr(10) + extra_context if extra_context else ""}

=== YOUR TASK ===
{task}

=== INSTRUCTIONS ===
1. Complete the task above following your identity and learnings
2. After completing, write a brief summary of: what you changed, what the next agent needs to know, and one learning to save
3. Format your final response as:
   CHANGES: <what you did>
   NEXT_AGENT_CONTEXT: <what the next agent needs to know>
   LEARNING: <one thing you learned from this task>
   STATUS: APPROVED or REJECTED: <reason if rejected>
"""
        project_dir = Path.home() / "Projects" / project

        start = time.time()
        try:
            result = subprocess.run(
                [CLAUDE_BIN, "-p", prompt, "--dangerously-skip-permissions"],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(project_dir)
            )
            duration = round(time.time() - start, 1)
            output = result.stdout.strip()

            # Extract and save learning
            if "LEARNING:" in output:
                for line in output.split("\n"):
                    if line.startswith("LEARNING:"):
                        append_learning(agent, task, line.replace("LEARNING:", "").strip())
                        break

            self._respond(200, {
                "ok": True,
                "agent": agent,
                "output": output,
                "duration": duration,
                "exit_code": result.returncode
            })
        except subprocess.TimeoutExpired:
            self._respond(200, {
                "ok": False,
                "agent": agent,
                "output": f"Timeout after {timeout}s",
                "duration": timeout,
                "exit_code": -1
            })
        except Exception as e:
            self._respond(500, {"ok": False, "error": str(e)})

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
    print(f"Claude Code Executor running on port {PORT}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
