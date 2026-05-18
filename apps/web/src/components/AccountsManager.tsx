import { useState, useEffect, useCallback } from 'react';
import type { Account, AccountCreate } from '../types';
import {
  getAccounts,
  createAccount,
  updateAccountBalance,
  deleteAccount,
} from '../services/api';

const ACCOUNT_TYPES = ['checking', 'savings', 'investment', 'crypto'];
const CURRENCIES = ['USD', 'BOB', 'ARS', 'MXN'];

const typeLabel = (t: string) => {
  const map: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    investment: 'Investment',
    crypto: 'Crypto',
  };
  return map[t] ?? t;
};

const typeColor = (t: string) => {
  const map: Record<string, string> = {
    checking: '#2563EB',
    savings: '#22C55E',
    investment: '#7C3AED',
    crypto: '#F59E0B',
  };
  return map[t] ?? 'var(--text-3)';
};

const currencySymbol = (c: string) => {
  if (c === 'BOB') return 'Bs.';
  return '$';
};

export default function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline balance editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState('');

  const [form, setForm] = useState<AccountCreate>({
    name: '',
    institution: '',
    account_type: 'checking',
    currency: 'USD',
    current_balance: 0,
  });

  const refresh = useCallback(() => {
    setLoading(true);
    getAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Account name is required.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await createAccount({ ...form, name: form.name.trim() });
      setShowForm(false);
      setForm({ name: '', institution: '', account_type: 'checking', currency: 'USD', current_balance: 0 });
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create account.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteAccount(id);
    refresh();
  };

  const handleSaveBalance = async (id: number) => {
    const bal = parseFloat(editBalance);
    if (isNaN(bal)) return;
    await updateAccountBalance(id, bal);
    setEditingId(null);
    setEditBalance('');
    refresh();
  };

  const totalUSD = accounts
    .filter(a => a.currency === 'USD')
    .reduce((sum, a) => sum + a.current_balance, 0);

  return (
    <div className="budget-layout">
      {/* Sidebar — Add Account Form */}
      <div className="card card-sticky">
        <div className="card-title">Accounts</div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="budget-form">
            <label className="form-label">Account Name</label>
            <input
              className="form-input"
              placeholder="e.g. Main Checking"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />

            <label className="form-label" style={{ marginTop: 12 }}>Institution (optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Chase Bank"
              value={form.institution ?? ''}
              onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
            />

            <label className="form-label" style={{ marginTop: 12 }}>Type</label>
            <select
              className="form-select"
              value={form.account_type}
              onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </select>

            <label className="form-label" style={{ marginTop: 12 }}>Current Balance</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="form-select"
                style={{ flex: '0 0 90px' }}
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 2500"
                value={form.current_balance || ''}
                onChange={e => setForm(f => ({ ...f, current_balance: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 1 }}>
                {submitting ? 'Saving…' : 'Add Account'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowForm(false); setError(null); }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => setShowForm(true)}
          >
            + Add Account
          </button>
        )}

        {accounts.length > 0 && (
          <div style={{
            marginTop: 20,
            padding: '14px 0 0',
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Total Balance (USD)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>USD accounts only</div>
          </div>
        )}
      </div>

      {/* Main — Account cards */}
      <div>
        {loading ? (
          <div style={{ color: 'var(--text-3)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏦</div>
            <div style={{ fontSize: 14 }}>No accounts yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Add a checking, savings, or investment account to track your balances</div>
          </div>
        ) : (
          <div className="budget-list">
            {accounts.map(a => {
              const sym = currencySymbol(a.currency);
              return (
                <div key={a.id} className="budget-card">
                  <div className="budget-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="budget-dot"
                        style={{ background: typeColor(a.account_type) }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{a.name}</span>
                        {a.institution && (
                          <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{a.institution}</span>
                        )}
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: typeColor(a.account_type),
                          background: `${typeColor(a.account_type)}22`,
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 500,
                        }}>
                          {typeLabel(a.account_type).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button
                      className="budget-delete"
                      onClick={() => handleDelete(a.id)}
                      title="Delete account"
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                      Balance · {a.currency}
                    </div>

                    {editingId === a.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={editBalance}
                          onChange={e => setEditBalance(e.target.value)}
                          style={{ padding: '5px 10px', fontSize: 15, width: 140 }}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveBalance(a.id);
                            if (e.key === 'Escape') { setEditingId(null); setEditBalance(''); }
                          }}
                        />
                        <button
                          className="btn-primary"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => handleSaveBalance(a.id)}
                        >Save</button>
                        <button
                          className="btn-ghost"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => { setEditingId(null); setEditBalance(''); }}
                        >Cancel</button>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: 'var(--text)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        title="Click to edit balance"
                        onClick={() => { setEditingId(a.id); setEditBalance(String(a.current_balance)); }}
                      >
                        {sym}{a.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>✎</span>
                      </div>
                    )}
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
