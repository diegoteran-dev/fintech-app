export interface Broker {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  pros: string[];
  cons: string[];
  warning?: string;
}

export const BROKERS: Broker[] = [
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    tag: '✓ Recommended',
    tagColor: '#10B981',
    pros: [
      'You own real shares (not CFDs)',
      'SIPC protection up to $250,000',
      'Accepts Bolivia, Argentina, Mexico',
      'Lowest commissions in the industry',
      'DCA & DRIP automation',
      'Regulated in USA + 10 countries',
    ],
    cons: [
      'Interface takes getting used to',
      '$0 minimum but $3/mo fee if < $100k',
    ],
  },
  {
    id: 'xtb',
    name: 'XTB',
    tag: 'EU-regulated',
    tagColor: '#7C3AED',
    pros: [
      '$0 commission up to €100k/month',
      'Real stocks & ETFs (Invest account)',
      'Fractional shares from $10',
      'Regulated by FCA, KNF, CySEC',
      'xStation — clean, fast platform',
      'Accepts most LATAM countries',
    ],
    cons: [
      'Also offers CFDs — pick "Invest" account, not "Trade"',
      'Commission kicks in above €100k/mo',
      'No US SIPC protection (EU-regulated)',
    ],
  },
  {
    id: 'hapi',
    name: 'Hapi',
    tag: 'Built for LATAM',
    tagColor: '#06B6D4',
    pros: [
      'Designed specifically for Latin America',
      'Real US shares — FINRA & SEC regulated',
      '$0 commission, fractional shares',
      'Spanish interface, LATAM onboarding',
      'No minimum deposit',
      'Available in MX, CO, PE, CL, AR & more',
    ],
    cons: [
      'Newer company — shorter track record',
      'Limited to US stocks & ETFs only',
      'No options, bonds, or crypto',
    ],
  },
  {
    id: 'etoro',
    name: 'eToro',
    tag: 'Social trading',
    tagColor: '#94A3B8',
    pros: [
      'Very easy to use',
      'Social & copy trading features',
      'Low minimum deposit ($50)',
      'Real shares on non-leveraged buys',
      'Wide asset selection',
    ],
    cons: [
      'Leveraged & short positions are CFDs',
      'High spreads vs competitors',
      'Withdrawal fees ($5 per withdrawal)',
      'Not ideal for long-term DCA investing',
    ],
    warning:
      'Outside the US, EU, and UK, eToro operates under its Seychelles entity (FSAS) — a weaker regulator with no investor compensation scheme and no negative balance protection. Non-leveraged 1x buys are real shares, but with leverage or short positions you hold CFDs with no ownership rights.',
  },
];

export const LATAM_COUNTRIES = new Set([
  'Bolivia', 'Argentina', 'Mexico', 'Brazil', 'Colombia',
  'Peru', 'Chile', 'Venezuela', 'Ecuador', 'Paraguay', 'Uruguay',
]);
