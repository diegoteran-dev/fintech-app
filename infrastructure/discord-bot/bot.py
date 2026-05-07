#!/usr/bin/env python3
"""
Jarvis Discord Bot
One channel per agent. Messages in a channel go to that agent via the Claude Executor.
Agent responses are posted back to the same channel.

Channels (created automatically on first run):
  #jarvis        → CEO / master orchestrator
  #cto           → Technical Director
  #backend       → Backend Engineer
  #frontend      → Frontend Engineer
  #devops        → DevOps Engineer
  #tester        → QA Tester
  #designer      → UI/UX Designer
  #personal-mgr  → Personal Manager
  #systems-admin → Systems Admin
  #pipeline      → Full pipeline runs (Jarvis → CTO → all agents)
"""
import asyncio
import json
import os
import re
import time
from pathlib import Path

import aiohttp
import discord
from discord.ext import commands

TOKEN = Path.home().joinpath(".jarvis-discord-token").read_text().strip()
EXECUTOR_URL = "http://127.0.0.1:5590"
IMESSAGE_URL = "http://127.0.0.1:5580"
OBSIDIAN_ROOT = Path.home() / "Documents" / "Obsidian" / "Jarvis"
PIPELINE_LOG = OBSIDIAN_ROOT / "pipeline-log.md"

# Map channel name → agent name
CHANNEL_AGENTS = {
    "jarvis": "Jarvis",
    "cto": "CTO",
    "backend": "Backend",
    "frontend": "Frontend",
    "devops": "DevOps",
    "tester": "Tester",
    "designer": "Designer",
    "personal-mgr": "PersonalManager",
    "systems-admin": "SystemsAdmin",
}

# Full pipeline order (for #pipeline channel)
PIPELINE_ORDER = ["CTO", "Backend", "Frontend", "DevOps", "Tester", "Designer"]
MAX_LOOPS = 3

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)


async def run_agent(agent: str, task: str, context: str = "", timeout: int = 300) -> dict:
    """Call the Claude Executor to run an agent headless."""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{EXECUTOR_URL}/run",
                json={"agent": agent, "task": task, "context": context, "timeout": timeout},
                timeout=aiohttp.ClientTimeout(total=timeout + 10),
            ) as resp:
                return await resp.json()
        except Exception as e:
            return {"ok": False, "output": f"Executor error: {e}", "agent": agent}


async def send_imessage(message: str):
    """Send an iMessage to Diego."""
    async with aiohttp.ClientSession() as session:
        try:
            await session.post(
                IMESSAGE_URL + "/send",
                json={"message": message},
                timeout=aiohttp.ClientTimeout(total=10),
            )
        except Exception:
            pass


def parse_agent_output(output: str) -> dict:
    """Extract structured fields from agent output."""
    result = {"changes": "", "next_context": "", "learning": "", "status": "APPROVED"}
    for line in output.split("\n"):
        if line.startswith("CHANGES:"):
            result["changes"] = line.replace("CHANGES:", "").strip()
        elif line.startswith("NEXT_AGENT_CONTEXT:"):
            result["next_context"] = line.replace("NEXT_AGENT_CONTEXT:", "").strip()
        elif line.startswith("LEARNING:"):
            result["learning"] = line.replace("LEARNING:", "").strip()
        elif line.startswith("STATUS:"):
            status_line = line.replace("STATUS:", "").strip()
            if status_line.startswith("REJECTED"):
                result["status"] = status_line
    return result


def log_pipeline(task: str, agent: str, status: str, notes: str):
    today = time.strftime("%Y-%m-%d %H:%M")
    entry = f"\n- {today} | {agent} | {status} | {task[:80]} | {notes[:100]}"
    with open(PIPELINE_LOG, "a") as f:
        f.write(entry)


@bot.event
async def on_ready():
    print(f"Jarvis online as {bot.user}")
    for guild in bot.guilds:
        existing = {ch.name for ch in guild.text_channels}
        needed = [c for c in list(CHANNEL_AGENTS.keys()) + ["pipeline"] if c not in existing]
        if needed:
            # Try to create; if no permission, print instructions
            for channel_name in needed:
                try:
                    await guild.create_text_channel(channel_name)
                    print(f"Created #{channel_name}")
                except discord.Forbidden:
                    pass  # Will notify below
            # Check what's still missing after attempts
            existing_now = {ch.name for ch in guild.text_channels}
            still_missing = [c for c in needed if c not in existing_now]
            if still_missing:
                # Post setup instructions to any available channel
                for ch in guild.text_channels:
                    try:
                        await ch.send(
                            "**Jarvis online** ✅\n\n"
                            "I need these channels created manually (I don't have Manage Channels permission):\n"
                            + "\n".join(f"• `#{c}`" for c in still_missing)
                            + "\n\nOr give me **Administrator** role in Server Settings → Roles and I'll create them."
                        )
                        break
                    except Exception:
                        continue
        print(f"Jarvis ready in {guild.name}")


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    await bot.process_commands(message)

    channel_name = message.channel.name
    content = message.content.strip()

    # Skip commands
    if content.startswith("!"):
        return

    # #pipeline: run the full multi-agent pipeline
    if channel_name == "pipeline":
        await run_full_pipeline(message, content)
        return

    # Agent-specific channels
    agent = CHANNEL_AGENTS.get(channel_name)
    if not agent:
        return

    # Show typing indicator while Claude runs
    async with message.channel.typing():
        result = await run_agent(agent, content, timeout=180)

    output = result.get("output", "No output.")
    duration = result.get("duration", 0)

    # Split long responses into chunks (Discord 2000 char limit)
    chunks = [output[i:i+1900] for i in range(0, len(output), 1900)]
    for i, chunk in enumerate(chunks):
        prefix = f"**{agent}** ({duration}s)" if i == 0 else ""
        await message.channel.send(f"{prefix}\n{chunk}" if prefix else chunk)


