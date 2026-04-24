import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFinancialHealth, getTransactionMonths, type FinancialHealth, type HealthRule } from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';

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

  // On mount, jump to the most recent month that has transaction data
  useEffect(() => {
    getTransactionMonths().then(months => {
      if (months.length > 0) setYm(months[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try { setHealth(await getFinancialHealth(ym)); }
    catch { setHealth(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [ym]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  function prevMonth() {
    const d = new Date(ym + '-02');
    d.setMonth(d.getMonth() - 1);
    setYm(ymOf(d));
  }
  function nextMonth() {
    const d = new Date(ym + '-02');
    d.setMonth(d.getMonth() + 1);
    setYm(ymOf(d));
  }
  const isCurrentMonth = ym === ymOf(new Date());

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  const pageTitle = (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.md, paddingBottom: 8, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Health</Text>
      <View style={s.monthRow}>
        <TouchableOpacity onPress={prevMonth} style={s.monthBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text2} />
        </TouchableOpacity>
        <Text style={s.monthText}>{ymLabel(ym)}</Text>
        <TouchableOpacity onPress={nextMonth} style={s.monthBtn} disabled={isCurrentMonth}>
          <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? colors.text3 : colors.text2} />
        </TouchableOpacity>
      </View>
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {pageTitle}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Grade card */}
        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
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
                  ${health.total_expenses.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 50/30/20 breakdown */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>50 / 30 / 20 RULE</Text>
          {health.rules.map(rule => (
            <RuleBar key={rule.label} rule={rule} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty:       { flexGrow: 1, padding: spacing.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  monthRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 4 },
  monthBtn:    { padding: 6 },
  monthText:   { fontSize: 14, fontWeight: '700', color: colors.text },
  card:        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionLabel:{ fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm },
  gradeBadge:  { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  gradeText:   { fontSize: 32, fontWeight: '800' },
  ruleCard:    { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  ruleTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  barTrack:    { height: 8, backgroundColor: colors.bg3, borderRadius: 4, overflow: 'visible', position: 'relative' },
  barFill:     { height: '100%', borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  barMarker:   { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: colors.text3 },
});
