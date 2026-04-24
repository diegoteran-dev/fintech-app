import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useUserProfile, isValidDob, COUNTRIES } from '../hooks/useUserProfile';
import { colors, spacing, radius, font } from '../constants/theme';
import type { Lang } from '../i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, value, onPress, destructive }: {
  icon: IconName; label: string; value?: string; onPress?: () => void; destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <View style={[s.rowIcon, destructive && { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
        <Ionicons name={icon} size={18} color={destructive ? colors.red : colors.accent} />
      </View>
      <Text style={[s.rowLabel, destructive && { color: colors.red }]}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {onPress && !destructive ? <Ionicons name="chevron-forward" size={14} color={colors.text3} /> : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const { profile, setProfile } = useUserProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [dobOpen, setDobOpen]         = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [langOpen, setLangOpen]       = useState(false);
  const [dobDraft, setDobDraft]       = useState('');
  const [dobError, setDobError]       = useState('');

  const fullName = user?.full_name || '—';
  const email    = user?.email     || '—';

  function confirmSignOut() {
    Alert.alert(t.menu.signOut, 'Are you sure you want to sign out?', [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.menu.signOut, style: 'destructive', onPress: logout },
    ]);
  }

  function openDobModal() {
    setDobDraft(profile.dob);
    setDobError('');
    setDobOpen(true);
  }

  function saveDob() {
    if (!isValidDob(dobDraft)) {
      setDobError(t.profile.dobInvalid);
      return;
    }
    setProfile({ ...profile, dob: dobDraft });
    setDobOpen(false);
  }

  function pickCountry(c: string) {
    setProfile({ ...profile, country: c });
    setCountryOpen(false);
  }

  function pickLang(l: Lang) {
    setLang(l);
    setLangOpen(false);
  }

  const dobValue     = profile.dob || t.profile.notSet;
  const countryValue = profile.country || t.profile.notSet;
  const langValue    = lang === 'es' ? t.menu.es : t.menu.en;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>{t.menu.settings}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 60 }}>
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={s.profileName}>{fullName}</Text>
            <Text style={s.profileEmail}>{email}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>PERSONAL</Text>
          <View style={s.card}>
            <Row icon="person-outline"   label={t.profile.fullName} value={fullName} />
            <View style={s.divider} />
            <Row icon="mail-outline"     label={t.profile.email}    value={email} />
            <View style={s.divider} />
            <Row icon="calendar-outline" label={t.profile.dob}      value={dobValue}     onPress={openDobModal} />
            <View style={s.divider} />
            <Row icon="location-outline" label={t.profile.country}  value={countryValue} onPress={() => setCountryOpen(true)} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>PREFERENCES</Text>
          <View style={s.card}>
            <Row icon="language-outline" label={t.profile.language}     value={langValue} onPress={() => setLangOpen(true)} />
            <View style={s.divider} />
            <Row icon="cash-outline"     label={t.profile.homeCurrency} value="BOB (Bs.)" onPress={() => Alert.alert(t.menu.settingsSoon, t.profile.currencySoon)} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            <Row icon="lock-closed-outline" label={t.profile.changePassword} onPress={() => Alert.alert(t.menu.settingsSoon, t.profile.passwordSoon)} />
            <View style={s.divider} />
            <Row icon="log-out-outline"     label={t.menu.signOut} onPress={confirmSignOut} destructive />
          </View>
        </View>

        <Text style={s.version}>Vault · v1.0.0</Text>
      </ScrollView>

      {/* DOB modal */}
      <Modal visible={dobOpen} transparent animationType="fade" onRequestClose={() => setDobOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalBackdrop}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t.profile.dobSet}</Text>
            <TextInput
              value={dobDraft}
              onChangeText={t_ => { setDobDraft(t_); setDobError(''); }}
              placeholder={t.profile.dobHint}
              placeholderTextColor={colors.text3}
              style={s.input}
              autoCapitalize="none"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />
            {dobError ? <Text style={s.errorText}>{dobError}</Text> : null}
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setDobOpen(false)}>
                <Text style={s.modalBtnGhostText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={saveDob}>
                <Text style={s.modalBtnPrimaryText}>{t.common.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Country modal */}
      <Modal visible={countryOpen} transparent animationType="fade" onRequestClose={() => setCountryOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { maxHeight: '70%' }]}>
            <Text style={s.modalTitle}>{t.profile.countrySet}</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={c => c}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.pickerRow} onPress={() => pickCountry(item)}>
                  <Text style={[s.pickerLabel, profile.country === item && { color: colors.accent, fontWeight: '700' }]}>
                    {item}
                  </Text>
                  {profile.country === item
                    ? <Ionicons name="checkmark" size={18} color={colors.accent} />
                    : null}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.pickerDivider} />}
            />
            <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost, { marginTop: spacing.sm }]} onPress={() => setCountryOpen(false)}>
              <Text style={s.modalBtnGhostText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language modal */}
      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t.menu.language}</Text>
            {(['en', 'es'] as Lang[]).map(l => (
              <TouchableOpacity key={l} style={s.pickerRow} onPress={() => pickLang(l)}>
                <Text style={[s.pickerLabel, lang === l && { color: colors.accent, fontWeight: '700' }]}>
                  {l === 'en' ? t.menu.en : t.menu.es}
                </Text>
                {lang === l
                  ? <Ionicons name="checkmark" size={18} color={colors.accent} />
                  : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost, { marginTop: spacing.sm }]} onPress={() => setLangOpen(false)}>
              <Text style={s.modalBtnGhostText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: font.md, fontWeight: '700', color: colors.text },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  profileEmail:{ fontSize: font.sm, color: colors.text3, marginTop: 2 },
  section:     { gap: 6 },
  sectionLabel:{ fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },
  card:        { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  rowIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowLabel:    { flex: 1, fontSize: font.base, color: colors.text, fontWeight: '500' },
  rowValue:    { fontSize: font.sm, color: colors.text3, marginRight: 4 },
  divider:     { height: 1, backgroundColor: colors.border, marginLeft: 52 + spacing.md },
  version:     { textAlign: 'center', color: colors.text3, fontSize: 12, marginTop: 8 },

  modalBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard:         { width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  modalTitle:        { color: colors.text, fontSize: font.md, fontWeight: '700', marginBottom: spacing.md },
  input:             { backgroundColor: colors.bg3, color: colors.text, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, fontSize: font.base },
  errorText:         { color: colors.red, fontSize: font.sm, marginTop: 6 },
  modalBtnRow:       { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalBtn:          { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  modalBtnGhost:     { backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border },
  modalBtnGhostText: { color: colors.text, fontWeight: '600' },
  modalBtnPrimary:   { backgroundColor: colors.accent },
  modalBtnPrimaryText:{ color: '#fff', fontWeight: '700' },
  pickerRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, paddingHorizontal: 4 },
  pickerLabel:       { color: colors.text, fontSize: font.base },
  pickerDivider:     { height: 1, backgroundColor: colors.border },
});
