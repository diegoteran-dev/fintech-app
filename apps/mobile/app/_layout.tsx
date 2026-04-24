import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LangProvider } from '../context/LangContext';
import { API_BASE } from '../services/api';
import { colors } from '../constants/theme';

function Guard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'login';
    if (!user && !inAuth) router.replace('/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading]);

  return null;
}

// Keep Render free-tier backend warm while app is open (every 9 min)
function useKeepWarm() {
  useEffect(() => {
    const ping = () => fetch(`${API_BASE}/health`).catch(() => {});
    const id = setInterval(ping, 9 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
}

function RootShell() {
  useKeepWarm();
  return (
    <>
      <Guard />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LangProvider>
        <RootShell />
      </LangProvider>
    </AuthProvider>
  );
}