async def run_full_pipeline(message: discord.Message, task: str):
    """Run the full Jarvis → CTO → Backend → Frontend → DevOps → Tester → Designer pipeline."""
    pipeline_channel = message.channel
    loop_count = 0
    context = ""
    rejected_by = None

    await pipeline_channel.send(f"🚀 **Pipeline started**: {task[:100]}\nRunning Jarvis analysis...")

    # Step 1: Jarvis classifies and sets up the task for CTO
    async with pipeline_channel.typing():
        jarvis_result = await run_agent(
            "Jarvis",
            f"Analyze this task and prepare a brief for the CTO: {task}",
            timeout=120,
        )
    jarvis_output = jarvis_result.get("output", "")
    parsed = parse_agent_output(jarvis_output)
    context = parsed["next_context"] or jarvis_output[:500]
    await pipeline_channel.send(f"✅ **Jarvis**: {parsed['changes'] or jarvis_output[:200]}")

    while loop_count < MAX_LOOPS:
        loop_count += 1
        loop_label = f"Loop {loop_count}/{MAX_LOOPS}"
        all_approved = True

        for agent in PIPELINE_ORDER:
            # Skip agents before the rejected one on re-runs
            if rejected_by and PIPELINE_ORDER.index(agent) < PIPELINE_ORDER.index(rejected_by):
                continue

            await pipeline_channel.send(f"⚙️ **{agent}** running... ({loop_label})")

            async with pipeline_channel.typing():
                result = await run_agent(agent, task, context=context, timeout=300)

            output = result.get("output", "")
            parsed = parse_agent_output(output)
            log_pipeline(task, agent, parsed["status"], parsed["changes"])

            # Update context for next agent
            if parsed["next_context"]:
                context = parsed["next_context"]

            if parsed["status"].startswith("REJECTED"):
                reason = parsed["status"].replace("REJECTED:", "").strip()
                await pipeline_channel.send(
                    f"❌ **{agent} REJECTED**: {reason}\n"
                    f"↩️ Looping back... (attempt {loop_count}/{MAX_LOOPS})"
                )
                rejected_by = agent
                all_approved = False

                # Add rejection context for the loop
                context = f"Previous attempt rejected by {agent}: {reason}\nOriginal task: {task}\nPrevious work: {context}"
                break
            else:
                await pipeline_channel.send(f"✅ **{agent}**: {parsed['changes'] or 'Done'}")

        if all_approved:
            # CTO final review
            await pipeline_channel.send("🔍 **CTO reviewing all changes...**")
            async with pipeline_channel.typing():
                cto_review = await run_agent(
                    "CTO",
                    f"Final technical review. Task: {task}\nWork completed: {context}",
                    timeout=120,
                )
            cto_parsed = parse_agent_output(cto_review.get("output", ""))

            if cto_parsed["status"].startswith("REJECTED"):
                await pipeline_channel.send(f"❌ **CTO rejected**: {cto_parsed['status']}")
                context = cto_parsed["next_context"] or context
                rejected_by = "Backend"  # restart from backend
                loop_count += 1
                continue

            # Pipeline complete — send Diego the approval request
            summary = (
                f"✅ **Pipeline complete** ({loop_count} loop{'s' if loop_count > 1 else ''})\n\n"
                f"**Task**: {task}\n"
                f"**CTO notes**: {cto_parsed['changes'] or 'All checks passed'}\n\n"
                f"Review changes locally, then reply `!deploy` in #pipeline to push + deploy."
            )
            await pipeline_channel.send(summary)

            # Also send iMessage
            await send_imessage(
                f"Jarvis: Pipeline done — {task[:60]}\n"
                f"{loop_count} loop(s). Check Discord #pipeline to review + approve deploy."
            )
            log_pipeline(task, "COMPLETE", "APPROVED", f"{loop_count} loops")
            return

    # Max loops exceeded
    msg = (
        f"⚠️ **Max loops ({MAX_LOOPS}) reached** without full approval.\n"
        f"Last rejected by: **{rejected_by}**\n"
        f"Please review and give more specific instructions."
    )
    await pipeline_channel.send(msg)
    await send_imessage(f"Jarvis: Pipeline stuck on '{task[:50]}' after {MAX_LOOPS} loops. Check Discord.")
    log_pipeline(task, "STUCK", f"Max loops reached, last rejected by {rejected_by}", "")


@bot.command(name="deploy")
async def deploy(ctx):
    """Diego types !deploy in #pipeline to approve and push."""
    if ctx.channel.name != "pipeline":
        await ctx.send("Run `!deploy` in #pipeline only.")
        return
    await ctx.send("🚀 Deploying... running `/ship`")
    result = await run_agent(
        "DevOps",
        "Run the full ship pipeline: TypeScript check, commit all changes with a descriptive message, push to GitHub, deploy API to Fly.io, deploy web to Vercel, run health checks.",
        timeout=600,
    )
    output = result.get("output", "")
    await ctx.send(f"**Deploy result**:\n{output[:1800]}")
    await send_imessage("Jarvis: Deploy complete. Vault is live.")


@bot.command(name="status")
async def status(ctx):
    """Show current system status."""
    result = await run_agent("SystemsAdmin", "Run a full health check of all services.", timeout=60)
    await ctx.send(f"**System Status**:\n{result.get('output','')[:1800]}")


if __name__ == "__main__":
    bot.run(TOKEN)
