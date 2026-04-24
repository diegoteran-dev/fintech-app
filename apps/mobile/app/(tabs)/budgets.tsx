import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBudgets, createBudget, deleteBudget, getTransactionMonths, type Budget } from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';

const EXPENSE_CATS = [
  'Housing','Groceries','Transport','Entertainment','Shopping',
  'Health','Utilities','Dining','Savings','Insurance',
  'Education','Personal Care','Travel','Gifts & Donations','Other',
];

function ymLabel(ym: string) {
  return new Date(ym + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const [budgets, setBudgets]   = useState<Budget[]>([]);
  const [months, setMonths]     = useState<string[]>([]);
  const [selMonth, setSelMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);

  // Form
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [amount, setAmount]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const ms = await getTransactionMonths();
      const sorted = ms.sort().reverse();
      setMonths(sorted);
      // Pick month: use selMonth if it has data, otherwise fall back to most recent
      const active = sorted.includes(selMonth) ? selMonth : (sorted[0] ?? selMonth);
      const b = await getBudgets(active);
      setBudgets(b);
      if (active !== selMonth) setSelMonth(active);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [selMonth]);

  const currentMonthIdx = months.indexOf(selMonth ?? '');
  function prevMonth() { if (currentMonthIdx < months.length - 1) setSelMonth(months[currentMonthIdx + 1]); }
  function nextMonth() { if (currentMonthIdx > 0) setSelMonth(months[currentMonthIdx - 1]); }

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFormError('Enter a valid budget amount.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      await createBudget({ category, amount: amt, period: 'monthly' });
      setShowAdd(false);
      setAmount(''); setCategory(EXPENSE_CATS[0]);
      load();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteBudget(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.md, paddingBottom: 8, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Budgets</Text>
        {months.length > 0 && (
          <View style={s.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={s.monthBtn} disabled={currentMonthIdx >= months.length - 1}>
              <Ionicons name="chevron-back" size={18} color={currentMonthIdx >= months.length - 1 ? colors.text3 : colors.text2} />
            </TouchableOpacity>
            <Text style={s.monthText}>{ymLabel(selMonth)}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.monthBtn} disabled={currentMonthIdx <= 0}>
              <Ionicons name="chevron-forward" size={18} color={colors.text2} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: 10, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {budgets.length === 0 ? (
          <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 40 }}>No budgets yet. Add one!</Text>
        ) : budgets.map(b => {
          const spent    = b.spent ?? 0;
          const rawPct   = b.amount > 0 ? (spent / b.amount) * 100 : 0;
          const pct      = Math.min(rawPct, 100);
          const over     = spent > b.amount;
          const nearLimit = !over && rawPct >= 80;
          const barColor  = over ? colors.red : nearLimit ? '#F59E0B' : colors.green;
          const remaining = b.amount - spent;
          return (
            <View key={b.id} style={s.budgetCard}>
              <View style={s.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.catName}>{b.category}</Text>
                  {over && (
                    <View style={[s.badge, { backgroundColor: colors.red + '22', borderColor: colors.red }]}>
                      <Text style={[s.badgeText, { color: colors.red }]}>Over budget</Text>
                    </View>
                  )}
                  {nearLimit && (
                    <View style={[s.badge, { backgroundColor: '#F59E0B22', borderColor: '#F59E0B' }]}>
                      <Text style={[s.badgeText, { color: '#F59E0B' }]}>Near limit</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDelete(b.id)}>
                  <Ionicons name="trash-outline" size={15} color={colors.text3} />
                </TouchableOpacity>
              </View>
              <View style={s.rowBetween}>
                <Text style={{ color: over ? colors.red : colors.text, fontSize: font.sm, fontWeight: '600' }}>
                  Bs.{spent.toFixed(2)} <Text style={{ color: colors.text3, fontWeight: '400' }}>of Bs.{b.amount.toFixed(2)}</Text>
                </Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
              </View>
              <View style={s.rowBetween}>
                <Text style={{ color: barColor, fontSize: 10, fontWeight: '700', marginTop: 3 }}>
                  {rawPct.toFixed(1)}% used
                </Text>
                <Text style={{ color: over ? colors.red : colors.text3, fontSize: 10, marginTop: 3 }}>
                  {over
                    ? `Bs.${(spent - b.amount).toFixed(2)} over`
                    : `Bs.${remaining.toFixed(2)} remaining`}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Budget</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {EXPENSE_CATS.map(c => (
                  <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
                    <Text style={[s.chipText, category === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.fieldLabel}>Monthly Limit (BOB)</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.text3}
            />

            {formError && <Text style={{ color: colors.red, fontSize: font.sm, marginBottom: spacing.sm }}>{formError}</Text>}

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Budget</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  monthRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: 4 },
  monthBtn:    { padding: 6 },
  monthText:   { fontSize: 14, fontWeight: '700', color: colors.text },
  budgetCard:  { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  catName:     { color: colors.text, fontSize: font.base, fontWeight: '700' },
  rowBetween:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  barBg:       { height: 6, backgroundColor: colors.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 3 },
  badge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5 },
  badgeText:   { fontSize: 9, fontWeight: '700' },
  fab:         { position: 'absolute', right: spacing.lg, bottom: 110, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:  { fontSize: font.md, fontWeight: '700', color: colors.text },
  modalBody:   { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:       { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base },
  chip:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:    { fontSize: 12, color: colors.text2 },
  saveBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
});
