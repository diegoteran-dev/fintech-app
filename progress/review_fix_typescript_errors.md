# Review: fix_typescript_errors

## Verdict: APPROVED

## Checks
- [x] init.sh exits 0
- [x] No runtime logic changed
- [x] No unwarranted `any` casts
- [x] importPreview state type unchanged
- [x] withRetry 800ms delay intact
- [x] pnpm override is minimal and correct

## Notes

### C1 — Harness is complete
All harness files present. `./init.sh` exits 0 with every stage green (backend tests, web TypeScript, mobile TypeScript).

### C2 — State is coherent
`feature_list.json` still shows `fix_typescript_errors` as `in_progress` and `progress/impl_fix_typescript_errors.md` does not exist — both are **session-close** obligations (AGENTS.md §5), not code-correctness blockers. The implementer should complete these steps before archiving.

### C3 — Architecture respected
No violations found:
- No inline colors introduced
- No direct fetch/axios in components
- No business logic moved to routes
- No hardcoded secrets
- No `console.log` added

### C4 — Each change verified

**`apps/mobile/app/(tabs)/transactions.tsx` line 184** (`setImportPreview(parsed.rows)`)
- `parsePdf()` returns `ParsedPdfResult` (confirmed at `services/api.ts` lines 103–110); its `.rows` field is `TransactionCreate[]`
- State type at line 63: `useState<TransactionCreate[] | null>(null)` — **unchanged**, type now matches
- All downstream consumers (`importPreview.map(...)` at lines 194, 467; `.length` at lines 197, 463, 482) operate on `TransactionCreate[]` — no breakage
- No new `any` casts introduced; pre-existing casts at lines 160, 182, 185, 198 are unchanged and documented

**`apps/mobile/services/api.ts` line 46** (`new Promise<void>(resolve => setTimeout(resolve, 800))`)
- `<void>` generic eliminates the `(value: unknown) => void` arity mismatch — strictly type-level
- `setTimeout(resolve, 800)` — 800ms delay **preserved**; retry path (`return fn()` at line 47) **unchanged**
- Only pre-existing `any` in file: `catch (err: any)` at line 44 — not introduced by this change

**`package.json` (root) — `pnpm.overrides`**
- Added under the existing `"pnpm"` key (lines 17–23) — correct placement; `pnpm` workspace overrides at root propagate monorepo-wide
- Pins to exact version `"18.3.28"` — consistent with the `@types/react@^18.3.0` declared in `apps/web/package.json` devDependencies
- No package was upgraded or downgraded; this is a resolution override, not a dependency change
- `apps/web/package.json` is untouched (correct — the override lives at root as the brief specified)
- `pnpm install` re-resolution result confirmed working by `init.sh` passing the web TypeScript check

### Outstanding session-close items (not blocking approval)
1. `progress/impl_fix_typescript_errors.md` must be written (AGENTS.md §5, step 3)
2. `feature_list.json` feature 2 status must be changed to `"done"` (AGENTS.md §5, step 6)
3. Summary must be moved from `progress/current.md` to `progress/history.md` and `current.md` cleared (AGENTS.md §5, steps 5–6)
