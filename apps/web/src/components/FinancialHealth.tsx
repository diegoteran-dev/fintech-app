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
    title: 'Needs — Essential Expenses (50%)',
    body: 'Gastos indispensables que no puedes eliminar fácilmente: vivienda, comida, transporte, salud y servicios básicos. Si superas el 50%, busca formas de reducir costos fijos como el alquiler o cambiar de plan de transporte.',
  },
  Wants: {
    title: 'Wants — Lifestyle Spending (30%)',
    body: 'Gastos de estilo de vida que mejoran tu calidad de vida pero que puedes reducir. Esta es la palanca más fácil para aumentar tus ahorros. Pequeños recortes aquí se acumulan rápido. Recuerda: no lifestyle creep — si suben tus ingresos, no subas el gasto.',
  },
  Savings: {
    title: 'Savings — Your Future (20%)',
    body: 'Orden correcto: 1) Fondo de emergencia (3–6 meses de gastos) 2) Elimina deuda de alto interés 3) Invierte vía ETFs con DCA. No tiene sentido invertir con 8% de retorno si pagas 20% en deuda. DCA + DRIP + tiempo = riqueza.',
  },
};

const GRADE_POP = {
  title: 'Financial Health Score',
  body: 'Mide qué tan cerca estás de la regla 50/30/20. A ≥90 · B ≥75 · C ≥60 · D ≥45 · F <45. Un A o B consistente significa que tu dinero trabaja para ti. C/D/F indica que uno de los tres buckets necesita ajuste.',
};

const RULE_50_30_20_POP = {
  title: 'The 50/30/20 Rule',
  body: 'Creada por la senadora Elizabeth Warren. Divide tus ingresos netos en tres buckets: 50% necesidades, 30% caprichos, 20% ahorro e inversión. Es el punto de partida antes de tocar ninguna inversión. Domina esto primero.',
};

const ETF_POPS: Record<string, { title: string; body: string }> = {
  VTI: {
    title: 'VTI — Vanguard Total Stock Market',
    body: 'Invierte en ~4,000 empresas del mercado bursátil de EE.UU. en un solo fondo. Diversificación máxima con comisiones mínimas. Ideal para estrategia DCA a largo plazo. Time in market beats timing the market.',
  },
  VOO: {
    title: 'VOO — Vanguard S&P 500',
    body: 'Réplica del S&P 500 — las 500 empresas más grandes de EE.UU. No puedes comprar el S&P 500 directamente, pero sí a través de VOO. Históricamente ha retornado ~10% anual promedio a largo plazo.',
  },
  VXUS: {
    title: 'VXUS — Total International Stocks',
    body: 'Mercados fuera de EE.UU.: Europa, Asia, mercados emergentes. Añade diversificación geográfica para reducir el riesgo de que un solo país afecte tu portfolio. Complementa bien a VTI o VOO.',
  },
  BIL: {
    title: 'BIL — Short-Term Treasury Bills',
    body: 'Bonos del gobierno de EE.UU. a muy corto plazo. Bajo riesgo, bajo retorno. Útil para aparcar tu fondo de emergencia mientras genera algo. No es una inversión de crecimiento — es un refugio de valor.',
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
