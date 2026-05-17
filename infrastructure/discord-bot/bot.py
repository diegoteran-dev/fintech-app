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

EXECUTE_TRIGGERS = (
    "create", "fix", "run", "deploy", "add", "update", "build", "check",
    "install", "delete", "remove", "generate", "implement", "refactor",
    "migrate", "start", "stop", "restart", "test", "ship", "push", "commit",
    "crea", "arregla", "ejecuta", "despliega", "construye", "agrega",
    "actualiza", "elimina", "genera", "implementa", "inicia",
)

_seen: set[int] = set()

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
bot = commands.Bot(command_prefix="!", intents=intents)


def classify(text: str) -> str:
    words = text.strip().lower().split()[:4]
    for w in words:
        if w.rstrip(".,!?:") in EXECUTE_TRIGGERS:
            return "EXECUTE"
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
    if message.author.bot:
        return
    if (discord.utils.utcnow() - message.created_at).total_seconds() > 10:
        return
    if message.id in _seen:
        return
    _seen.add(message.id)
    if len(_seen) > 500:
        _seen.clear()

    if message.channel.name != JARVIS_CHANNEL:
        return

    text = message.content.strip()
    if not text or text.startswith("!"):
        return

    intent = classify(text)
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


if __name__ == "__main__":
    print("Jarvis Bot v2 starting...", flush=True)
    bot.run(TOKEN)
