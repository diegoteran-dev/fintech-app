#!/usr/bin/env python3
"""
iMessage Poller — watches chat.db for new messages and forwards to n8n.
Handles both text messages and voice memo attachments (Whisper transcription).
Needs Full Disk Access for Terminal/Python.
"""
import json
import os
import sqlite3
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

DB_PATH = Path.home() / "Library/Messages/chat.db"
N8N_WEBHOOK = "http://localhost:5678/webhook/imessage-inbound"
STATE_FILE = Path("/tmp/imessage-poller-state.json")
POLL_INTERVAL = 3

AUDIO_MIME_TYPES = {"audio/x-caf", "audio/mp4", "audio/aac", "audio/mpeg",
                    "audio/x-m4a", "audio/3gpp", "audio/amr"}
WHISPER_MODEL = "base"  # fast, accurate enough for Spanish+English


def extract_apple_transcription(attributed_body: bytes) -> str | None:
    """
    Extract Apple's on-device voice memo transcription from attributedBody.
    Apple stores this as 'IMAudioTranscription<text>' in the binary blob.
    Much faster than Whisper — already done by the OS.
    """
    if not attributed_body:
        return None
    try:
        # Decode as latin-1 to preserve all byte values
        body = attributed_body.decode("latin-1", errors="replace")
        marker = "IMAudioTranscription"
        idx = body.find(marker)
        if idx == -1:
            return None
        # Text follows immediately after the marker (skip 1 byte separator)
        after = body[idx + len(marker) + 1:]
        # Collect printable ASCII chars until we hit binary data
        text = ""
        for ch in after:
            code = ord(ch)
            if 0x20 <= code < 0x80:
                text += ch
            elif text:
                break
        text = text.strip()
        return text if len(text) > 1 else None
    except Exception:
        return None


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"last_rowid": 0}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state))


