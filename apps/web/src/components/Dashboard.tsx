import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Transaction, NetWorthEntry } from '../types';
import { getNetWorth, createNetWorth, deleteNetWorth } from '../services/api';
import { CATEGORY_COLORS } from '../constants';

interface Props {
  transactions: Transaction[];
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

export default function Dashboard({ transactions }: Props) {
  const [netWorthEntries, setNetWorthEntries] = useState<NetWorthEntry[]>([]);
  const [nwAmount, setNwAmount] = useState('');
  const [nwDate, setNwDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nwNotes, setNwNotes] = useState('');
  const [nwLoading, setNwLoading] = useState(true);

  useEffect(() => {
    getNetWorth()
      .then(setNetWorthEntries)
      .finally(() => setNwLoading(false));
  }, []);

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

  return (
    <div className="dashboard-grid">

      {/* ── Income vs Expenses bar chart ── */}
      <div className="card dashboard-full">
        <div className="card-title">Income vs. Expenses — Last 6 Months</div>
        {transactions.length === 0 ? (
          <div className="chart-empty"><span style={{ fontSize: 28 }}>📊</span>No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={60} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(124,58,237,0.07)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)', paddingTop: 8 }} />
              <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Spending trend line chart ── */}
      <div className="card dashboard-half">
        <div className="card-title">Spending Trend</div>
        {transactions.filter(t => t.type === 'expense').length === 0 ? (
          <div className="chart-empty"><span style={{ fontSize: 24 }}>📉</span>No expenses yet</div>
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
        <div className="card-title">Top Spending Categories</div>
        {topCategories.length === 0 ? (
          <div className="chart-empty"><span style={{ fontSize: 24 }}>🏷️</span>No expenses yet</div>
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
        <div className="card-title">Net Worth Tracker</div>
        <div className="nw-layout">
          {/* chart */}
          <div className="nw-chart">
            {nwChartData.length < 2 ? (
              <div className="chart-empty" style={{ height: 160 }}>
                <span style={{ fontSize: 24 }}>💰</span>
                Add at least 2 entries to see a trend
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
                placeholder="Total net worth (USD)"
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
                placeholder="Notes (optional)"
                value={nwNotes}
                onChange={e => setNwNotes(e.target.value)}
                className="nw-input"
              />
              <button onClick={addNetWorth} className="nw-add-btn">Add entry</button>
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
  );
}
