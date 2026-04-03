import { useState } from 'react';
import type { TransactionCreate } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import { useLang } from '../context/LangContext';

interface Props {
  onClose: () => void;
  onSave: (data: TransactionCreate) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AddTransactionModal({ onClose, onSave }: Props) {
  const { t } = useLang();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today());
  const [isRecurring, setIsRecurring] = useState(false);
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
        is_recurring: isRecurring,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">{t.addModal.title}</span>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        <div className="field">
          <label>{t.addModal.typeLabel}</label>
          <div className="type-row">
            <button
              className={`type-btn ${type === 'expense' ? 'active-expense' : ''}`}
              onClick={() => { setType('expense'); setCategory(''); }}
            >
              {t.addModal.expense}
            </button>
            <button
              className={`type-btn ${type === 'income' ? 'active-income' : ''}`}
              onClick={() => { setType('income'); setCategory(''); }}
            >
              {t.addModal.income}
            </button>
          </div>
        </div>

        <div className="field">
          <label>{t.addModal.description}</label>
          <input
            type="text"
            placeholder={t.addModal.descPlaceholder}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label>{t.addModal.currency}</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t.addModal.amount} ({currency})</label>
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
          <label>{t.addModal.category}</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">{t.addModal.selectCategory}</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t.addModal.date}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="recurring-label">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="recurring-check"
            />
            {t.addModal.recurring}
          </label>
          {isRecurring && (
            <div className="recurring-hint">{t.addModal.recurringHint}</div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>{t.addModal.cancel}</button>
          <button className="btn-save" onClick={handleSave} disabled={!valid || saving}>
            {saving ? t.addModal.saving : t.addModal.save}
          </button>
        </div>
      </div>
    </div>
  );
}
