import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getTransactions, getAccounts, getNetWorth, type Transaction, type Account, type NetWorthEntry } from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';
import { CAT_COLORS as CATEGORY_COLORS } from '../../constants/categories';
import { MonthPicker } from '../../components/MonthPicker';
import { LineChart } from '../../components/LineChart';

function fmtBob(usd: number, rate: number) {
  return `Bs. ${(usd * rate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [netWorth, setNetWorth]         = useState<NetWorthEntry[]>([]);
  const [usdRate]                       = useState(6.97);
  const [refreshing, setRefreshing]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [selYm, setSelYm]               = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = useCallback(async () => {
    try {
      const [txs, accs, nw] = await Promise.all([getTransactions(), getAccounts(), getNetWorth()]);
      setTransactions(txs);
      setAccounts(accs);
      setNetWorth(nw);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // All-time net balance
  const allIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount_usd ?? t.amount), 0);
  const allExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount_usd ?? t.amount), 0);
  const balance     = allIncome - allExpenses;

  // Selected-month breakdown (driven by MonthPicker)
  const ym = selYm;
  const monthLabel    = new Date(ym + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthTxs      = transactions.filter(t => t.date?.slice(0, 7) === ym);
  const monthIncome   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount_usd ?? t.amount), 0);
  const monthExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount_usd ?? t.amount), 0);

  // Top categories — this month if data exists, otherwise all-time
  const expenseTxs = monthTxs.filter(t => t.type === 'expense');
  const spendingSource = expenseTxs.length > 0 ? expenseTxs : transactions.filter(t => t.type === 'expense');
  const spendingLabel  = expenseTxs.length > 0 ? monthLabel.toUpperCase() : 'ALL TIME';
  const byCat: Record<string, number> = {};
  for (const tx of spendingSource) {
    const bob = tx.currency === 'BOB' ? tx.amount : (tx.amount_usd ?? tx.amount) * usdRate;
    byCat[tx.category] = (byCat[tx.category] ?? 0) + bob;
  }
  const topCats  = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalExp = topCats.reduce((s, [, v]) => s + v, 0);

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);

  // Income vs Expenses chart — last 6 months with data
  const monthlyMap: Record<string, { income: number; expenses: number }> = {};
  for (const tx of transactions) {
    const m = tx.date?.slice(0, 7);
    if (!m) continue;
    if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0 };
    const usd = tx.amount_usd ?? tx.amount;
    if (tx.type === 'income') monthlyMap[m].income += usd;
    else monthlyMap[m].expenses += usd;
  }
  const chartMonths = Object.keys(monthlyMap).sort().slice(-6);
  const chartMax = Math.max(...chartMonths.map(m => Math.max(monthlyMap[m].income, monthlyMap[m].expenses)), 1);

  // Net worth — latest manual entry or fallback to account balances
  const latestNW     = netWorth.length > 0 ? netWorth.sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const netWorthUsd  = latestNW ? latestNW.amount_usd : totalBalance;
  const netWorthBob  = netWorthUsd * usdRate;

  if (loading) {
    return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;
  }

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Inline top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Text style={s.logoLetter}>V</Text>
          </View>
          <View>
            <Text style={s.greeting}>{greeting}</Text>
            <Text style={s.userName}>{firstName}</Text>
          </View>
        </View>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="person-circle-outline" size={34} color={colors.text2} />
        </TouchableOpacity>
      </View>

    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Month picker */}
      <MonthPicker value={selYm} onChange={v => setSelYm(v ?? selYm)} />

      {/* Net Balance */}
      <View style={s.card}>
        <Text style={s.label}>NET BALANCE · ALL TIME</Text>
        <Text style={[s.bigNum, { color: balance >= 0 ? colors.green : colors.red }]}>
          Bs. {(balance * usdRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: colors.text3, fontSize: 11, marginBottom: 8 }}>Running total · all transactions</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Text style={{ color: colors.green, fontSize: font.sm }}>↑ {fmtBob(monthIncome, usdRate)}</Text>
          <Text style={{ color: colors.red,   fontSize: font.sm }}>↓ {fmtBob(monthExpenses, usdRate)}</Text>
          <Text style={{ color: colors.text3, fontSize: font.sm }}>{monthLabel}</Text>
        </View>
      </View>

      {/* Net Worth Tracker */}
      <View style={s.card}>
        <Text style={s.label}>NET WORTH</Text>
        <Text style={[s.bigNum, { color: netWorthUsd >= 0 ? colors.green : colors.red, fontSize: 28 }]}>
          ${netWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: colors.text3, fontSize: 11 }}>
          Bs. {netWorthBob.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          {latestNW ? ` · ${new Date(latestNW.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' · from accounts'}
        </Text>
      </View>

      {/* Spending Trend (line chart) */}
      {chartMonths.length > 1 && (
        <View style={s.card}>
          <Text style={s.label}>SPENDING TREND</Text>
          <LineChart
            data={chartMonths.map(m => ({
              x: new Date(m + '-02').getTime(),
              y: monthlyMap[m].expenses,
              label: new Date(m + '-02').toLocaleDateString('en-US', { month: 'short' }),
            }))}
            height={150}
            color={colors.red}
            yFormat={v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
            xFormat={x => new Date(Number(x)).toLocaleDateString('en-US', { month: 'short' })}
          />
        </View>
      )}

      {/* Income vs Expenses chart */}
      {chartMonths.length > 0 && (
        <View style={s.card}>
          <Text style={s.label}>INCOME VS EXPENSES</Text>
          <View style={{ gap: 10, marginTop: spacing.sm }}>
            {chartMonths.map(m => {
              const d = monthlyMap[m];
              const incPct  = (d.income   / chartMax) * 100;
              const expPct  = (d.expenses / chartMax) * 100;
              const label   = new Date(m + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              return (
                <View key={m}>
                  <Text style={{ color: colors.text3, fontSize: 9, marginBottom: 3 }}>{label}</Text>
                  <View style={{ gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green }} />
                      <View style={{ flex: 1, height: 7, backgroundColor: colors.bg3, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${incPct}%`, backgroundColor: colors.green, borderRadius: 4 }} />
                      </View>
                      <Text style={{ color: colors.green, fontSize: 9, minWidth: 40, textAlign: 'right' }}>${d.income.toFixed(0)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red }} />
                      <View style={{ flex: 1, height: 7, backgroundColor: colors.bg3, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${expPct}%`, backgroundColor: colors.red, borderRadius: 4 }} />
                      </View>
                      <Text style={{ color: colors.red, fontSize: 9, minWidth: 40, textAlign: 'right' }}>${d.expenses.toFixed(0)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Accounts summary */}
      {accounts.length > 0 && (
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.label}>MY ACCOUNTS</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {accounts.map(acc => (
            <View key={acc.id} style={s.accRow}>
              <View style={[s.dot, {
                backgroundColor: acc.account_type === 'savings' ? colors.green
                  : acc.account_type === 'crypto' ? '#00BCD4'
                  : colors.accent,
              }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: font.base, fontWeight: '600' }}>{acc.name}</Text>
                {acc.institution ? <Text style={{ color: colors.text3, fontSize: font.sm }}>{acc.institution}</Text> : null}
              </View>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.base }}>
                {acc.currency === 'BOB' ? 'Bs.' : '$'}{acc.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Top categories */}
      {topCats.length > 0 && (
        <View style={s.card}>
          <Text style={[s.label, { marginBottom: spacing.sm }]}>TOP SPENDING · {spendingLabel}</Text>
          {topCats.map(([cat, amt], i) => {
            const pct   = totalExp > 0 ? (amt / totalExp) * 100 : 0;
            const color = CATEGORY_COLORS[cat] ?? colors.text3;
            return (
              <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ color: colors.text3, fontSize: 11, minWidth: 22, textAlign: 'right' }}>#{i + 1}</Text>
                <View style={[s.dot, { backgroundColor: color }]} />
                <Text style={{ color: colors.text, fontSize: font.sm, minWidth: 80 }} numberOfLines={1}>{cat}</Text>
                <View style={{ flex: 1, height: 4, backgroundColor: colors.bg3, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} />
                </View>
                <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '600', minWidth: 56, textAlign: 'right' }}>
                  Bs.{amt.toFixed(0)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

    </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bg },
  content:    { padding: spacing.md, gap: spacing.md, paddingBottom: 120 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  card:       { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  label:      { fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  bigNum:     { fontSize: 34, fontWeight: '800', letterSpacing: -1, marginBottom: 4 },
  row:        { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  accRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.bg },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox:    { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  greeting:   { fontSize: 11, color: colors.text3, fontWeight: '500' },
  userName:   { fontSize: 16, color: colors.text, fontWeight: '700' },
});
