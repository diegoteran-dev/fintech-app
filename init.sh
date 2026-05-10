#!/usr/bin/env bash
# init.sh — Vault (fastapi-react-expo)
# Run at session start and before marking any feature done.
# Must exit 0 before anything can be marked done.

set -u
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn() { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail() { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }
EXIT_CODE=0

echo "── 1. Harness files ────────────────────────────────────"
for f in AGENTS.md CLAUDE.md CHECKPOINTS.md feature_list.json \
          docs/architecture.md docs/conventions.md docs/verification.md \
          progress/current.md progress/history.md; do
  if [ ! -f "$f" ]; then
    fail "Missing: $f"; EXIT_CODE=1
  else
    ok "Exists: $f"
  fi
done

echo ""
echo "── 2. feature_list.json ────────────────────────────────"
python3 - <<'PY'
import json, sys
try:
    data = json.load(open("feature_list.json"))
    valid = {"pending", "in_progress", "done", "blocked"}
    in_progress = [f for f in data["features"] if f["status"] == "in_progress"]
    if len(in_progress) > 1:
        print(f"[FAIL]  {len(in_progress)} features in_progress (max 1)")
        sys.exit(1)
    for f in data["features"]:
        if f["status"] not in valid:
            print(f"[FAIL]  Invalid status on feature {f['id']}: {f['status']}")
            sys.exit(1)
    print(f"[OK]    feature_list.json valid ({len(data['features'])} features, {len(in_progress)} in_progress)")
except Exception as e:
    print(f"[FAIL]  feature_list.json error: {e}")
    sys.exit(1)
PY
[ $? -ne 0 ] && EXIT_CODE=1

echo ""
echo "── 3. Backend — Python / FastAPI ───────────────────────"
if [ -f "apps/backend/requirements.txt" ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 not found"; EXIT_CODE=1
  else
    ok "python3 → $(python3 --version)"
    VENV="apps/backend/.venv"
    if [ -d "$VENV" ]; then
      ok "venv exists at $VENV"
      if [ -d "apps/backend/tests" ]; then
        if source "$VENV/bin/activate" && python3 -m pytest apps/backend/tests -q --tb=short 2>&1; then
          ok "Backend tests pass"
        else
          fail "Backend tests failed"; EXIT_CODE=1
        fi
      else
        warn "No apps/backend/tests/ yet — skipping"
      fi
    else
      warn "venv not found at $VENV — run: cd apps/backend && python3 -m venv .venv && pip install -r requirements.txt"
    fi
  fi
else
  warn "No backend detected — skipping"
fi

echo ""
echo "── 4. Frontend — TypeScript / React ────────────────────"
if [ -f "apps/web/package.json" ]; then
  if ! command -v pnpm >/dev/null 2>&1; then
    fail "pnpm not found"; EXIT_CODE=1
  else
    ok "pnpm → $(pnpm --version)"
    if pnpm --filter @vault/web exec tsc --noEmit 2>&1; then
      ok "Web TypeScript check passes"
    else
      fail "Web TypeScript errors found"; EXIT_CODE=1
    fi
  fi
else
  warn "No web app detected — skipping"
fi

echo ""
echo "── 5. Mobile — Expo / TypeScript ───────────────────────"
if [ -f "apps/mobile/package.json" ]; then
  if pnpm --filter @vault/mobile exec tsc --noEmit 2>&1; then
    ok "Mobile TypeScript check passes"
  else
    fail "Mobile TypeScript errors found"; EXIT_CODE=1
  fi
else
  warn "No mobile app detected — skipping"
fi

echo ""
echo "── 6. Summary ──────────────────────────────────────────"
if [ $EXIT_CODE -eq 0 ]; then
  ok "Environment ready. You may begin."
else
  fail "Environment NOT ready. Fix errors before continuing."
fi
exit $EXIT_CODE
