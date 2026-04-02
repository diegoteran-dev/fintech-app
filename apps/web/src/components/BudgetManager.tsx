import { useState, useEffect, useCallback } from 'react';
import type { Budget, BudgetCreate } from '../types';
import { getBudgets, createBudget, deleteBudget } from '../services/api';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from '../constants';
import { useLang } from '../context/LangContext';

export default function BudgetManager() {
  const { t } = useLang();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<BudgetCreate>({
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    period: 'monthly',
  });

  const refresh = useCallback(() => {
    getBudgets()
      .then(setBudgets)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const usedCategories = new Set(budgets.map(b => b.category));
  const availableCategories = EXPENSE_CATEGORIES.filter(c => !usedCategories.has(c));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0) { setError(t.budgets.amountError); return; }
    setError(null);
    setSubmitting(true);
    try {
      await createBudget(form);
      setShowForm(false);
      setForm({ category: availableCategories[1] ?? EXPENSE_CATEGORIES[0], amount: 0, period: 'monthly' });
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t.budgets.createError;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteBudget(id);
    refresh();
  };

  if (loading) {
    return <div style={{ color: 'var(--text-3)', padding: 40, textAlign: 'center' }}>{t.common.loading}</div>;
  }

  return (
    <div className="budget-layout">
      {/* Sidebar — Add Budget Form */}
      <div className="card card-sticky">
        <div className="card-title">{t.budgets.title}</div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="budget-form">
            <label className="form-label">{t.budgets.category}</label>
            <select
              className="form-select"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              {availableCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <label className="form-label" style={{ marginTop: 12 }}>{t.budgets.monthlyLimit}</label>
            <input
              className="form-input"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 500"
              value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
            />

            {error && <div className="form-error">{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 1 }}>
                {submitting ? t.budgets.saving : t.budgets.saveBtn}
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setError(null); }}>
                {t.budgets.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => {
              if (availableCategories.length === 0) return;
              setForm(f => ({ ...f, category: availableCategories[0] }));
              setShowForm(true);
            }}
            disabled={availableCategories.length === 0}
          >
            {t.budgets.addBtn}
          </button>
        )}

        {availableCategories.length === 0 && !showForm && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
            {t.budgets.allCovered}
          </p>
        )}
      </div>

      {/* Main — Budget progress list */}
      <div>
        {budgets.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
            <div style={{ fontSize: 14 }}>{t.budgets.empty}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t.budgets.emptyHint}</div>
          </div>
        ) : (
          <div className="budget-list">
            {budgets.map(b => {
              const over = b.percentage > 100;
              const warning = b.percentage >= 80 && !over;
              const color = CATEGORY_COLORS[b.category] ?? 'var(--accent)';
              const barColor = over ? 'var(--red)' : warning ? 'var(--yellow)' : color;

              return (
                <div key={b.id} className={`budget-card${over ? ' budget-card--over' : warning ? ' budget-card--warning' : ''}`}>
                  <div className="budget-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="budget-dot"
                        style={{ background: color }}
                      />
                      <span className="budget-category">{b.category}</span>
                      {over && <span className="budget-badge budget-badge--over">{t.budgets.overBudget}</span>}
                      {warning && <span className="budget-badge budget-badge--warning">{t.budgets.nearLimit}</span>}
                    </div>
                    <button
                      className="budget-delete"
                      onClick={() => handleDelete(b.id)}
                      title="Delete budget"
                    >
                      ×
                    </button>
                  </div>

                  <div className="budget-amounts">
                    <span style={{ color: over ? 'var(--red)' : 'var(--text)' }}>
                      ${b.spent.toFixed(2)} {t.budgets.spent}
                    </span>
                    <span style={{ color: 'var(--text-2)' }}>
                      {t.budgets.of} ${b.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="budget-bar-track">
                    <div
                      className="budget-bar-fill"
                      style={{
                        width: `${Math.min(b.percentage, 100)}%`,
                        background: barColor,
                      }}
                    />
                  </div>

                  <div className="budget-footer">
                    <span style={{ color: over ? 'var(--red)' : warning ? 'var(--yellow)' : 'var(--text-2)' }}>
                      {b.percentage.toFixed(1)}% {t.budgets.usedPct}
                    </span>
                    <span style={{ color: 'var(--text-3)' }}>
                      {over
                        ? `$${(b.spent - b.amount).toFixed(2)} ${t.budgets.over}`
                        : `$${(b.amount - b.spent).toFixed(2)} ${t.budgets.remaining}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
