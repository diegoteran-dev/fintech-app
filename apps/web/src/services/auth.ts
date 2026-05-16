import axios, { AxiosError, type AxiosResponse } from 'axios';
import type { AuthUser, TokenResponse } from '../types';

const authApi = axios.create({ baseURL: '/api/auth', timeout: 20000 });

const AUTH_ERROR_MESSAGE = 'Invalid credentials. Please try again.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const INTERNAL_LEAK_PATTERNS = [
  /Traceback/i,
  /at \w+ \(/,
  /File "[^"]+", line \d+/,
  /sqlalchemy/i,
  /psycopg/i,
  /IntegrityError/i,
  /ProgrammingError/i,
  /OperationalError/i,
  /\/Users\//,
  /\/home\//,
  /node_modules/,
];

function isSafeDetail(detail: unknown): detail is string {
  if (typeof detail !== 'string') return false;
  if (detail.length === 0 || detail.length > 200) return false;
  return !INTERNAL_LEAK_PATTERNS.some(rx => rx.test(detail));
}

authApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ detail?: unknown }>) => {
    const status = error.response?.status;
    const rawDetail = error.response?.data?.detail;
    let safeMessage: string;
    if (status === 401 || status === 403) {
      safeMessage = AUTH_ERROR_MESSAGE;
    } else if (isSafeDetail(rawDetail)) {
      safeMessage = rawDetail;
    } else {
      safeMessage = GENERIC_ERROR_MESSAGE;
    }
    if (error.response) {
      error.response.data = { ...(error.response.data ?? {}), detail: safeMessage };
    }
    return Promise.reject(error);
  },
);

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    // Retry once on network error only (not on 4xx/5xx responses)
    if (!err.response) {
      await new Promise(r => setTimeout(r, 800));
      return fn();
    }
    throw err;
  }
}

export const register = (email: string, password: string, full_name?: string, invite_code?: string): Promise<TokenResponse> =>
  withRetry(() => authApi.post('/register', { email, password, full_name, invite_code }).then(r => r.data));

export const login = (email: string, password: string): Promise<TokenResponse> =>
  withRetry(() => authApi.post('/login', { email, password }).then(r => r.data));

export const refreshTokens = (refresh_token: string): Promise<TokenResponse> =>
  authApi.post('/refresh', { refresh_token }).then(r => r.data);

export const getMe = (access_token: string): Promise<AuthUser> =>
  authApi.get('/me', { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.data);

export const updateProfile = (
  access_token: string,
  data: { dob?: string | null; country?: string | null; full_name?: string | null },
): Promise<AuthUser> =>
  authApi.patch('/profile', data, { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.data);
