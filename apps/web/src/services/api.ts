import axios from 'axios';
import type { Transaction, TransactionCreate, FinancialHealth, Budget, BudgetCreate } from '../types';

const api = axios.create({ baseURL: '/api' });

export default api;

export const getTransactions = (): Promise<Transaction[]> =>
  api.get('/transactions').then(r => r.data);

export const createTransaction = (data: TransactionCreate): Promise<Transaction> =>
  api.post('/transactions', data).then(r => r.data);

export const deleteTransaction = (id: number): Promise<void> =>
  api.delete(`/transactions/${id}`).then(r => r.data);

export const getFinancialHealth = (month?: string): Promise<FinancialHealth> =>
  api.get('/financial-health', { params: month ? { month } : {} }).then(r => r.data);

export const getBudgets = (): Promise<Budget[]> =>
  api.get('/budgets').then(r => r.data);

export const createBudget = (data: BudgetCreate): Promise<Budget> =>
  api.post('/budgets', data).then(r => r.data);

export const updateBudget = (id: number, data: Partial<Pick<BudgetCreate, 'amount' | 'period'>>): Promise<Budget> =>
  api.put(`/budgets/${id}`, data).then(r => r.data);

export const deleteBudget = (id: number): Promise<void> =>
  api.delete(`/budgets/${id}`).then(r => r.data);
