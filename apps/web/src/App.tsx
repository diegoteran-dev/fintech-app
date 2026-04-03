import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import './index.css';
import type { Transaction } from './types';
import { getTransactions } from './services/api';
import LoginPage from './components/LoginPage';
import UserMenu from './components/UserMenu';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LangContext';

const Dashboard = lazy(() => import('./components/Dashboard'));
const SpendingChart = lazy(() => import('./components/SpendingChart'));
const TransactionList = lazy(() => import('./components/TransactionList'));
const FinancialHealth = lazy(() => import('./components/FinancialHealth'));
const BudgetManager = lazy(() => import('./components/BudgetManager'));

type Tab = 'transactions' | 'health' | 'budgets' | 'dashboard';

const LoadingFallback = () => (
  <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
    Loading…
  </div>
);

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('transactions');

  // Keep Render free-tier backend warm while tab is open (every 9 min)
  useEffect(() => {
    const ping = () => fetch('/api/health').catch(() => {});
    const id = setInterval(ping, 9 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) return;
    getTransactions()
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      refresh();
    }
  }, [user, refresh]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        Loading…
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);

  const byCategory = expenses.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const categoryBreakdown = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0,
    }));

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo">
          <em>V</em>ault
        </div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${tab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setTab('dashboard')}
          >
            {t.nav.dashboard}
          </button>
          <button
            className={`nav-tab ${tab === 'transactions' ? 'active' : ''}`}
            onClick={() => setTab('transactions')}
          >
            {t.nav.transactions}
          </button>
          <button
            className={`nav-tab ${tab === 'health' ? 'active' : ''}`}
            onClick={() => setTab('health')}
          >
            {t.nav.health}
          </button>
          <button
            className={`nav-tab ${tab === 'budgets' ? 'active' : ''}`}
            onClick={() => setTab('budgets')}
          >
            {t.nav.budgets}
          </button>
        </div>
        <UserMenu />
      </nav>

      <main className="main">
        {loading ? (
          <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 60 }}>
            Loading…
          </div>
        ) : tab === 'dashboard' ? (
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard transactions={transactions} onAddTransaction={refresh} />
          </Suspense>
        ) : tab === 'transactions' ? (
          <Suspense fallback={<LoadingFallback />}>
            <div className="tx-layout">
              <SpendingChart data={categoryBreakdown} totalExpenses={totalExpenses} />
              <TransactionList transactions={transactions} onRefresh={refresh} />
            </div>
          </Suspense>
        ) : tab === 'health' ? (
          <Suspense fallback={<LoadingFallback />}>
            <FinancialHealth />
          </Suspense>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <BudgetManager />
          </Suspense>
        )}
      </main>
    </div>
  );
}
