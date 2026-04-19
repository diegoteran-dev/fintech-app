import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTransactions, createTransaction, deleteTransaction,
  type Transaction, type TransactionCreate,
} from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';

const EXPENSE_CATS = [
  'Housing','Groceries','Transport','Entertainment','Shopping',
  'Health','Utilities','Dining','Savings','Insurance',
  'Education','Personal Care','Travel','Gifts & Donations','Other',
];
const INCOME_CATS = ['Salary','Freelance','Investment Returns','Other'];
const CURRENCIES   = ['BOB','USD','ARS','MXN'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [showAdd, setShowAdd]           = useState(false);

  // Add form
  const [desc, setDesc]         = useState('');
  const [amount, setAmount]     = useState('');
  const [currency, setCurrency] = useState('BOB');
  const [type, setType]         = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setTransactions(await getTransactions()); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(() =>
    search.trim()
      ? transactions.filter(t =>
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.category.toLowerCase().includes(search.toLowerCase()))
      : transactions,
    [transactions, search]);

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!desc.trim() || !amt || amt <= 0) { setFormError('Description and a valid amount are required.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      const data: TransactionCreate = {
        description: desc.trim(),
        amount: amt,
        currency,
        category,
        type,
        date: new Date().toISOString(),
      };
      await createTransaction(data);
      setShowAdd(false);
      setDesc(''); setAmount(''); setType('expense'); setCategory(EXPENSE_CATS[0]);
      load();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.md, paddingBottom: 4, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Transactions</Text>
      </View>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.text3} style={{ marginRight: 6 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search transactions…"
          placeholderTextColor={colors.text3}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {filtered.length === 0 ? (
          <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 40 }}>No transactions found.</Text>
        ) : filtered.map(tx => (
          <View key={tx.id} style={s.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
              <Text style={s.txMeta}>{tx.category} · {fmtDate(tx.date)}</Text>
            </View>
            <Text style={[s.txAmt, { color: tx.type === 'income' ? colors.green : colors.red }]}>
              {tx.type === 'income' ? '+' : '−'}{tx.currency === 'BOB' ? 'Bs.' : '$'}{tx.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </Text>
            <TouchableOpacity onPress={() => handleDelete(tx.id)} style={{ paddingLeft: 8 }}>
              <Ionicons name="trash-outline" size={16} color={colors.text3} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Transaction</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            {/* Type toggle */}
            <View style={s.toggle}>
              {(['expense','income'] as const).map(t => (
                <TouchableOpacity key={t} style={[s.toggleBtn, type === t && s.toggleActive]} onPress={() => { setType(t); setCategory(t === 'expense' ? EXPENSE_CATS[0] : INCOME_CATS[0]); }}>
                  <Text style={[s.toggleText, type === t && { color: '#fff' }]}>{t === 'expense' ? '↓ Expense' : '↑ Income'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Description</Text>
            <TextInput style={s.input} value={desc} onChangeText={setDesc} placeholder="e.g. Uber" placeholderTextColor={colors.text3} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Amount</Text>
                <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.text3} />
              </View>
              <View style={{ width: 90 }}>
                <Text style={s.fieldLabel}>Currency</Text>
                <View style={s.pickerWrap}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity key={c} style={[s.pickerOpt, currency === c && s.pickerOptActive]} onPress={() => setCurrency(c)}>
                      <Text style={[{ fontSize: 10, fontWeight: '600', color: colors.text3 }, currency === c && { color: '#fff' }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(type === 'expense' ? EXPENSE_CATS : INCOME_CATS).map(c => (
                  <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
                    <Text style={[s.chipText, category === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {formError && <Text style={{ color: colors.red, fontSize: font.sm, marginBottom: spacing.sm }}>{formError}</Text>}

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Transaction</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', margin: spacing.md, marginBottom: 0, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base },
  txRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  txDesc:      { color: colors.text, fontSize: font.base, fontWeight: '600' },
  txMeta:      { color: colors.text3, fontSize: font.sm, marginTop: 2 },
  txAmt:       { fontWeight: '700', fontSize: font.base, marginLeft: spacing.sm },
  fab:         { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:  { fontSize: font.md, fontWeight: '700', color: colors.text },
  modalBody:   { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  toggle:      { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.md, padding: 4, marginBottom: spacing.sm },
  toggleBtn:   { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.accent },
  toggleText:  { fontSize: font.sm, fontWeight: '600', color: colors.text3 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:       { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base },
  pickerWrap:  { flexDirection: 'column', backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pickerOpt:   { paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center' },
  pickerOptActive: { backgroundColor: colors.accent },
  chip:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:    { fontSize: 12, color: colors.text2 },
  saveBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
});
