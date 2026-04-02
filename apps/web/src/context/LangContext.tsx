import { createContext, useContext, useState, type ReactNode } from 'react';
import { translations, type Lang, type T } from '../i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('vault-lang') as Lang) ?? 'en';
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('vault-lang', l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
