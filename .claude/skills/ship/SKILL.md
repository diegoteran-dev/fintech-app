---
name: ship
description: Full deployment pipeline — TypeScript check, commit all changes, push to GitHub, deploy API to Fly.io, deploy web to Vercel, run health checks. Use when ready to ship a completed feature or fix.
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(flyctl *) Bash(vercel *) Bash(pnpm *) Bash(cd *) Bash(curl *)
argument-hint: "[commit message]"
---

Full ship pipeline for Vault. Commit message: `$ARGUMENTS`

## Step 1 — Show what's changing

```bash
cd /Users/diegoteran/Projects/fintech-app && git status --short && echo "---" && git diff --stat
```

## Step 2 — TypeScript check

```bash
pnpm --filter @vault/web exec tsc --noEmit 2>&1 | grep "error TS" | head -10
```

If any TypeScript errors appear, **stop and report them**. Do not proceed until they are fixed.

## Step 3 — Commit and push

```bash
git add -A
git commit -m "$(cat <<'EOF'
$ARGUMENTS

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin main
```

If `$ARGUMENTS` is empty, write a descriptive commit message based on the diff from Step 1.

## Step 4 — Deploy API

```bash
cd /Users/diegoteran/Projects/fintech-app/apps/backend && flyctl deploy --app vault-api
```

## Step 5 — Deploy Web

```bash
cd /Users/diegoteran/Projects/fintech-app/apps/web && vercel --prod
```

## Step 6 — Health checks

```bash
curl -s --max-time 15 https://vault-api.fly.dev/api/health
curl -s --max-time 15 -o /dev/null -w "Web: HTTP %{http_code}" https://vault-by-diego.vercel.app
```

## Report

Final summary:
- Commit hash and message
- GitHub push status
- API deploy result + health check
- Web deploy result + production URL
- Any errors encountered
