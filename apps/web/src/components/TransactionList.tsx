import { useState, useMemo } from 'react';
import type { Transaction, TransactionCreate } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { createTransaction, deleteTransaction, patchTransaction } from '../services/api';
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
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterRecurring, setFilterRecurring] = useState(false);

  const allCategories = useMemo(() => {
    const cats = [...new Set(transactions.map(tx => tx.category))].filter(Boolean);
    return cats.sort();
  }, [transactions]);

  const allMonths = useMemo(() => {
    const months = [...new Set(transactions.map(tx => tx.date?.slice(0, 7)).filter(Boolean))];
    return months.sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    let txs = transactions;
    if (search.trim()) {
      const q = search.toLowerCase();
      txs = txs.filter(tx => tx.description.toLowerCase().includes(q));
    }
    if (filterCat) txs = txs.filter(tx => tx.category === filterCat);
    if (filterType) txs = txs.filter(tx => tx.type === filterType);
    if (filterMonth) txs = txs.filter(tx => tx.date?.startsWith(filterMonth));
    if (filterRecurring) txs = txs.filter(tx => tx.is_recurring);
    return txs;
  }, [transactions, search, filterCat, filterType, filterMonth]);

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

      <div className="tx-filters">
        <input
          className="tx-search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="tx-filter-select"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        >
          <option value="">All months</option>
          {allMonths.map(m => (
            <option key={m} value={m}>
              {new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </option>
          ))}
        </select>
        <select
          className="tx-filter-select"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          className="tx-filter-select"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">All categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className="btn-ghost btn-sm"
          onClick={() => setFilterRecurring(r => !r)}
          style={{ opacity: filterRecurring ? 1 : 0.6, flexShrink: 0 }}
        >
          ↻ Recurring
        </button>
        {(search || filterCat || filterType || filterMonth || filterRecurring) && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => { setSearch(''); setFilterCat(''); setFilterType(''); setFilterMonth(''); setFilterRecurring(false); }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="tx-list">
        {filtered.length === 0 ? (
          <div className="tx-empty-state">
            <div className="tx-empty-icon">💸</div>
            <div className="tx-empty-msg">
              {transactions.length === 0 ? t.transactions.empty : 'No transactions match your filters.'}
            </div>
            {transactions.length === 0 && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                {t.onboarding.addFirstTx}
              </button>
            )}
          </div>
        ) : (
          filtered.map(tx => (
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
              <button
                className="tx-del"
                onClick={() => patchTransaction(tx.id, { is_recurring: !tx.is_recurring }).then(onRefresh)}
                title={tx.is_recurring ? 'Mark as non-recurring' : 'Mark as recurring'}
                style={{ color: tx.is_recurring ? 'var(--accent)' : undefined, opacity: tx.is_recurring ? 1 : 0.4 }}
              >
                ↻
              </button>
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
