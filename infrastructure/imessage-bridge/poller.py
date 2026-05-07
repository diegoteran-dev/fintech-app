#!/usr/bin/env python3
"""
iMessage Poller — watches chat.db for new messages and forwards to n8n.
Replaces BlueBubbles webhooks. Needs Full Disk Access for Terminal.
Runs every 3 seconds, tracks last-seen message ID to avoid duplicates.
"""
import json
import os
import sqlite3
import time
import urllib.request
from pathlib import Path

DB_PATH = Path.home() / "Library/Messages/chat.db"
N8N_WEBHOOK = "http://localhost:5678/webhook/imessage-inbound"
STATE_FILE = Path("/tmp/imessage-poller-state.json")
POLL_INTERVAL = 3  # seconds

SELF_ADDRESSES = {"diego.teran.a@gmail.com"}


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"last_rowid": 0}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state))


def get_new_messages(last_rowid: int) -> list:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("""
            SELECT m.rowid, m.text, m.is_from_me,
                   h.id as sender,
                   datetime(m.date/1000000000 + strftime('%s','2001-01-01'),
                            'unixepoch','localtime') as ts,
                   c.chat_identifier
            FROM message m
            LEFT JOIN handle h ON m.handle_id = h.rowid
            LEFT JOIN chat_message_join cmj ON m.rowid = cmj.message_id
            LEFT JOIN chat c ON cmj.chat_id = c.rowid
            WHERE m.rowid > ?
              AND m.text IS NOT NULL
              AND m.text != ''
              AND m.is_from_me = 0
            ORDER BY m.rowid ASC
            LIMIT 10
        """, (last_rowid,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def forward_to_n8n(msg: dict):
    payload = json.dumps({
        "type": "new-message",
        "data": {
            "text": msg["text"],
            "isFromMe": False,
            "timestamp": msg["ts"],
            "handle": {
                "address": msg.get("sender") or msg.get("chat_identifier", ""),
                "service": "iMessage"
            },
            "chats": [{
                "chatIdentifier": msg.get("chat_identifier", ""),
                "guid": f"iMessage;-;{msg.get('chat_identifier','')}"
            }]
        }
    }).encode()

    req = urllib.request.Request(
        N8N_WEBHOOK,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status == 200
    except Exception as e:
        print(f"Forward error: {e}", flush=True)
        return False


def main():
    print(f"iMessage poller started — watching {DB_PATH}", flush=True)

    # On first run, set last_rowid to current max (don't replay history)
    state = load_state()
    if state["last_rowid"] == 0:
        try:
            conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
            row = conn.execute("SELECT MAX(rowid) FROM message").fetchone()
            conn.close()
            state["last_rowid"] = row[0] or 0
            save_state(state)
            print(f"Starting from message rowid {state['last_rowid']}", flush=True)
        except Exception as e:
            print(f"DB not accessible yet: {e}", flush=True)

    while True:
        try:
            messages = get_new_messages(state["last_rowid"])
            for msg in messages:
                print(f"New message: {msg['text'][:60]} (from {msg.get('sender','?')})", flush=True)
                forward_to_n8n(msg)
                state["last_rowid"] = max(state["last_rowid"], msg["rowid"])
            if messages:
                save_state(state)
        except sqlite3.OperationalError as e:
            if "unable to open" in str(e):
                print("Waiting for Full Disk Access...", flush=True)
        except Exception as e:
            print(f"Poll error: {e}", flush=True)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
