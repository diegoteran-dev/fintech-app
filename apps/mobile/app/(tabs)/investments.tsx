import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getHoldings, createHolding, updateHolding, deleteHolding, searchTicker,
  getNetWorth, createNetWorth, deleteNetWorth,
  getTransactions, getAccounts, getInflation,
  type Holding, type NetWorthEntry, type InflationData,
} from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';
import { BROKERS } from '../../constants/brokers';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useRuleTargets } from '../../hooks/useRuleTargets';
import { LineChart } from '../../components/LineChart';

// ── Constants ────────────────────────────────────────────────────────────────

const ASSET_TYPES = ['stock', 'etf', 'metal', 'crypto', 'cash'] as const;
type AssetType = typeof ASSET_TYPES[number];

const TYPE_COLOR: Record<AssetType, string> = {
  stock: '#6366F1', etf: '#10B981', metal: '#F59E0B',
  crypto: '#06B6D4', cash: '#94A3B8',
};

const LATAM_COUNTRIES = [
  { code: 'BO', name: 'Bolivia' }, { code: 'AR', name: 'Argentina' },
  { code: 'MX', name: 'Mexico' },  { code: 'BR', name: 'Brazil' },
  { code: 'CO', name: 'Colombia' },{ code: 'PE', name: 'Peru' },
  { code: 'CL', name: 'Chile' },   { code: 'VE', name: 'Venezuela' },
  { code: 'US', name: 'United States' },
];

const GUIDE_SECTIONS = [
  {
    id: 'why', emoji: '🔥', title: 'Why You Must Invest',
    body: 'If your money is sitting in a bank in Bolivia, Argentina, or Mexico, it is losing value every day. Inflation silently eats your purchasing power.\n\nThe solution is not to save more — it is to put your money to work in assets that grow faster than inflation.\n\n• −8%/yr: Avg. purchasing power loss in a BOB savings account\n• +10%/yr: Historical avg. return of the S&P 500 (USD)\n• +18%/yr: Combined effect over 10 years of investing',
  },
  {
    id: 'assets', emoji: '🧱', title: 'Asset Classes Explained',
    body: '📊 Stocks — Ownership in a company. High growth potential, high volatility. Best for long-term wealth building (5+ years). e.g. AAPL, MSFT, NVDA\n\n📦 ETFs — Baskets of stocks/bonds. Low cost, diversified. Best for passive investors. e.g. VOO, VT, QQQ\n\n🏅 Precious Metals — Inflation hedge. Low growth but protects value. e.g. PHYS, GLD\n\n₿ Crypto — Highly speculative, volatile. Small position (< 5%) only. e.g. BTC, ETH\n\n💵 Bonds — Loans to governments/companies. Low return, low risk. For capital preservation.',
  },
  {
    id: 'first', emoji: '🚀', title: 'Build Your First Portfolio',
    body: 'Start simple. A two-ETF portfolio beats most actively managed funds:\n\n1. VOO (S&P 500) — 70% of your equity\n2. VT (Global) — 30% of your equity\n\nAdd bonds when you are closer to needing the money (> 40 years old or < 5 years to goal).\n\nIncrease contributions before optimizing allocations.',
  },
  {
    id: 'stepbystep', emoji: '📋', title: 'Step-by-Step: Start Investing',
    body: '1. Build 3–6 months emergency fund in USD savings first\n2. Open an account with IBKR, XTB, or Hapi\n3. Start with $50–$100/month — consistency beats amount\n4. Buy VOO + VT every month regardless of price (DCA)\n5. Reinvest dividends automatically\n6. Never sell during a crash — crashes are buying opportunities\n7. Review once per year, rebalance if needed',
  },
  {
    id: 'rules', emoji: '⚠️', title: 'The Rules That Protect You',
    body: '• Never invest money you need in < 3 years\n• Never use leverage unless you fully understand it\n• No more than 5% in any single crypto\n• CFDs are not investments — avoid them\n• Never invest based on tips or social media\n• Past performance does not guarantee future results\n• Diversification is the only free lunch in finance',
  },
];

type Portfolio = 'growth' | 'balanced' | 'dividends';

