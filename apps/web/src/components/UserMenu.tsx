import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={ref} className="user-menu-wrap">
      <button
        className={`user-menu-btn ${open ? 'user-menu-btn--open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Menu"
        type="button"
      >
        <span className="user-menu-icon">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-email">{user?.email}</div>

          <div className="user-menu-divider" />

          <div className="user-menu-section-label">{t.menu.language}</div>
          <div className="user-menu-lang-row">
            <button
              className={`user-menu-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
              type="button"
            >
              {t.menu.en}
            </button>
            <button
              className={`user-menu-lang-btn ${lang === 'es' ? 'active' : ''}`}
              onClick={() => setLang('es')}
              type="button"
            >
              {t.menu.es}
            </button>
          </div>

          <div className="user-menu-divider" />

          <button className="user-menu-item user-menu-item--disabled" type="button" disabled>
            {t.menu.settings}
            <span className="user-menu-soon">{t.menu.settingsSoon}</span>
          </button>

          <button
            className="user-menu-item user-menu-item--signout"
            onClick={() => { setOpen(false); logout(); }}
            type="button"
          >
            {t.menu.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
