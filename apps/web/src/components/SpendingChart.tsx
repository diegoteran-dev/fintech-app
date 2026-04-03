import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Transaction } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface Props {
  transactions: Transaction[]; // expense transactions only
}

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
      for (const tx of txs) {
        byCat[tx.category] = (byCat[tx.category] ?? 0) + tx.amount;
      }
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
      // USD last (usually smaller numbers), local currencies first
      if (a.currency === 'USD') return 1;
      if (b.currency === 'USD') return -1;
      return b.total - a.total;
    });
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  BOB: 'Bs.',
  ARS: '$',
  MXN: '$',
};

function fmt(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload?.[0]) return null;
  const { name, value } = payload[0];
  return (
    <div className="chart-tip">
      <div className="chart-tip-name" style={{ color: CATEGORY_COLORS[name] ?? '#94A3B8' }}>
        {name}
      </div>
      <div className="chart-tip-val">{fmt(value, currency)}</div>
    </div>
  );
};

export default function SpendingChart({ transactions }: Props) {
  const sections = groupByCurrency(transactions);

  return (
    <div className="card card-sticky">
      <div className="card-title">Spending by Category</div>

      {sections.length === 0 ? (
        <div className="chart-empty">
          <span style={{ fontSize: 28 }}>📊</span>
          No expenses yet
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
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category] ?? '#94A3B8'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip currency={section.currency} />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="chart-legend">
              {section.categories.map(entry => (
                <div key={entry.category} className="legend-item">
                  <div className="legend-left">
                    <div
                      className="legend-dot"
                      style={{ background: CATEGORY_COLORS[entry.category] ?? '#94A3B8' }}
                    />
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
    </div>
  );
}
