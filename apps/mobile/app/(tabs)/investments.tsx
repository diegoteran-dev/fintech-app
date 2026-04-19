import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getHoldings, createHolding, deleteHolding, searchTicker,
  getNetWorth, createNetWorth, deleteNetWorth,
  type Holding, type NetWorthEntry,
} from '../../services/api';
import { colors, spacing, radius, font } from '../../constants/theme';

const ASSET_TYPES = ['stock', 'etf', 'metal', 'crypto', 'cash'] as const;
type AssetType = typeof ASSET_TYPES[number];

const TYPE_COLOR: Record<AssetType, string> = {
  stock: '#6366F1', etf: '#10B981', metal: '#F59E0B',
  crypto: '#06B6D4', cash: '#94A3B8',
};

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

  const load = useCallback(async () => {
    try {
      const [h, nw] = await Promise.all([getHoldings(), getNetWorth()]);
      setHoldings(h);
      setNetWorth(nw.sort((a, b) => b.date.localeCompare(a.date)));
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const portfolioTotal = holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);
  const latestNW = netWorth[0];

  // Ticker search with debounce
  const onTickerChange = (text: string) => {
    setTicker(text);
    setHoldingName('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim() || assetType === 'cash') { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchTicker(text, assetType);
        setSearchResults(res.slice(0, 6));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const selectTicker = (item: { ticker: string; name: string }) => {
    setTicker(item.ticker);
    setHoldingName(item.name);
    setSearchResults([]);
  };

  const handleAdd = async () => {
    const qty = parseFloat(quantity);
    if (!ticker.trim() || !qty || qty <= 0) { setFormError('Ticker and quantity are required.'); return; }
    setFormError(null); setSaving(true);
    try {
      await createHolding({
        ticker: ticker.trim().toUpperCase(),
        name: holdingName || ticker.trim().toUpperCase(),
        asset_type: assetType,
        quantity: qty,
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

  const handleSnapshot = async () => {
    if (portfolioTotal <= 0) { Alert.alert('No data', 'Add holdings first to record a net worth snapshot.'); return; }
    setSnapping(true);
    try {
      await createNetWorth(portfolioTotal, 'Snapshot from portfolio');
      await load();
      Alert.alert('Snapshot saved', `$${portfolioTotal.toFixed(2)} recorded.`);
    } catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setSnapping(false); }
  };

  const handleDeleteNW = async (id: number) => {
    await deleteNetWorth(id);
    setNetWorth(prev => prev.filter(n => n.id !== id));
  };

  if (loading) return <View style={s.center}><Text style={{ color: colors.text3 }}>Loading…</Text></View>;

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
              onPress={handleSnapshot}
              disabled={snapping}
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
            const hasPnl = h.pnl !== undefined && h.pnl !== null;
            const pnlPos = hasPnl && (h.pnl ?? 0) >= 0;
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
                      {h.quantity} × ${(h.current_price ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>
                      ${(h.current_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    {hasPnl && (
                      <Text style={{ fontSize: font.sm, fontWeight: '600', color: pnlPos ? colors.green : colors.red }}>
                        {pnlPos ? '+' : ''}{(h.pnl ?? 0).toFixed(2)} ({(h.pnl_pct ?? 0).toFixed(1)}%)
                      </Text>
                    )}
                    <TouchableOpacity onPress={() => handleDeleteHolding(h.id)} style={{ marginTop: 4 }}>
                      <Ionicons name="trash-outline" size={14} color={colors.text3} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Net Worth history */}
        {netWorth.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <Text style={[s.label, { marginBottom: spacing.sm }]}>NET WORTH HISTORY</Text>
            {netWorth.slice(0, 6).map(nw => (
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
                <TouchableOpacity onPress={() => handleDeleteNW(nw.id)}>
                  <Ionicons name="trash-outline" size={14} color={colors.text3} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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
            {/* Asset type */}
            <Text style={s.fieldLabel}>Asset Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {ASSET_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[s.chip, assetType === t && s.chipActive]} onPress={() => { setAssetType(t); setTicker(''); setHoldingName(''); setSearchResults([]); }}>
                    <Text style={[s.chipText, assetType === t && { color: '#fff' }]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Ticker search */}
            <Text style={s.fieldLabel}>{assetType === 'cash' ? 'Label' : 'Ticker / Name'}</Text>
            <View style={{ position: 'relative', zIndex: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={ticker}
                  onChangeText={onTickerChange}
                  placeholder={assetType === 'cash' ? 'e.g. Cash BOB' : 'e.g. AAPL or Apple'}
                  placeholderTextColor={colors.text3}
                  autoCapitalize="characters"
                />
                {searching && <ActivityIndicator size="small" color={colors.accent} />}
              </View>
              {searchResults.length > 0 && (
                <View style={s.dropdown}>
                  {searchResults.map(r => (
                    <TouchableOpacity key={r.ticker} style={s.dropdownItem} onPress={() => selectTicker(r)}>
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
                      <Text style={[s.chipText, currency === c && { color: '#fff' }]}>{c}</Text>
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
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  card:        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  label:       { fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  snapBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  snapBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 },
  addBtnText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:  { fontSize: font.md, fontWeight: '700', color: colors.text },
  modalBody:   { padding: spacing.md, gap: spacing.sm, paddingBottom: 60 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:       { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: font.base },
  chip:        { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:    { fontSize: 11, color: colors.text2, fontWeight: '600' },
  saveBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  dropdown:    { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, zIndex: 100, overflow: 'hidden' },
  dropdownItem:{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
