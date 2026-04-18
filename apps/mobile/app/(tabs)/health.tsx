import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { getFinancialHealth, type FinancialHealth } from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';

function gradeColor(grade: string) {
  if (grade === 'A') return '#10B981';
  if (grade === 'B') return '#14B8A6';
  if (grade === 'C') return '#F59E0B';
  if (grade === 'D') return '#F97316';
  return colors.red;
}

function RuleBar({ label, spent, budget, pct, target }: {
  label: string; spent: number; budget: number; pct: number; target: number;
}) {
  const over   = pct > target + 5;
  const ok     = pct <= target + 5;
  const barPct = Math.min(pct, 100);
  const barColor = over ? colors.red : ok && pct > 0 ? '#10B981' : colors.text3;
  return (
    <View style={s.ruleRow}>
      <View style={s.ruleHeader}>
        <Text style={s.ruleName}>{label}</Text>
        <Text style={{ color: colors.text3, fontSize: font.sm }}>target {target}%</Text>
        <Text style={[s.rulePct, { color: barColor }]}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${barPct}%` as any, backgroundColor: barColor }]} />
        <View style={[s.barTarget, { left: `${target}%` as any }]} />
      </View>
      <View style={s.ruleFooter}>
        <Text style={{ color: colors.text3, fontSize: 10 }}>
          Spent: ${spent.toFixed(0)} / Budget: ${budget.toFixed(0)}
        </Text>
        {over && (
          <Text style={{ color: colors.red, fontSize: 10, fontWeight: '600' }}>Over target</Text>
        )}
      </View>
    </View>
  );
}

export default function HealthScreen() {
  const [health, setHealth]     = useState<FinancialHealth | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    try { setHealth(await getFinancialHealth(ym)); }
    catch { setHealth(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [ym]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  if (!health || health.total_income === 0) {
    return (
      <ScrollView
        contentContainerStyle={s.empty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 40 }}>
          No income data for this month. Add income transactions to see your financial health.
        </Text>
      </ScrollView>
    );
  }

  const gc = gradeColor(health.grade);
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Grade card */}
      <View style={[s.card, { alignItems: 'center' }]}>
        <Text style={s.monthLabel}>{monthLabel.toUpperCase()}</Text>
        <View style={[s.gradeBadge, { backgroundColor: gc + '22', borderColor: gc }]}>
          <Text style={[s.gradeText, { color: gc }]}>{health.grade}</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 }}>
          Score: {health.score}/100
        </Text>
        <Text style={{ color: colors.text3, fontSize: font.sm, marginTop: 4 }}>
          Income: ${health.total_income.toFixed(0)} · Expenses: ${health.total_expenses.toFixed(0)}
        </Text>
      </View>

      {/* 50/30/20 breakdown */}
      <View style={s.card}>
        <Text style={s.sectionLabel}>50 / 30 / 20 RULE</Text>
        <RuleBar
          label="Needs (Housing, Groceries, Transport…)"
          spent={health.needs_spent}
          budget={health.needs_budget}
          pct={health.needs_pct}
          target={50}
        />
        <RuleBar
          label="Wants (Entertainment, Shopping, Dining)"
          spent={health.wants_spent}
          budget={health.wants_budget}
          pct={health.wants_pct}
          target={30}
        />
        <RuleBar
          label="Savings"
          spent={health.savings_spent}
          budget={health.savings_budget}
          pct={health.savings_pct}
          target={20}
        />
      </View>

      {/* Status tips */}
      <View style={s.card}>
        <Text style={s.sectionLabel}>TIPS</Text>
        {health.needs_pct > 55 && (
          <View style={s.tipRow}>
            <Text style={{ color: colors.red, fontSize: 14 }}>⚠</Text>
            <Text style={s.tipText}>Needs are above 55% of income. Look for ways to reduce fixed costs.</Text>
          </View>
        )}
        {health.wants_pct > 35 && (
          <View style={s.tipRow}>
            <Text style={{ color: '#F59E0B', fontSize: 14 }}>⚠</Text>
            <Text style={s.tipText}>Discretionary spending is high. Try the 24-hour rule before purchases.</Text>
          </View>
        )}
        {health.savings_pct < 10 && health.total_income > 0 && (
          <View style={s.tipRow}>
            <Text style={{ color: colors.red, fontSize: 14 }}>⚠</Text>
            <Text style={s.tipText}>Savings are below 10%. Even small amounts add up — automate if possible.</Text>
          </View>
        )}
        {health.score >= 80 && (
          <View style={s.tipRow}>
            <Text style={{ color: '#10B981', fontSize: 14 }}>✓</Text>
            <Text style={[s.tipText, { color: '#10B981' }]}>Great balance! You're meeting the 50/30/20 targets.</Text>
          </View>
        )}
        {health.needs_pct <= 55 && health.wants_pct <= 35 && health.savings_pct >= 10 && health.score < 80 && (
          <View style={s.tipRow}>
            <Text style={{ color: colors.text3, fontSize: 14 }}>·</Text>
            <Text style={s.tipText}>You're on the right track. Keep building your savings habit.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty:        { flexGrow: 1, padding: spacing.md, backgroundColor: colors.bg },
  card:         { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  monthLabel:   { fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, marginBottom: 8 },
  gradeBadge:   { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  gradeText:    { fontSize: 36, fontWeight: '800' },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm },
  ruleRow:      { marginBottom: spacing.md },
  ruleHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  ruleName:     { flex: 1, color: colors.text, fontSize: font.sm, fontWeight: '600' },
  rulePct:      { fontWeight: '700', fontSize: font.sm },
  barBg:        { height: 8, backgroundColor: colors.bg3, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  barFill:      { height: '100%', borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  barTarget:    { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.text3 },
  ruleFooter:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  tipRow:       { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  tipText:      { flex: 1, color: colors.text2, fontSize: font.sm, lineHeight: 18 },
});
