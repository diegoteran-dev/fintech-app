import { useState } from 'react';
import type { Transaction, TransactionCreate } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { createTransaction, deleteTransaction } from '../services/api';
import AddTransactionModal from './AddTransactionModal';
import { useLang } from '../context/LangContext';

interface Props {
  transactions: Transaction[];
  onRefresh: () => void;
}

const fmt = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function TransactionList({ transactions, onRefresh }: Props) {
  const { t } = useLang();
  const [showModal, setShowModal] = useState(false);

  const handleSave = async (data: TransactionCreate) => {
    await createTransaction(data);
    setShowModal(false);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
    onRefresh();
  };

  return (
    <div className="card">
      <div className="tx-header">
        <span className="tx-header-title">{t.transactions.title}</span>
        <button className="btn-add" onClick={() => setShowModal(true)}>
          {t.transactions.addBtn}
        </button>
      </div>

      <div className="tx-list">
        {transactions.length === 0 ? (
          <div className="tx-empty">{t.transactions.empty}</div>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="tx-item">
              <div
                className="tx-dot"
                style={{ background: CATEGORY_COLORS[tx.category] ?? '#94A3B8' }}
              />
              <div className="tx-info">
                <div className="tx-desc">{tx.description}</div>
                <div className="tx-sub">
                  <span className="tx-cat">{tx.category}</span>
                  <span className="tx-cat">·</span>
                  <span className="tx-date">{fmt(tx.date)}</span>
                </div>
              </div>
              <span className={`tx-amount ${tx.type}`}>
                {tx.type === 'income' ? '+' : '−'}
                {tx.currency !== 'USD'
                  ? `${tx.amount.toLocaleString()} ${tx.currency}`
                  : `$${tx.amount.toFixed(2)}`}
                {tx.currency !== 'USD' && tx.amount_usd != null && (
                  <span className="tx-usd"> ≈ ${tx.amount_usd.toFixed(2)}</span>
                )}
              </span>
              <button className="tx-del" onClick={() => handleDelete(tx.id)} title="Delete">
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <AddTransactionModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}
