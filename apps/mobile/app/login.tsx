import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../services/api';
import { colors, spacing, radius, font } from '../constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [invite, setInvite]     = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const tokens = mode === 'login'
        ? await apiLogin(email.trim(), password)
        : await apiRegister(email.trim(), password, name.trim() || undefined, invite.trim() || undefined);
      await login(tokens);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}><Text style={{ color: colors.accent }}>V</Text>ault</Text>
        <Text style={styles.tagline}>Your global personal finance app</Text>

        <View style={styles.card}>
          {/* Mode toggle */}
          <View style={styles.toggle}>
            {(['login', 'register'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
                onPress={() => { setMode(m); setError(null); }}
              >
                <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Full name (optional)"
              placeholderTextColor={colors.text3}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.text3}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.text3}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Invite code"
              placeholderTextColor={colors.text3}
              value={invite}
              onChangeText={setInvite}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logo:      { fontSize: 42, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 6 },
  tagline:   { fontSize: font.base, color: colors.text3, textAlign: 'center', marginBottom: spacing.xl },
  card:      { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  toggle:    { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText:      { fontSize: font.sm, fontWeight: '600', color: colors.text3 },
  toggleTextActive: { color: '#fff' },
  input:  {
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text,
    fontSize: font.base, marginBottom: spacing.sm,
  },
  error:  { color: colors.red, fontSize: font.sm, marginBottom: spacing.sm },
  btn:    { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnText: { color: '#fff', fontWeight: '700', fontSize: font.base },
});
