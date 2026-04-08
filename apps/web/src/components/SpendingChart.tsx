import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTip, Legend,
} from 'recharts';
import type { Transaction } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface Props {
  transactions: Transaction[]; // expense transactions only, all months
}

// ── helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', BOB: 'Bs.', ARS: '$', MXN: '$',
};

function fmt(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMonthFull(ym: string): string {
  return new Date(ym + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtMonthShort(ym: string): string {
  return new Date(ym + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();
  for (const tx of transactions) months.add(tx.date.slice(0, 7));
  return [...months].sort().reverse(); // newest first
}

// Group expense transactions for one month by currency → category breakdown
interface CurrencySection {
  currency: string;
  total: number;
  categories: { category: string; amount: number; percentage: number }[];
}

function groupByCurrency(transactions: Transaction[]): CurrencySection[] {
  const byCurrency: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    if (!byCurrency[tx.currency]) byCurrency[tx.currency] = [];
    byCurrency[tx.currency].push(tx);
  }
  return Object.entries(byCurrency)
    .map(([currency, txs]) => {
      const total = txs.reduce((s, t) => s + t.amount, 0);
      const byCat: Record<string, number> = {};
      for (const tx of txs) byCat[tx.category] = (byCat[tx.category] ?? 0) + tx.amount;
      const categories = Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
        }));
      return { currency, total, categories };
    })
    .sort((a, b) => {
      if (a.currency === 'USD') return 1;
      if (b.currency === 'USD') return -1;
      return b.total - a.total;
    });
}

// Build stacked bar data: chronological months (last 6), amounts in USD equivalent
function buildStackedData(
  transactions: Transaction[],
  months: string[],
): { data: Record<string, number | string>[]; categories: string[] } {
  const chronoMonths = [...months].reverse().slice(-6);
  const catTotals: Record<string, number> = {};
  for (const tx of transactions) {
    catTotals[tx.category] = (catTotals[tx.category] ?? 0) + (tx.amount_usd ?? tx.amount);
  }
  const categories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  const data = chronoMonths.map(month => {
    const monthTxs = transactions.filter(tx => tx.date.slice(0, 7) === month);
    const entry: Record<string, number | string> = { month: fmtMonthShort(month) };
    for (const cat of categories) {
      entry[cat] = parseFloat(
        monthTxs
          .filter(tx => tx.category === cat)
          .reduce((s, tx) => s + (tx.amount_usd ?? tx.amount), 0)
          .toFixed(2),
      );
    }
    return entry;
  });

  return { data, categories };
}

// ── tooltip components ────────────────────────────────────────────────────────

const DonutTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload?.[0]) return null;
  const { name, value } = payload[0];
  return (
    <div className="chart-tip">
      <div className="chart-tip-name" style={{ color: CATEGORY_COLORS[name] ?? '#94A3B8' }}>{name}</div>
      <div className="chart-tip-val">{fmt(value, currency)}</div>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (Number(p.value) || 0), 0);
  return (
    <div className="chart-tip">
      <div className="chart-tip-name" style={{ marginBottom: 6 }}>{label}</div>
      {[...payload].reverse().map((p: any) =>
        Number(p.value) > 0 ? (
          <div key={p.name} style={{ color: p.fill, fontSize: 12 }}>
            {p.name}: <strong>${Number(p.value).toFixed(2)}</strong>
          </div>
        ) : null,
      )}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 4, fontSize: 12, color: 'var(--text-1)', fontWeight: 700 }}>
        Total: ${total.toFixed(2)}
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────

export default function SpendingChart({ transactions }: Props) {
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  const [month, setMonth] = useState<string | null>(null);

  const selectedMonth = month ?? availableMonths[0] ?? null;
  const monthIdx = selectedMonth ? availableMonths.indexOf(selectedMonth) : -1;
  const canGoPrev = monthIdx < availableMonths.length - 1;
  const canGoNext = monthIdx > 0;
  const goPrev = () => { if (canGoPrev) setMonth(availableMonths[monthIdx + 1]); };
  const goNext = () => { if (canGoNext) setMonth(availableMonths[monthIdx - 1]); };

  const monthTxs = useMemo(
    () => selectedMonth ? transactions.filter(tx => tx.date.slice(0, 7) === selectedMonth) : [],
    [transactions, selectedMonth],
  );

  const sections = useMemo(() => groupByCurrency(monthTxs), [monthTxs]);
  const { data: stackedData, categories } = useMemo(
    () => buildStackedData(transactions, availableMonths),
    [transactions, availableMonths],
  );

  return (
    <div className="card card-sticky">
      <div className="card-title">Spending by Category</div>

      {transactions.length === 0 ? (
        <div className="chart-empty">
          <span style={{ fontSize: 28 }}>📊</span>
          No expenses yet
        </div>
      ) : (
        <>
          {/* Month navigator */}
          <div className="month-row" style={{ marginBottom: 12 }}>
            {availableMonths.length > 1 ? (
              <div className="month-nav">
                <button className="month-nav-btn" onClick={goPrev} disabled={!canGoPrev} title="Previous month">‹</button>
                <span className="month-nav-label">{selectedMonth ? fmtMonthFull(selectedMonth) : '—'}</span>
                <button className="month-nav-btn" onClick={goNext} disabled={!canGoNext} title="Next month">›</button>
              </div>
            ) : (
              <span className="month-nav-label">{selectedMonth ? fmtMonthFull(selectedMonth) : '—'}</span>
            )}
          </div>

          {/* Per-currency donut charts for selected month */}
          {sections.length === 0 ? (
            <div className="chart-empty" style={{ height: 80 }}>
              <span style={{ fontSize: 22 }}>📭</span>
              No expenses this month
            </div>
          ) : (
            sections.map((section, idx) => (
              <div key={section.currency} style={{ marginTop: idx > 0 ? 24 : 0 }}>
                {sections.length > 1 && (
                  <div className="chart-currency-label">{section.currency}</div>
                )}
                <div className="chart-total">
                  <div className="chart-total-amount">{fmt(section.total, section.currency)}</div>
                  <div className="chart-total-label">total expenses</div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={section.categories}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {section.categories.map(entry => (
                        <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#94A3B8'} />
                      ))}
                    </Pie>
                    <PieTip content={<DonutTooltip currency={section.currency} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  {section.categories.map(entry => (
                    <div key={entry.category} className="legend-item">
                      <div className="legend-left">
                        <div className="legend-dot" style={{ background: CATEGORY_COLORS[entry.category] ?? '#94A3B8' }} />
                        <span className="legend-name">{entry.category}</span>
                      </div>
                      <div className="legend-right">
                        <span className="legend-pct">{entry.percentage}%</span>
                        <span className="legend-val">{fmt(entry.amount, section.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {idx < sections.length - 1 && (
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0 0' }} />
                )}
              </div>
            ))
          )}

          {/* Stacked bar: spending over time */}
          {availableMonths.length >= 2 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0 16px' }} />
              <div className="card-title" style={{ marginBottom: 12 }}>Spending Over Time</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stackedData} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={55} />
                  <BarTip content={<BarTooltip />} cursor={{ fill: 'rgba(124,58,237,0.07)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'var(--text-2)', paddingTop: 8 }}
                    formatter={(value: string) => <span style={{ color: CATEGORY_COLORS[value] ?? '#94A3B8' }}>{value}</span>}
                  />
                  {categories.map(cat => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="expenses"
                      fill={CATEGORY_COLORS[cat] ?? '#94A3B8'}
                      radius={categories.indexOf(cat) === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </>
      )}
    </div>
  );
}
