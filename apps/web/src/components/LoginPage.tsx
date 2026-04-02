import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register';
type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirm', string>>;

function pwStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: '' };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /[0-9]/.test(pw);
  const hasSpec  = /[^A-Za-z0-9]/.test(pw);
  const score    = (pw.length >= 10 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
  if (score <= 1) return { level: 1, label: 'Weak',   color: 'var(--red)' };
  if (score <= 2) return { level: 2, label: 'Fair',   color: 'var(--yellow)' };
  return           { level: 3, label: 'Strong', color: 'var(--green)' };
}

function validate(mode: Mode, email: string, password: string, confirm: string, fullName: string): FieldErrors {
  const errs: FieldErrors = {};
  if (mode === 'register' && fullName.trim().length > 0 && fullName.trim().length < 2) {
    errs.fullName = 'Name must be at least 2 characters';
  }
  if (!email.trim()) {
    errs.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errs.email = 'Enter a valid email address';
  }
  if (!password) {
    errs.password = 'Password is required';
  } else if (mode === 'register' && password.length < 8) {
    errs.password = 'Password must be at least 8 characters';
  }
  if (mode === 'register' && password && confirm !== password) {
    errs.confirm = 'Passwords do not match';
  }
  return errs;
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode]       = useState<Mode>('login');
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError('');

    const errs = validate(mode, email, password, confirm, fullName);
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
        await register(email.trim(), password, fullName.trim() || undefined);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiError(detail ?? 'Something went wrong. Please try again.');
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const strength = mode === 'register' ? pwStrength(password) : null;

  return (
    <div className="auth-screen">
      <div className={`auth-card ${shake ? 'auth-shake' : ''}`}>
        <div className="auth-logo"><em>V</em>ault</div>
        <p className="auth-tagline">Your global personal finance platform</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
            type="button"
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="full-name">Full name <span className="auth-optional">(optional)</span></label>
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
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
            <div className="auth-input-row">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
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
                aria-label={showPw ? 'Hide password' : 'Show password'}
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
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="confirm">Confirm password</label>
              <div className="auth-input-row">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password"
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
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
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
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
