import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getMe } from '../services/auth';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name?: string, invite_code?: string) => Promise<void>;
  logout: () => void;
  /** Always returns null — tokens live in httpOnly cookies, not JS. Kept for interface stability. */
  getAccessToken: () => null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort: clear server-side cookie even if request fails
    }
    setUser(null);
  }, []);

  // Response interceptor: on 401, attempt cookie-refresh then retry once
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      res => res,
      async err => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            await api.post('/auth/cookie-refresh');
            return api(original);
          } catch {
            setUser(null);
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [logout]);

  // On mount: restore session — if the httpOnly cookie exists, /me succeeds automatically
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    // Server sets httpOnly cookies on successful login; JSON tokens also returned for mobile compat
    await apiLogin(email, password);
    const me = await getMe();
    setUser(me);
  };

  const register = async (email: string, password: string, full_name?: string, invite_code?: string) => {
    // Server sets httpOnly cookies on successful register
    await apiRegister(email, password, full_name, invite_code);
    const me = await getMe();
    setUser(me);
  };

  const getAccessToken = (): null => null;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
