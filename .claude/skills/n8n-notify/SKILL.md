---
name: n8n-notify
description: Trigger the Vault Events n8n webhook to log an event. Use after deploys, critical fixes, or any significant project event worth tracking.
when_to_use: Use after /ship, after fixing a production bug, or when you want to log a significant event externally.
disable-model-invocation: true
allowed-tools: Bash(curl *) Bash(docker *)
argument-hint: "[event description]"
---

Send a Vault event to n8n: `$ARGUMENTS`

## Pre-check: Is n8n running?

```bash
curl -s --max-time 3 http://localhost:5678/healthz 2>/dev/null
```

If down, start it:
```bash
docker start vault-n8n
```

If the container doesn't exist, recreate it:
```bash
docker run -d --name vault-n8n --restart unless-stopped -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e GENERIC_TIMEZONE="America/Chicago" \
  n8nio/n8n
```

## Send the event

```bash
curl -s -X POST http://localhost:5678/webhook/vault-events \
  -H "Content-Type: application/json" \
  -d "{\"event\": \"$ARGUMENTS\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"source\": \"claude-code\"}"
```

Expected response: `{"message":"Workflow was started"}`

## Report

Tell Diego:
- n8n status (running/down)
- Webhook response
- Event logged: `$ARGUMENTS`

## n8n UI: http://localhost:5678
Login: diego.teran.a@gmail.com / Vault2026!n8n
Workflows: Vault Events (active) · Vault Daily Health Check (inactive — activate when ready)
