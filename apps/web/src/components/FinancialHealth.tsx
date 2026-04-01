import { useState, useEffect } from 'react';
import type { FinancialHealth as FH } from '../types';
import { getFinancialHealth } from '../services/api';
import { RULE_ICONS, RULE_COLORS } from '../constants';

const STATUS_LABELS: Record<string, string> = {
  on_track: '✓ On track',
  over:     '↑ Over target',
  under:    '↓ Under target',
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function FinancialHealth() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<FH | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFinancialHealth(month)
      .then(setData)
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) {
    return (
      <div style={{ color: 'var(--text-3)', padding: 40, textAlign: 'center' }}>
        Loading…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="month-row">
        <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Month</span>
        <input
          type="month"
          className="month-input"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      <div className="health-layout">
        {/* Grade card */}
        <div className="card grade-card">
          <div className="grade-month">
            {new Date(data.month + '-01').toLocaleDateString('en-US', {
              month: 'long', year: 'numeric',
            })}
          </div>

          <div className={`grade-letter grade-${data.grade}`}>{data.grade}</div>
          <div className="grade-score">Score: {data.score.toFixed(1)} / 100</div>

          <hr className="grade-divider" />

          <div className="grade-row">
            <span className="grade-label">Income</span>
            <span className="grade-val-income">${data.total_income.toFixed(2)}</span>
          </div>
          <div className="grade-row">
            <span className="grade-label">Expenses</span>
            <span className="grade-val-expense">${data.total_expenses.toFixed(2)}</span>
          </div>
        </div>

        {/* Rules */}
        <div className="card">
          <div className="card-title">50 / 30 / 20 Rule</div>
          <div className="rules-list">
            {data.rules.map(rule => {
              const color = RULE_COLORS[rule.label] ?? '#94A3B8';
              const fillPct = Math.min(100, (rule.actual_pct / 60) * 100);
              const markerPct = (rule.target_pct / 60) * 100;

              return (
                <div key={rule.label} className="rule-card">
                  <div className="rule-top">
                    <div className="rule-icon-label">
                      <span className="rule-icon">{RULE_ICONS[rule.label]}</span>
                      <div>
                        <div className="rule-name">{rule.label}</div>
                        <div className="rule-cats">{rule.categories.join(', ')}</div>
                      </div>
                    </div>
                    <div className="rule-nums">
                      <div className="rule-pct-actual" style={{ color }}>
                        {rule.actual_pct}%
                      </div>
                      <div className="rule-pct-target">target {rule.target_pct}%</div>
                      <div className="rule-amount">${rule.amount.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="rule-bar-track">
                    <div
                      className="rule-bar-fill"
                      style={{ width: `${fillPct}%`, background: color }}
                    />
                    <div
                      className="rule-bar-marker"
                      style={{ left: `${markerPct}%` }}
                    />
                  </div>

                  <div className={`rule-status-line status-${rule.status}`}>
                    {STATUS_LABELS[rule.status]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
