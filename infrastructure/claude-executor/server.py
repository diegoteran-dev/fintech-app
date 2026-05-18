#!/usr/bin/env python3
"""
Jarvis Executor Service — port 5590
Model routing: OpenCode Go (primary), Gemini (tier 1 free), OpenRouter (fallback).
No Claude API calls in the Discord/iMessage path.
"""
import json
import os
import time
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = 5590
PROJECT_ROOT = Path.home() / "Projects" / "fintech-app"
OBSIDIAN_ROOT = Path.home() / "Documents" / "Obsidian" / "Jarvis"
MEMORY_ROOT = OBSIDIAN_ROOT / "Memory"
CLASSIFIER_URL = "http://127.0.0.1:5595/classify"

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyAJ4KAYa0v7rzHIjB1Uga9NGKVBcVDtFQ0")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
)

OPENCODE_GO_API_KEY = os.environ.get(
    "OPENCODE_GO_API_KEY",
    "sk-EmSbqOPlglday2OVGcnZbaw0xzpjcJdgwY5Gz9uJwdejg81wVZ652x5HWRoH5xbi"
)
OPENCODE_GO_URL = "https://opencode.ai/zen/go/v1/chat/completions"

# Fallback only — used if OpenCode Go is down
OPENROUTER_API_KEY = os.environ.get(
    "OPENROUTER_API_KEY",
    "REDACTED_OPENROUTER_KEY"
)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

TIER_NAMES = {1: "Trivial", 2: "Easy", 3: "Complex", 4: "Deep"}

# Tier → OpenCode Go model
TIER_MODELS = {
    2: "glm-5.1",            # fast, cheap for Q&A and simple tasks
    3: "deepseek-v4-flash",  # stronger reasoning for complex tasks
    4: "deepseek-v4-flash",  # replaces Claude for pipeline/orchestration
}

MODEL_SHORT = {
    "glm-5.1": "GLM-5.1",
    "glm-5": "GLM-5",
    "deepseek-v4-flash": "DeepSeek V4 Flash",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
    "kimi-k2.6": "Kimi K2.6",
    "kimi-k2.5": "Kimi K2.5",
    "qwen3.5-plus": "Qwen3.5+",
    "qwen3.6-plus": "Qwen3.6+",
    "gemini-2.0-flash": "Gemini Flash",
    "moonshotai/kimi-k2.6": "Kimi K2.6 (OR)",
}

LANG_INSTRUCTION = {
    "es": "IMPORTANTE: Responde siempre en español en esta conversación.",
    "en": "",
    "other": "Respond in the same language as the user's message.",
}

JARVIS_PERSONA = """You are Jarvis, Diego's personal AI assistant.
Diego is a CS student from Bolivia building a fintech app called Arca.
You are concise, direct, and helpful. Never explain your internals.
Never say things like "I received a task" or reference system mechanics.
Just respond naturally as a helpful assistant."""

ERROR_LOG = Path("/tmp/jarvis-errors.log")


def _log_error(context: str, error: str):
    entry = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {context}: {error}\n"
    try:
        with open(ERROR_LOG, "a") as f:
            f.write(entry)
    except Exception:
        pass
    print(entry.strip(), flush=True)


# ── Gemini response (Tier 1 — free) ──────────────────────────────────────────

def gemini_respond(task: str, language: str = "en", agent: str = "Jarvis") -> str | None:
    lang_hint = LANG_INSTRUCTION.get(language, "")
    prompt = (
        f"{JARVIS_PERSONA}\n"
        f"{'You are the ' + agent + ' agent. ' if agent != 'Jarvis' else ''}"
        f"{lang_hint}\n\nUser message: {task}"
    )
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 400},
    }).encode()
    try:
        req = urllib.request.Request(
            GEMINI_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read())
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        _log_error("gemini_respond", str(e))
        return None


# ── OpenCode Go response (primary for all tiers) ──────────────────────────────

