import { useState } from 'react';
import type { Transaction, TransactionCreate } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { createTransaction, deleteTransaction } from '../services/api';
import AddTransactionModal from './AddTransactionModal';
import ImportCSVModal from './ImportCSVModal';
import ImportPDFModal from './ImportPDFModal';
import RecategorizeModal from './RecategorizeModal';
import { useLang } from '../context/LangContext';

interface Props {
  transactions: Transaction[];
  onRefresh: () => void;
}

const fmt = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Running balance (USD) keyed by transaction id — oldest→newest accumulation.
function buildRunningBalance(txs: Transaction[]): Map<number, number> {
  const sorted = [...txs].reverse();
  const map = new Map<number, number>();
  let running = 0;
  for (const tx of sorted) {
    const usd = tx.amount_usd ?? tx.amount;
    running += tx.type === 'income' ? usd : -usd;
    map.set(tx.id, running);
  }
  return map;
}

export default function TransactionList({ transactions, onRefresh }: Props) {
  const { t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [showRecategorize, setShowRecategorize] = useState(false);
  const [showBalance, setShowBalance] = useState(false);

  const runningBalance = showBalance ? buildRunningBalance(transactions) : null;

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
    <div className="card tx-list-card">
      <div className="tx-header">
        <span className="tx-header-title">{t.transactions.title}</span>
        <div className="tx-header-btns">
          <button
            className="btn-ghost btn-sm"
            onClick={() => setShowBalance(b => !b)}
            style={{ opacity: showBalance ? 1 : 0.6 }}
          >
            ≡ Balance
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setShowRecategorize(true)}>
            ✎ Categorize
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setShowPdfImport(true)}>
            {t.pdfImport.title}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setShowImport(true)}>
            {t.csvImport.title}
          </button>
          <button className="btn-add" onClick={() => setShowModal(true)}>
            {t.transactions.addBtn}
          </button>
        </div>
      </div>

      <div className="tx-list">
        {transactions.length === 0 ? (
          <div className="tx-empty-state">
            <div className="tx-empty-icon">💸</div>
            <div className="tx-empty-msg">{t.transactions.empty}</div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              {t.onboarding.addFirstTx}
            </button>
          </div>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className="tx-item">
              <div
                className="tx-dot"
                style={{ background: CATEGORY_COLORS[tx.category] ?? '#94A3B8' }}
              />
              <div className="tx-info">
                <div className="tx-desc">
                  {tx.description}
                  {tx.is_recurring && <span className="tx-recurring-badge">↻ Recurring</span>}
                </div>
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
              {runningBalance && (
                <span style={{
                  fontSize: 12,
                  color: (runningBalance.get(tx.id) ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                  minWidth: 80,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  ${(runningBalance.get(tx.id) ?? 0).toFixed(2)}
                </span>
              )}
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
      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); onRefresh(); }}
        />
      )}
      {showPdfImport && (
        <ImportPDFModal
          onClose={() => setShowPdfImport(false)}
          onImported={() => { setShowPdfImport(false); onRefresh(); }}
        />
      )}
      {showRecategorize && (
        <RecategorizeModal
          transactions={transactions}
          onClose={() => setShowRecategorize(false)}
          onSaved={() => { setShowRecategorize(false); onRefresh(); }}
        />
      )}
    </div>
  );
}
