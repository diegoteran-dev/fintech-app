import axios from 'axios';
import type { AuthUser, TokenResponse } from '../types';

const base = import.meta.env.VITE_API_URL ?? '';
const authApi = axios.create({ baseURL: `${base}/api/auth` });

export const register = (email: string, password: string, full_name?: string): Promise<TokenResponse> =>
  authApi.post('/register', { email, password, full_name }).then(r => r.data);

export const login = (email: string, password: string): Promise<TokenResponse> =>
  authApi.post('/login', { email, password }).then(r => r.data);

export const refreshTokens = (refresh_token: string): Promise<TokenResponse> =>
  authApi.post('/refresh', { refresh_token }).then(r => r.data);

export const getMe = (access_token: string): Promise<AuthUser> =>
  authApi.get('/me', { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.data);
