import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { login as apiLogin, register as apiRegister, refreshTokens, getMe } from '../services/auth';
import type { AuthUser } from '../types';

const ACCESS_KEY = 'vault_access_token';
const REFRESH_KEY = 'vault_refresh_token';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const interceptorRef = useRef<number | null>(null);

  const storeTokens = (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  };

  const clearTokens = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  };

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  // Attach JWT interceptor to the shared api instance
  useEffect(() => {
    if (interceptorRef.current !== null) {
      api.interceptors.request.eject(interceptorRef.current);
    }
    interceptorRef.current = api.interceptors.request.use(config => {
      const token = localStorage.getItem(ACCESS_KEY);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Response interceptor: auto-refresh on 401
    const responseInterceptor = api.interceptors.response.use(
      res => res,
      async err => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry) {
          original._retry = true;
          const refresh = localStorage.getItem(REFRESH_KEY);
          if (refresh) {
            try {
              const tokens = await refreshTokens(refresh);
              storeTokens(tokens.access_token, tokens.refresh_token);
              original.headers.Authorization = `Bearer ${tokens.access_token}`;
              return api(original);
            } catch {
              logout();
            }
          } else {
            logout();
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [logout]);

  // On mount: try to restore session from stored tokens
  useEffect(() => {
    const access = localStorage.getItem(ACCESS_KEY);
    if (!access) {
      setLoading(false);
      return;
    }
    getMe(access)
      .then(setUser)
      .catch(() => {
        const refresh = localStorage.getItem(REFRESH_KEY);
        if (!refresh) { clearTokens(); return; }
        return refreshTokens(refresh)
          .then(tokens => {
            storeTokens(tokens.access_token, tokens.refresh_token);
            return getMe(tokens.access_token);
          })
          .then(setUser)
          .catch(() => clearTokens());
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await apiLogin(email, password);
    storeTokens(tokens.access_token, tokens.refresh_token);
    const me = await getMe(tokens.access_token);
    setUser(me);
  };

  const register = async (email: string, password: string, full_name?: string) => {
    const tokens = await apiRegister(email, password, full_name);
    storeTokens(tokens.access_token, tokens.refresh_token);
    const me = await getMe(tokens.access_token);
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