const PORTFOLIO_MODELS: Record<Portfolio, {
  label: string; desc: string;
  fixedIncome: { ticker: string; pct: number; desc: string }[];
  variable: { ticker: string; pct: number; desc: string }[];
}> = {
  growth: {
    label: 'Growth', desc: 'Maximizes long-term capital appreciation. Best for investors under 35.',
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
    label: 'Balanced', desc: 'Balances growth with income. Good for any age.',
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
    label: 'Dividends', desc: 'Focused on consistent dividend income. Ideal for passive cash flow.',
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

// ── Sub-components ────────────────────────────────────────────────────────────

function AssetBadge({ type }: { type: string }) {
  const col = TYPE_COLOR[type as AssetType] ?? colors.text3;
  return (
    <View style={[badge.wrap, { backgroundColor: col + '22', borderColor: col }]}>
      <Text style={[badge.text, { color: col }]}>{type.toUpperCase()}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5 },
  text: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});

function inflationColor(rate: number | null) {
  if (rate === null) return colors.text3;
  if (rate > 50) return '#EF4444';
  if (rate > 20) return '#F97316';
  if (rate > 10) return '#F59E0B';
  if (rate > 4)  return '#EAB308';
  return '#10B981';
}
function inflationLabel(rate: number | null) {
  if (rate === null) return 'No data';
  if (rate > 50) return 'Hyperinflation';
  if (rate > 20) return 'Very High';
  if (rate > 10) return 'High';
  if (rate > 4)  return 'Elevated';
  return 'Moderate';
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InvestmentsScreen() {
  const insets = useSafeAreaInsets();
  const [holdings, setHoldings]   = useState<Holding[]>([]);
  const [netWorth, setNetWorth]   = useState<NetWorthEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [snapping, setSnapping]   = useState(false);

  // Add holding form
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [ticker, setTicker]       = useState('');
  const [holdingName, setHoldingName] = useState('');
  const [quantity, setQuantity]   = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currency, setCurrency]   = useState('USD');
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ticker search
  const [searchResults, setSearchResults] = useState<{ ticker: string; name: string; asset_type: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inflation
  const [inflation, setInflation] = useState<InflationData | null>(null);
  const [inflCountry, setInflCountry] = useState('BO');
  const [inflLoading, setInflLoading] = useState(true);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Portfolio plan
  const [avgExpenses, setAvgExpenses] = useState(0);
  const [avgIncome, setAvgIncome]     = useState(0);
  const [liquidUSD, setLiquidUSD] = useState(0);
  const [portfolioModel, setPortfolioModel] = useState<Portfolio>('growth');
  const [monthlyInvest, setMonthlyInvest] = useState('');
  const AGE = 23; // from user profile (Diego is 23)
  const equityPct = Math.max(0, Math.min(100, 120 - AGE));
  const fixedPct = 100 - equityPct;

  // Investment guide
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Holding edit
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editQty, setEditQty]               = useState('');
  const [editSaving, setEditSaving]         = useState(false);

  // Show NW history entry list (graph is always shown)
  const [showNwList, setShowNwList]         = useState(false);

  // Emergency-fund target months (3 or 6)
  const [efMonths, setEfMonths] = useState<3 | 6>(6);
  useEffect(() => {
    AsyncStorage.getItem('vault-ef-months').then(v => {
      if (v === '3' || v === '6') setEfMonths(parseInt(v, 10) as 3 | 6);
    });
  }, []);

  // 50/30/20 targets — drives DCA recommendation
  const { targets } = useRuleTargets();

  // Broker selection — persisted in user profile
  const { profile, setProfile } = useUserProfile();
  const [openBroker, setOpenBroker] = useState<string | null>(null);
  const [brokerDraft, setBrokerDraft] = useState<string | null>(null);
  useEffect(() => { setBrokerDraft(profile.broker ?? null); }, [profile.broker]);

  const load = useCallback(async () => {
    try {
      const [h, nw, txs, accs] = await Promise.all([
        getHoldings(), getNetWorth(), getTransactions(), getAccounts(),
      ]);
      setHoldings(h);
      setNetWorth(nw.sort((a, b) => b.date.localeCompare(a.date)));

      // Compute avg monthly expenses + income
      const byMonthExp: Record<string, number> = {};
      const byMonthInc: Record<string, number> = {};
      for (const t of txs) {
        const m = t.date?.slice(0, 7);
        if (!m) continue;
        const usd = t.amount_usd ?? t.amount;
        if (t.type === 'expense') byMonthExp[m] = (byMonthExp[m] ?? 0) + usd;
        else if (t.type === 'income') byMonthInc[m] = (byMonthInc[m] ?? 0) + usd;
      }
      const expVals = Object.values(byMonthExp);
      const incVals = Object.values(byMonthInc);
      setAvgExpenses(expVals.length ? expVals.reduce((a, b) => a + b, 0) / expVals.length : 0);
      setAvgIncome(incVals.length ? incVals.reduce((a, b) => a + b, 0) / incVals.length : 0);

      // Liquid USD accounts
      const liquid = accs
        .filter(a => a.currency === 'USD' && (a.account_type === 'checking' || a.account_type === 'savings'))
        .reduce((s, a) => s + a.current_balance, 0);
      setLiquidUSD(liquid);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadInflation = useCallback(async (code: string) => {
    setInflLoading(true);
    try { setInflation(await getInflation(code)); }
    catch { setInflation(null); }
    finally { setInflLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadInflation(inflCountry); }, [inflCountry, loadInflation]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const portfolioTotal = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const latestNW = netWorth[0];
  const emergencyMonths = avgExpenses > 0 ? liquidUSD / avgExpenses : 0;

  // DCA projections
  const monthly = parseFloat(monthlyInvest) || 0;
  const rate = 0.10 / 12;
  const projections = [5, 10, 20, 30].map(years => {
    const n = years * 12;
    const val = monthly > 0 ? monthly * ((Math.pow(1 + rate, n) - 1) / rate) : 0;
    return { years, val };
  });

  // Ticker search
  const onTickerChange = (text: string) => {
    setTicker(text); setHoldingName('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim() || assetType === 'cash') { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setSearchResults((await searchTicker(text, assetType)).slice(0, 6)); }
      catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const handleAdd = async () => {
    const qty = parseFloat(quantity);
    if (!ticker.trim() || !qty || qty <= 0) { setFormError('Ticker and quantity are required.'); return; }
    setFormError(null); setSaving(true);
    try {
      await createHolding({
        ticker: ticker.trim().toUpperCase(),
        name: holdingName || ticker.trim().toUpperCase(),
        asset_type: assetType, quantity: qty,
        cost_basis: costBasis ? parseFloat(costBasis) : undefined,
        currency: assetType === 'cash' ? currency : undefined,
      });
      setShowAdd(false);
      setTicker(''); setHoldingName(''); setQuantity(''); setCostBasis(''); setAssetType('stock');
      load();
    } catch (e: any) { setFormError(e?.response?.data?.detail ?? 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDeleteHolding = (id: number) => {
    Alert.alert('Remove holding', 'Remove this from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await deleteHolding(id);
        setHoldings(prev => prev.filter(h => h.id !== id));
      }},
    ]);
  };

  const openEditHolding = (h: Holding) => {
    setEditingHolding(h);
    setEditQty(String(h.quantity));
  };

  const handleSaveQty = async () => {
    if (!editingHolding) return;
    const qty = parseFloat(editQty);
    if (!qty || qty <= 0) { Alert.alert('Invalid', 'Quantity must be greater than 0.'); return; }
    setEditSaving(true);
    try {
      await updateHolding(editingHolding.id, qty);
      setEditingHolding(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Failed to update holding.');
    } finally { setEditSaving(false); }
  };

  const setEfTargetMonths = (m: 3 | 6) => {
    setEfMonths(m);
    AsyncStorage.setItem('vault-ef-months', String(m)).catch(() => {});
  };

  const saveBroker = () => {
    setProfile({ ...profile, broker: brokerDraft ?? undefined });
    Alert.alert('Saved', brokerDraft
      ? `Set ${BROKERS.find(b => b.id === brokerDraft)?.name} as your broker.`
      : 'Cleared broker selection.');
  };

  const handleSnapshot = async () => {
    if (portfolioTotal <= 0) { Alert.alert('No data', 'Add holdings first.'); return; }
    setSnapping(true);
    try {
      await createNetWorth(portfolioTotal, 'Snapshot from portfolio');
      await load();
      Alert.alert('Snapshot saved', `$${portfolioTotal.toFixed(2)} recorded.`);
    } catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setSnapping(false); }
  };

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  const inflRate = inflation?.latest_rate ?? null;
  const inflColor = inflationColor(inflRate);
  const purchasingPower = (() => {
    if (!inflation?.history?.length) return null;
    let val = 1000;
    for (const d of inflation.history) val = val / (1 + d.rate / 100);
    return Math.round(val);
  })();

  const efStatus = emergencyMonths >= efMonths
    ? { color: colors.green, label: '✓ Fully funded' }
    : emergencyMonths >= 3
    ? { color: '#F59E0B', label: '~ Partially funded' }
    : { color: colors.red, label: '✗ Not funded' };

  const model = PORTFOLIO_MODELS[portfolioModel];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Investments</Text>
          <Text style={{ fontSize: 13, color: colors.text3 }}>Track your portfolio & net worth</Text>
        </View>

        {/* Portfolio total */}
        <View style={[s.card, { marginHorizontal: spacing.md, marginBottom: spacing.md }]}>
          <Text style={s.label}>PORTFOLIO TOTAL</Text>
          <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1, marginBottom: 4 }}>
            ${portfolioTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <TouchableOpacity
              style={[s.snapBtn, snapping && { opacity: 0.6 }]}
              onPress={handleSnapshot} disabled={snapping}
            >
              {snapping
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="camera-outline" size={14} color="#fff" /><Text style={s.snapBtnText}> Record snapshot</Text></>}
            </TouchableOpacity>
            {latestNW && (
              <Text style={{ fontSize: 11, color: colors.text3 }}>
                Last: ${latestNW.amount_usd.toFixed(0)} · {new Date(latestNW.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
        </View>

        {/* Holdings */}
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={s.label}>HOLDINGS</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={s.addBtnText}>Add holding</Text>
            </TouchableOpacity>
          </View>
          {holdings.length === 0 ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
              <Ionicons name="trending-up-outline" size={40} color={colors.text3} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>No holdings yet</Text>
              <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center' }}>Add stocks, ETFs, crypto, or cash to track your portfolio.</Text>
            </View>
          ) : holdings.map(h => {
            const hasPl = h.pl !== undefined && h.pl !== null;
            const plPos = hasPl && (h.pl ?? 0) >= 0;
            return (
              <View key={h.id} style={[s.card, { marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Text style={{ fontSize: font.md, fontWeight: '800', color: colors.text }}>{h.ticker}</Text>
                      <AssetBadge type={h.asset_type} />
                    </View>
                    <Text style={{ fontSize: font.sm, color: colors.text3 }} numberOfLines={1}>{h.name}</Text>
                    <Text style={{ fontSize: font.sm, color: colors.text3, marginTop: 2 }}>
                      {h.quantity} × ${(h.price ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>
                      ${(h.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    {hasPl && (
                      <Text style={{ fontSize: font.sm, fontWeight: '600', color: plPos ? colors.green : colors.red }}>
                        {plPos ? '+' : ''}{(h.pl ?? 0).toFixed(2)} ({(h.pl_pct ?? 0).toFixed(1)}%)
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <TouchableOpacity onPress={() => openEditHolding(h)}>
                        <Ionicons name="pencil-outline" size={14} color={colors.text3} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteHolding(h.id)}>
                        <Ionicons name="trash-outline" size={14} color={colors.text3} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Net Worth history */}
        {netWorth.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={s.label}>NET WORTH HISTORY</Text>
              <TouchableOpacity onPress={() => setShowNwList(v => !v)}>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                  {showNwList ? 'Hide entries' : 'Manage entries'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={s.card}>
              <LineChart
                data={[...netWorth]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(nw => ({
                    x: new Date(nw.date).getTime(),
                    y: nw.amount_usd,
                    label: new Date(nw.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  }))}
                height={170}
                color={colors.accent}
                yFormat={v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
                xFormat={x => new Date(Number(x)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              {netWorth.length === 1 && (
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 6, textAlign: 'center' }}>
                  Add another snapshot to see the trend.
                </Text>
              )}
            </View>
            {showNwList && (
              <View style={{ marginTop: spacing.sm }}>
                {netWorth.slice(0, 8).map(nw => (
                  <View key={nw.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 6 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: font.base, fontWeight: '700', color: colors.text }}>
                        ${nw.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={{ fontSize: font.sm, color: colors.text3 }}>
                        {new Date(nw.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {nw.notes ? ` · ${nw.notes}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteNetWorth(nw.id).then(() => setNetWorth(prev => prev.filter(n => n.id !== nw.id)))}>
                      <Ionicons name="trash-outline" size={14} color={colors.text3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Inflation Tracker ─────────────────────────────────────────────── */}
        <View style={[s.card, { marginHorizontal: spacing.md, marginBottom: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={s.cardTitle}>Inflation Tracker</Text>
              <Text style={{ fontSize: 11, color: colors.text3 }}>Annual CPI — World Bank data</Text>
            </View>
            <TouchableOpacity
              style={[s.chip, { paddingHorizontal: 12 }]}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>
                {LATAM_COUNTRIES.find(c => c.code === inflCountry)?.name ?? inflCountry} ▾
              </Text>
            </TouchableOpacity>
          </View>

          {inflLoading ? (
            <ActivityIndicator color={colors.accent} style={{ padding: 20 }} />
          ) : !inflation || inflRate === null ? (
            <Text style={{ color: colors.text3, textAlign: 'center', padding: 20 }}>No data available.</Text>
          ) : (
            <>
              {/* Stat cards */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View style={[s.statCard, { backgroundColor: inflColor + '18', borderColor: inflColor + '44', flex: 1 }]}>
                  <Text style={{ fontSize: 10, color: colors.text3 }}>{inflation.country_name} · {inflation.latest_year}</Text>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: inflColor, letterSpacing: -1 }}>{inflRate.toFixed(1)}%</Text>
                  <Text style={{ fontSize: 11, color: inflColor, fontWeight: '600' }}>{inflationLabel(inflRate)}</Text>
                </View>
                <View style={{ gap: 8, flex: 1 }}>
                  {purchasingPower !== null && (
                    <View style={[s.statCard, { backgroundColor: colors.bg2 }]}>
                      <Text style={{ fontSize: 9, color: colors.text3 }}>Purchasing power of $1,000</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>${purchasingPower}</Text>
                      <Text style={{ fontSize: 9, color: colors.text3 }}>after {inflation.history.length} years</Text>
                    </View>
                  )}
                  <View style={[s.statCard, { backgroundColor: '#10B98118', borderColor: '#10B98144' }]}>
                    <Text style={{ fontSize: 9, color: colors.text3 }}>S&P 500 avg. annual return</Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#10B981' }}>10%</Text>
                    <Text style={{ fontSize: 9, color: '#10B981', fontWeight: '600' }}>
                      {inflRate < 10 ? `+${(10 - inflRate).toFixed(1)}% real return` : 'Inflation exceeds market avg.'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Inflation history line chart */}
              {inflation.history.length >= 2 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text2, marginBottom: 8 }}>Annual Inflation History</Text>
                  <LineChart
                    data={inflation.history.map(d => ({ x: d.year, y: d.rate }))}
                    height={150}
                    color={inflColor}
                    yFormat={v => `${v.toFixed(0)}%`}
                    xFormat={x => String(x)}
                  />
                  <Text style={{ fontSize: 10, color: colors.text3, marginTop: 6 }}>Source: World Bank</Text>
                </>
              )}
            </>
          )}
        </View>

        {/* ── Portfolio Plan ────────────────────────────────────────────────── */}
        <View style={[s.card, { marginHorizontal: spacing.md, marginBottom: spacing.md }]}>
          <Text style={s.cardTitle}>Your Portfolio Plan</Text>
          <Text style={{ fontSize: 12, color: colors.text3, marginBottom: 16 }}>
            Personalized steps based on your actual data. From zero to financially free.
          </Text>

          {/* Step 1: Emergency Fund */}
          <View style={s.planStep}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>Emergency Fund</Text>
                <Text style={s.stepSub}>3–6 months of expenses in liquid USD before investing</Text>
              </View>
            </View>

            {/* Target selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Text style={{ color: colors.text3, fontSize: 11 }}>Target:</Text>
              {([3, 6] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setEfTargetMonths(m)}
                  style={[s.efTargetChip, efMonths === m && s.efTargetChipActive]}
                >
                  <Text style={[s.efTargetChipText, efMonths === m && { color: '#fff' }]}>
                    {m} months
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={{ color: colors.text3, fontSize: 10, marginLeft: 4 }}>recommended 3–6</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={[s.statMini, { flex: 1 }]}>
                <Text style={s.statMiniLabel}>Avg. Monthly Expenses</Text>
                <Text style={s.statMiniVal}>${avgExpenses > 0 ? avgExpenses.toFixed(0) : '—'}</Text>
              </View>
              <View style={[s.statMini, { flex: 1 }]}>
                <Text style={s.statMiniLabel}>Liquid USD</Text>
                <Text style={s.statMiniVal}>${liquidUSD.toFixed(0)}</Text>
              </View>
              <View style={[s.statMini, { flex: 1 }]}>
                <Text style={s.statMiniLabel}>Months Covered</Text>
                <Text style={[s.statMiniVal, { color: efStatus.color }]}>
                  {avgExpenses > 0 ? `${emergencyMonths.toFixed(1)} mo` : '—'}
                </Text>
              </View>
            </View>
            <View style={[s.efStatus, { borderColor: efStatus.color + '44', backgroundColor: efStatus.color + '11' }]}>
              <Text style={{ color: efStatus.color, fontSize: 12, fontWeight: '700' }}>{efStatus.label}</Text>
              {avgExpenses > 0 && emergencyMonths < efMonths && (
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                  Need ${((efMonths - emergencyMonths) * avgExpenses).toFixed(0)} more to reach {efMonths}-month target
                </Text>
              )}
              {avgExpenses > 0 && emergencyMonths < 3 && (
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                  Or ${((3 - emergencyMonths) * avgExpenses).toFixed(0)} more for the minimum 3-month buffer
                </Text>
              )}
            </View>
          </View>

          {/* Step 2: Choose Broker */}
          <View style={s.planStep}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>Choose Your Broker</Text>
                <Text style={s.stepSub}>Tap a card to see pros & cons. Pick one and save.</Text>
              </View>
            </View>

            <View style={{ gap: 8, marginTop: 10 }}>
              {BROKERS.map(b => {
                const isOpen     = openBroker === b.id;
                const isSelected = brokerDraft === b.id;
                const isSaved    = profile.broker === b.id;
                return (
                  <View
                    key={b.id}
                    style={[
                      s.brokerRow,
                      { flexDirection: 'column', alignItems: 'stretch', borderColor: isSelected ? b.tagColor : colors.border },
                      isSelected && { backgroundColor: b.tagColor + '0F' },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setOpenBroker(isOpen ? null : b.id)}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sm }}>{b.name}</Text>
                          <View style={[s.tagBadge, { backgroundColor: b.tagColor + '22', borderColor: b.tagColor + '55' }]}>
                            <Text style={{ fontSize: 9, color: b.tagColor, fontWeight: '600' }}>{b.tag}</Text>
                          </View>
                          {isSaved && (
                            <View style={[s.tagBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}>
                              <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }}>YOUR PICK</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text3} />
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={{ marginTop: 10, gap: 10 }}>
                        <View>
                          <Text style={[s.brokerListLabel, { color: colors.green }]}>PROS</Text>
                          {b.pros.map((p, i) => (
                            <View key={i} style={s.brokerListRow}>
                              <Text style={[s.brokerListBullet, { color: colors.green }]}>✓</Text>
                              <Text style={s.brokerListText}>{p}</Text>
                            </View>
                          ))}
                        </View>
                        <View>
                          <Text style={[s.brokerListLabel, { color: colors.red }]}>CONS</Text>
                          {b.cons.map((c, i) => (
                            <View key={i} style={s.brokerListRow}>
                              <Text style={[s.brokerListBullet, { color: colors.red }]}>✗</Text>
                              <Text style={s.brokerListText}>{c}</Text>
                            </View>
                          ))}
                        </View>
                        {b.warning && (
                          <View style={s.brokerWarning}>
                            <Text style={{ color: '#F59E0B', fontSize: 11, lineHeight: 16 }}>⚠ {b.warning}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => setBrokerDraft(isSelected ? null : b.id)}
                          style={[s.brokerSelectBtn, isSelected && { backgroundColor: b.tagColor }]}
                        >
                          <Text style={[s.brokerSelectBtnText, isSelected && { color: '#fff' }]}>
                            {isSelected ? '✓ Selected' : 'Select this broker'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Save button — visible only when draft differs from saved */}
            {brokerDraft !== (profile.broker ?? null) && (
              <TouchableOpacity onPress={saveBroker} style={s.brokerSaveBtn}>
                <Text style={s.brokerSaveBtnText}>
                  {brokerDraft
                    ? `Save: ${BROKERS.find(b => b.id === brokerDraft)?.name}`
                    : 'Clear selection'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Step 3: Equity Split */}
          <View style={s.planStep}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><Text style={s.stepNumText}>3</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>Fixed Income vs. Equity Split</Text>
                <Text style={s.stepSub}>120 − age rule: the more time you hold, the more equity</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 6 }}>
                Based on age {AGE}: {equityPct}% equity · {fixedPct}% fixed income
              </Text>
              <View style={{ height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' }}>
                <View style={{ flex: equityPct, backgroundColor: colors.accent }} />
                <View style={{ flex: fixedPct, backgroundColor: '#10B981' }} />
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                  <Text style={{ fontSize: 11, color: colors.text2, flex: 1 }} numberOfLines={1}>
                    <Text style={{ fontWeight: '700', color: colors.accent }}>{equityPct}%</Text>
                    <Text> Renta Variable (ETFs, stocks, gold)</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                  <Text style={{ fontSize: 11, color: colors.text2, flex: 1 }} numberOfLines={1}>
                    <Text style={{ fontWeight: '700', color: '#10B981' }}>{fixedPct}%</Text>
                    <Text> Renta Fija (BND, IUSB, BNDX)</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Step 4: ETF Portfolio Examples */}
          <View style={s.planStep}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><Text style={s.stepNumText}>4</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>ETF Portfolio Examples</Text>
                <Text style={s.stepSub}>Apply the allocation to your own situation</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 12 }}>
              {(['growth', 'balanced', 'dividends'] as Portfolio[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[s.profileChip, portfolioModel === p && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  onPress={() => setPortfolioModel(p)}
                >
                  <Text style={[{ fontSize: 11, fontWeight: '600', color: colors.text2 }, portfolioModel === p && { color: '#fff' }]}>
                    {PORTFOLIO_MODELS[p].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 10 }}>{model.desc}</Text>

            <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Fixed Income — {fixedPct}% of portfolio
            </Text>
            {model.fixedIncome.map(e => (
              <View key={e.ticker} style={s.etfRow}>
                <Text style={{ color: '#10B981', fontWeight: '700', fontSize: font.sm, minWidth: 48 }}>{e.ticker}</Text>
                <Text style={{ color: colors.text3, fontSize: font.sm, flex: 1 }}>{e.desc}</Text>
                <Text style={{ color: colors.text2, fontWeight: '700', fontSize: font.sm }}>{e.pct}%</Text>
              </View>
            ))}

            <Text style={{ color: colors.text3, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 }}>
              Equity (Renta Variable) — {equityPct}% of portfolio
            </Text>
            {model.variable.map(e => (
              <View key={e.ticker} style={s.etfRow}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: font.sm, minWidth: 48 }}>{e.ticker}</Text>
                <Text style={{ color: colors.text3, fontSize: font.sm, flex: 1 }}>{e.desc}</Text>
                <Text style={{ color: colors.text2, fontWeight: '700', fontSize: font.sm }}>{e.pct}%</Text>
              </View>
            ))}
            <Text style={{ color: colors.text3, fontSize: 10, marginTop: 8 }}>
              ⚠ Example portfolios — not financial advice. Adjust to your risk tolerance and tax situation.
            </Text>
          </View>

          {/* Step 5: DCA Compound Interest Projector */}
          <View style={[s.planStep, { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
            <View style={s.stepHeader}>
              <View style={s.stepNum}><Text style={s.stepNumText}>5</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>DCA — Compound Interest Projector</Text>
                <Text style={s.stepSub}>Apply the 50/30/20 rule: invest your {targets.savings}% savings rule each month, consistently</Text>
              </View>
            </View>

            {/* Recommended monthly DCA from Health savings % × avg income */}
            {avgIncome > 0 && (() => {
              const recommended = avgIncome * (targets.savings / 100);
              return (
                <TouchableOpacity
                  onPress={() => setMonthlyInvest(recommended.toFixed(0))}
                  activeOpacity={0.7}
                  style={s.dcaHint}
                >
                  <Ionicons name="bulb-outline" size={14} color={colors.accent} />
                  <Text style={s.dcaHintText}>
                    Suggested:{' '}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>
                      ${recommended.toFixed(0)}/mo
                    </Text>
                    {'  '}
                    <Text style={{ color: colors.text3, fontSize: 10 }}>
                      ({targets.savings}% of ${avgIncome.toFixed(0)} avg income · tap to use)
                    </Text>
                  </Text>
                </TouchableOpacity>
              );
            })()}

            <View style={{ marginTop: 10 }}>
              <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 6 }}>Monthly investment (USD)</Text>
              <TextInput
                style={[s.input, { marginBottom: 12 }]}
                value={monthlyInvest}
                onChangeText={setMonthlyInvest}
                keyboardType="decimal-pad"
                placeholder="e.g. 200"
                placeholderTextColor={colors.text3}
              />
              {monthly > 0 && (
                <View style={{ gap: 8 }}>
                  {projections.map(p => (
                    <View key={p.years} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text3, fontSize: font.sm }}>{p.years} years</Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: colors.bg3, borderRadius: 3, marginHorizontal: 12, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${Math.min(100, (p.val / (projections[3]?.val || 1)) * 100)}%`, backgroundColor: colors.accent, borderRadius: 3 }} />
                      </View>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sm, minWidth: 80, textAlign: 'right' }}>
                        ${p.val >= 1e6 ? `${(p.val / 1e6).toFixed(2)}M` : p.val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </Text>
                    </View>
                  ))}
                  <Text style={{ color: colors.text3, fontSize: 10, marginTop: 4 }}>
                    Based on 10% avg. annual return (S&P 500 historical average). Not a guarantee.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Investment Guide ──────────────────────────────────────────────── */}
        <View style={[s.card, { marginHorizontal: spacing.md, marginBottom: spacing.md }]}>
          <Text style={s.cardTitle}>Investment Guide</Text>
          <Text style={{ fontSize: 12, color: colors.text3, marginBottom: 12 }}>
            Learn how to build and manage a portfolio that protects your wealth from inflation.
          </Text>
          {GUIDE_SECTIONS.map(sec => (
            <TouchableOpacity
              key={sec.id}
              onPress={() => setOpenSection(openSection === sec.id ? null : sec.id)}
              activeOpacity={0.7}
            >
              <View style={s.guideRow}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>{sec.emoji}</Text>
                <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: font.base }}>{sec.title}</Text>
                <Ionicons name={openSection === sec.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text3} />
              </View>
              {openSection === sec.id && (
                <View style={s.guideBody}>
                  <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{sec.body}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Add holding modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Holding</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setSearchResults([]); }}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Asset Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {ASSET_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[s.chip, assetType === t && s.chipActive]} onPress={() => { setAssetType(t); setTicker(''); setHoldingName(''); setSearchResults([]); }}>
                    <Text style={[{ fontSize: 11, fontWeight: '600', color: colors.text2 }, assetType === t && { color: '#fff' }]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.fieldLabel}>{assetType === 'cash' ? 'Label' : 'Ticker / Name'}</Text>
            <View style={{ position: 'relative', zIndex: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={ticker} onChangeText={onTickerChange}
                  placeholder={assetType === 'cash' ? 'e.g. Cash BOB' : 'e.g. AAPL or Apple'}
                  placeholderTextColor={colors.text3} autoCapitalize="characters"
                />
                {searching && <ActivityIndicator size="small" color={colors.accent} />}
              </View>
              {searchResults.length > 0 && (
                <View style={s.dropdown}>
                  {searchResults.map(r => (
                    <TouchableOpacity key={r.ticker} style={s.dropdownItem} onPress={() => { setTicker(r.ticker); setHoldingName(r.name); setSearchResults([]); }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sm }}>{r.ticker}</Text>
                      <Text style={{ color: colors.text3, fontSize: font.sm, flex: 1, marginLeft: 8 }} numberOfLines={1}>{r.name}</Text>
                      <AssetBadge type={r.asset_type} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {holdingName ? <Text style={{ color: colors.text3, fontSize: font.sm, marginTop: -4, marginBottom: 4 }}>{holdingName}</Text> : null}

            {assetType === 'cash' && (
              <>
                <Text style={s.fieldLabel}>Currency</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.sm }}>
                  {['USD','BOB','ARS','MXN'].map(c => (
                    <TouchableOpacity key={c} style={[s.chip, currency === c && s.chipActive]} onPress={() => setCurrency(c)}>
                      <Text style={[{ fontSize: 11, fontWeight: '600', color: colors.text2 }, currency === c && { color: '#fff' }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Quantity / Amount</Text>
                <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
              </View>
              {assetType !== 'cash' && (
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Cost Basis (USD)</Text>
                  <TextInput style={s.input} value={costBasis} onChangeText={setCostBasis} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.text3} />
                </View>
              )}
            </View>
            {formError && <Text style={{ color: colors.red, fontSize: font.sm }}>{formError}</Text>}
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Add to Portfolio</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit holding quantity modal */}
      <Modal
        visible={!!editingHolding}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingHolding(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.editBackdrop}
        >
          <View style={s.editCard}>
            <Text style={s.editTitle}>Edit holding</Text>
            <Text style={s.editSubtitle}>
              {editingHolding?.ticker} · {editingHolding?.name}
            </Text>
            <Text style={[s.fieldLabel, { marginTop: spacing.md }]}>Quantity</Text>
            <TextInput
              style={s.input}
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.text3}
              autoFocus
            />
            <Text style={{ color: colors.text3, fontSize: 11, marginTop: 4 }}>
              Adjusts only the share count. Sale proceeds should be tracked as an
              income transaction separately.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TouchableOpacity
                style={[s.editGhostBtn, { flex: 1 }]}
                onPress={() => setEditingHolding(null)}
              >
                <Text style={s.editGhostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1, marginTop: 0 }, editSaving && { opacity: 0.6 }]}
                onPress={handleSaveQty}
                disabled={editSaving}
              >
                {editSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Country picker modal */}
      <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCountryPicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {LATAM_COUNTRIES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={[s.countryRow, inflCountry === c.code && { backgroundColor: colors.accent + '22' }]}
                onPress={() => { setInflCountry(c.code); setShowCountryPicker(false); }}
              >
                <Text style={[{ color: colors.text, fontSize: font.base }, inflCountry === c.code && { color: colors.accent, fontWeight: '700' }]}>
                  {c.name}
                </Text>
                {inflCountry === c.code && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  card:         { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle:    { fontSize: font.md, fontWeight: '800', color: colors.text, marginBottom: 2 },
  label:        { fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  snapBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  snapBtnText:  { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 },
  addBtnText:   { color: '#fff', fontSize: 12, fontWeight: '600' },
  chip:         { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  statCard:     { borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  // Portfolio plan
  planStep:     { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md, paddingBottom: spacing.md },
  stepHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum:      { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepTitle:    { color: colors.text, fontWeight: '700', fontSize: font.base },
  stepSub:      { color: colors.text3, fontSize: 11, marginTop: 2 },
  statMini:     { backgroundColor: colors.bg2, borderRadius: radius.sm, padding: 8, borderWidth: 1, borderColor: colors.border },
  statMiniLabel:{ fontSize: 9, color: colors.text3, marginBottom: 2 },
  statMiniVal:  { fontSize: font.md, fontWeight: '800', color: colors.text },
  efStatus:     { marginTop: 10, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1 },
  brokerRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg2, borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, marginBottom: 6 },
  tagBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5 },
  profileChip:  { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  etfRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  input:        { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base },
  // Guide
  guideRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  guideBody:    { paddingVertical: 12, paddingHorizontal: 4 },
  // Modals
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:   { fontSize: font.md, fontWeight: '700', color: colors.text },
  modalBody:    { padding: spacing.md, gap: spacing.sm, paddingBottom: 60 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  saveBtn:      { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: font.base },
  dropdown:     { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, zIndex: 100, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },

  // EF target chips
  efTargetChip:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg3 },
  efTargetChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  efTargetChipText:   { color: colors.text2, fontSize: 11, fontWeight: '600' },

  // Broker pros/cons + select/save
  brokerListLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  brokerListRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3 },
  brokerListBullet: { fontSize: 11, fontWeight: '700', minWidth: 12 },
  brokerListText:   { flex: 1, color: colors.text2, fontSize: 11, lineHeight: 16 },
  brokerWarning:    { backgroundColor: '#F59E0B14', borderLeftWidth: 3, borderLeftColor: '#F59E0B', borderRadius: 4, padding: 8 },
  brokerSelectBtn:  { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.bg3 },
  brokerSelectBtnText: { color: colors.text2, fontWeight: '700', fontSize: 11 },
  brokerSaveBtn:    { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  brokerSaveBtnText:{ color: '#fff', fontWeight: '700', fontSize: font.sm },

  // DCA recommendation hint
  dcaHint:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent + '14', borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 4, padding: 8, marginTop: 10 },
  dcaHintText:    { color: colors.text2, fontSize: 11, flex: 1, lineHeight: 15 },

  // Edit holding modal
  editBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  editCard:        { width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  editTitle:       { color: colors.text, fontSize: font.md, fontWeight: '700' },
  editSubtitle:    { color: colors.text3, fontSize: font.sm, marginTop: 2 },
  editGhostBtn:    { backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  editGhostBtnText:{ color: colors.text, fontWeight: '600' },
});
