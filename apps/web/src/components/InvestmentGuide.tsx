import { useState } from 'react';

interface Section {
  id: string;
  emoji: string;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: 'why',
    emoji: '🔥',
    title: 'Why You Must Invest',
    content: (
      <div className="guide-body">
        <p>
          If your money is sitting in a bank account in Bolivia, Argentina, or Mexico, it is losing
          value every single day. Inflation silently eats your purchasing power — in Argentina it
          has exceeded 100% per year. In Bolivia the official rate is low but the street reality is
          different. The solution is not to save more. It is to <strong>put your money to work in
          assets that grow faster than inflation.</strong>
        </p>
        <div className="guide-stat-row">
          <div className="guide-stat">
            <div className="guide-stat-value" style={{ color: 'var(--red)' }}>−8% / yr</div>
            <div className="guide-stat-label">Avg. purchasing power loss<br />in a BOB savings account</div>
          </div>
          <div className="guide-stat">
            <div className="guide-stat-value" style={{ color: 'var(--green)' }}>+10% / yr</div>
            <div className="guide-stat-label">Historical avg. return<br />of the S&P 500 (USD)</div>
          </div>
          <div className="guide-stat">
            <div className="guide-stat-value" style={{ color: 'var(--accent)' }}>+18% / yr</div>
            <div className="guide-stat-label">Combined effect over<br />10 years of investing</div>
          </div>
        </div>
        <p>
          Investing is not speculation. It is the act of buying ownership in businesses and assets
          that produce value. The stock market is simply the easiest place to do that.
        </p>
      </div>
    ),
  },
  {
    id: 'assets',
    emoji: '🧱',
    title: 'Asset Classes Explained',
    content: (
      <div className="guide-body">
        <p>Every asset class has a role. A strong portfolio uses several of them together.</p>
        <div className="guide-asset-grid">
          <div className="guide-asset-card">
            <div className="guide-asset-header" style={{ color: '#7C3AED' }}>
              <span className="guide-asset-icon">📊</span> Stocks
            </div>
            <p>Ownership in a company. High growth potential, high volatility. Best for long-term wealth building (5+ years).</p>
            <div className="guide-pill">e.g. AAPL, MSFT, NVDA</div>
          </div>
          <div className="guide-asset-card">
            <div className="guide-asset-header" style={{ color: '#2563EB' }}>
              <span className="guide-asset-icon">🗂️</span> ETFs
            </div>
            <p>A basket of hundreds of stocks in one purchase. Instant diversification at low cost. The safest way to start.</p>
            <div className="guide-pill">e.g. VOO, VTI, QQQ, PHYS</div>
          </div>
          <div className="guide-asset-card">
            <div className="guide-asset-header" style={{ color: '#F59E0B' }}>
              <span className="guide-asset-icon">₿</span> Crypto
            </div>
            <p>Decentralized digital assets. Very high volatility. Bitcoin and Ethereum are the most established. Keep allocation small.</p>
            <div className="guide-pill">e.g. BTC, ETH, XRP</div>
          </div>
          <div className="guide-asset-card">
            <div className="guide-asset-header" style={{ color: '#D97706' }}>
              <span className="guide-asset-icon">🥇</span> Metals
            </div>
            <p>Gold and silver are inflation hedges and safe-haven assets. They protect wealth during crises. Use as a store of value.</p>
            <div className="guide-pill">e.g. GLD, PHYS, SLV</div>
          </div>
          <div className="guide-asset-card">
            <div className="guide-asset-header" style={{ color: '#22C55E' }}>
              <span className="guide-asset-icon">💵</span> Cash (USD)
            </div>
            <p>Holding USD protects you from local currency devaluation. Keep an emergency fund in USD. Not for long-term growth.</p>
            <div className="guide-pill">3–6 months of expenses</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'portfolio',
    emoji: '🎯',
    title: 'Build Your First Portfolio',
    content: (
      <div className="guide-body">
        <p>
          The most proven beginner portfolio is the <strong>3-Fund Portfolio</strong> — used by millions of
          investors worldwide. It is simple, cheap, and hard to beat over the long run.
        </p>
        <div className="guide-allocation">
          <div className="guide-allocation-bar">
            <div className="guide-allocation-segment" style={{ width: '60%', background: '#2563EB' }}>
              <span>60%</span>
            </div>
            <div className="guide-allocation-segment" style={{ width: '20%', background: '#7C3AED' }}>
              <span>20%</span>
            </div>
            <div className="guide-allocation-segment" style={{ width: '10%', background: '#D97706' }}>
              <span>10%</span>
            </div>
            <div className="guide-allocation-segment" style={{ width: '10%', background: '#F59E0B' }}>
              <span>10%</span>
            </div>
          </div>
          <div className="guide-allocation-legend">
            <div className="guide-legend-item"><span className="guide-legend-dot" style={{ background: '#2563EB' }} />US Total Market ETF (VTI or VOO) — 60%</div>
            <div className="guide-legend-item"><span className="guide-legend-dot" style={{ background: '#7C3AED' }} />International ETF (VXUS) — 20%</div>
            <div className="guide-legend-item"><span className="guide-legend-dot" style={{ background: '#D97706' }} />Gold ETF (GLD or PHYS) — 10%</div>
            <div className="guide-legend-item"><span className="guide-legend-dot" style={{ background: '#F59E0B' }} />Bitcoin (BTC) — 10%</div>
          </div>
        </div>
        <p>
          This allocation gives you exposure to the US economy, global markets, an inflation hedge,
          and a small high-upside bet on crypto — without over-concentrating in any single asset.
        </p>
        <div className="guide-callout">
          <strong>Rule of thumb:</strong> The more time you have, the more aggressive you can be.
          If you are under 30, you can push the ETF allocation higher and add individual stocks.
          If you are close to needing the money, shift toward gold and cash.
        </div>
      </div>
    ),
  },
  {
    id: 'steps',
    emoji: '🪜',
    title: 'Step-by-Step: Start Investing',
    content: (
      <div className="guide-body">
        <div className="guide-steps">
          <div className="guide-step">
            <div className="guide-step-num">1</div>
            <div>
              <div className="guide-step-title">Build a USD emergency fund first</div>
              <p>Before investing, have 3–6 months of expenses saved in USD. This prevents you from selling investments at a loss during emergencies.</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="guide-step-num">2</div>
            <div>
              <div className="guide-step-title">Open a brokerage account</div>
              <p>From Latin America, the best options are <strong>Interactive Brokers</strong> (best for international investors, low fees) or <strong>Stake</strong>. Avoid brokers that only offer local markets.</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="guide-step-num">3</div>
            <div>
              <div className="guide-step-title">Start with VOO or VTI</div>
              <p>Your first purchase should be a broad US market ETF. One share of VOO gives you exposure to 500 of the largest US companies. That is your foundation.</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="guide-step-num">4</div>
            <div>
              <div className="guide-step-title">Dollar-cost average every month</div>
              <p>Invest a fixed amount every month regardless of what the market is doing. This removes emotion from the equation and lowers your average cost over time.</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="guide-step-num">5</div>
            <div>
              <div className="guide-step-title">Add complexity as you grow</div>
              <p>Once your ETF base is solid (3+ months in), you can add individual stocks, gold, or a small crypto position. Never let speculative assets exceed 20% of your total portfolio.</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="guide-step-num">6</div>
            <div>
              <div className="guide-step-title">Track it here, review quarterly</div>
              <p>Use the Holdings section above to track your portfolio value in real time. Review your allocation every 3 months — rebalance only if one asset class has drifted more than 10% from your target.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'rules',
    emoji: '⚠️',
    title: 'The Rules That Protect You',
    content: (
      <div className="guide-body">
        <div className="guide-rules">
          <div className="guide-rule guide-rule--green">
            <div className="guide-rule-label">DO</div>
            <ul>
              <li>Invest money you will not need for at least 3 years</li>
              <li>Diversify across asset classes and geographies</li>
              <li>Keep investing during downturns — that is when prices are cheapest</li>
              <li>Reinvest dividends automatically</li>
              <li>Use low-cost index ETFs as your core</li>
            </ul>
          </div>
          <div className="guide-rule guide-rule--red">
            <div className="guide-rule-label">DO NOT</div>
            <ul>
              <li>Invest money you need in the next 12 months</li>
              <li>Put more than 5% of your portfolio in a single stock</li>
              <li>Try to time the market — nobody can do it consistently</li>
              <li>Sell in panic during a correction</li>
              <li>Follow influencer "tips" — they are usually selling you something</li>
            </ul>
          </div>
        </div>
        <div className="guide-callout" style={{ marginTop: 20 }}>
          <strong>The most powerful force in investing is time.</strong> $200/month invested in VOO
          for 30 years at the historical average return becomes over $400,000. Start early, stay consistent.
        </div>
      </div>
    ),
  },
];

export default function InvestmentGuide() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>Investment Guide</div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
        Learn how to build and manage a portfolio that protects your wealth from inflation.
      </p>
      <div className="guide-accordion">
        {sections.map(s => (
          <div key={s.id} className={`guide-section${open === s.id ? ' guide-section--open' : ''}`}>
            <button
              className="guide-section-header"
              onClick={() => setOpen(open === s.id ? null : s.id)}
            >
              <span>{s.emoji} {s.title}</span>
              <span className="guide-chevron">{open === s.id ? '▲' : '▼'}</span>
            </button>
            {open === s.id && (
              <div className="guide-section-body">
                {s.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