def opencode_go_respond(task: str, model: str, agent: str, language: str,
                        agent_ctx: str = "", memory_ctx: str = "") -> str | None:
    lang_hint = LANG_INSTRUCTION.get(language, LANG_INSTRUCTION["other"])
    system = (
        f"You are {agent}, an AI agent in the Jarvis system built by Diego Teran.\n"
        f"You are NOT Claude. You are NOT made by Anthropic. Never claim to be Claude or any other model.\n"
        f"If asked about your model or identity, say you are {agent} running on the Jarvis system.\n"
        f"Diego is a CS student from Bolivia building Arca, a fintech app for Latin America.\n"
        f"Be concise, direct, and helpful. Never reference system internals.\n"
        f"{lang_hint}"
    )
    if agent_ctx:
        system += f"\n\n{agent_ctx}"
    if memory_ctx:
        system += f"\n\n{memory_ctx}"

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": task},
        ],
        "max_tokens": 1500,
        "temperature": 0.7,
    }).encode()

    try:
        req = urllib.request.Request(
            OPENCODE_GO_URL, data=payload,
            headers={
                "Authorization": f"Bearer {OPENCODE_GO_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "Jarvis/1.0",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        _log_error(f"opencode_go_respond ({model})", str(e))
        return None


# ── OpenRouter fallback (only if OpenCode Go fails) ───────────────────────────

def openrouter_respond(task: str, model: str, agent: str, language: str,
                       agent_ctx: str = "", memory_ctx: str = "") -> str | None:
    lang_hint = LANG_INSTRUCTION.get(language, LANG_INSTRUCTION["other"])
    system = (
        f"You are {agent}, an AI agent in the Jarvis system built by Diego Teran.\n"
        f"You are NOT Claude. You are NOT made by Anthropic. Never claim to be Claude or any other model.\n"
        f"If asked about your model or identity, say you are {agent} running on the Jarvis system.\n"
        f"Diego is a CS student from Bolivia building Arca, a fintech app for Latin America.\n"
        f"Be concise, direct, and helpful. Never reference system internals.\n"
        f"{lang_hint}"
    )
    if agent_ctx:
        system += f"\n\n{agent_ctx}"
    if memory_ctx:
        system += f"\n\n{memory_ctx}"

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": task},
        ],
        "max_tokens": 1000,
        "temperature": 0.7,
    }).encode()

    try:
        req = urllib.request.Request(
            OPENROUTER_URL, data=payload,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "Jarvis/1.0",
                "HTTP-Referer": "https://vault-api.fly.dev",
                "X-Title": "Jarvis",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        _log_error(f"openrouter_respond ({model})", str(e))
        return None


# ── Memory helpers ────────────────────────────────────────────────────────────

def _agent_memory_dir(agent: str) -> Path:
    return MEMORY_ROOT / agent


def get_memory_context(agent: str, tier: int) -> str:
    if tier == 1:
        return ""
    now = datetime.now()
    month_key = now.strftime("%Y-%m")
    today_key = now.strftime("%Y-%m-%d")
    base = _agent_memory_dir(agent)
    parts = []

    summary_file = base / month_key / f"{month_key}-summary.md"
    if summary_file.exists():
        content = summary_file.read_text().strip()
        if content:
            parts.append(f"=== PAST CONTEXT ({month_key}) ===\n{content[-2000:]}")

    daily_file = base / month_key / "daily" / f"{today_key}.md"
    if daily_file.exists():
        content = daily_file.read_text().strip()
        if content:
            entries = content.split("---\n")[-6:]
            parts.append(f"=== TODAY'S CONTEXT ===\n{'---'.join(entries)[-1500:]}")

    return "\n\n".join(parts) + "\n\n" if parts else ""


def log_interaction(agent: str, task: str, output: str, model: str,
                    tier: int, language: str, channel: str, sender: str, duration: float):
    now = datetime.now()
    month_key = now.strftime("%Y-%m")
    today_key = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M")

    daily_dir = _agent_memory_dir(agent) / month_key / "daily"
    daily_dir.mkdir(parents=True, exist_ok=True)
    daily_file = daily_dir / f"{today_key}.md"

    if not daily_file.exists():
        daily_file.write_text(f"# {today_key} — {agent}\n\n")

    model_label = MODEL_SHORT.get(model, model)
    entry = (
        f"## [{time_str}] Tier {tier} ({TIER_NAMES.get(tier,'?')}) · "
        f"{model_label} · {channel}\n"
        f"**From**: {sender}\n"
        f"**Message**: {task[:400]}\n"
        f"**Response**: {output[:600]}\n"
        f"**Duration**: {duration}s\n"
        f"---\n\n"
    )
    with open(daily_file, "a") as f:
        f.write(entry)


def consolidate_agent(agent: str) -> dict:
    now = datetime.now()
    month_key = now.strftime("%Y-%m")
    today_key = now.strftime("%Y-%m-%d")
    base = _agent_memory_dir(agent)
    daily_file = base / month_key / "daily" / f"{today_key}.md"

    if not daily_file.exists():
        return {"agent": agent, "skipped": True}
    content = daily_file.read_text().strip()
    if not content or content == f"# {today_key} — {agent}":
        return {"agent": agent, "skipped": True}

    prompt = (
        f"Summarise these AI assistant interactions for agent '{agent}' on {today_key}. "
        f"Write max 200 words capturing: topics discussed, tasks completed, key decisions. "
        f"Be technical. Third person.\n\n{content[:4000]}"
    )
    try:
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300},
        }).encode()
        req = urllib.request.Request(GEMINI_URL, data=payload,
                                      headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        summary = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        summary = f"[Summary failed: {e}]"

    summary_file = base / month_key / f"{month_key}-summary.md"
    if not summary_file.exists():
        summary_file.write_text(f"# {agent} Memory — {month_key}\n\n")
    with open(summary_file, "a") as f:
        f.write(f"\n## {today_key}\n{summary}\n")

    return {"agent": agent, "skipped": False, "summary_length": len(summary)}


# ── Agent context ─────────────────────────────────────────────────────────────

def load_agent_context(agent: str, tier: int) -> str:
    identity_path = OBSIDIAN_ROOT / "Agents" / agent / "identity.md"
    learnings_path = OBSIDIAN_ROOT / "Agents" / agent / "learnings.md"
    project_status = OBSIDIAN_ROOT / "Arca App" / "status.md"
    project_decisions = OBSIDIAN_ROOT / "Arca App" / "decisions.md"

    parts = []
    if identity_path.exists():
        parts.append(f"=== AGENT IDENTITY ===\n{identity_path.read_text().strip()}")

    if tier >= 2:
        for path, label in [
            (learnings_path, "AGENT LEARNINGS"),
            (project_status, "PROJECT STATUS"),
            (project_decisions, "PROJECT DECISIONS"),
        ]:
            if path.exists():
                parts.append(f"=== {label} ===\n{path.read_text().strip()[:1500]}")

    return "\n\n".join(parts)


def append_learning(agent: str, task: str, learning: str):
    path = OBSIDIAN_ROOT / "Agents" / agent / "learnings.md"
    today = time.strftime("%Y-%m-%d")
    entry = f"\n- {today} | {task[:60]} | {learning[:200]}"
    try:
        with open(path, "a") as f:
            f.write(entry)
    except Exception:
        pass


# ── Classifier ────────────────────────────────────────────────────────────────

def classify_message(task: str) -> dict:
    task_lower = task.strip().lower()
    trivial_starters = ("hi", "hello", "hey", "hola", "good morning", "buenos dias",
                        "good night", "buenas", "thanks", "gracias", "ok", "okay",
                        "sure", "claro", "yes", "no", "si", "👍", "👋")
    if len(task) < 25 or task_lower in trivial_starters or task_lower.startswith(trivial_starters):
        return {"tier": 1, "language": "es" if any(w in task_lower for w in
                ("hola","gracias","buenas","buenos")) else "en",
                "timeout": 30, "fallback_used": False}

    try:
        payload = json.dumps({"message": task}).encode()
        req = urllib.request.Request(
            CLASSIFIER_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception:
        tier = 1 if len(task) < 50 else 2
        return {"tier": tier, "language": "en",
                "timeout": 30 if tier == 1 else 60, "fallback_used": True}


# ── HTTP Handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"ok": True, "service": "jarvis-executor", "port": PORT})
        else:
            self._respond(404, {"ok": False})

    def do_POST(self):
        if self.path == "/run":
            self._run_agent()
        elif self.path == "/consolidate":
            self._consolidate()
        elif self.path == "/health":
            self._respond(200, {"ok": True})
        else:
            self._respond(404, {"ok": False, "error": "not found"})

    def _run_agent(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")

        agent         = body.get("agent", "Jarvis")
        task          = body.get("task", "")
        extra_ctx     = body.get("context", "")
        project       = body.get("project", "fintech-app")
        channel       = body.get("channel", "unknown")
        sender        = body.get("sender", "unknown")
        model_override = body.get("model")

        if not task:
            self._respond(400, {"ok": False, "error": "task is required"})
            return

        # ── Classify ─────────────────────────────────────────────────────────
        if model_override:
            model    = model_override
            language = body.get("language", "en")
            tier     = 4
            timeout  = body.get("timeout", 180)
        else:
            clf      = classify_message(task)
            language = body.get("language") or clf.get("language", "en")
            tier     = clf["tier"]
            timeout  = body.get("timeout") or clf.get("timeout", 60)
            model    = TIER_MODELS.get(tier, "glm-5.1")

        print(f"[{agent}] tier={tier} model={MODEL_SHORT.get(model,model)} "
              f"lang={language} channel={channel}", flush=True)

        # ── Tier 1: Gemini (free) with OpenCode Go fallback ───────────────────
        if tier == 1:
            start  = time.time()
            output = gemini_respond(task, language, agent)
            if output:
                self._respond(200, {
                    "ok": True, "agent": agent, "output": output,
                    "duration": round(time.time() - start, 1),
                    "tier": tier, "model": "gemini-2.0-flash", "language": language,
                })
                return

            # Gemini failed → OpenCode Go glm-5.1
            output = opencode_go_respond(task, "glm-5.1", agent, language)
            duration = round(time.time() - start, 1)
            if not output:
                output = "Hey Diego."
            self._respond(200, {
                "ok": True, "agent": agent, "output": output,
                "duration": duration, "tier": tier,
                "model": "glm-5.1", "language": language,
            })
            return

        # ── Load context for tiers 2+ ─────────────────────────────────────────
        agent_ctx  = load_agent_context(agent, tier)
        memory_ctx = get_memory_context(agent, tier)

        # ── Tiers 2-3: OpenCode Go primary, OpenRouter fallback ───────────────
        if tier in (2, 3):
            start  = time.time()
            output = opencode_go_respond(task, model, agent, language, agent_ctx, memory_ctx)

            if not output:
                # Fallback to OpenRouter with kimi-k2.6
                _log_error(f"tier {tier} primary failed", "falling back to OpenRouter")
                output = openrouter_respond(task, "moonshotai/kimi-k2.6", agent, language,
                                            agent_ctx, memory_ctx)

            duration = round(time.time() - start, 1)
            if not output:
                output = "Something went wrong — please try again."

            noisy = any(k in task.lower() for k in
                        ("arca api down", "check fly.io", "system alert", "health check"))
            if len(output) > 20 and not noisy:
                log_interaction(agent, task, output, model, tier, language,
                                channel, sender, duration)

            self._respond(200, {
                "ok": True, "agent": agent, "output": output,
                "duration": duration, "tier": tier, "model": model, "language": language,
            })
            return

        # ── Tier 4: OpenCode Go deepseek-v4-flash (pipeline / orchestration) ──
        lang_hint = LANG_INSTRUCTION.get(language, LANG_INSTRUCTION["other"])
        user_parts = []
        if extra_ctx:
            user_parts.append(f"=== CONTEXT FROM PREVIOUS AGENT ===\n{extra_ctx}")
        user_parts.append(f"=== YOUR TASK ===\n{task}")
        if lang_hint:
            user_parts.append(lang_hint)
        user_parts.append(
            "=== RESPONSE FORMAT ===\n"
            "Complete the task concisely. At the end add (on new lines):\n"
            "CHANGES: <what you did>\nNEXT_AGENT_CONTEXT: <handoff notes>\n"
            "LEARNING: <one insight>\nSTATUS: APPROVED or REJECTED: <reason>"
        )
        full_task = "\n\n".join(user_parts)

        start  = time.time()
        output = opencode_go_respond(full_task, model, agent, language, agent_ctx, memory_ctx)

        if not output:
            _log_error(f"tier 4 primary failed", "falling back to OpenRouter")
            output = openrouter_respond(full_task, "moonshotai/kimi-k2.6", agent, language,
                                        agent_ctx, memory_ctx)

        duration = round(time.time() - start, 1)
        if not output:
            self._respond(200, {
                "ok": False, "agent": agent,
                "output": "Both providers failed — please try again.",
                "duration": duration, "tier": tier, "model": model, "language": language,
            })
            return

        if "LEARNING:" in output:
            for line in output.split("\n"):
                if line.startswith("LEARNING:"):
                    append_learning(agent, task, line.replace("LEARNING:", "").strip())
                    break

        meta_keys = ("CHANGES:", "NEXT_AGENT_CONTEXT:", "LEARNING:", "STATUS:")
        clean_lines = [
            l for l in output.split("\n")
            if not any(l.strip().startswith(k) for k in meta_keys) and l.strip() != "---"
        ]
        while clean_lines and not clean_lines[-1].strip():
            clean_lines.pop()
        clean_output = "\n".join(clean_lines).strip()

        noisy = any(k in task.lower() for k in
                    ("arca api down", "check fly.io", "system alert", "health check"))
        if len(clean_output) > 20 and not noisy:
            log_interaction(agent, task, clean_output, model, tier, language,
                            channel, sender, duration)

        self._respond(200, {
            "ok": True, "agent": agent, "output": clean_output,
            "duration": duration, "tier": tier, "model": model, "language": language,
        })

    def _consolidate(self):
        agents = [
            "Jarvis", "CTO", "Backend", "Frontend", "DevOps",
            "Tester", "Designer", "PersonalManager", "SystemsAdmin",
        ]
        results = []
        for agent in agents:
            try:
                r = consolidate_agent(agent)
                results.append(r)
                if not r.get("skipped"):
                    print(f"[consolidate] {agent}: done", flush=True)
            except Exception as e:
                results.append({"agent": agent, "error": str(e)})

        processed = [r for r in results if not r.get("skipped")]
        self._respond(200, {"ok": True, "processed": len(processed), "results": results})

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
    print(f"Jarvis Executor running on port {PORT}", flush=True)
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
