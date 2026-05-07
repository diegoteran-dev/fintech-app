---
name: health-check
description: Check live health of Vault infrastructure — Fly.io API and Vercel web. Use when verifying a deployment, debugging production issues, or confirming the app is up.
when_to_use: Use after deploying, when something seems broken in production, or when asked to check if the app is up.
---

## Live Infrastructure Status

**API health** (`vault-api.fly.dev`):
!`curl -s --max-time 10 https://vault-api.fly.dev/api/health`

**API response time**:
!`curl -s --max-time 10 -o /dev/null -w "%{time_total}s" https://vault-api.fly.dev/api/health`

**Web HTTP status** (`vault-by-diego.vercel.app`):
!`curl -s --max-time 10 -o /dev/null -w "HTTP %{http_code}" https://vault-by-diego.vercel.app`

## Instructions

Report a clear summary:
1. API status (up/down, response body, latency)
2. Web status (HTTP code — 200 = healthy, anything else = problem)
3. If either is down, suggest next steps:
   - API down → check `flyctl status --app vault-api` and `flyctl logs --app vault-api`
   - Web down → check Vercel dashboard at `vercel.com/diegoteran-dev`
