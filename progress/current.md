# Current session

> Cleared and archived to history.md at session close.
> Update in real-time — not at the end.

- **Feature in progress:** Security review — apps/web (read-only)
- **Started:** 2026-05-15
- **Agent:** Claude Sonnet 4.6 (dispatcher/orchestrator)

## Plan

1. Read all key files in apps/web: package.json, vite.config.ts, index.html, main.tsx, services/api.ts, services/auth.ts, context/AuthContext.tsx, and component files
2. Identify vulnerabilities across 5 categories: dependencies, configuration, hardcoded secrets, client-side security, API interaction patterns
3. Prioritize findings by severity (HIGH / MEDIUM / LOW)
4. Write remediation recommendations for each finding
5. Output ROUTE and IMPL directive for developer

## Security Review Findings

### CRITICAL / HIGH

---

#### [HIGH-1] JWT Tokens Stored in localStorage

**File:** `apps/web/src/context/AuthContext.tsx:26-32`
**File:** `apps/web/src/services/auth.ts:4`

Both `vault_access_token` and `vault_refresh_token` are stored in `localStorage`. localStorage is accessible to any JavaScript running on the page — a single XSS vulnerability immediately yields full token theft and account takeover. For a fintech app handling real financial data, this is the most critical finding.

**Remediation:** Use `httpOnly` cookies set by the backend (`Set-Cookie: ...; HttpOnly; Secure; SameSite=Strict`). The frontend never touches the token directly; the browser sends it automatically. The backend already issues JWTs — add a `/auth/cookie-login` variant that sets an httpOnly cookie and remove all `localStorage.getItem('vault_access_token')` calls from the frontend.

---

#### [HIGH-2] No Security Headers on Vercel Deployment

**File:** `apps/web/vercel.json`

The `vercel.json` has no `headers` block. The deployed production app ships zero security headers:
- No `Content-Security-Policy` — XSS attacks have no browser-level mitigation
- No `X-Frame-Options` or `frame-ancestors` CSP — clickjacking possible
- No `X-Content-Type-Options: nosniff` — MIME sniffing attacks possible
- No `Strict-Transport-Security` — no HSTS enforcement
- No `Referrer-Policy` — API paths and query parameters leak in referrer headers

For a financial app, this is a HIGH severity gap.

**Remediation:** Add a `headers` block to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; connect-src 'self' https://vault-api.fly.dev; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"
        }
      ]
    }
  ]
}
```
Note: `unsafe-inline` for styles is required because of inline `style={}` usage throughout React components. This is acceptable if a strict nonce-based CSP is not feasible. `unsafe-eval` is NOT required and should not be added.

---

#### [HIGH-3] No `index.html` Security Meta Tags

**File:** `apps/web/index.html`

The `<head>` has only `charset` and `viewport` — no `<meta http-equiv="Content-Security-Policy">` fallback, no `referrer` policy, no `X-UA-Compatible`. Even as a fallback layer, this is missing.

---

### MEDIUM

---

#### [MED-1] Client-Side Admin Gate Based on Hardcoded User ID

**File:** `apps/web/src/components/InviteManager.tsx:13`
```tsx
if (!user || user.id !== 1) return null;
```

Admin access to invite code management (view + rotate) is gated on `user.id === 1` — a client-side check only. While the actual API calls (`/admin/invite`) should be protected by backend auth middleware, this pattern is fragile:
- A determined attacker can spoof the `user.id` value in an intercepted response or via devtools
- The `AuthUser` type has `id: number` (types/index.ts:2) — it comes directly from the `/auth/me` JSON response with no server-side role claim
- The backend should gate on a proper `is_admin` boolean or role field, not numeric ID

**Remediation:** 
1. Add `is_admin: boolean` to the `AuthUser` interface and `/auth/me` response
2. Gate the component on `user.is_admin` instead of `user.id !== 1`
3. Verify backend `/admin/invite` routes also enforce this properly (backend concern)

---

#### [MED-2] Invite Code Displayed in Plaintext in URL Parameter

**File:** `apps/web/src/components/LoginPage.tsx:23-24`
```tsx
const [inviteCode] = useState<string | null>(() =>
  new URLSearchParams(window.location.search).get('invite')
);
```

The invite code is read from `?invite=<code>` in the URL. This means:
- The invite code appears in browser history
- It leaks in the `Referer` header if the user navigates to an external link before registering
- It appears in server access logs (Vercel logs will contain the full URL)
- It can be shared unintentionally via copy/paste of the URL

**Remediation:** Use a short-lived token system instead — the invite link contains a one-time token that the backend validates and exchanges for a session or registration allowance. The token should be consumed server-side on first use regardless.

---

#### [MED-3] Vite Dev Proxy Points to Production API

**File:** `apps/web/vite.config.ts:10`
```ts
target: 'https://vault-api.fly.dev',
```

The Vite development proxy targets the live production API (`vault-api.fly.dev`). This means:
- All local development operations (creates, deletes, patches) hit production data
- A developer running locally with real credentials is modifying real user data
- There is no staging/dev environment separation

**Remediation:** Change to `http://localhost:8000` for local dev. Use `VITE_API_URL` env var or a `.env.local` file to allow devs to point at production when explicitly needed.

