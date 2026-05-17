#!/usr/bin/env python3
"""
Jarvis Discord Bot v2 — clean relay
Single channel: #jarvis
Two paths:
  READ   → fast executor API call (questions, status, explanations)
  EXECUTE → opencode CLI subprocess (create, fix, deploy, run, build)
"""
import asyncio
import json
import os
import time
from pathlib import Path

import aiohttp
import discord
from discord.ext import commands

TOKEN        = Path.home().joinpath(".jarvis-discord-token").read_text().strip()
EXECUTOR_URL = "http://127.0.0.1:5590"
OPENCODE_BIN = "/opt/homebrew/bin/opencode"
PROJECT_ROOT = Path.home() / "Projects" / "fintech-app"
OPENCODE_GO_KEY = os.environ.get(
    "OPENCODE_GO_API_KEY",
    "sk-EmSbqOPlglday2OVGcnZbaw0xzpjcJdgwY5Gz9uJwdejg81wVZ652x5HWRoH5xbi"
)
JARVIS_CHANNEL  = "jarvis"
EXECUTE_TIMEOUT = 120

_seen: set[int] = set()
_SEEN_FILE = Path("/tmp/jarvis-discord-seen.json")

def _load_seen():
    """Load message IDs from disk processed in the last 5 minutes."""
    try:
        data = json.loads(_SEEN_FILE.read_text())
        cutoff = time.time() - 300
        return {int(k) for k, v in data.items() if float(v) > cutoff}
    except Exception:
        return set()

def _mark_seen(msg_id: int):
    """Persist a message ID to disk with current timestamp."""
    _seen.add(msg_id)
    try:
        data = {}
        if _SEEN_FILE.exists():
            try:
                data = json.loads(_SEEN_FILE.read_text())
            except Exception:
                pass
        data[str(msg_id)] = time.time()
        cutoff = time.time() - 300
        data = {k: v for k, v in data.items() if float(v) > cutoff}
        _SEEN_FILE.write_text(json.dumps(data))
    except Exception:
        pass

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def setup_hook():
    # Replace aiohttp's async DNS resolver with the threaded one (uses stdlib socket).
    # The async resolver fails intermittently in macOS LaunchAgent environments.
    import aiohttp.resolver
    connector = aiohttp.TCPConnector(resolver=aiohttp.resolver.ThreadedResolver())
    old = bot.http._HTTPClient__session
    if old and not old.closed:
        await old.close()
    bot.http._HTTPClient__session = aiohttp.ClientSession(connector=connector)
    print("DNS: using ThreadedResolver", flush=True)

CLASSIFY_PROMPT = """You are a message router for an AI assistant system called Jarvis.
Classify the message below as READ or EXECUTE.

READ  — the user wants information, an explanation, a status update, or an answer
        from existing knowledge. No changes needed. Examples:
        "What is Vault?", "How does auth work?", "What files are in the project?",
        "Is the API up?", "Explain the database schema", "What's the current feature?"

EXECUTE — the user wants the system to DO something: create, fix, deploy, run a
          command, modify code, check live infrastructure, build a feature.
          Examples: "Fix the TypeScript errors", "Deploy the API", "Run a health check",
          "Add a dark mode toggle", "The login page is broken", "Create a new endpoint"

Message: {text}

Reply with exactly one word: READ or EXECUTE"""


async def classify(text: str) -> str:
    """Ask DeepSeek V4 Flash to classify the message intent."""
    payload = json.dumps({
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "user", "content": CLASSIFY_PROMPT.format(text=text)}
        ],
        "max_tokens": 10,
        "temperature": 0,
    }).encode()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://opencode.ai/zen/go/v1/chat/completions",
                data=payload,
                headers={
                    "Authorization": f"Bearer {OPENCODE_GO_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Jarvis/1.0",
                },
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                data = await resp.json()
                answer = data["choices"][0]["message"]["content"].strip().upper()
                return "EXECUTE" if "EXECUTE" in answer else "READ"
    except Exception as e:
        print(f"[classify error] {e} — defaulting to READ", flush=True)
        return "READ"


