import axios from 'axios';
import type { Transaction, TransactionCreate, FinancialHealth } from '../types';

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