def get_new_messages(last_rowid: int) -> list:
    """
    Return new messages to process:
    - Text messages received from other devices (is_from_me=0)
    - Audio attachment messages from ANY source (inc. Mac voice memos, is_from_me=1)
      The bridge only ever sends plain text, so audio + is_from_me=1 = Diego's voice memo
    """
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("""
            SELECT m.rowid as rowid, m.text, m.is_from_me,
                   m.cache_has_attachments, m.attributedBody,
                   h.id as sender,
                   datetime(m.date/1000000000 + strftime('%s','2001-01-01'),
                            'unixepoch','localtime') as ts,
                   c.chat_identifier
            FROM message m
            LEFT JOIN handle h ON m.handle_id = h.rowid
            LEFT JOIN chat_message_join cmj ON m.rowid = cmj.message_id
            LEFT JOIN chat c ON cmj.chat_id = c.rowid
            WHERE m.rowid > ?
              AND (
                (m.is_from_me = 0 AND m.text IS NOT NULL AND m.text != ''
                 AND m.text != char(65532))
                OR m.cache_has_attachments = 1
              )
            ORDER BY m.rowid ASC
            LIMIT 10
        """, (last_rowid,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_audio_attachment(message_rowid: int) -> dict | None:
    """Return the first audio attachment for a message, or None."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    try:
        row = conn.execute("""
            SELECT a.filename, a.mime_type, a.transfer_name
            FROM attachment a
            JOIN message_attachment_join maj ON a.rowid = maj.attachment_id
            WHERE maj.message_id = ?
              AND (a.mime_type LIKE 'audio%' OR a.transfer_name LIKE '%.caf'
                   OR a.transfer_name LIKE '%.m4a' OR a.transfer_name LIKE '%.aac')
            LIMIT 1
        """, (message_rowid,)).fetchone()
        if row:
            return {"filename": row[0], "mime_type": row[1], "transfer_name": row[2]}
        return None
    finally:
        conn.close()


def resolve_attachment_path(filename: str) -> Path | None:
    """Resolve the attachment file path, expanding ~ and handling relative paths."""
    if not filename:
        return None
    p = Path(filename.replace("~", str(Path.home())))
    if p.exists():
        return p
    # Try within Library/Messages/
    alt = Path.home() / "Library" / "Messages" / filename.lstrip("/")
    if alt.exists():
        return alt
    return None


def transcribe_audio(file_path: Path) -> dict:
    """
    Run Whisper on the audio file.
    Returns {"text": "...", "language": "en|es|..."}
    """
    try:
        # Convert .caf to .wav first if needed (Whisper prefers wav/mp3)
        work_path = file_path
        tmp_wav = None
        if file_path.suffix.lower() in (".caf", ".m4a", ".aac", ".3gp", ".amr"):
            tmp_wav = tempfile.mktemp(suffix=".wav")
            ffmpeg = subprocess.run(
                ["ffmpeg", "-i", str(file_path), "-ar", "16000", "-ac", "1", tmp_wav, "-y"],
                capture_output=True, timeout=30
            )
            if ffmpeg.returncode == 0:
                work_path = Path(tmp_wav)

        result = subprocess.run(
            ["/opt/homebrew/bin/python3", "-m", "whisper",
             str(work_path), "--model", WHISPER_MODEL,
             "--output_format", "json", "--output_dir", "/tmp",
             "--fp16", "False"],
            capture_output=True, text=True, timeout=60
        )

        # Clean up temp wav
        if tmp_wav and Path(tmp_wav).exists():
            os.unlink(tmp_wav)

        if result.returncode != 0:
            print(f"Whisper error: {result.stderr[:200]}", flush=True)
            return {"text": None, "language": "unknown"}

        # Whisper writes JSON to /tmp/<filename>.json
        json_out = Path("/tmp") / (work_path.stem + ".json")
        if json_out.exists():
            data = json.loads(json_out.read_text())
            json_out.unlink(missing_ok=True)
            return {
                "text": data.get("text", "").strip(),
                "language": data.get("language", "unknown"),
            }

        # Fallback: parse stdout
        for line in result.stdout.split("\n"):
            if line.strip() and not line.startswith("["):
                return {"text": line.strip(), "language": "unknown"}

        return {"text": None, "language": "unknown"}

    except subprocess.TimeoutExpired:
        print("Whisper timeout", flush=True)
        return {"text": None, "language": "unknown"}
    except Exception as e:
        print(f"Transcription error: {e}", flush=True)
        return {"text": None, "language": "unknown"}


def forward_to_n8n(msg: dict, voice: dict | None = None):
    """Forward a text message or voice transcription to n8n."""
    sender = msg.get("sender") or msg.get("chat_identifier", "")
    chat_id = msg.get("chat_identifier", "")

    if voice and voice.get("text"):
        # Voice memo: forward as text with language hint
        text = voice["text"]
        msg_type = "voice-message"
        print(f"Voice memo transcribed [{voice['language']}]: {text[:60]}...", flush=True)
    else:
        text = msg.get("text", "")
        msg_type = "new-message"

    payload = json.dumps({
        "type": msg_type,
        "data": {
            "text": text,
            "isFromMe": False,
            "timestamp": msg.get("ts"),
            "language": voice["language"] if voice else None,
            "isVoiceMemo": voice is not None,
            "handle": {"address": sender, "service": "iMessage"},
            "chats": [{"chatIdentifier": chat_id,
                       "guid": f"iMessage;-;{chat_id}"}],
        }
    }).encode()

    req = urllib.request.Request(
        N8N_WEBHOOK, data=payload,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status == 200
    except Exception as e:
        print(f"Forward error: {e}", flush=True)
        return False


def main():
    print(f"iMessage poller started — watching {DB_PATH}", flush=True)

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
                rowid = msg["rowid"]

                if msg.get("cache_has_attachments") and not msg.get("text"):
                    # Possible voice memo — try Apple transcription first
                    apple_text = extract_apple_transcription(msg.get("attributedBody"))
                    if apple_text:
                        print(f"Voice memo (Apple transcription): {apple_text[:80]}", flush=True)
                        # Language detection: "en" as default, classifier will refine
                        forward_to_n8n(msg, voice={"text": apple_text, "language": None})
                    else:
                        # Fallback to Whisper if Apple transcription not available
                        attachment = get_audio_attachment(rowid)
                        if attachment:
                            file_path = resolve_attachment_path(attachment["filename"])
                            if file_path:
                                print(f"Voice memo (Whisper fallback): {file_path.name}", flush=True)
                                voice = transcribe_audio(file_path)
                                if voice.get("text") and len(voice["text"].strip()) > 2:
                                    print(f"  Transcription [{voice['language']}]: {voice['text'][:80]}", flush=True)
                                    forward_to_n8n(msg, voice=voice)
                                else:
                                    print(f"  Transcription empty/too short, skipping", flush=True)
                            else:
                                print(f"  Audio file not found: {attachment['filename']}", flush=True)
                        # Skip non-audio attachments (photos, videos, etc.)
                elif msg.get("text"):
                    # Filter attachment placeholders (U+FFFC) and messages with no real content
                    clean_text = msg["text"].replace("￼", "").strip()
                    if not clean_text or len(clean_text) < 2:
                        print(f"Skipping attachment placeholder/empty text (rowid={rowid})", flush=True)
                    else:
                        print(f"Text: {clean_text[:60]} (from {msg.get('sender','?')})", flush=True)
                        msg["text"] = clean_text
                        forward_to_n8n(msg)

                state["last_rowid"] = max(state["last_rowid"], rowid)

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
