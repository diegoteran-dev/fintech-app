import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTransactions, createTransaction, deleteTransaction, patchTransaction,
  getTransactionMonths, parsePdf,
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
const USD_RATE     = 6.97;

const CAT_COLORS: Record<string, string> = {
  Housing:'#6366F1', Groceries:'#F59E0B', Transport:'#06B6D4',
  Entertainment:'#EC4899', Shopping:'#8B5CF6', Health:'#10B981',
  Utilities:'#F97316', Dining:'#EF4444', Savings:'#14B8A6',
  Salary:'#10B981', Freelance:'#7C3AED', 'Investment Returns':'#F59E0B',
  'Personal Care':'#DB2777', Insurance:'#0EA5E9', Other:'#94A3B8',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtMonth(ym: string) {
  return new Date(ym + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [months, setMonths]             = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [selMonth, setSelMonth]     = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [catFilter, setCatFilter]   = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(false);

  // Chart view
  const [chartView, setChartView] = useState<'category' | 'merchant'>('category');

  // Spending over time
  const [otPeriod, setOtPeriod] = useState<3 | 6 | 9 | 12>(6);

  // Add form
  const [showAdd, setShowAdd]       = useState(false);
  const [desc, setDesc]             = useState('');
  const [amount, setAmount]         = useState('');
  const [currency, setCurrency]     = useState('BOB');
  const [type, setType]             = useState<'expense' | 'income'>('expense');
  const [category, setCategory]     = useState(EXPENSE_CATS[0]);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  // PDF import
  const [importing, setImporting]   = useState(false);
  const [importPreview, setImportPreview] = useState<TransactionCreate[] | null>(null);
  const [importSaving, setImportSaving]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [txs, ms] = await Promise.all([getTransactions(), getTransactionMonths()]);
      setTransactions(txs);
      setMonths(ms.sort().reverse());
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let txs = transactions;
    if (selMonth) txs = txs.filter(t => t.date?.slice(0, 7) === selMonth);
    if (typeFilter !== 'all') txs = txs.filter(t => t.type === typeFilter);
    if (catFilter) txs = txs.filter(t => t.category === catFilter);
    if (search.trim()) txs = txs.filter(t =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()));
    return txs;
  }, [transactions, selMonth, typeFilter, catFilter, search]);

  // ── Spending chart data ──────────────────────────────────────────────────────
  const expenses = filtered.filter(t => t.type === 'expense');
  const totalBob = expenses.reduce((s, t) =>
    s + (t.currency === 'BOB' ? t.amount : (t.amount_usd ?? t.amount) * USD_RATE), 0);

  const byCat: Record<string, number> = {};
  for (const t of expenses) {
    const bob = t.currency === 'BOB' ? t.amount : (t.amount_usd ?? t.amount) * USD_RATE;
    byCat[t.category] = (byCat[t.category] ?? 0) + bob;
  }
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const byMerchant: Record<string, { total: number; count: number }> = {};
  for (const t of expenses) {
    const key = t.merchant || t.description;
    const bob  = t.currency === 'BOB' ? t.amount : (t.amount_usd ?? t.amount) * USD_RATE;
    if (!byMerchant[key]) byMerchant[key] = { total: 0, count: 0 };
    byMerchant[key].total += bob;
    byMerchant[key].count += 1;
  }
  const merchantRows = Object.entries(byMerchant).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const merchantMax  = merchantRows[0]?.[1].total ?? 1;

  // ── Spending over time ───────────────────────────────────────────────────────
  const otData = useMemo(() => {
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = otPeriod - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const byMonthCat: Record<string, Record<string, number>> = {};
    const catSet = new Set<string>();
    for (const ym of monthKeys) byMonthCat[ym] = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const ym = t.date?.slice(0, 7);
      if (!ym || !byMonthCat[ym]) continue;
      const bob = t.currency === 'BOB' ? t.amount : (t.amount_usd ?? t.amount) * USD_RATE;
      byMonthCat[ym][t.category] = (byMonthCat[ym][t.category] ?? 0) + bob;
      catSet.add(t.category);
    }
    const cats = Array.from(catSet);
    const maxTotal = Math.max(...monthKeys.map(ym =>
      Object.values(byMonthCat[ym]).reduce((s, v) => s + v, 0)), 1);
    return { monthKeys, byMonthCat, cats, maxTotal };
  }, [transactions, otPeriod]);

  // ── Running balance ──────────────────────────────────────────────────────────
  const runningBalance = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    const map: Record<number, number> = {};
    for (const t of sorted) {
      const usd = t.amount_usd ?? t.amount;
      bal += t.type === 'income' ? usd : -usd;
      map[t.id] = bal;
    }
    return map;
  }, [filtered]);

  // ── Add transaction ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!desc.trim() || !amt || amt <= 0) { setFormError('Description and a valid amount are required.'); return; }
    setFormError(null); setSaving(true);
    try {
      await createTransaction({ description: desc.trim(), amount: amt, currency, category, type, date: new Date().toISOString() });
      setShowAdd(false);
      setDesc(''); setAmount(''); setType('expense'); setCategory(EXPENSE_CATS[0]);
      load();
    } catch (e: any) { setFormError(e?.response?.data?.detail ?? 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const toggleRecurring = async (tx: Transaction) => {
    await patchTransaction(tx.id, { is_recurring: !tx.is_recurring });
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, is_recurring: !t.is_recurring } : t));
  };

  // ── PDF import ───────────────────────────────────────────────────────────────
  const handlePdfImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setImporting(true);
      const fd = new FormData();
      fd.append('file', { uri: file.uri, name: file.name, type: 'application/pdf' } as any);
      const parsed = await parsePdf(fd);
      setImportPreview(parsed);
    } catch (e: any) {
      Alert.alert('Import failed', e?.response?.data?.detail ?? e?.message ?? 'Could not parse PDF.');
    } finally { setImporting(false); }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImportSaving(true);
    try {
      await Promise.all(importPreview.map(tx => createTransaction(tx)));
      setImportPreview(null);
      load();
      Alert.alert('Imported', `${importPreview.length} transactions imported.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Import failed.');
    } finally { setImportSaving(false); }
  };

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.md, paddingBottom: 8, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Transactions</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.iconBtn, showBalance && { backgroundColor: colors.accent }]}
              onPress={() => setShowBalance(v => !v)}
            >
              <Ionicons name="stats-chart-outline" size={16} color={showBalance ? '#fff' : colors.text2} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={handlePdfImport} disabled={importing}>
              {importing
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Ionicons name="document-text-outline" size={16} color={colors.text2} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={15} color={colors.text3} style={{ marginRight: 6 }} />
          <TextInput style={s.searchInput} placeholder="Search…" placeholderTextColor={colors.text3} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.text3} /></TouchableOpacity> : null}
        </View>

        {/* Type filter */}
        <View style={[s.toggle, { marginTop: 8 }]}>
          {(['all','income','expense'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.toggleBtn, typeFilter === t && s.toggleActive]} onPress={() => setTypeFilter(t)}>
              <Text style={[s.toggleText, typeFilter === t && { color: '#fff' }]}>
                {t === 'all' ? 'All' : t === 'income' ? '↑ Income' : '↓ Expense'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Month filter chips */}
      {months.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 6, paddingBottom: 4 }}>
          <TouchableOpacity style={[s.chip, !selMonth && s.chipActive]} onPress={() => setSelMonth(null)}>
            <Text style={[s.chipText, !selMonth && { color: '#fff' }]}>All time</Text>
          </TouchableOpacity>
          {months.map(m => (
            <TouchableOpacity key={m} style={[s.chip, selMonth === m && s.chipActive]} onPress={() => setSelMonth(selMonth === m ? null : m)}>
              <Text style={[s.chipText, selMonth === m && { color: '#fff' }]}>{fmtMonth(m)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Spending chart */}
        {expenses.length > 0 && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={s.sectionLabel}>SPENDING BY {chartView.toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {(['category','merchant'] as const).map(v => (
                  <TouchableOpacity key={v} style={[s.viewBtn, chartView === v && s.viewBtnActive]} onPress={() => setChartView(v)}>
                    <Text style={[s.viewBtnText, chartView === v && { color: '#fff' }]}>{v === 'category' ? 'Cat' : 'Merchant'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Segmented bar */}
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: spacing.sm }}>
              {(chartView === 'category' ? catRows : merchantRows.map(([k, v]) => [k, v.total] as [string, number])).map(([key, val], i) => (
                <View key={key} style={{ flex: val as number, backgroundColor: CAT_COLORS[key] ?? `hsl(${i * 45},70%,55%)` }} />
              ))}
            </View>

            {chartView === 'category' ? (
              catRows.map(([cat, amt]) => {
                const pct = totalBob > 0 ? (amt / totalBob) * 100 : 0;
                const col = CAT_COLORS[cat] ?? colors.text3;
                return (
                  <TouchableOpacity key={cat} style={s.chartRow} onPress={() => setCatFilter(catFilter === cat ? null : cat)}>
                    <View style={[s.dot, { backgroundColor: col }]} />
                    <Text style={[s.chartLabel, catFilter === cat && { color: colors.accent }]}>{cat}</Text>
                    <View style={{ flex: 1, height: 4, backgroundColor: colors.bg3, borderRadius: 2, overflow: 'hidden', marginHorizontal: 8 }}>
                      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: col, borderRadius: 2 }} />
                    </View>
                    <Text style={s.chartAmt}>Bs.{amt.toFixed(0)}</Text>
                    <Text style={[s.chartPct, { color: col }]}>{pct.toFixed(0)}%</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              merchantRows.map(([name, { total, count }], i) => {
                const pct = (total / merchantMax) * 100;
                return (
                  <View key={name} style={s.chartRow}>
                    <Text style={{ color: colors.text3, fontSize: 10, minWidth: 16 }}>#{i + 1}</Text>
                    <Text style={[s.chartLabel, { flex: 1 }]} numberOfLines={1}>{name}</Text>
                    <View style={{ width: 80, height: 4, backgroundColor: colors.bg3, borderRadius: 2, overflow: 'hidden', marginHorizontal: 8 }}>
                      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.accent, borderRadius: 2 }} />
                    </View>
                    <Text style={s.chartAmt}>Bs.{total.toFixed(0)}</Text>
                    <Text style={{ color: colors.text3, fontSize: 9, marginLeft: 2 }}>×{count}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Spending over time */}
        {otData.cats.length > 0 && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={s.sectionLabel}>SPENDING OVER TIME</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {([3, 6, 9, 12] as const).map(p => (
                  <TouchableOpacity key={p} style={[s.viewBtn, otPeriod === p && s.viewBtnActive]} onPress={() => setOtPeriod(p)}>
                    <Text style={[s.viewBtnText, otPeriod === p && { color: '#fff' }]}>{p}M</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110 }}>
              {otData.monthKeys.map(ym => {
                const catAmts = otData.byMonthCat[ym];
                const total = Object.values(catAmts).reduce((s, v) => s + v, 0);
                const barH = Math.round((total / otData.maxTotal) * 90);
                const label = new Date(ym + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                return (
                  <View key={ym} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ height: 90, justifyContent: 'flex-end', width: '100%' }}>
                      {barH > 0 && (
                        <View style={{ height: barH, width: '100%', borderRadius: 2, overflow: 'hidden' }}>
                          {otData.cats.map(cat => {
                            const amt = catAmts[cat] ?? 0;
                            if (!amt || total === 0) return null;
                            const segH = Math.round((amt / total) * barH);
                            if (segH < 1) return null;
                            return (
                              <View key={cat} style={{ height: segH, width: '100%', backgroundColor: CAT_COLORS[cat] ?? '#666' }} />
                            );
                          })}
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 7, color: colors.text3, marginTop: 2, textAlign: 'center' }}>{label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
              {otData.cats.map(cat => (
                <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: CAT_COLORS[cat] ?? '#666' }} />
                  <Text style={{ fontSize: 9, color: colors.text3 }}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 24 }}>No transactions found.</Text>
        ) : filtered.map(tx => (
          <View key={tx.id} style={s.txRow}>
            <View style={[s.catDot, { backgroundColor: CAT_COLORS[tx.category] ?? colors.text3 }]} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                {tx.is_recurring && <Text style={s.recurBadge}>↻</Text>}
              </View>
              <Text style={s.txMeta}>{tx.category} · {fmtDate(tx.date)}</Text>
              {showBalance && (
                <Text style={{ fontSize: 10, color: (runningBalance[tx.id] ?? 0) >= 0 ? colors.green : colors.red, marginTop: 1 }}>
                  Balance: ${(runningBalance[tx.id] ?? 0).toFixed(2)}
                </Text>
              )}
            </View>
            <Text style={[s.txAmt, { color: tx.type === 'income' ? colors.green : colors.red }]}>
              {tx.type === 'income' ? '+' : '−'}{tx.currency === 'BOB' ? 'Bs.' : '$'}{tx.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </Text>
            <TouchableOpacity onPress={() => toggleRecurring(tx)} style={{ paddingHorizontal: 4 }}>
              <Ionicons name={tx.is_recurring ? 'repeat' : 'repeat-outline'} size={14} color={tx.is_recurring ? colors.accent : colors.text3} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(tx.id)} style={{ paddingLeft: 4 }}>
              <Ionicons name="trash-outline" size={14} color={colors.text3} />
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
            <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={24} color={colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
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

      {/* PDF import preview modal */}
      <Modal visible={!!importPreview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setImportPreview(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Import Preview ({importPreview?.length ?? 0})</Text>
            <TouchableOpacity onPress={() => setImportPreview(null)}><Ionicons name="close" size={24} color={colors.text2} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 6, paddingBottom: 100 }}>
            {importPreview?.map((tx, i) => (
              <View key={i} style={s.txRow}>
                <View style={[s.catDot, { backgroundColor: CAT_COLORS[tx.category] ?? colors.text3 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                  <Text style={s.txMeta}>{tx.category} · {fmtDate(tx.date)}</Text>
                </View>
                <Text style={[s.txAmt, { color: tx.type === 'income' ? colors.green : colors.red }]}>
                  {tx.type === 'income' ? '+' : '−'}{tx.currency === 'BOB' ? 'Bs.' : '$'}{tx.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={{ position: 'absolute', bottom: 32, left: spacing.md, right: spacing.md }}>
            <TouchableOpacity style={[s.saveBtn, importSaving && { opacity: 0.6 }]} onPress={confirmImport} disabled={importSaving}>
              {importSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Import {importPreview?.length} Transactions</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  iconBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  searchInput:  { flex: 1, color: colors.text, fontSize: font.base },
  toggle:       { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.md, padding: 3 },
  toggleBtn:    { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.accent },
  toggleText:   { fontSize: font.sm, fontWeight: '600', color: colors.text3 },
  chip:         { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:     { fontSize: 11, color: colors.text2, fontWeight: '500' },
  card:         { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  viewBtn:      { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  viewBtnActive:{ backgroundColor: colors.accent, borderColor: colors.accent },
  viewBtnText:  { fontSize: 10, fontWeight: '600', color: colors.text3 },
  chartRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  catDot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginRight: 4 },
  chartLabel:   { fontSize: font.sm, color: colors.text, minWidth: 72 },
  chartAmt:     { fontSize: font.sm, color: colors.text, fontWeight: '600', minWidth: 52, textAlign: 'right' },
  chartPct:     { fontSize: 10, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  txRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  txDesc:       { color: colors.text, fontSize: font.base, fontWeight: '600' },
  txMeta:       { color: colors.text3, fontSize: font.sm, marginTop: 1 },
  txAmt:        { fontWeight: '700', fontSize: font.base, marginLeft: 4 },
  recurBadge:   { fontSize: 10, color: colors.accent, fontWeight: '700' },
  fab:          { position: 'absolute', right: spacing.lg, bottom: 110, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:   { fontSize: font.md, fontWeight: '700', color: colors.text },
  modalBody:    { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:        { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base },
  pickerWrap:   { flexDirection: 'column', backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pickerOpt:    { paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center' },
  pickerOptActive: { backgroundColor: colors.accent },
  saveBtn:      { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: font.base },
});
