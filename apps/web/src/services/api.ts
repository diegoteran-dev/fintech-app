import axios from 'axios';
import type { Transaction, TransactionCreate, FinancialHealth, Budget, BudgetCreate, NetWorthEntry, NetWorthCreate, Account, AccountCreate, Holding, HoldingCreate, TickerResult } from '../types';

const base = import.meta.env.VITE_API_URL ?? '';
const api = axios.create({ baseURL: `${base}/api` });

export default api;

export const getTransactions = (): Promise<Transaction[]> =>
  api.get('/transactions').then(r => r.data);

export const createTransaction = (data: TransactionCreate, fromImport = false): Promise<Transaction> =>
  api.post(fromImport ? '/transactions?from_import=true' : '/transactions', data).then(r => r.data);

export const deleteTransaction = (id: number): Promise<void> =>
  api.delete(`/transactions/${id}`).then(r => r.data);

export const updateTransaction = (
  id: number,
  data: { category?: string; description?: string; amount?: number },
): Promise<Transaction> =>
  api.patch(`/transactions/${id}`, data).then(r => r.data);

export const getFinancialHealth = (
  month?: string,
  targets?: { needs: number; wants: number; savings: number },
): Promise<FinancialHealth> =>
  api.get('/financial-health', {
    params: { ...(month ? { month } : {}), ...(targets ?? {}) },
  }).then(r => r.data);

export const getBudgets = (month?: string): Promise<Budget[]> =>
  api.get('/budgets', { params: month ? { month } : {} }).then(r => r.data);

export const createBudget = (data: BudgetCreate): Promise<Budget> =>
  api.post('/budgets', data).then(r => r.data);

export const updateBudget = (id: number, data: Partial<Pick<BudgetCreate, 'amount' | 'period'>>): Promise<Budget> =>
  api.put(`/budgets/${id}`, data).then(r => r.data);

export const deleteBudget = (id: number): Promise<void> =>
  api.delete(`/budgets/${id}`).then(r => r.data);

export const getNetWorth = (): Promise<NetWorthEntry[]> =>
  api.get('/net-worth').then(r => r.data);

export const createNetWorth = (data: NetWorthCreate): Promise<NetWorthEntry> =>
  api.post('/net-worth', data).then(r => r.data);

export const deleteNetWorth = (id: number): Promise<void> =>
  api.delete(`/net-worth/${id}`).then(r => r.data);

export const getAccounts = (): Promise<Account[]> =>
  api.get('/accounts').then(r => r.data);

export const createAccount = (data: AccountCreate): Promise<Account> =>
  api.post('/accounts', data).then(r => r.data);

export const updateAccountBalance = (id: number, current_balance: number): Promise<Account> =>
  api.patch(`/accounts/${id}`, { current_balance }).then(r => r.data);

export const deleteAccount = (id: number): Promise<void> =>
  api.delete(`/accounts/${id}`).then(r => r.data);

export const getTransactionMonths = (): Promise<string[]> =>
  api.get('/transactions/months').then(r => r.data);

export const generateRecurring = (): Promise<{ generated: number }> =>
  api.post('/transactions/generate-recurring').then(r => r.data);

export interface ParsedPdfRow {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  currency: string;
  category: string;
  comprobante?: string | null;
}

export interface YearlyMonth {
  month: string; // "Jan" … "Dec"
  income: number;
  expenses: number;
}

export const getYearlyOverview = (year: number): Promise<YearlyMonth[]> =>
  api.get('/dashboard/yearly-overview', { params: { year } }).then(r => r.data);

export interface MonthlyBalance {
  year: number;
  month: number;
  income_usd: number;
  expenses_usd: number;
  balance_usd: number;
  income_bob: number;
  expenses_bob: number;
  balance_bob: number;
  rate: number;
}

export const getMonthlyBalance = (year: number, month: number): Promise<MonthlyBalance> =>
  api.get('/dashboard/monthly-balance', { params: { year, month } }).then(r => r.data);

export const getUsdRate = (): Promise<{ rate: number; source: string; currency: string }> =>
  api.get('/utils/usd-rate').then(r => r.data);

export const getHoldings = (): Promise<Holding[]> =>
  api.get('/holdings').then(r => r.data);

export const createHolding = (data: HoldingCreate): Promise<Holding> =>
  api.post('/holdings', data).then(r => r.data);

export const updateHolding = (id: number, quantity: number): Promise<Holding> =>
  api.patch(`/holdings/${id}`, { quantity }).then(r => r.data);

export const deleteHolding = (id: number): Promise<void> =>
  api.delete(`/holdings/${id}`).then(r => r.data);

export const searchTicker = (q: string, type: string): Promise<TickerResult[]> =>
  api.get('/holdings/search', { params: { q, type } }).then(r => r.data);

export const parsePdf = (file: File): Promise<ParsedPdfRow[]> => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/transactions/parse-pdf', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export interface CategoryRule {
  id: number;
  merchant_raw: string;
  merchant_fingerprint: string;
  category: string;
  source: string;
  confidence: number;
  times_applied: number;
  updated_at: string | null;
}

export const getRules = (): Promise<CategoryRule[]> =>
  api.get('/rules').then(r => r.data);

export const updateRule = (id: number, category: string): Promise<{ id: number; category: string }> =>
  api.patch(`/rules/${id}`, { category }).then(r => r.data);

export const deleteRule = (id: number): Promise<void> =>
  api.delete(`/rules/${id}`).then(r => r.data);

export interface RecurringPattern {
  description: string;
  month_count: number;
  avg_amount: number;
  currency: string;
  category: string;
}

export const detectRecurring = (): Promise<RecurringPattern[]> =>
  api.get('/transactions/detect-recurring').then(r => r.data);

export const patchTransaction = (id: number, data: { is_recurring?: boolean; category?: string }): Promise<unknown> =>
  api.patch(`/transactions/${id}`, data).then(r => r.data);
