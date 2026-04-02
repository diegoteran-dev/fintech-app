import { useState } from 'react';
import type { TransactionCreate } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';

interface Props {
  onClose: () => void;
  onSave: (data: TransactionCreate) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AddTransactionModal({ onClose, onSave }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const CURRENCIES = [
    { code: 'USD', label: 'USD — US Dollar' },
    { code: 'BOB', label: 'BOB — Boliviano' },
    { code: 'ARS', label: 'ARS — Argentine Peso' },
    { code: 'MXN', label: 'MXN — Mexican Peso' },
  ];

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const valid = description.trim() && Number(amount) > 0 && category && date;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: Number(amount),
        currency,
        category,
        type,
        date: new Date(date).toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">Add Transaction</span>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        <div className="field">
          <label>Type</label>
          <div className="type-row">
            <button
              className={`type-btn ${type === 'expense' ? 'active-expense' : ''}`}
              onClick={() => { setType('expense'); setCategory(''); }}
            >
              − Expense
            </button>
            <button
              className={`type-btn ${type === 'income' ? 'active-income' : ''}`}
              onClick={() => { setType('income'); setCategory(''); }}
            >
              + Income
            </button>
          </div>
        </div>

        <div className="field">
          <label>Description</label>
          <input
            type="text"
            placeholder="e.g. Monthly rent"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Amount ({currency})</label>
          <input
            type="number"
            placeholder="0.00"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Select category…</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
