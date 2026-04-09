import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { Transaction } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface Props {
  transactions: Transaction[]; // expense transactions only
}

function fmtMonthShort(ym: string): string {
  return new Date(ym + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();
  for (const tx of transactions) months.add(tx.date.slice(0, 7));
  return [...months].sort(); // oldest → newest
}

function buildData(
  transactions: Transaction[],
  months: string[], // chronological slice already selected
): { data: Record<string, number | string>[]; categories: string[] } {
  // Top categories by total across the visible window
  const catTotals: Record<string, number> = {};
  for (const tx of transactions.filter(tx => months.includes(tx.date.slice(0, 7)))) {
    catTotals[tx.category] = (catTotals[tx.category] ?? 0) + (tx.amount_usd ?? tx.amount);
  }
  const categories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  const data = months.map(month => {
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
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 4, fontSize: 12, fontWeight: 700 }}>
        Total: ${total.toFixed(2)}
      </div>
    </div>
  );
};

const RANGE_OPTIONS = [3, 6, 9, 12] as const;

export default function SpendingOverTime({ transactions }: Props) {
  const [range, setRange] = useState<3 | 6 | 9 | 12>(6);

  const allMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  // Take the last `range` months from the available set
  const visibleMonths = allMonths.slice(-range);

  const { data, categories } = useMemo(
    () => buildData(transactions, visibleMonths),
    [transactions, visibleMonths],
  );

  if (transactions.length === 0 || allMonths.length < 2) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Spending Over Time</div>
        <div className="sot-range-btns">
          {RANGE_OPTIONS.map(n => (
            <button
              key={n}
              className={`sot-range-btn${range === n ? ' active' : ''}`}
              onClick={() => setRange(n)}
              disabled={allMonths.length < n}
            >
              {n}M
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={55} />
          <BarTip content={<BarTooltip />} cursor={{ fill: 'rgba(124,58,237,0.07)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-2)', paddingTop: 10 }}
            formatter={(value: string) => <span style={{ color: CATEGORY_COLORS[value] ?? '#94A3B8' }}>{value}</span>}
          />
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="s"
              fill={CATEGORY_COLORS[cat] ?? '#94A3B8'}
              radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
