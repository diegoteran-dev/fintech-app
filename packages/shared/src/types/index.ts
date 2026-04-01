export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  plaidAccountId: string | null;
  name: string;
  type: AccountType;
  subtype: string | null;
  currentBalance: number;
  availableBalance: number | null;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountType = 'checking' | 'savings' | 'investment' | 'credit' | 'loan' | 'other';

export interface Transaction {
  id: string;
  accountId: string;
  plaidTransactionId: string | null;
  amount: number;
  currency: string;
  description: string;
  category: string | null;
  date: Date;
  pending: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
