import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe } from '../services/api';

interface User { id: number; email: string; full_name?: string; }

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login:  (tokens: { access_token: string; refresh_token: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('access_token').then(token => {
      if (!token) { setLoading(false); return; }
      getMe()
        .then(setUser)
        .catch(() => AsyncStorage.multiRemove(['access_token', 'refresh_token']))
        .finally(() => setLoading(false));
    });
  }, []);

  const login = async (tokens: { access_token: string; refresh_token: string }) => {
    await AsyncStorage.setItem('access_token', tokens.access_token);
    await AsyncStorage.setItem('refresh_token', tokens.refresh_token);
    const me = await getMe();
    setUser(me);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
