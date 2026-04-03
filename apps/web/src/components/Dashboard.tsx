import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Transaction, TransactionCreate, NetWorthEntry, Account } from '../types';
import { getNetWorth, createNetWorth, deleteNetWorth, getAccounts, createAccount, updateAccountBalance, deleteAccount, createTransaction } from '../services/api';
import { CATEGORY_COLORS } from '../constants';
import InfoPopover from './InfoPopover';
import AddTransactionModal from './AddTransactionModal';
import { useLang } from '../context/LangContext';

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  checking:   '#7B61FF',
  savings:    '#1D9E75',
  investment: '#F5A623',
  crypto:     '#00BCD4',
};

interface Props {
  transactions: Transaction[];
  onAddTransaction?: () => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function txMonth(t: Transaction): string {
  return t.date.slice(0, 7);
}

function fmtMonth(ym: string): string {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

function usd(t: Transaction): number {
  return t.amount_usd ?? t.amount;
}

// ── sub-components ────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-name">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, fontSize: 12 }}>
          {p.name}: <strong>${Number(p.value).toFixed(2)}</strong>
        </div>
      ))}
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard({ transactions, onAddTransaction }: Props) {
  const { t } = useLang();
  const [showAddModal, setShowAddModal] = useState(false);

  const handleModalSave = async (data: TransactionCreate) => {
    await createTransaction(data);
    setShowAddModal(false);
    onAddTransaction?.();
  };

  const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    checking:   t.dashboard.checking,
    savings:    t.dashboard.savings,
    investment: t.dashboard.investment,
    crypto:     t.dashboard.crypto,
  };

  const [netWorthEntries, setNetWorthEntries] = useState<NetWorthEntry[]>([]);
  const [nwAmount, setNwAmount] = useState('');
  const [nwDate, setNwDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nwNotes, setNwNotes] = useState('');
  const [nwLoading, setNwLoading] = useState(true);

  // accounts state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAccForm, setShowAccForm] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('checking');
  const [accInstitution, setAccInstitution] = useState('');
  const [accCurrency, setAccCurrency] = useState('USD');
  const [accBalance, setAccBalance] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [accSaving, setAccSaving] = useState(false);

  useEffect(() => {
    getNetWorth()
      .then(setNetWorthEntries)
      .finally(() => setNwLoading(false));
    getAccounts().then(setAccounts);
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);

  const addAccount = async () => {
    if (!accName.trim() || accBalance === '' || isNaN(Number(accBalance))) return;
    setAccSaving(true);
    try {
      const acc = await createAccount({
        name: accName.trim(),
        institution: accInstitution.trim() || undefined,
        account_type: accType,
        currency: accCurrency,
        current_balance: Number(accBalance),
      });
      setAccounts(prev => [...prev, acc]);
      setAccName(''); setAccInstitution(''); setAccBalance(''); setAccType('checking'); setAccCurrency('USD');
      setShowAccForm(false);
    } finally {
      setAccSaving(false);
    }
  };

  const saveEditBalance = async (id: number) => {
    if (editBalance === '' || isNaN(Number(editBalance))) return;
    const updated = await updateAccountBalance(id, Number(editBalance));
    setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    setEditingId(null);
    setEditBalance('');
  };

  const removeAccount = async (id: number) => {
    await deleteAccount(id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  // ── monthly income vs expense (last 6 months) ──
  const months = getLastNMonths(6);
  const monthlyData = months.map(m => {
    const mTxs = transactions.filter(t => txMonth(t) === m);
    return {
      month: fmtMonth(m),
      Income: parseFloat(mTxs.filter(t => t.type === 'income').reduce((s, t) => s + usd(t), 0).toFixed(2)),
      Expenses: parseFloat(mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + usd(t), 0).toFixed(2)),
    };
  });

  // ── top spending categories (all-time) ──
  const byCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + usd(t);
      return acc;
    }, {});
  const totalExp = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── net worth chart data ──
  const nwChartData = netWorthEntries.map(e => ({
    date: e.date.slice(0, 10),
    'Net Worth': parseFloat(e.amount_usd.toFixed(2)),
  }));

  const addNetWorth = async () => {
    if (!nwAmount || isNaN(Number(nwAmount))) return;
    const entry = await createNetWorth({
      amount_usd: Number(nwAmount),
      date: new Date(nwDate).toISOString(),
      notes: nwNotes || undefined,
    });
    setNetWorthEntries(prev => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setNwAmount('');
    setNwNotes('');
  };

  const removeNetWorth = async (id: number) => {
    await deleteNetWorth(id);
    setNetWorthEntries(prev => prev.filter(e => e.id !== id));
  };

  if (transactions.length === 0) {
    return (
      <>
        <div className="dashboard-grid">
          <div className="card dashboard-full onboard-card">
            <div className="onboard-title">{t.onboarding.welcomeTitle}</div>
            <div className="onboard-body">{t.onboarding.welcomeBody}</div>
            <ol className="onboard-steps">
              <li className="onboard-step">
                <span className="onboard-step-num">1</span>
                {t.onboarding.step1}
              </li>
              <li className="onboard-step">
                <span className="onboard-step-num">2</span>
                {t.onboarding.step2}
              </li>
              <li className="onboard-step">
                <span className="onboard-step-num">3</span>
                {t.onboarding.step3}
              </li>
            </ol>
            <button className="btn-primary onboard-cta" onClick={() => setShowAddModal(true)}>
              {t.onboarding.addFirstTx}
            </button>
          </div>
        </div>
        {showAddModal && (
          <AddTransactionModal onClose={() => setShowAddModal(false)} onSave={handleModalSave} />
        )}
      </>
    );
  }

  return (
    <>
    <div className="dashboard-grid">

      {/* ── Accounts balance tracker ── */}
      <div className="card dashboard-full">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>{t.dashboard.myAccounts}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginLeft: 8 }}>{t.dashboard.totalBalance}</span>
            </div>
          </div>
          <button
            className="btn-add"
            onClick={() => setShowAccForm(v => !v)}
          >
            {showAccForm ? t.dashboard.cancelAdd : t.dashboard.addAccount}
          </button>
        </div>

        {showAccForm && (
          <div className="acc-form">
            <div className="acc-form-row">
              <div className="acc-form-field">
                <label>{t.dashboard.accName}</label>
                <input placeholder={t.dashboard.accNamePlaceholder} value={accName} onChange={e => setAccName(e.target.value)} className="nw-input" />
              </div>
              <div className="acc-form-field">
                <label>{t.dashboard.accInstitution}</label>
                <input placeholder={t.dashboard.accInstitutionPlaceholder} value={accInstitution} onChange={e => setAccInstitution(e.target.value)} className="nw-input" />
              </div>
              <div className="acc-form-field">
                <label>{t.dashboard.accType}</label>
                <select value={accType} onChange={e => setAccType(e.target.value)} className="nw-input">
                  <option value="checking">{t.dashboard.checking}</option>
                  <option value="savings">{t.dashboard.savings}</option>
                  <option value="investment">{t.dashboard.investment}</option>
                  <option value="crypto">{t.dashboard.crypto}</option>
                </select>
              </div>
              <div className="acc-form-field">
                <label>{t.dashboard.accCurrency}</label>
                <select value={accCurrency} onChange={e => setAccCurrency(e.target.value)} className="nw-input">
                  <option value="USD">USD</option>
                  <option value="BOB">BOB</option>
                  <option value="ARS">ARS</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
              <div className="acc-form-field">
                <label>{t.dashboard.accBalance}</label>
                <input type="number" placeholder="0.00" value={accBalance} onChange={e => setAccBalance(e.target.value)} className="nw-input" />
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: 8 }} onClick={addAccount} disabled={accSaving}>
              {accSaving ? t.common.saving : t.dashboard.saveAccount}
            </button>
          </div>
        )}

        {accounts.length === 0 && !showAccForm ? (
          <div className="chart-empty" style={{ height: 80 }}>
            <span style={{ fontSize: 22 }}>🏦</span>
            {t.dashboard.noAccounts}
          </div>
        ) : (
          <div className="acc-list">
            {accounts.map(acc => {
              const color = ACCOUNT_TYPE_COLORS[acc.account_type] ?? '#90A4AE';
              return (
                <div key={acc.id} className="acc-card">
                  <div className="acc-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="acc-dot" style={{ background: color }} />
                      <div>
                        <div className="acc-name">{acc.name}</div>
                        {acc.institution && <div className="acc-inst">{acc.institution}</div>}
                      </div>
                    </div>
                    <button className="acc-del" onClick={() => removeAccount(acc.id)}>×</button>
                  </div>

                  <div className="acc-type-badge" style={{ background: `${color}18`, color }}>
                    {ACCOUNT_TYPE_LABELS[acc.account_type] ?? acc.account_type}
                  </div>

                  {editingId === acc.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <input
                        type="number"
                        className="nw-input"
                        style={{ flex: 1, padding: '6px 9px', fontSize: 13 }}
                        value={editBalance}
                        onChange={e => setEditBalance(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveEditBalance(acc.id); if (e.key === 'Escape') setEditingId(null); }}
                      />
                      <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => saveEditBalance(acc.id)}>Save</button>
                      <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  ) : (
                    <div
                      className="acc-balance"
                      onClick={() => { setEditingId(acc.id); setEditBalance(String(acc.current_balance)); }}
                      title="Click to update balance"
                    >
                      {acc.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="acc-currency">{acc.currency}</span>
                      <span className="acc-edit-hint">✎</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Income vs Expenses bar chart ── */}
      <div className="card dashboard-full">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t.dashboard.incomeVsExpenses}
          <InfoPopover title={t.pops.incomeVsExpenses.title} body={t.pops.incomeVsExpenses.body} align="left" />
        </div>
        {transactions.length === 0 ? (
          <div className="chart-empty"><span style={{ fontSize: 28 }}>📊</span>{t.dashboard.noDataYet}</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={60} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(124,58,237,0.07)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)', paddingTop: 8 }} />
              <Bar dataKey="Income" name={t.dashboard.income} fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" name={t.dashboard.expenses} fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Spending trend line chart ── */}
      <div className="card dashboard-half">
        <div className="card-title">{t.dashboard.spendingTrend}</div>
        {transactions.filter(tx => tx.type === 'expense').length === 0 ? (
          <div className="chart-empty"><span style={{ fontSize: 24 }}>📉</span>{t.dashboard.noExpenses}</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={60} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="Expenses" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Top spending categories ── */}
      <div className="card dashboard-half">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t.dashboard.topCategories}
          <InfoPopover title={t.pops.topCategories.title} body={t.pops.topCategories.body} align="left" />
        </div>
        {topCategories.length === 0 ? (
          <div className="chart-empty"><span style={{ fontSize: 24 }}>🏷️</span>{t.dashboard.noExpenses}</div>
        ) : (
          <div className="top-cats">
            {topCategories.map(([cat, amt], i) => {
              const pct = totalExp > 0 ? (amt / totalExp) * 100 : 0;
              const color = CATEGORY_COLORS[cat] ?? '#94A3B8';
              return (
                <div key={cat} className="top-cat-row">
                  <div className="top-cat-left">
                    <span className="top-cat-rank">#{i + 1}</span>
                    <span className="top-cat-dot" style={{ background: color }} />
                    <span className="top-cat-name">{cat}</span>
                  </div>
                  <div className="top-cat-right">
                    <div className="top-cat-bar-wrap">
                      <div className="top-cat-bar" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="top-cat-amt">${amt.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Net worth tracker ── */}
      <div className="card dashboard-full">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t.dashboard.netWorth}
          <InfoPopover title={t.pops.netWorth.title} body={t.pops.netWorth.body} align="left" />
        </div>
        <div className="nw-layout">
          {/* chart */}
          <div className="nw-chart">
            {nwChartData.length < 2 ? (
              <div className="chart-empty" style={{ height: 160 }}>
                <span style={{ fontSize: 24 }}>💰</span>
                {t.dashboard.nwTrendHint}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={nwChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={70} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="Net Worth" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* entry form + list */}
          <div className="nw-side">
            <div className="nw-form">
              <input
                type="number"
                placeholder={t.dashboard.nwPlaceholder}
                value={nwAmount}
                onChange={e => setNwAmount(e.target.value)}
                className="nw-input"
              />
              <input
                type="date"
                value={nwDate}
                onChange={e => setNwDate(e.target.value)}
                className="nw-input"
              />
              <input
                type="text"
                placeholder={t.dashboard.nwNotes}
                value={nwNotes}
                onChange={e => setNwNotes(e.target.value)}
                className="nw-input"
              />
              <button onClick={addNetWorth} className="nw-add-btn">{t.dashboard.nwAddBtn}</button>
            </div>

            {!nwLoading && netWorthEntries.length > 0 && (
              <div className="nw-list">
                {[...netWorthEntries].reverse().slice(0, 5).map(e => (
                  <div key={e.id} className="nw-list-row">
                    <div>
                      <div className="nw-list-amt">${e.amount_usd.toLocaleString()}</div>
                      <div className="nw-list-date">{e.date.slice(0, 10)}{e.notes ? ` · ${e.notes}` : ''}</div>
                    </div>
                    <button onClick={() => removeNetWorth(e.id)} className="nw-del-btn">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
    {showAddModal && (
      <AddTransactionModal onClose={() => setShowAddModal(false)} onSave={handleModalSave} />
    )}
    </>
  );
}
