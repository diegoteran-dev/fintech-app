import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

type Mode = 'login' | 'register';
type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirm', string>>;

function pwStrengthLevel(pw: string): { level: 0 | 1 | 2 | 3; color: string } {
  if (pw.length === 0) return { level: 0, color: '' };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /[0-9]/.test(pw);
  const hasSpec  = /[^A-Za-z0-9]/.test(pw);
  const score    = (pw.length >= 10 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
  if (score <= 1) return { level: 1, color: 'var(--red)' };
  if (score <= 2) return { level: 2, color: 'var(--yellow)' };
  return           { level: 3, color: 'var(--green)' };
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const { t } = useLang();
  const [mode, setMode]       = useState<Mode>('login');
  const [inviteCode]          = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('invite')
  );
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake]         = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setApiError('');
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    const tl = t.login;
    if (mode === 'register' && fullName.trim().length > 0 && fullName.trim().length < 2)
      errs.fullName = tl.errNameMin;
    if (!email.trim())
      errs.email = tl.errEmailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = tl.errEmailInvalid;
    if (!password)
      errs.password = tl.errPasswordRequired;
    else if (mode === 'register' && password.length < 8)
      errs.password = tl.errPasswordMin;
    if (mode === 'register' && password && confirm !== password)
      errs.confirm = tl.errPasswordMatch;
    return errs;
  };

  const strength = mode === 'register' ? pwStrengthLevel(password) : null;
  const strengthLabel = strength
    ? strength.level === 1 ? t.login.pwWeak
    : strength.level === 2 ? t.login.pwFair
    : strength.level === 3 ? t.login.pwStrong
    : ''
    : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError('');

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      triggerShake();
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, fullName.trim() || undefined, inviteCode ?? undefined);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiError(detail ?? t.login.fallbackError);
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className={`auth-card ${shake ? 'auth-shake' : ''}`}>
        <div className="auth-logo"><em>V</em>ault</div>
        <p className="auth-tagline">{t.login.tagline}</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
            type="button"
          >
            {t.login.signIn}
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
            type="button"
          >
            {t.login.createAccount}
          </button>
        </div>

        {mode === 'register' && !inviteCode && (
          <div className="invite-gate">
            <div className="invite-gate-icon">🔒</div>
            <div className="invite-gate-title">{t.invite.gateTitle}</div>
            <p className="invite-gate-body">{t.invite.gateBody}</p>
          </div>
        )}

        {mode === 'register' && inviteCode && (
          <div className="invite-badge">
            <span>🎟</span> {t.invite.badge}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate style={mode === 'register' && !inviteCode ? { display: 'none' } : {}}>
          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="full-name">{t.login.fullName} <span className="auth-optional">{t.login.fullNameOptional}</span></label>
              <input
                id="full-name"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={e => { setFullName(e.target.value); clearFieldError('fullName'); }}
                autoComplete="name"
                className={fieldErrors.fullName ? 'auth-input--error' : ''}
              />
              {fieldErrors.fullName && <span className="auth-field-error">{fieldErrors.fullName}</span>}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">{t.login.email}</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
              autoComplete="email"
              className={fieldErrors.email ? 'auth-input--error' : ''}
            />
            {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="password">{t.login.password}</label>
            <div className="auth-input-row">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'register' ? t.login.passwordPlaceholder : '••••••••'}
                value={password}
                onChange={e => { setPassword(e.target.value); clearFieldError('password'); }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={fieldErrors.password ? 'auth-input--error' : ''}
              />
              <button
                type="button"
                className="auth-pw-btn"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                aria-label={showPw ? t.login.hidePassword : t.login.showPassword}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
            {strength && strength.level > 0 && (
              <div className="pw-strength-row">
                <div className="pw-bar">
                  <div
                    className="pw-bar-fill"
                    style={{
                      width: `${(strength.level / 3) * 100}%`,
                      background: strength.color,
                    }}
                  />
                </div>
                <span className="pw-strength-label" style={{ color: strength.color }}>
                  {strengthLabel}
                </span>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="confirm">{t.login.confirmPassword}</label>
              <div className="auth-input-row">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder={t.login.confirmPlaceholder}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); clearFieldError('confirm'); }}
                  autoComplete="new-password"
                  className={fieldErrors.confirm ? 'auth-input--error' : ''}
                />
                <button
                  type="button"
                  className="auth-pw-btn"
                  onClick={() => setShowConfirm(v => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? t.login.hidePassword : t.login.showPassword}
                >
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {fieldErrors.confirm && <span className="auth-field-error">{fieldErrors.confirm}</span>}
            </div>
          )}

          {apiError && <p className="auth-error">{apiError}</p>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting
              ? <span className="auth-spinner" />
              : mode === 'login' ? t.login.signIn : t.login.createAccount
            }
          </button>
        </form>
      </div>
    </div>
  );
}