async def handle_read(text: str, sender: str) -> str:
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{EXECUTOR_URL}/run",
                json={"agent": "Jarvis", "task": text,
                      "channel": f"Discord/#{JARVIS_CHANNEL}", "sender": sender},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                data = await resp.json()
                return data.get("output", "No response.")
        except Exception as e:
            return f"Error: {e}"


async def handle_execute(text: str) -> str:
    env = {**os.environ, "HOME": str(Path.home())}
    try:
        proc = await asyncio.create_subprocess_exec(
            OPENCODE_BIN, "run",
            "-m", "opencode/deepseek-v4-flash-free",
            "--format", "json",
            text,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            cwd=str(PROJECT_ROOT),
            env=env,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=EXECUTE_TIMEOUT)
    except asyncio.TimeoutError:
        return f"Timed out after {EXECUTE_TIMEOUT}s."
    except Exception as e:
        return f"Failed to start opencode: {e}"

    texts = []
    for line in stdout.decode(errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
            if event.get("type") == "text":
                chunk = event.get("part", {}).get("text", "")
                if chunk:
                    texts.append(chunk)
        except json.JSONDecodeError:
            pass

    return "".join(texts).strip() or "Done."


@bot.event
async def on_ready():
    print(f"Jarvis online as {bot.user}", flush=True)
    for guild in bot.guilds:
        if not discord.utils.get(guild.text_channels, name=JARVIS_CHANNEL):
            try:
                await guild.create_text_channel(JARVIS_CHANNEL)
            except discord.Forbidden:
                pass
        print(f"Ready in {guild.name}", flush=True)


@bot.event
async def on_message(message: discord.Message):
    age = (discord.utils.utcnow() - message.created_at).total_seconds()
    print(f"[RAW] id={message.id} age={age:.1f}s bot={message.author.bot} "
          f"in_mem={message.id in _seen} in_disk={message.id in _load_seen()} "
          f"channel={message.channel.name!r}", flush=True)
    if message.author.bot:
        return
    if age > 10:
        print(f"[DROP-STALE] id={message.id}", flush=True)
        return
    if message.id in _seen or message.id in _load_seen():
        print(f"[DROP-DEDUP] id={message.id}", flush=True)
        return
    _mark_seen(message.id)
    print(f"[PROCESS] id={message.id} channel={message.channel.name!r}", flush=True)

    if message.channel.name != JARVIS_CHANNEL:
        return

    text = message.content.strip()
    if not text or text.startswith("!"):
        return

    intent = await classify(text)
    print(f"[{intent}] {text[:80]}", flush=True)

    if intent == "EXECUTE":
        status_msg = await message.channel.send("⚙️ Running...")
        response = await handle_execute(text)
        try:
            await status_msg.delete()
        except Exception:
            pass
    else:
        async with message.channel.typing():
            response = await handle_read(text, str(message.author))

    response = response.strip() or "Done."
    for chunk in [response[i:i+1900] for i in range(0, len(response), 1900)]:
        await message.channel.send(chunk)


@bot.command(name="status")
async def cmd_status(ctx):
    if ctx.channel.name != JARVIS_CHANNEL:
        return
    async with ctx.typing():
        resp = await handle_read("Quick health check of all services.", str(ctx.author))
    await ctx.send(resp[:1900])


def _wait_for_network(host: str = "gateway.discord.gg", retries: int = 20):
    """Block until DNS resolves, with retries. Prevents crash-loops on fast restart."""
    import socket
    for i in range(retries):
        try:
            socket.getaddrinfo(host, 443)
            if i > 0:
                print(f"Network ready after {i} attempts", flush=True)
            return
        except OSError:
            print(f"Waiting for network... ({i+1}/{retries})", flush=True)
            time.sleep(3)
    print("Network never became available — attempting anyway", flush=True)


if __name__ == "__main__":
    _wait_for_network()
    # Load seen IDs from disk so a KeepAlive restart doesn't reprocess recent messages
    _seen.update(_load_seen())
    print(f"Jarvis Bot v2 starting... ({len(_seen)} seen IDs loaded)", flush=True)
    # Do NOT wrap in while loop — reusing a Bot object across bot.run() calls
    # causes internal state/listeners to stack, producing N responses per message.
    # KeepAlive in the LaunchAgent handles restarts with a fresh process each time.
    bot.run(TOKEN, reconnect=True)
