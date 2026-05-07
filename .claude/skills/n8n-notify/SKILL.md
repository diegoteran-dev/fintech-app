---
name: n8n-notify
description: Trigger an n8n workflow webhook to send a notification or run an automation. Use after deployments, errors, or any event worth tracking externally.
when_to_use: Use after /ship, after a critical error is fixed, or when you want to log an event to an external system.
disable-model-invocation: true
allowed-tools: Bash(curl *)
argument-hint: "[event description]"
---

Trigger n8n notification for: `$ARGUMENTS`

## Pre-check: Is n8n running?

```bash
curl -s --max-time 3 http://localhost:5678/healthz 2>/dev/null | head -1
```

If n8n is not running:
- **Local**: `npx n8n start` (runs on localhost:5678)
- **Fly.io** (once deployed): `https://vault-n8n.fly.dev`

Check `.env` or `~/.n8n/config` for the N8N_WEBHOOK_URL.

## Trigger the webhook

```bash
N8N_WEBHOOK_URL="${N8N_WEBHOOK_URL:-http://localhost:5678/webhook/vault-events}"
curl -s -X POST "$N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{\"event\": \"$ARGUMENTS\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"source\": \"claude-code\"}"
```

## Report

Tell Diego:
- Whether n8n is running and reachable
- The webhook response
- If n8n is not running, remind him to start it (`npx n8n start`) or deploy to Fly.io

## n8n Setup Reference

n8n is installed globally (`npm install -g n8n`). To start:
```bash
n8n start
# → UI at http://localhost:5678
```

Fly.io deployment config is at `infrastructure/n8n/fly.toml` (once created).
Webhook URL for Vault events: `http://localhost:5678/webhook/vault-events`
