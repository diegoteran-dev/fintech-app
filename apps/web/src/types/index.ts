export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  currency: string;
  amount_usd: number | null;
  category: string;
  type: 'income' | 'expense';
  date: string;
  is_recurring: boolean;
  created_at: string;
}

export interface TransactionCreate {
  description: string;
  amount: number;
  currency: string;
  category: string;
  type: 'income' | 'expense';
  date: string;
  is_recurring?: boolean;
}

export interface Budget {
  id: number;
  category: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'weekly' | 'yearly';
  spent: number;
  percentage: number;
  created_at: string;
}

export interface BudgetCreate {
  category: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'weekly' | 'yearly';
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface RuleAnalysis {
  label: string;
  actual_pct: number;
  target_pct: number;
  amount: number;
  categories: string[];
  status: 'on_track' | 'over' | 'under';
}

export interface NetWorthEntry {
  id: number;
  amount_usd: number;
  date: string;
  notes: string | null;
  created_at: string | null;
}

export interface NetWorthCreate {
  amount_usd: number;
  date: string;
  notes?: string;
}

export interface Account {
  id: number;
  name: string;
  institution: string | null;
  account_type: string;
  currency: string;
  current_balance: number;
  created_at: string | null;
}

export interface AccountCreate {
  name: string;
  institution?: string;
  account_type: string;
  currency: string;
  current_balance: number;
}

export interface Holding {
  id: number;
  asset_type: 'stock' | 'etf' | 'metal' | 'crypto' | 'cash';
  ticker: string;
  name: string | null;
  quantity: number;
  price: number | null;
  value: number | null;
}

export interface HoldingCreate {
  asset_type: 'stock' | 'etf' | 'metal' | 'crypto' | 'cash';
  ticker: string;
  name?: string;
  quantity: number;
}

export interface TickerResult {
  ticker: string;
  name: string | null;
  price: number | null;
}

export interface FinancialHealth {
  grade: string;
  score: number;
  total_income: number;
  total_expenses: number;
  rules: RuleAnalysis[];
  category_breakdown: CategoryBreakdown[];
  month: string;
}
