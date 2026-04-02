import { useState, useEffect } from 'react';
import type { FinancialHealth as FH } from '../types';
import { getFinancialHealth } from '../services/api';
import { RULE_ICONS, RULE_COLORS } from '../constants';

const STATUS_LABELS: Record<string, string> = {
  on_track: '✓ On track',
  over:     '↑ Over target',
  under:    '↓ Under target',
};

const RULE_TIPS: Record<string, string> = {
  Needs: 'Essential living expenses you cannot easily cut: rent/mortgage, groceries, transport, healthcare, and utilities. The 50/30/20 rule targets keeping these at or below 50% of income.',
  Wants: 'Discretionary lifestyle spending — entertainment, shopping, and dining out. These improve quality of life but can be reduced if needed. Target: ≤30% of income.',
  Savings: 'Money set aside for your future: investments, emergency fund, or debt repayment. This is the most important bucket for long-term financial health. Target: ≥20% of income.',
};

const GRADE_TIP = 'Your score (0–100) measures how closely your spending matches the 50/30/20 rule. Grades: A ≥90 · B ≥75 · C ≥60 · D ≥45 · F <45. A high score means your money is working for you.';

const ETF_SUGGESTIONS = [
  { ticker: 'VTI',  name: 'Total US Stock Market',      risk: 'med'  as const },
  { ticker: 'VOO',  name: 'S&P 500 Index',              risk: 'med'  as const },
  { ticker: 'VXUS', name: 'Total International Stocks', risk: 'med'  as const },
  { ticker: 'BIL',  name: 'Short-Term T-Bills (safe)',  risk: 'low'  as const },
];

const RISK_LABELS: Record<string, string> = {
  low: 'Low risk',
  med: 'Moderate',
  high: 'High risk',
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="info-tip"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="info-tip-icon">?</span>
      {show && <span className="info-tip-bubble">{text}</span>}
    </span>
  );
}

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

  const savingsRule = data.rules.find(r => r.label === 'Savings');
  const savingsGap = savingsRule && savingsRule.actual_pct < 20
    ? ((20 - savingsRule.actual_pct) / 100) * data.total_income
    : null;

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
          <div className="grade-score" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            Score: {data.score.toFixed(1)} / 100
            <InfoTip text={GRADE_TIP} />
          </div>

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
        <div>
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              50 / 30 / 20 Rule
              <InfoTip text="The 50/30/20 rule divides after-tax income into three buckets: 50% for needs, 30% for wants, and 20% for savings. It's a simple framework to build wealth while covering your essential costs." />
            </div>
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
                          <div className="rule-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {rule.label}
                            <InfoTip text={RULE_TIPS[rule.label] ?? ''} />
                          </div>
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

          {/* Unallocated money panel */}
          {savingsGap !== null && savingsGap > 0 && (
            <div className="unallocated-panel">
              <div className="unallocated-header">
                <span className="unallocated-icon">📈</span>
                <div>
                  <div className="unallocated-title">You have investable room</div>
                  <div className="unallocated-subtitle">
                    Invest this monthly to reach your 20% savings target
                  </div>
                </div>
              </div>
              <div className="unallocated-amount">${savingsGap.toFixed(2)}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginLeft: 6 }}>/mo</span></div>
              <div className="card-title" style={{ marginBottom: 10 }}>ETF ideas for your gap</div>
              <div className="etf-grid">
                {ETF_SUGGESTIONS.map(etf => (
                  <div key={etf.ticker} className="etf-card">
                    <div className="etf-ticker">{etf.ticker}</div>
                    <div className="etf-name">{etf.name}</div>
                    <span className={`etf-risk etf-risk--${etf.risk}`}>
                      {RISK_LABELS[etf.risk]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
