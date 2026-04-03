import { useState } from 'react';
import type { Transaction } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_COLORS } from '../constants';
import { updateTransaction } from '../services/api';

interface Props {
  transactions: Transaction[];
  onClose: () => void;
  onSaved: () => void;
}

const fmt = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function RecategorizeModal({ transactions, onClose, onSaved }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = transactions.filter(tx =>
    tx.description.toLowerCase().includes(search.toLowerCase()) ||
    tx.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (tx: Transaction) => {
    setSelected(tx);
    setCategory(tx.category);
  };

  const handleSave = async () => {
    if (!selected || !category || category === selected.category) return;
    setSaving(true);
    try {
      await updateTransaction(selected.id, { category });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const cats = selected?.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal csv-modal">
        <div className="modal-head">
          <span className="modal-title">Re-categorize Transaction</span>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {!selected ? (
          <>
            <input
              className="nw-input"
              style={{ margin: '0 0 12px', width: '100%', boxSizing: 'border-box' }}
              placeholder="Search by description or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div className="csv-preview-wrap" style={{ maxHeight: 360 }}>
              {filtered.length === 0 ? (
                <div className="chart-empty">No transactions found</div>
              ) : (
                filtered.map(tx => (
                  <div
                    key={tx.id}
                    className="tx-item"
                    style={{ cursor: 'pointer', borderRadius: 6, padding: '8px 10px' }}
                    onClick={() => handleSelect(tx)}
                  >
                    <div
                      className="tx-dot"
                      style={{ background: CATEGORY_COLORS[tx.category] ?? '#94A3B8' }}
                    />
                    <div className="tx-info">
                      <div className="tx-desc" style={{ fontSize: 13 }}>{tx.description}</div>
                      <div className="tx-sub">
                        <span className="tx-cat">{tx.category}</span>
                        <span className="tx-cat">·</span>
                        <span className="tx-date">{fmt(tx.date)}</span>
                      </div>
                    </div>
                    <span
                      className={`tx-amount ${tx.type}`}
                      style={{ fontSize: 13 }}
                    >
                      {tx.type === 'income' ? '+' : '−'}
                      {tx.currency !== 'USD'
                        ? `${tx.amount.toLocaleString()} ${tx.currency}`
                        : `$${tx.amount.toFixed(2)}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                {selected.description}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {fmt(selected.date)} · {selected.currency !== 'USD'
                  ? `${selected.amount.toLocaleString()} ${selected.currency}`
                  : `$${selected.amount.toFixed(2)}`}
              </div>
            </div>

            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
              Change category from <strong style={{ color: CATEGORY_COLORS[selected.category] ?? 'var(--text-1)' }}>{selected.category}</strong> to:
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="nw-input"
              style={{ width: '100%', marginBottom: 16 }}
            >
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setSelected(null)}>← Back</button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={saving || category === selected.category}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
