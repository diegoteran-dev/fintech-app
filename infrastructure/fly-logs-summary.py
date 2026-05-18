#!/usr/bin/env python3
"""Morning Fly.io status summary → iMessage.

Checks vault-api health, deployment status, and recent deployments,
then sends a concise report via iMessage (BlueBubbles with osascript fallback).

Runs on schedule via launchd (weekdays at 9am).
"""

import subprocess
import json
import re
import sys
from datetime import datetime, timezone

APP = "vault-api"
API_URL = "https://vault-api.fly.dev"
WEB_URL = "https://vault-by-diego.vercel.app"
IMESSAGE_TARGET = "diego.teran.a@gmail.com"
BLUEBUBBLES_URL = "http://localhost:1234/api/v1"
BLUEBUBBLES_PASSWORD = "Arca2026bb"

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def run(cmd, timeout=30):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def http_get(url, timeout=10):
    result = run(["curl", "-s", "-w", "\n%{http_code}", "-o", "-", "--max-time", str(timeout), url])
    if result.returncode != 0:
        return None, None
    parts = result.stdout.rsplit("\n", 1)
    body = parts[0] if len(parts) > 1 else ""
    code = parts[1].strip() if len(parts) > 1 else "000"
    return body, code


def check_api_health():
    body, code = http_get(f"{API_URL}/api/health", timeout=10)
    if code == "200":
        try:
            data = json.loads(body)
            return True, data.get("status", "ok")
        except json.JSONDecodeError:
            return True, "ok"
    return False, f"HTTP {code}"


def check_web_health():
    body, code = http_get(f"{WEB_URL}/api/health", timeout=10)
    return code == "200"


def get_deploy_status():
    result = run(["flyctl", "status", "--app", APP], timeout=15)
    if result.returncode != 0:
        return None, result.stderr.strip()
    return result.stdout, None


def get_recent_releases():
    result = run(["flyctl", "releases", "--app", APP, "--json"], timeout=15)
    if result.returncode != 0:
        return [], result.stderr.strip()
    try:
        releases = json.loads(result.stdout)
        return releases[:3], None
    except json.JSONDecodeError:
        return [], "json parse error"


def parse_machine_info(output):
    clean = ANSI_RE.sub("", output)
    info = {}
    for line in clean.split("\n"):
        line = line.strip()
        if "│" not in line or "PROCESS" in line:
            continue
        parts = [p.strip() for p in line.split("│")]
        if len(parts) >= 6 and parts[0] == "app":
            info["id"] = parts[1][:12] + "..." if len(parts[1]) > 12 else parts[1]
            info["version"] = parts[2]
            info["region"] = parts[3]
            info["state"] = parts[4]
            info["checks"] = parts[6] if len(parts) > 6 else "?"
    return info


def build_message(api_ok, api_detail, web_ok, machine_info, releases):
    now = datetime.now().strftime("%a %H:%M")
    parts = [f"☁️ Arca — {now}"]
    parts.append(f"API: {'✅' if api_ok else '🔴'} {api_detail}")
    parts.append(f"Web: {'✅ online' if web_ok else '🔴 DOWN'}")

    if machine_info:
        st = machine_info.get("state", "?")
        reg = machine_info.get("region", "?")
        ver = machine_info.get("version", "?")
        chk = machine_info.get("checks", "?")
        parts.append(f"Machine: {st} | {reg} | v{ver} | checks: {chk}")

    if releases and isinstance(releases, list):
        for r in releases[:2]:
            desc = r.get("Description", r.get("reason", "?"))
            when = r.get("CreatedAt", r.get("created_at", "?"))
            if when and when != "?":
                when = when[:10]
            parts.append(f"Deploy: {desc} ({when})")

    return "\n".join(parts)


def send_via_bluebubbles(message):
    import uuid
    payload = {
        "chatGuid": f"any;-;{IMESSAGE_TARGET}",
        "tempGuid": f"temp-{uuid.uuid4()}",
        "message": message,
    }
    try:
        resp = run([
            "curl", "-s", "-X", "POST",
            f"{BLUEBUBBLES_URL}/message/text?password={BLUEBUBBLES_PASSWORD}",
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload),
        ], timeout=10)
        if resp.returncode == 0:
            data = json.loads(resp.stdout)
            if data.get("status") == 200:
                return True, "BlueBubbles"
    except Exception:
        pass
    return False, None


def send_via_osascript(message):
    escaped = message.replace("\\", "\\\\").replace('"', '\\"')
    script = (
        'tell application "Messages"\n'
        '    set targetService to 1st service whose service type = iMessage\n'
        f'    send "{escaped}" to buddy "{IMESSAGE_TARGET}" of targetService\n'
        'end tell'
    )
    try:
        result = run(["osascript", "-e", script], timeout=15)
        return result.returncode == 0
    except Exception:
        return False


def main():
    print(f"[fly-summary] {datetime.now(timezone.utc).isoformat()}")

    health_ok, health_detail = check_api_health()
    web_ok = check_web_health()

    status_out, _ = get_deploy_status()
    machine_info = parse_machine_info(status_out) if status_out else {}

    releases, _ = get_recent_releases()

    message = build_message(health_ok, health_detail, web_ok, machine_info, releases)
    print(message)
    print("---")

    ok, method = send_via_bluebubbles(message)
    if ok:
        print(f"[fly-summary] sent via {method}")
    elif send_via_osascript(message):
        print("[fly-summary] sent via osascript (fallback)")
    else:
        print("[fly-summary] FAILED — both iMessage methods down")
        sys.exit(1)


if __name__ == "__main__":
    main()
