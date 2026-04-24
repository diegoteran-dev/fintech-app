import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFinancialHealth, getTransactionMonths, type FinancialHealth, type HealthRule } from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';
import { MonthPicker } from '../../components/MonthPicker';
import { RuleSlider } from '../../components/RuleSlider';
import { useRuleTargets, DEFAULT_TARGETS } from '../../hooks/useRuleTargets';

function ymOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function ymLabel(ym: string) {
  return new Date(ym + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function gradeColor(grade: string) {
  if (grade === 'A') return '#10B981';
  if (grade === 'B') return '#14B8A6';
  if (grade === 'C') return '#F59E0B';
  if (grade === 'D') return '#F97316';
  return colors.red;
}

const RULE_COLORS: Record<string, string> = {
  Needs:   '#6366F1',
  Wants:   '#EC4899',
  Savings: '#10B981',
};

const RULE_ICONS: Record<string, string> = {
  Needs:   '🏠',
  Wants:   '🎮',
  Savings: '💰',
};

const SAVINGS_IN_EXPENSES_KEY = 'vault-savings-in-expenses';

function RuleBar({ rule }: { rule: HealthRule }) {
  const color   = RULE_COLORS[rule.label] ?? colors.accent;
  const fillPct = Math.min(100, rule.actual_pct ?? 0);
  const markPct = Math.min(100, rule.target_pct ?? 0);

  const status = rule.status;
  const statusColor = status === 'on_track' ? '#10B981' : status === 'over' ? colors.red : '#F59E0B';
  const statusLabel = status === 'on_track' ? '✓ On track' : status === 'over' ? '↑ Over target' : '↓ Under target';

  return (
    <View style={s.ruleCard}>
      <View style={s.ruleTop}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 8 }}>
          <Text style={{ fontSize: 20 }}>{RULE_ICONS[rule.label]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.base }}>{rule.label}</Text>
            <Text style={{ color: colors.text3, fontSize: 10, marginTop: 2 }} numberOfLines={2}>
              {rule.categories.join(', ')}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color, fontSize: 20, fontWeight: '800' }}>{(rule.actual_pct ?? 0).toFixed(1)}%</Text>
          <Text style={{ color: colors.text3, fontSize: 10 }}>target {rule.target_pct}%</Text>
          <Text style={{ color: colors.text3, fontSize: 10 }}>${(rule.amount ?? 0).toFixed(2)}</Text>
        </View>
      </View>

      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${fillPct}%` as any, backgroundColor: color }]} />
        <View style={[s.barMarker, { left: `${markPct}%` as any }]} />
      </View>

      <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600', marginTop: 4 }}>
        {statusLabel}
      </Text>
    </View>
  );
}

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [health, setHealth]         = useState<FinancialHealth | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ym, setYm]                 = useState(ymOf(new Date()));
  const [savingsInExpenses, setSavingsInExpenses] = useState(true);
  const [showCustom, setShowCustom] = useState(false);

  const { targets, setTargets, reset: resetTargets, isDefault } = useRuleTargets();

  useEffect(() => {
    AsyncStorage.getItem(SAVINGS_IN_EXPENSES_KEY).then(v => {
      if (v === 'false') setSavingsInExpenses(false);
    });
  }, []);

  // On mount, jump to the most recent month that has transaction data
  useEffect(() => {
    getTransactionMonths().then(months => {
      if (months.length > 0) setYm(months[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try { setHealth(await getFinancialHealth(ym, targets)); }
    catch { setHealth(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [ym, targets]);

  // Debounce 200ms so dragging the slider doesn't spam the API
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  function toggleSavingsInExpenses(v: boolean) {
    setSavingsInExpenses(v);
    AsyncStorage.setItem(SAVINGS_IN_EXPENSES_KEY, String(v)).catch(() => {});
  }

  if (loading && !health) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  const pageTitle = (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.md, paddingBottom: 8, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Health</Text>
      <MonthPicker value={ym} onChange={v => v && setYm(v)} />
    </View>
  );

  if (!health || health.total_income === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {pageTitle}
        <ScrollView
          contentContainerStyle={s.empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          <Ionicons name="analytics-outline" size={48} color={colors.text3} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            No income data for {ymLabel(ym)}
          </Text>
          <Text style={{ color: colors.text3, textAlign: 'center', fontSize: 13, lineHeight: 20, maxWidth: 280 }}>
            Use the arrows above to navigate to a month that has income transactions, or add a Salary entry for this month.
          </Text>
        </ScrollView>
      </View>
    );
  }

  const gc = gradeColor(health.grade);

  const savingsRule   = health.rules.find(r => r.label === 'Savings');
  const savingsAmount = savingsRule?.amount ?? 0;
  const displayExpenses = savingsInExpenses
    ? health.total_expenses
    : Math.max(0, health.total_expenses - savingsAmount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {pageTitle}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Grade card */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={[s.gradeBadge, { backgroundColor: gc + '22', borderColor: gc }]}>
              <Text style={[s.gradeText, { color: gc }]}>{health.grade}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                Score: {health.score}/100
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 6 }}>
                <View>
                  <Text style={{ color: colors.text3, fontSize: 10 }}>INCOME</Text>
                  <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.base }}>
                    ${health.total_income.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: colors.text3, fontSize: 10 }}>EXPENSES</Text>
                  <Text style={{ color: colors.red, fontWeight: '700', fontSize: font.base }}>
                    ${displayExpenses.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Savings-in-expenses toggle */}
          <View style={s.toggleRow}>
            <Text style={{ color: colors.text2, fontSize: font.sm, flex: 1 }}>
              Include savings in expenses
            </Text>
            <Switch
              value={savingsInExpenses}
              onValueChange={toggleSavingsInExpenses}
              trackColor={{ false: colors.bg3, true: colors.accent + '99' }}
              thumbColor={savingsInExpenses ? colors.accent : '#888'}
            />
          </View>
        </View>

        {/* 50/30/20 breakdown */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.sectionLabel}>50 / 30 / 20 RULE</Text>
              {!isDefault && <View style={s.customDot} />}
            </View>
            <TouchableOpacity
              onPress={() => setShowCustom(v => !v)}
              style={[s.customBtn, showCustom && s.customBtnActive]}
            >
              <Text style={[s.customBtnText, showCustom && { color: '#fff' }]}>
                ⚙ Customize
              </Text>
            </TouchableOpacity>
          </View>

          {showCustom && (
            <View style={s.customPanel}>
              <View style={s.warningBox}>
                <Text style={{ color: '#F59E0B', fontSize: 14 }}>⚠</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>Heads up</Text>
                  <Text style={s.warningBody}>
                    The 50/30/20 rule is the most widely tested personal budgeting strategy,
                    backed by decades of financial research. Customizing your targets will
                    change your grade and score — use with care.
                  </Text>
                </View>
              </View>

              <RuleSlider
                needs={targets.needs}
                wants={targets.wants}
                savings={targets.savings}
                colors={{
                  needs:   RULE_COLORS.Needs,
                  wants:   RULE_COLORS.Wants,
                  savings: RULE_COLORS.Savings,
                }}
                labels={{ needs: 'Needs', wants: 'Wants', savings: 'Savings' }}
                onChange={(n, w, sa) => setTargets({ needs: n, wants: w, savings: sa })}
              />

              <View style={[s.rowBetween, { marginTop: spacing.sm }]}>
                <Text style={{ color: colors.text3, fontSize: 11 }}>
                  Total: {targets.needs + targets.wants + targets.savings}%
                </Text>
                {!isDefault && (
                  <TouchableOpacity onPress={resetTargets}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>
                      ↺ Reset to {DEFAULT_TARGETS.needs}/{DEFAULT_TARGETS.wants}/{DEFAULT_TARGETS.savings}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={{ marginTop: showCustom ? spacing.md : 0 }}>
            {health.rules.map(rule => (
              <RuleBar key={rule.label} rule={rule} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty:       { flexGrow: 1, padding: spacing.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  card:        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowBetween:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel:{ fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  gradeBadge:  { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  gradeText:   { fontSize: 32, fontWeight: '800' },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  customBtn:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg3 },
  customBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  customBtnText:   { color: colors.text2, fontSize: 11, fontWeight: '600' },
  customDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  customPanel: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  warningBox:  { flexDirection: 'row', gap: 8, backgroundColor: '#F59E0B1A', borderLeftWidth: 3, borderLeftColor: '#F59E0B', borderRadius: 6, padding: spacing.sm, marginBottom: spacing.md },
  warningTitle:{ color: '#F59E0B', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  warningBody: { color: colors.text2, fontSize: 11, lineHeight: 15 },
  ruleCard:    { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  ruleTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  barTrack:    { height: 8, backgroundColor: colors.bg3, borderRadius: 4, overflow: 'visible', position: 'relative' },
  barFill:     { height: '100%', borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  barMarker:   { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: colors.text3 },
});
