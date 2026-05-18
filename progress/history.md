# History

> Append-only. Never delete entries.

---

## 2026-05-10 — Harness bootstrapped

- **Agent:** human (Diego) + Claude Sonnet 4.6
- **Feature:** harness_bootstrap (feature 1)
- **Changes:** Added AGENTS.md, CHECKPOINTS.md, feature_list.json, init.sh,
  docs/architecture.md, docs/conventions.md, docs/verification.md,
  progress/current.md, progress/history.md, .opencode/agent/, .claude/agents/
- **Verification:** init.sh structure complete, agents configured
- **Close:** feature 1 marked done. Next: add first real feature to feature_list.json

---

## Feature 2 — fix_typescript_errors (2026-05-10)

Fixed 4 pre-existing TypeScript errors. init.sh now exits 0.

**Changes:**
- `package.json` (root): Added `pnpm.overrides["@types/react"] = "18.3.28"` — pins React 18 types monorepo-wide, resolving Recharts JSX incompatibility with the `@types/react@19` types hoisted by mobile deps.
- `apps/mobile/app/(tabs)/transactions.tsx` L184: `setImportPreview(parsed)` → `setImportPreview(parsed.rows)` — unwraps `ParsedPdfResult` to match `TransactionCreate[] | null` state type.
- `apps/mobile/services/api.ts` L46: `new Promise(r => setTimeout(r, 800))` → `new Promise<void>(resolve => setTimeout(resolve, 800))` — explicit `<void>` generic resolves callback arity mismatch.

**Reviewer verdict:** APPROVED
