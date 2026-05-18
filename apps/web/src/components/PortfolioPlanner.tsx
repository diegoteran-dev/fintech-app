import { useState, useEffect } from 'react';
import type { Transaction, Account, Holding } from '../types';
import { getTransactions, getAccounts, getHoldings, createAccount } from '../services/api';
import { computeAge, useUserProfile } from '../hooks/useUserProfile';

interface Broker {
  id: string;
  name: string;
  tag: string;
  tagStyle: 'best' | 'popular' | 'warn' | 'neutral';
  pros: string[];
  cons: string[];
  warning?: string;
  latamOnly?: boolean; // only show warning for LATAM users
}

const BROKERS: Broker[] = [
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    tag: '✓ Recommended',
    tagStyle: 'best',
    pros: [
      '✓ You own real shares (not CFDs)',
      '✓ SIPC protection up to $250,000',
      '✓ Accepts Bolivia, Argentina, Mexico',
      '✓ Lowest commissions in the industry',
      '✓ DCA & DRIP automation',
      '✓ Regulated in USA + 10 countries',
    ],
    cons: [
      '✗ Interface takes getting used to',
      '✗ $0 minimum but $3/mo fee if < $100k',
    ],
  },
  {
    id: 'xtb',
    name: 'XTB',
    tag: 'EU-regulated · LATAM-friendly',
    tagStyle: 'popular',
    pros: [
      '✓ $0 commission up to €100k/month',
      '✓ Real stocks & ETFs (Invest account)',
      '✓ Fractional shares from $10',
      '✓ Regulated by FCA, KNF, CySEC',
      '✓ xStation — clean, fast platform',
      '✓ Accepts most LATAM countries',
    ],
    cons: [
      '✗ Also offers CFDs — pick "Invest" account, not "Trade"',
      '✗ Commission kicks in above €100k/mo',
      '✗ No US SIPC protection (EU-regulated)',
    ],
  },
  {
    id: 'hapi',
    name: 'Hapi',
    tag: 'Built for LATAM',
    tagStyle: 'popular',
    pros: [
      '✓ Designed specifically for Latin America',
      '✓ Real US shares — FINRA & SEC regulated',
      '✓ $0 commission, fractional shares',
      '✓ Spanish interface, LATAM onboarding',
      '✓ No minimum deposit',
      '✓ Available in MX, CO, PE, CL, AR & more',
    ],
    cons: [
      '✗ Newer company — shorter track record',
      '✗ Limited to US stocks & ETFs only',
      '✗ No options, bonds, or crypto',
    ],
  },
  {
    id: 'etoro',
    name: 'eToro',
    tag: 'Popular · Social trading',
    tagStyle: 'neutral',
    pros: [
      '✓ Very easy to use',
      '✓ Social & copy trading features',
      '✓ Low minimum deposit ($50)',
      '✓ Real shares on non-leveraged buys',
      '✓ Wide asset selection',
    ],
    cons: [
      '✗ Leveraged & short positions are CFDs',
      '✗ High spreads vs competitors',
      '✗ Withdrawal fees ($5 per withdrawal)',
      '✗ Not ideal for long-term DCA investing',
    ],
    warning: 'Outside the US, EU, and UK, eToro operates under its Seychelles entity (FSAS) — a much weaker regulator with no investor compensation scheme and no negative balance protection. Non-leveraged 1x buys are real shares, but if you use leverage or short positions you hold CFDs with no ownership rights. IBKR, XTB, and Hapi all offer stronger protections for long-term investors.',
  },
];

const LATAM_COUNTRIES = new Set([
  'Bolivia', 'Argentina', 'Mexico', 'Brazil', 'Colombia', 'Peru',
  'Chile', 'Venezuela', 'Ecuador', 'Paraguay', 'Uruguay',
]);

