import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTip, ResponsiveContainer,
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

// ── main component ────────────────────────────────────────────────────────────

function topMerchants(txs: Transaction[], n = 15) {
  const byMerchant: Record<string, { amount: number; currency: string; count: number }> = {};
  for (const tx of txs) {
    const key = tx.description;
    if (!byMerchant[key]) byMerchant[key] = { amount: 0, currency: tx.currency, count: 0 };
    byMerchant[key].amount += tx.amount;
    byMerchant[key].count++;
  }
  return Object.entries(byMerchant)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, n);
}

export default function SpendingChart({ transactions }: Props) {
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<'category' | 'merchant'>('category');

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

  return (
    <div className="card card-sticky">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          {view === 'category' ? 'Spending by Category' : 'Spending by Merchant'}
        </div>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['category', 'merchant'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: view === v ? 'var(--accent)' : 'var(--bg-2)',
              color: view === v ? '#fff' : 'var(--text-3)',
              textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>
      </div>

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

          {/* Per-currency donut charts or merchant list for selected month */}
          {view === 'merchant' ? (() => {
            const merchants = topMerchants(monthTxs);
            if (merchants.length === 0) return (
              <div className="chart-empty" style={{ height: 80 }}>
                <span style={{ fontSize: 22 }}>📭</span>No expenses this month
              </div>
            );
            const maxAmt = merchants[0][1].amount;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {merchants.map(([desc, { amount, currency, count }], i) => (
                  <div key={desc} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 18, textAlign: 'right' }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={desc}>
                          {desc}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0, marginLeft: 6 }}>
                          {fmt(amount, currency)}
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${(amount / maxAmt) * 100}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{count}×</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })() : sections.length === 0 ? (
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

        </>
      )}
    </div>
  );
}
