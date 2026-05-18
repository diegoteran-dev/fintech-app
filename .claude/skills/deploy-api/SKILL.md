---
name: deploy-api
description: Deploy the Vault backend API to Fly.io (vault-api). Runs flyctl deploy, waits for success, then verifies the health endpoint.
disable-model-invocation: true
allowed-tools: Bash(flyctl *) Bash(cd *) Bash(curl *) Bash(git *)
---

Deploy `apps/backend` to Fly.io as `vault-api`.

## Pre-flight

1. Show uncommitted backend changes so Diego can decide whether to commit first:
```bash
git status apps/backend --short
```

2. Show the current Alembic migration head (Fly runs `alembic upgrade head` on startup via `start.sh`):
```bash
cd /Users/diegoteran/Projects/fintech-app/apps/backend && source .venv/bin/activate && alembic heads
```

If there are uncommitted files, ask Diego whether to commit them first or deploy from the current HEAD.

## Deploy

```bash
cd /Users/diegoteran/Projects/fintech-app/apps/backend && flyctl deploy --app vault-api
```

Wait for the deploy to complete. Fly streams output — watch for `v[N] deployed successfully`.

## Verify

```bash
curl -s --max-time 15 https://vault-api.fly.dev/api/health
```

Expected: JSON with `"status": "ok"` (or `"healthy"`). If the endpoint times out, the machine may still be starting — wait 10 seconds and retry once.

## Report

Tell Diego:
- Deploy success/failure
- Health check result and response time
- Fly.io dashboard: https://fly.io/apps/vault-api
- If failed: paste the last 20 lines of deploy output for diagnosis
