import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategoryBreakdown } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface Props {
  data: CategoryBreakdown[];
  totalExpenses: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const { name, value } = payload[0];
  return (
    <div className="chart-tip">
      <div className="chart-tip-name" style={{ color: CATEGORY_COLORS[name] ?? '#94A3B8' }}>
        {name}
      </div>
      <div className="chart-tip-val">${value.toFixed(2)}</div>
    </div>
  );
};

export default function SpendingChart({ data, totalExpenses }: Props) {
  return (
    <div className="card card-sticky">
      <div className="card-title">Spending by Category</div>

      {data.length === 0 ? (
        <div className="chart-empty">
          <span style={{ fontSize: 28 }}>📊</span>
          No expenses yet
        </div>
      ) : (
        <>
          <div className="chart-total">
            <div className="chart-total-amount">${totalExpenses.toFixed(2)}</div>
            <div className="chart-total-label">total expenses</div>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map(entry => (
                  <Cell
                    key={entry.category}
                    fill={CATEGORY_COLORS[entry.category] ?? '#94A3B8'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="chart-legend">
            {data.map(entry => (
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
                  <span className="legend-val">${entry.amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
