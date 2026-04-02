import { useState, useEffect } from 'react';
import type { FinancialHealth as FH } from '../types';
import { getFinancialHealth } from '../services/api';
import { RULE_ICONS, RULE_COLORS } from '../constants';
import InfoPopover from './InfoPopover';

const STATUS_LABELS: Record<string, string> = {
  on_track: '✓ On track',
  over:     '↑ Over target',
  under:    '↓ Under target',
};

const RULE_POPS: Record<string, { title: string; body: string }> = {
  Needs: {
    title: 'Needs — Essential Expenses (target: 50%)',
    body: 'The costs you cannot easily eliminate: housing, food, transport, healthcare, and utilities. If this bucket exceeds 50%, focus on reducing fixed expenses — negotiate rent, consolidate subscriptions, or find cheaper alternatives. Every dollar freed here goes directly toward your future.',
  },
  Wants: {
    title: 'Wants — Lifestyle Spending (target: 30%)',
    body: 'Spending that improves your quality of life but can be reduced when needed. This is your most flexible lever. As your income grows, resist the urge to grow your lifestyle at the same rate — channel every raise into savings first. Small, consistent cuts here compound into real wealth over time.',
  },
  Savings: {
    title: 'Savings — Building Wealth (target: 20%)',
    body: 'The most important bucket. Follow this order: first, build an emergency fund covering 3–6 months of expenses. Second, eliminate high-interest debt — there is no point earning 8% on investments while paying 20% on a credit card. Third, invest consistently via index ETFs. Time in the market always beats trying to time the market.',
  },
};

const GRADE_POP = {
  title: 'Your Financial Health Score',
  body: 'Measures how closely your spending aligns with the 50/30/20 rule. A ≥90 · B ≥75 · C ≥60 · D ≥45 · F below 45. Consistent A or B scores mean your money is actively working for you. A lower grade tells you exactly which bucket — Needs, Wants, or Savings — needs attention.',
};

const RULE_50_30_20_POP = {
  title: 'The 50/30/20 Rule',
  body: 'A simple framework to divide your after-tax income: 50% for essentials, 30% for lifestyle, and 20% for savings and investment. Master this before touching any financial product. It is the foundation that every other wealth-building strategy is built on.',
};

const ETF_POPS: Record<string, { title: string; body: string }> = {
  VTI: {
    title: 'VTI — Vanguard Total Stock Market',
    body: 'Holds roughly 4,000 US companies in a single fund — the entire American economy in one purchase. Ultra-low fees, automatic rebalancing, and maximum diversification. Ideal as the core holding in a long-term Dollar Cost Averaging strategy. Time in the market beats timing the market.',
  },
  VOO: {
    title: 'VOO — Vanguard S&P 500',
    body: 'Tracks the 500 largest publicly traded US companies. You cannot buy the S&P 500 directly — VOO is your access point. Historically averages around 10% annually over the long term. One of the most recommended starting points for investors at any level.',
  },
  VXUS: {
    title: 'VXUS — Total International Stocks',
    body: 'Covers markets outside the US: Europe, Asia, and emerging economies. Pairs perfectly with VTI or VOO to reduce overexposure to any single country. Geographic diversification is one of the core principles of sound portfolio construction.',
  },
  BIL: {
    title: 'BIL — Short-Term Treasury Bills',
    body: 'US government bonds with very short maturities. Low risk, modest return. Best used as a home for your emergency fund while it earns something rather than sitting idle. Not a growth investment — think of it as a safe harbor, not a destination.',
  },
};

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
            <InfoPopover title={GRADE_POP.title} body={GRADE_POP.body} />
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
              <InfoPopover title={RULE_50_30_20_POP.title} body={RULE_50_30_20_POP.body} align="left" />
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
                            {RULE_POPS[rule.label] && (
                              <InfoPopover title={RULE_POPS[rule.label].title} body={RULE_POPS[rule.label].body} align="left" />
                            )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div className="etf-ticker">{etf.ticker}</div>
                      {ETF_POPS[etf.ticker] && (
                        <InfoPopover title={ETF_POPS[etf.ticker].title} body={ETF_POPS[etf.ticker].body} align="right" />
                      )}
                    </div>
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
