import axios from 'axios';
import type { Transaction, TransactionCreate, FinancialHealth, Budget, BudgetCreate, NetWorthEntry, NetWorthCreate, Account, AccountCreate } from '../types';

const base = import.meta.env.VITE_API_URL ?? '';
const api = axios.create({ baseURL: `${base}/api` });

export default api;

export const getTransactions = (): Promise<Transaction[]> =>
  api.get('/transactions').then(r => r.data);

export const createTransaction = (data: TransactionCreate): Promise<Transaction> =>
  api.post('/transactions', data).then(r => r.data);

export const deleteTransaction = (id: number): Promise<void> =>
  api.delete(`/transactions/${id}`).then(r => r.data);

export const getFinancialHealth = (
  month?: string,
  targets?: { needs: number; wants: number; savings: number },
): Promise<FinancialHealth> =>
  api.get('/financial-health', {
    params: { ...(month ? { month } : {}), ...(targets ?? {}) },
  }).then(r => r.data);

export const getBudgets = (): Promise<Budget[]> =>
  api.get('/budgets').then(r => r.data);

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

export const generateRecurring = (): Promise<{ generated: number }> =>
  api.post('/transactions/generate-recurring').then(r => r.data);

export interface ParsedPdfRow {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  currency: string;
}

export const parsePdf = (file: File): Promise<ParsedPdfRow[]> => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/transactions/parse-pdf', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};
