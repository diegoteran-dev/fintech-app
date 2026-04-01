import { useState, useEffect, useCallback } from 'react';
import './index.css';
import type { Transaction } from './types';
import { getTransactions } from './services/api';
import SpendingChart from './components/SpendingChart';
import TransactionList from './components/TransactionList';
import FinancialHealth from './components/FinancialHealth';

type Tab = 'transactions' | 'health';

export default function App() {
  const [tab, setTab] = useState<Tab>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getTransactions()
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);

  // Build category breakdown for the chart
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
            className={`nav-tab ${tab === 'transactions' ? 'active' : ''}`}
            onClick={() => setTab('transactions')}
          >
            Transactions
          </button>
          <button
            className={`nav-tab ${tab === 'health' ? 'active' : ''}`}
            onClick={() => setTab('health')}
          >
            Financial Health
          </button>
        </div>
      </nav>

      <main className="main">
        {loading ? (
          <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 60 }}>
            Loading…
          </div>
        ) : tab === 'transactions' ? (
          <div className="tx-layout">
            <SpendingChart data={categoryBreakdown} totalExpenses={totalExpenses} />
            <TransactionList transactions={transactions} onRefresh={refresh} />
          </div>
        ) : (
          <FinancialHealth />
        )}
      </main>
    </div>
  );
}
