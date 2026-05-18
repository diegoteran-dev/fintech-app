# Verification — Arca

> Gold rule: agents don't say "it works" — they demonstrate it.
> Every feature closes with executable evidence, not assertions.

## Level 1 — Unit/integration tests (required for every backend feature)

All new endpoints have at least one pytest test covering:
- Happy path with valid input
- Auth rejection (401) if endpoint is protected
- At least one error path (400/404/422)

Run: `source apps/backend/.venv/bin/activate && python -m pytest apps/backend/tests -q`

## Level 2 — TypeScript check (required for every frontend/mobile change)

All TypeScript must compile with zero errors before marking done.

Web: `pnpm --filter @arca/web exec tsc --noEmit`
Mobile: `pnpm --filter @arca/mobile exec tsc --noEmit`

## Level 3 — Smoke test (required before closing any UI feature)

Manually verify the golden path in browser (web) and iOS Simulator (mobile).
Copy a brief description of what you tested into `progress/impl_<feature>.md`.

Web dev: `pnpm --filter @arca/web dev` → http://localhost:3000
Backend: `cd apps/backend && source .venv/bin/activate && python main.py` → :8000
Mobile: `cd apps/mobile && npx expo run:ios`

## Anti-patterns

- "I added the endpoint, it should work" — no test, not done
- TypeScript errors suppressed with `as any` — fix the type
- Mobile not tested — both platforms required
- Marking done before `./init.sh` exits 0

## Final gate

```bash
./init.sh   # must exit 0
```

If not green — do not mark done. Set feature to `blocked` in feature_list.json.
Document the exact failure in `progress/current.md`.