---

#### [MED-4] Silent Backend Sync Failure on Profile Save

**File:** `apps/web/src/components/UserProfileSettings.tsx:39-43`
```tsx
} catch {
  // localStorage save succeeded; backend sync failed silently
  setSaved(true);
  onSaved?.();
  setTimeout(() => setSaved(false), 2000);
}
```

When the backend `PATCH /auth/profile` call fails, the user is shown "✓ Saved" — a false confirmation. For a fintech app where profile data (DOB, country) drives inflation tracker and portfolio planner calculations, a silent save failure means the user believes data is persisted when it is not. On next login from a different device, their profile will be missing.

**Remediation:** Show a distinct warning (e.g., "Saved locally — sync failed") instead of the success indicator when the backend call fails.

---

#### [MED-5] Access Token Directly Accessed from localStorage in Component

**File:** `apps/web/src/components/UserProfileSettings.tsx:34`
```tsx
const token = localStorage.getItem('vault_access_token');
```

This component bypasses the `AuthContext` and reads the token directly from localStorage using the raw key string. This creates a second access path that is not managed by the interceptor or refresh logic, and duplicates a magic string that already exists in `AuthContext.tsx:7` as `ACCESS_KEY`.

**Remediation:** Expose a `getAccessToken()` helper or a `useToken()` hook from `AuthContext` so all token access goes through a single controlled path.

---

### LOW

---

#### [LOW-1] No File Size or Type Validation Before Upload

**File:** `apps/web/src/components/ImportPDFModal.tsx:30-56`
**File:** `apps/web/src/components/ImportCSVModal.tsx:62-85`

Both import modals accept files via `<input type="file" accept=".pdf">` / `accept=".csv"` but only rely on the browser's `accept` attribute, which is not enforced and can be bypassed. Neither modal checks `file.size` before sending to the API. A very large file could cause a long hang or OOM on the backend PDF parser.

**Remediation:** Add client-side guard:
```ts
if (file.size > 10 * 1024 * 1024) { // 10MB
  setParseError('File too large (max 10MB)');
  return;
}
// Also verify MIME type: file.type === 'application/pdf'
```

---

#### [LOW-2] Monorepo `apps/web/package.json` is the Root Package File

**File:** `apps/web/package.json`

The `apps/web/package.json` file (260 bytes) is identical to the root `package.json` — it declares `"name": "fintech-monorepo"` with only turbo as a devDependency. The actual web dependencies (react, axios, recharts, vite) exist only in the worktree copy at `.claude/worktrees/.../apps/web/package.json`. This discrepancy means:
- Running `pnpm install` in `apps/web/` does not install web deps
- Any automated security scanning (Dependabot, `pnpm audit`) against `apps/web/package.json` would scan nothing
- The actual dependency versions in use are unknown from the main repo

**Remediation:** Restore the correct `apps/web/package.json` (with `@vault/web` name, react, axios, recharts, vite, etc.) in the main working tree.

---

#### [LOW-3] No Request Timeout on Main API Instance

**File:** `apps/web/src/services/api.ts:4-5`
```ts
const api = axios.create({ baseURL: `${base}/api` });
```

The main `api` axios instance has no `timeout` configured. Only `authApi` in `services/auth.ts:4` has `timeout: 20000`. If the backend is cold-starting on Fly.io (the app already pings `/api/health` every 9 minutes to mitigate this), or a slow network is involved, API calls will hang indefinitely with no user feedback.

**Remediation:** Add `timeout: 30000` to the `api` instance in `services/api.ts`.

---

#### [LOW-4] Invite Code Visible to Clipboard (No Masking)

**File:** `apps/web/src/components/InviteManager.tsx:51-58`

The invite code is displayed in plaintext inside a `<code>` element with a "Copy" button. If an admin's screen is visible to others (e.g., shared screen, shoulder surfing), the code is fully exposed. Minor concern but worth noting for a single-admin fintech.

---

#### [LOW-5] Weak Password Minimum (8 chars) for Financial App

