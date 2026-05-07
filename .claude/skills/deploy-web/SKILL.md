---
name: deploy-web
description: Deploy the Vault web frontend to Vercel production. Runs TypeScript check first, then deploys with vercel --prod, then verifies the live URL.
disable-model-invocation: true
allowed-tools: Bash(vercel *) Bash(pnpm *) Bash(cd *) Bash(curl *) Bash(git *)
---

Deploy `apps/web` to Vercel production.

## Pre-flight: TypeScript check

```bash
cd /Users/diegoteran/Projects/fintech-app && pnpm --filter @vault/web exec tsc --noEmit 2>&1 | head -30
```

If there are TypeScript errors (`error TS`), **stop and report them** — do not deploy broken code. Fix the errors first.

## Pre-flight: uncommitted changes

```bash
git status apps/web --short
```

If there are uncommitted changes, ask Diego whether to commit them first or deploy the current state (Vercel builds from disk, not git, when run locally).

## Deploy

```bash
cd /Users/diegoteran/Projects/fintech-app/apps/web && vercel --prod
```

Vercel streams output. Watch for `Production:` followed by the deployment URL.

## Verify

```bash
curl -s --max-time 15 -o /dev/null -w "HTTP %{http_code} | %{time_total}s" https://vault-by-diego.vercel.app
```

Expected: `HTTP 200`.

## Report

Tell Diego:
- Deploy success/failure
- Production URL from Vercel output
- HTTP status and response time
- Vercel dashboard: https://vercel.com/diegoteran-dev
- If TypeScript errors blocked the deploy: list them clearly
