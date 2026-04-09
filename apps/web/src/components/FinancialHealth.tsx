import { useState, useEffect, useCallback } from 'react';
import type { FinancialHealth as FH } from '../types';
import { getFinancialHealth, getTransactionMonths } from '../services/api';
import { RULE_ICONS, RULE_COLORS } from '../constants';
import InfoPopover from './InfoPopover';
import RuleSlider from './RuleSlider';
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

const DEFAULT_TARGETS = { needs: 50, wants: 30, savings: 20 };
const STORAGE_KEY = 'vault-rule-targets';

function loadTargets(): typeof DEFAULT_TARGETS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TARGETS;
    const parsed = JSON.parse(raw);
    const { needs, wants, savings } = parsed;
    if (
      typeof needs === 'number' && typeof wants === 'number' && typeof savings === 'number' &&
      Math.round(needs + wants + savings) === 100
    ) return { needs, wants, savings };
  } catch { /* ignore */ }
  return DEFAULT_TARGETS;
}

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

  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<FH | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState(loadTargets);
  const [showCustom, setShowCustom] = useState(false);
  const [savingsInExpenses, setSavingsInExpenses] = useState<boolean>(() => {
    try { return localStorage.getItem('vault-savings-in-expenses') !== 'false'; }
    catch { return true; }
  });

  // Load available months once on mount, then jump to most recent with data
  useEffect(() => {
    getTransactionMonths().then(months => {
      setAvailableMonths(months);
      if (months.length > 0) setMonth(months[0]);
    }).catch(() => {});
  }, []);

  const monthIdx = availableMonths.indexOf(month);
  const canGoPrev = monthIdx < availableMonths.length - 1;
  const canGoNext = monthIdx > 0;
  const goPrev = () => { if (canGoPrev) setMonth(availableMonths[monthIdx + 1]); };
  const goNext = () => { if (canGoNext) setMonth(availableMonths[monthIdx - 1]); };

  const monthLabel = new Date(month + '-15').toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const isDefault =
    targets.needs === DEFAULT_TARGETS.needs &&
    targets.wants === DEFAULT_TARGETS.wants &&
    targets.savings === DEFAULT_TARGETS.savings;

  const fetchHealth = useCallback((m: string, tgt: typeof targets) => {
    setLoading(true);
    getFinancialHealth(m, tgt)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Debounce API call 200ms so dragging feels real-time without spamming
  useEffect(() => {
    const timer = setTimeout(() => fetchHealth(month, targets), 200);
    return () => clearTimeout(timer);
  }, [month, targets, fetchHealth]);

  const handleSliderChange = (needs: number, wants: number, savings: number) => {
    const updated = { needs, wants, savings };
    setTargets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const resetTargets = () => {
    setTargets(DEFAULT_TARGETS);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-3)', padding: 40, textAlign: 'center' }}>
        {t.common.loading}
      </div>
    );
  }

  if (!data) return null;

  const isEmpty = data.total_income === 0 && data.total_expenses === 0;

  const savingsRule = data.rules.find(r => r.label === 'Savings');
  const savingsAmount = savingsRule?.amount ?? 0;
  const displayExpenses = savingsInExpenses
    ? data.total_expenses
    : Math.max(0, data.total_expenses - savingsAmount);
  const savingsGap = savingsRule && savingsRule.actual_pct < targets.savings
    ? ((targets.savings - savingsRule.actual_pct) / 100) * data.total_income
    : null;

  const sliderColors = {
    needs:   RULE_COLORS['Needs']   ?? '#94A3B8',
    wants:   RULE_COLORS['Wants']   ?? '#94A3B8',
    savings: RULE_COLORS['Savings'] ?? '#94A3B8',
  };

  const sliderLabels = {
    needs:   t.ruleCustom.needs,
    wants:   t.ruleCustom.wants,
    savings: t.ruleCustom.savings,
  };

  return (
    <div>
      {/* Month navigator — only shows months that have transaction data */}
      <div className="month-row">
        {availableMonths.length > 0 ? (
          <div className="month-nav">
            <button
              className="month-nav-btn"
              onClick={goPrev}
              disabled={!canGoPrev}
              title="Previous month"
            >‹</button>
            <span className="month-nav-label">{monthLabel}</span>
            <button
              className="month-nav-btn"
              onClick={goNext}
              disabled={!canGoNext}
              title="Next month"
            >›</button>
          </div>
        ) : (
          <span className="month-nav-label">{monthLabel}</span>
        )}
      </div>

      {/* Empty state — keep the navigator visible above */}
      {isEmpty && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
            {t.health.emptyTitle}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
            {t.health.emptyHint}
          </div>
        </div>
      )}

      {!isEmpty && <div className="health-layout">
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
            <span className="grade-val-expense">${displayExpenses.toFixed(2)}</span>
          </div>
          <label className="savings-exp-toggle">
            <input
              type="checkbox"
              checked={savingsInExpenses}
              onChange={e => {
                setSavingsInExpenses(e.target.checked);
                localStorage.setItem('vault-savings-in-expenses', String(e.target.checked));
              }}
            />
            <span>{t.health.savingsInExpenses}</span>
          </label>
        </div>

        {/* Rules */}
        <div>
          <div className="card">
            {/* Card title + customize toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCustom ? 12 : 16 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                {t.health.ruleTitle}
                {!isDefault && <span className="rule-custom-dot" />}
                <InfoPopover title={t.pops.rule503020.title} body={t.pops.rule503020.body} align="left" />
              </div>
              <button
                className={`rule-custom-btn ${showCustom ? 'rule-custom-btn--open' : ''}`}
                onClick={() => setShowCustom(v => !v)}
                type="button"
              >
                ⚙ {t.ruleCustom.customize}
              </button>
            </div>

            {/* Slider sub-panel */}
            {showCustom && (
              <div className="rule-custom-panel">
                <div className="rule-custom-warning">
                  <span className="rule-custom-warning-icon">⚠</span>
                  <div>
                    <div className="rule-custom-warning-title">{t.ruleCustom.warningTitle}</div>
                    <div className="rule-custom-warning-body">{t.ruleCustom.warningBody}</div>
                  </div>
                </div>

                <RuleSlider
                  needs={targets.needs}
                  wants={targets.wants}
                  savings={targets.savings}
                  colors={sliderColors}
                  labels={sliderLabels}
                  onChange={handleSliderChange}
                />

                <div className="rule-slider-footer">
                  <span className="rule-slider-total">
                    {t.ruleCustom.total}: {targets.needs + targets.wants + targets.savings}%
                  </span>
                  {!isDefault && (
                    <button className="rule-reset-btn" onClick={resetTargets} type="button">
                      ↺ {t.ruleCustom.resetDefault}
                    </button>
                  )}
                </div>
              </div>
            )}

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
      </div>}
    </div>
  );
}