**File:** `apps/web/src/components/LoginPage.tsx:62-63`
```ts
else if (mode === 'register' && password.length < 8)
  errs.password = tl.errPasswordMin;
```

8-character minimum is below NIST SP 800-63B's recommendation of 15 characters for financial accounts. The strength meter is a good UX touch, but it's advisory only — a user can still submit a "Weak" (level 1) password. The backend should enforce a minimum of 12-15 characters.

---

#### [LOW-6] No CSRF Protection on State-Changing Requests

Since JWT tokens are in localStorage (not httpOnly cookies), CSRF is technically not exploitable in the current setup. However, this is a consequence of the insecure token storage described in HIGH-1. If tokens are moved to httpOnly cookies (the recommended fix), CSRF protection becomes mandatory. Note this dependency: fixing HIGH-1 requires simultaneously implementing CSRF protection (e.g., `SameSite=Strict` cookie attribute, or a CSRF token in a custom header).

---

#### [LOW-7] `dist/` and `.vercel/` Committed to Repository

**File:** Root `.gitignore` does not exclude `apps/web/dist/`
**File:** `apps/web/.gitignore` only excludes `.vercel` (the deployment config dir), but `apps/web/dist/` is present and committed

Built artifacts in the repository increase repo size, can contain stale builds with old vulnerabilities, and expose compiled output unnecessarily. The root `.gitignore` excludes `dist/` at root level but `apps/web/dist/` is still present (confirmed by directory listing).

**Remediation:** Add `dist/` to `apps/web/.gitignore` and remove the committed dist directory.

---

## Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| HIGH-1 | HIGH | AuthContext.tsx | JWT tokens in localStorage (XSS → account takeover) |
| HIGH-2 | HIGH | vercel.json | Zero security headers on production deployment |
| HIGH-3 | HIGH | index.html | No security meta tags |
| MED-1 | MEDIUM | InviteManager.tsx | Admin gate on hardcoded user.id (should be role/claim) |
| MED-2 | MEDIUM | LoginPage.tsx | Invite code exposed in URL (history, logs, referrer) |
| MED-3 | MEDIUM | vite.config.ts | Dev proxy targets production API |
| MED-4 | MEDIUM | UserProfileSettings.tsx | Silent backend sync failure shown as success |
| MED-5 | MEDIUM | UserProfileSettings.tsx | Raw localStorage access bypasses AuthContext |
| LOW-1 | LOW | ImportPDFModal.tsx, ImportCSVModal.tsx | No file size/MIME validation before upload |
| LOW-2 | LOW | apps/web/package.json | package.json is root file, not web-app file |
| LOW-3 | LOW | services/api.ts | No request timeout on main axios instance |
| LOW-4 | LOW | InviteManager.tsx | Plaintext invite code visible on screen |
| LOW-5 | LOW | LoginPage.tsx | 8-char password minimum too weak for fintech |
| LOW-6 | LOW | (architectural) | CSRF exposure if httpOnly cookies adopted (planned dep) |
| LOW-7 | LOW | apps/web/dist/ | Built artifacts committed to repository |

## Log

- Read: package.json (root/web), vite.config.ts, index.html, main.tsx, tsconfig.json, vercel.json
- Read: services/api.ts, services/auth.ts, context/AuthContext.tsx
- Read: components/LoginPage.tsx, ImportPDFModal.tsx, ImportCSVModal.tsx, InviteManager.tsx
- Read: components/UserProfileSettings.tsx, UserMenu.tsx, App.tsx
- Read: types/index.ts
- Searched: dangerouslySetInnerHTML, innerHTML, eval, document.write (none found — good)
- Searched: console.log in components (none found — good)
- Searched: hardcoded URLs in src (none found — correct use of proxy)
- Searched: localStorage usage (found in AuthContext, FinancialHealth, LangContext, UserProfileSettings)
- Confirmed: apps/web/package.json is actually the root monorepo package.json (260 bytes)
- Confirmed: dist/ directory is committed (present in directory listing)
- Confirmed: no .env files present (good)
- Confirmed: no dangerouslySetInnerHTML or XSS vectors in JSX (good)
- Confirmed: no hardcoded secrets or API keys in source files

## Next step

Developer (frontend + backend) should:
1. Fix HIGH-1 (localStorage → httpOnly cookies) — requires backend change first
2. Fix HIGH-2 (vercel.json headers) — frontend-only, low effort, high impact
3. Fix MED-3 (vite proxy → localhost:8000) — one-line change
4. Fix MED-5 (raw localStorage access in UserProfileSettings) — refactor to use AuthContext
