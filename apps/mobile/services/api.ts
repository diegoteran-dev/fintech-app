import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Production backend — swap to your local IP for on-device dev
export const API_BASE = 'https://vault-api-tmk6.onrender.com/api';

const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

// Attach token to every request
api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await AsyncStorage.getItem('refresh_token');
        if (!refresh) throw new Error('no refresh token');
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
        await AsyncStorage.setItem('access_token', data.access_token);
        await AsyncStorage.setItem('refresh_token', data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      }
    }
    return Promise.reject(err);
  },
);

// ── Auth ──────────────────────────────────────────────────────────────────────
const authApi = axios.create({ baseURL: API_BASE, timeout: 15000 });

export const login = (email: string, password: string) =>
  authApi.post('/auth/login', { email, password }).then(r => r.data as { access_token: string; refresh_token: string });

export const register = (email: string, password: string, full_name?: string, invite_code?: string) =>
  authApi.post('/auth/register', { email, password, full_name, invite_code }).then(r => r.data as { access_token: string; refresh_token: string });

export const getMe = () =>
  api.get('/auth/me').then(r => r.data as { id: number; email: string; full_name?: string });

// ── Transactions ──────────────────────────────────────────────────────────────
export interface Transaction {
  id: number;
  description: string;
  amount: number;
  currency: string;
  amount_usd: number | null;
  category: string;
  type: 'income' | 'expense';
  date: string;
  merchant?: string;
  is_recurring?: boolean;
}

export interface TransactionCreate {
  description: string;
  amount: number;
  currency: string;
  category: string;
  type: 'income' | 'expense';
  date: string;
}

export const getTransactions = (): Promise<Transaction[]> =>
  api.get('/transactions').then(r => r.data);

export const createTransaction = (data: TransactionCreate): Promise<Transaction> =>
  api.post('/transactions', data).then(r => r.data);

export const deleteTransaction = (id: number): Promise<void> =>
  api.delete(`/transactions/${id}`).then(() => undefined);

// ── Budgets ───────────────────────────────────────────────────────────────────
export interface Budget {
  id: number;
  category: string;
  amount: number;
  currency: string;
  spent: number;
  percentage: number;
  period: string;
}

export const getBudgets = (month?: string): Promise<Budget[]> =>
  api.get('/budgets', { params: month ? { month } : {} }).then(r => r.data);

export const createBudget = (data: { category: string; amount: number; period: string }): Promise<Budget> =>
  api.post('/budgets', data).then(r => r.data);

export const deleteBudget = (id: number): Promise<void> =>
  api.delete(`/budgets/${id}`).then(() => undefined);

// ── Financial Health ──────────────────────────────────────────────────────────
export interface FinancialHealth {
  grade: string;
  score: number;
  needs_pct: number;
  wants_pct: number;
  savings_pct: number;
  needs_budget: number;
  wants_budget: number;
  savings_budget: number;
  needs_spent: number;
  wants_spent: number;
  savings_spent: number;
  total_income: number;
  total_expenses: number;
  month: string;
}

export const getFinancialHealth = (month?: string): Promise<FinancialHealth> =>
  api.get('/financial-health', { params: month ? { month } : {} }).then(r => r.data);

// ── Accounts ──────────────────────────────────────────────────────────────────
export interface Account {
  id: number;
  name: string;
  institution?: string;
  account_type: string;
  currency: string;
  current_balance: number;
}

export const getAccounts = (): Promise<Account[]> =>
  api.get('/accounts').then(r => r.data);

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface YearlyMonth {
  month: string;
  income: number;
  expenses: number;
}

export const getYearlyOverview = (year: number): Promise<YearlyMonth[]> =>
  api.get('/dashboard/yearly-overview', { params: { year } }).then(r => r.data);

export const getUsdRate = (): Promise<{ rate: number; source: string }> =>
  api.get('/utils/usd-rate').then(r => r.data);

export default api;
