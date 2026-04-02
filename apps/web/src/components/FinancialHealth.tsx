import { useState, useEffect } from 'react';
import type { FinancialHealth as FH } from '../types';
import { getFinancialHealth } from '../services/api';
import { RULE_ICONS, RULE_COLORS } from '../constants';
import InfoPopover from './InfoPopover';
import { useLang } from '../context/LangContext';

const ETF_SUGGESTIONS = [
  { ticker: 'VTI',  name: 'Total US Stock Market',      risk: 'med'  as const },
  { ticker: 'VOO',  name: 'S&P 500 Index',              risk: 'med'  as const },
  { ticker: 'VXUS', name: 'Total International Stocks', risk: 'med'  as const },
  { ticker: 'BIL',  name: 'Short-Term T-Bills (safe)',  risk: 'low'  as const },
];

const RISK_LABELS_EN: Record<string, string> = {
  low: 'Low risk',
  med: 'Moderate',
  high: 'High risk',
};

const RISK_LABELS_ES: Record<string, string> = {
  low: 'Bajo riesgo',
  med: 'Moderado',
  high: 'Alto riesgo',
};

const currentMonth = () => new Date().toISOString().slice(0, 7);


export default function FinancialHealth() {
  const { lang, t } = useLang();
  const RISK_LABELS = lang === 'es' ? RISK_LABELS_ES : RISK_LABELS_EN;

  const STATUS_LABELS: Record<string, string> = {
    on_track: t.health.onTrack,
    over:     t.health.overTarget,
    under:    t.health.underTarget,
  };

  const RULE_POPS: Record<string, { title: string; body: string }> = {
    Needs:   t.pops.needs,
    Wants:   t.pops.wants,
    Savings: t.pops.savings,
  };

  const ETF_POPS: Record<string, { title: string; body: string }> = {
    VTI:  t.pops.vti,
    VOO:  t.pops.voo,
    VXUS: t.pops.vxus,
    BIL:  t.pops.bil,
  };

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
        {t.common.loading}
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
        <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{t.health.month}</span>
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
            {t.health.score}: {data.score.toFixed(1)} / 100
            <InfoPopover title={t.pops.grade.title} body={t.pops.grade.body} />
          </div>

          <hr className="grade-divider" />

          <div className="grade-row">
            <span className="grade-label">{t.health.income}</span>
            <span className="grade-val-income">${data.total_income.toFixed(2)}</span>
          </div>
          <div className="grade-row">
            <span className="grade-label">{t.health.expenses}</span>
            <span className="grade-val-expense">${data.total_expenses.toFixed(2)}</span>
          </div>
        </div>

        {/* Rules */}
        <div>
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.health.ruleTitle}
              <InfoPopover title={t.pops.rule503020.title} body={t.pops.rule503020.body} align="left" />
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
                        <div className="rule-pct-target">{t.health.target} {rule.target_pct}%</div>
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
                  <div className="unallocated-title">{t.health.investableTitle}</div>
                  <div className="unallocated-subtitle">
                    {t.health.investableHint}
                  </div>
                </div>
              </div>
              <div className="unallocated-amount">${savingsGap.toFixed(2)}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginLeft: 6 }}>/mo</span></div>
              <div className="card-title" style={{ marginBottom: 10 }}>{t.health.etfIdeas}</div>
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