const INSTITUTIONS = [
  'Banco Ganadero', 'Banco Nacional de Bolivia', 'Banco Mercantil Santa Cruz',
  'Banco BISA', 'Banco Económico', 'Banco FIE', 'Banco Solidario',
  'Chase Bank', 'Bank of America', 'Wells Fargo', 'Other',
];
const CURRENCIES = ['USD', 'BOB', 'ARS', 'MXN'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function avgMonthlyExpenses(transactions: Transaction[]): number {
  const expenses = transactions.filter(t => t.type === 'expense');
  if (expenses.length === 0) return 0;
  const byMonth: Record<string, number> = {};
  for (const t of expenses) {
    const month = t.date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + (t.amount_usd ?? t.amount);
  }
  const months = Object.values(byMonth);
  return months.reduce((a, b) => a + b, 0) / months.length;
}

function liquidUSD(accounts: Account[]): number {
  return accounts
    .filter(a => a.currency === 'USD' && (a.account_type === 'checking' || a.account_type === 'savings'))
    .reduce((s, a) => s + a.current_balance, 0);
}

function portfolioValue(holdings: Holding[]): number {
  return holdings.reduce((s, h) => s + (h.value ?? 0), 0);
}

// 120 − age rule from notes
function allocationByAge(age: number) {
  const variable = Math.max(0, Math.min(100, 120 - age));
  const fixed = 100 - variable;
  return { variable, fixed };
}

function monthsOfEmergencyFund(liquid: number, monthly: number): number {
  if (monthly <= 0) return 0;
  return liquid / monthly;
}

// ── Portfolio model suggestions based on profile ─────────────────────────────

type Profile = 'growth' | 'balanced' | 'dividends';

const portfolioModels: Record<Profile, {
  label: string;
  desc: string;
  fixedIncome: Array<{ ticker: string; pct: number; desc: string }>;
  variable: Array<{ ticker: string; pct: number; desc: string }>;
}> = {
  growth: {
    label: 'Growth — Diversification & Growth',
    desc: 'Maximizes long-term capital appreciation with global diversification. Best for investors under 35 focused on building wealth.',
    fixedIncome: [
      { ticker: 'BND', pct: 34, desc: '66% USA + 33% global bonds' },
      { ticker: 'IUSB', pct: 33, desc: '+15,000 bonds, ~3% monthly dividend' },
      { ticker: 'BNDX', pct: 33, desc: 'Global bonds excluding USA' },
    ],
    variable: [
      { ticker: 'VOO', pct: 30, desc: 'S&P 500 — 500 largest US companies' },
      { ticker: 'VT', pct: 25, desc: '+9,000 global companies' },
      { ticker: 'QQQ', pct: 25, desc: 'Top 100 NASDAQ tech companies' },
      { ticker: 'VWO', pct: 10, desc: 'Emerging markets outside USA' },
      { ticker: 'PHYS', pct: 10, desc: 'Physical gold — inflation hedge' },
    ],
  },
  balanced: {
    label: 'Balanced — Diversification & Dividends',
    desc: 'Balances growth with income. A mix of broad ETFs and dividend-paying assets. Good for any age.',
    fixedIncome: [
      { ticker: 'BND', pct: 34, desc: '66% USA + 33% global bonds' },
      { ticker: 'IUSB', pct: 33, desc: '+15,000 bonds, ~3% monthly dividend' },
      { ticker: 'BNDX', pct: 33, desc: 'Global bonds excluding USA' },
    ],
    variable: [
      { ticker: 'VOO', pct: 30, desc: 'S&P 500 — foundation' },
      { ticker: 'VT', pct: 30, desc: '+9,000 global companies' },
      { ticker: 'NOBL', pct: 20, desc: 'Dividend Aristocrats — 25yr growing divs' },
      { ticker: 'VNQ', pct: 20, desc: 'US REITs — real estate exposure' },
    ],
  },
  dividends: {
    label: 'Dividends — Income Focused',
    desc: 'Focused on generating consistent dividend income. Ideal for those approaching financial independence or wanting passive cash flow.',
    fixedIncome: [
      { ticker: 'BND', pct: 34, desc: '66% USA + 33% global bonds' },
      { ticker: 'IUSB', pct: 33, desc: '+15,000 bonds, ~3% monthly dividend' },
      { ticker: 'BNDX', pct: 33, desc: 'Global bonds excluding USA' },
    ],
    variable: [
      { ticker: 'SCHD', pct: 20, desc: '100 best dividend companies USA' },
      { ticker: 'VOO', pct: 20, desc: 'S&P 500 — growth anchor' },
      { ticker: 'VT', pct: 10, desc: 'Global diversification' },
      { ticker: 'VNQ', pct: 20, desc: 'US REITs — high dividends' },
      { ticker: 'NOBL', pct: 10, desc: 'Dividend Aristocrats' },
      { ticker: 'O', pct: 10, desc: 'Realty Income — monthly dividends' },
      { ticker: 'VICI', pct: 10, desc: 'Best Las Vegas casinos & hotels' },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortfolioPlanner() {
  const { profile: userProfile, setProfile: saveUserProfile } = useUserProfile();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const age = computeAge(userProfile.dob);

  // Emergency fund account creation
  const [showEFForm, setShowEFForm] = useState(false);
  const [efInstitution, setEFInstitution] = useState(INSTITUTIONS[0]);
  const [efCurrency, setEFCurrency] = useState('USD');
  const [efBalance, setEFBalance] = useState('');
  const [efSaving, setEFSaving] = useState(false);
  const [efError, setEFError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>('growth');
  const [selectedBroker, setSelectedBroker] = useState<string | null>(userProfile.broker ?? null);
  const [monthlyInvest, setMonthlyInvest] = useState('');

  useEffect(() => {
    const load = () =>
      Promise.all([getTransactions(), getAccounts(), getHoldings()])
        .then(([tx, acc, hol]) => { setTransactions(tx); setAccounts(acc); setHoldings(hol); })
        .finally(() => setLoading(false));
    load();
  }, []);

  const handleCreateEF = async () => {
    setEFError(null);
    setEFSaving(true);
    try {
      await createAccount({
        name: 'Emergency Fund',
        institution: efInstitution,
        account_type: 'savings',
        currency: efCurrency,
        current_balance: parseFloat(efBalance) || 0,
      });
      setShowEFForm(false);
      setEFBalance('');
      // Refresh accounts
      getAccounts().then(setAccounts);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create account.';
      setEFError(msg);
    } finally {
      setEFSaving(false);
    }
  };

  const avgExpenses = avgMonthlyExpenses(transactions);
  const efAccount = accounts.find(a => a.name.toLowerCase().includes('emergency'));
  const liquidBalance = liquidUSD(accounts);
  const currentPortfolio = portfolioValue(holdings);
  const emergencyMonths = monthsOfEmergencyFund(liquidBalance, avgExpenses);
  const { variable, fixed } = allocationByAge(age);
  const model = portfolioModels[profile];

  // DCA compound projection (simplified: monthly contribution, 10% annual return)
  const monthly = parseFloat(monthlyInvest) || 0;
  const rate = 0.10 / 12;
  const projections = [5, 10, 20, 30].map(years => {
    const n = years * 12;
    const future = monthly > 0
      ? monthly * ((Math.pow(1 + rate, n) - 1) / rate)
      : 0;
    return { years, value: future };
  });

  // Emergency fund status
  const efStatus = emergencyMonths >= 6
    ? { color: 'var(--green)', label: '✓ Fully funded', hint: 'You\'re ready to invest.' }
    : emergencyMonths >= 3
    ? { color: 'var(--yellow)', label: '~ Partially funded', hint: 'Keep building. 6 months is the target.' }
    : { color: 'var(--red)', label: '✗ Not funded', hint: 'Build this before investing. It\'s your safety net.' };

  return (
    <div className="card">
      <div className="card-title">Your Portfolio Plan</div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
        Personalized steps based on your actual data. From zero to financially free.
      </p>

      {loading ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>Loading your data…</div>
      ) : (
        <div className="planner-steps">

          {/* ── Step 1: Emergency Fund ── */}
          <div className="planner-step">
            <div className="planner-step-header">
              <div className="planner-step-num">1</div>
              <div>
                <div className="planner-step-title">Emergency Fund</div>
                <div className="planner-step-sub">3–6 months of expenses in liquid USD before investing</div>
              </div>
            </div>
            <div className="planner-step-body">
              <div className="planner-stat-row">
                <div className="planner-stat">
                  <div className="planner-stat-label">Avg. Monthly Expenses</div>
                  <div className="planner-stat-value">
                    ${avgExpenses > 0 ? avgExpenses.toFixed(0) : '—'}
                  </div>
                </div>
                <div className="planner-stat">
                  <div className="planner-stat-label">Liquid USD (checking + savings)</div>
                  <div className="planner-stat-value">${liquidBalance.toFixed(0)}</div>
                </div>
                <div className="planner-stat">
                  <div className="planner-stat-label">Months Covered</div>
                  <div className="planner-stat-value" style={{ color: efStatus.color }}>
                    {avgExpenses > 0 ? `${emergencyMonths.toFixed(1)} mo` : '—'}
                  </div>
                </div>
              </div>
              {avgExpenses > 0 && (
                <div className="planner-status-row" style={{ borderColor: efStatus.color }}>
                  <span style={{ color: efStatus.color, fontWeight: 600 }}>{efStatus.label}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{efStatus.hint}</span>
                </div>
              )}
              {emergencyMonths < 3 && avgExpenses > 0 && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)' }}>
                  You need <strong style={{ color: 'var(--text)' }}>${(avgExpenses * 3 - liquidBalance).toFixed(0)}</strong> more
                  to reach 3 months, or <strong style={{ color: 'var(--text)' }}>${(avgExpenses * 6 - liquidBalance).toFixed(0)}</strong> for
                  the full 6-month target.
                </div>
              )}
              <div className="planner-note">
                The emergency fund goes in a <strong>USD savings account</strong>, not invested.
                This prevents you from selling investments at a loss during a crisis.
              </div>

              {/* Create Emergency Fund Account */}
              {efAccount ? (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)' }}>
                  <span style={{ color: 'var(--green)', fontSize: 16 }}>✓</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>Emergency Fund account exists</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{efAccount.institution} · {efAccount.currency} · Balance: {efAccount.currency === 'BOB' ? 'Bs.' : '$'}{efAccount.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
              ) : showEFForm ? (
                <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                    New Account — <span style={{ color: 'var(--accent)' }}>Emergency Fund</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>· Type: Savings (fixed)</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Bank / Institution</div>
                      <select
                        className="form-select"
                        value={efInstitution}
                        onChange={e => setEFInstitution(e.target.value)}
                      >
                        {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: '0 0 90px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Currency</div>
                      <select
                        className="form-select"
                        value={efCurrency}
                        onChange={e => setEFCurrency(e.target.value)}
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Current Balance</div>
                      <input
                        className="form-input"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={efBalance}
                        onChange={e => setEFBalance(e.target.value.replace(',', '.'))}
                      />
                    </div>
                  </div>
                  {efError && <div className="form-error" style={{ marginTop: 8 }}>{efError}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn-primary" onClick={handleCreateEF} disabled={efSaving} style={{ flex: 1 }}>
                      {efSaving ? 'Creating…' : 'Create Account'}
                    </button>
                    <button className="btn-ghost" onClick={() => { setShowEFForm(false); setEFError(null); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => setShowEFForm(true)}
                >
                  + Create Emergency Fund Account
                </button>
              )}
            </div>
          </div>

          {/* ── Step 2: Choose Your Broker ── */}
          <div className="planner-step">
            <div className="planner-step-header">
              <div className="planner-step-num">2</div>
              <div>
                <div className="planner-step-title">Choose Your Broker</div>
                <div className="planner-step-sub">Click one to compare — each has different tradeoffs</div>
              </div>
            </div>
            <div className="planner-step-body">
              <div className="planner-broker-grid">
                {BROKERS.map(b => {
                  const isSelected = selectedBroker === b.id;
                  const showWarn = isSelected && !!b.warning && (!b.latamOnly || LATAM_COUNTRIES.has(userProfile.country));
                  return (
                    <div
                      key={b.id}
                      className={`planner-broker-card ${isSelected ? (showWarn ? 'selected-warn' : 'selected') : ''}`}
                      onClick={() => {
                        const next = isSelected ? null : b.id;
                        setSelectedBroker(next);
                        saveUserProfile({ ...userProfile, broker: next ?? undefined });
                      }}
                    >
                      <div className="planner-broker-name">{b.name}</div>
                      <span className={`planner-broker-tag planner-broker-tag--${b.tagStyle}`}>{b.tag}</span>
                      <div className="planner-broker-pros">
                        {b.pros.map(p => <div key={p}>{p}</div>)}
                      </div>
                      <div className="planner-broker-cons">
                        {b.cons.map(c => <div key={c}>{c}</div>)}
                      </div>
                      {showWarn && (
                        <div className="planner-broker-warn">
                          ⚠ {b.warning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!selectedBroker && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                  Select a broker above to see the full pros & cons
                </div>
              )}
            </div>
          </div>

          {/* ── Step 3: Your Allocation by Age ── */}
          <div className="planner-step">
            <div className="planner-step-header">
              <div className="planner-step-num">3</div>
              <div>
                <div className="planner-step-title">Fixed Income vs. Equity Split</div>
                <div className="planner-step-sub">Rule of 120: the younger you are, the more equity you hold</div>
              </div>
            </div>
            <div className="planner-step-body">
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Based on your age of <strong style={{ color: 'var(--accent)' }}>{age}</strong> (set in Settings),
                you should hold <strong style={{ color: 'var(--accent)' }}>{variable}% in equity</strong> and{' '}
                <strong>{fixed}% in fixed income</strong>.
              </div>
              <div className="planner-alloc-bar">
                <div
                  className="planner-alloc-seg planner-alloc-var"
                  style={{ width: `${variable}%` }}
                >
                  {variable > 15 && <span>{variable}% Equity</span>}
                </div>
                {fixed > 0 && (
                  <div
                    className="planner-alloc-seg planner-alloc-fixed"
                    style={{ width: `${fixed}%` }}
                  >
                    {fixed > 10 && <span>{fixed}% Fixed Income</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div className="planner-alloc-label">
                  <span className="planner-dot" style={{ background: '#7C3AED' }} />
                  <span><strong>{variable}%</strong> Renta Variable (ETFs, stocks, crypto, gold)</span>
                </div>
                <div className="planner-alloc-label">
                  <span className="planner-dot" style={{ background: '#2563EB' }} />
                  <span><strong>{fixed}%</strong> Renta Fija (bonds: BND, IUSB, BNDX)</span>
                </div>
              </div>
              <div className="planner-note" style={{ marginTop: 12 }}>
                Formula: <code>120 − {age} = {variable}% in equity</code>.
                At your age, the priority is <strong>growth</strong>
                {fixed > 20 ? ' while protecting with meaningful bond exposure' : ' — bonds are minimal'}.
              </div>
            </div>
          </div>

          {/* ── Step 4: ETF Examples ── */}
          <div className="planner-step">
            <div className="planner-step-header">
              <div className="planner-step-num">4</div>
              <div>
                <div className="planner-step-title">ETF Portfolio Examples</div>
                <div className="planner-step-sub">Reference models — adapt these to your own situation</div>
              </div>
            </div>
            <div className="planner-step-body">
              <div className="planner-profile-tabs">
                {(['growth', 'balanced', 'dividends'] as Profile[]).map(p => (
                  <button
                    key={p}
                    className={`planner-profile-tab${profile === p ? ' active' : ''}`}
                    onClick={() => setProfile(p)}
                  >
                    {p === 'growth' ? '📈 Growth' : p === 'balanced' ? '⚖️ Balanced' : '💰 Dividends'}
                  </button>
                ))}
              </div>
              <div style={{ margin: '10px 0', padding: '8px 12px', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', fontSize: 12, color: 'var(--text-2)' }}>
                💡 These are <strong>example portfolios</strong> — not financial advice. Use them as a starting point and adjust based on your goals, risk tolerance, and tax situation.
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '8px 0 12px' }}>{model.desc}</p>

              {fixed > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', marginBottom: 8 }}>
                    FIXED INCOME — {fixed}% of portfolio
                  </div>
                  {model.fixedIncome.map(item => (
                    <div key={item.ticker} className="planner-etf-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="planner-ticker" style={{ background: '#2563EB22', color: '#2563EB' }}>{item.ticker}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.desc}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
                        {((item.pct / 100) * fixed).toFixed(0)}% of total
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED', marginBottom: 8 }}>
                  EQUITY (RENTA VARIABLE) — {variable}% of portfolio
                </div>
                {model.variable.map(item => (
                  <div key={item.ticker} className="planner-etf-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="planner-ticker" style={{ background: '#7C3AED22', color: '#7C3AED' }}>{item.ticker}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.desc}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
                      {((item.pct / 100) * variable).toFixed(0)}% of total
                    </span>
                  </div>
                ))}
              </div>

              {currentPortfolio > 0 && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 13, color: 'var(--text-2)' }}>
                  Your current portfolio value: <strong style={{ color: 'var(--text)' }}>${currentPortfolio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              )}
            </div>
          </div>

          {/* ── Step 5: DCA — Compound Interest Projector ── */}
          <div className="planner-step">
            <div className="planner-step-header">
              <div className="planner-step-num">5</div>
              <div>
                <div className="planner-step-title">DCA — Compound Interest Projector</div>
                <div className="planner-step-sub">Apply the 50/30/20 rule: invest your 20% every month, consistently</div>
              </div>
            </div>
            <div className="planner-step-body">
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                  Monthly investment (USD)
                  {avgExpenses > 0 && (
                    <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 12 }}>
                      — your 20% savings rule: ~${(avgExpenses * 0.2).toFixed(0)}/mo
                    </span>
                  )}
                </label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="decimal"
                  placeholder={avgExpenses > 0 ? `e.g. ${(avgExpenses * 0.2).toFixed(0)}` : 'e.g. 200'}
                  value={monthlyInvest}
                  onChange={e => setMonthlyInvest(e.target.value.replace(',', '.'))}
                  style={{ maxWidth: 200 }}
                />
              </div>
              {monthly > 0 ? (
                <div className="planner-projection-grid">
                  {projections.map(p => (
                    <div key={p.years} className="planner-projection-card">
                      <div className="planner-projection-years">{p.years} years</div>
                      <div className="planner-projection-value">
                        ${p.value >= 1_000_000
                          ? `${(p.value / 1_000_000).toFixed(2)}M`
                          : p.value >= 1000
                          ? `${(p.value / 1000).toFixed(0)}K`
                          : p.value.toFixed(0)}
                      </div>
                      <div className="planner-projection-sub">
                        invested: ${(monthly * p.years * 12 / 1000).toFixed(0)}K
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  Enter a monthly amount to see the compound interest projection at 10% annual return (S&P 500 historical average).
                </div>
              )}
              <div className="planner-note" style={{ marginTop: 12 }}>
                Based on DCA + 10% avg. annual return (S&P 500 historical). This is not a guarantee — it is a mathematical projection.
                <strong> The key is to never stop buying.</strong> Market downturns = buying cheaper.
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
