import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../constants/theme';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fullName   = user?.full_name || '—';
  const email      = user?.email     || '—';

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 60 }}>
        {/* Profile card */}
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

        {/* Personal info */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>PERSONAL</Text>
          <View style={s.card}>
            <Row icon="person-outline"    label="Full name"    value={fullName} />
            <View style={s.divider} />
            <Row icon="mail-outline"      label="Email"        value={email} />
            <View style={s.divider} />
            <Row icon="calendar-outline"  label="Date of birth" value="Not set" onPress={() => Alert.alert('Coming soon', 'Edit profile coming in the next update.')} />
            <View style={s.divider} />
            <Row icon="location-outline"  label="Country"      value="Bolivia" onPress={() => Alert.alert('Coming soon', 'Country selection coming in the next update.')} />
          </View>
        </View>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>PREFERENCES</Text>
          <View style={s.card}>
            <Row icon="language-outline"  label="Language"     value="English"  onPress={() => Alert.alert('Coming soon', 'Language selection coming in the next update.')} />
            <View style={s.divider} />
            <Row icon="cash-outline"      label="Home currency" value="BOB (Bs.)" onPress={() => Alert.alert('Coming soon', 'Currency preference coming in the next update.')} />
          </View>
        </View>

        {/* Account */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            <Row icon="lock-closed-outline" label="Change password" onPress={() => Alert.alert('Coming soon', 'Password change coming in the next update.')} />
            <View style={s.divider} />
            <Row icon="log-out-outline"   label="Sign out" onPress={confirmSignOut} destructive />
          </View>
        </View>

        <Text style={s.version}>Vault · v1.0.0</Text>
      </ScrollView>
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
});
