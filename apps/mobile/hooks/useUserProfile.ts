import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

export interface UserProfile {
  dob: string;
  country: string;
  broker?: string;
}

const DEFAULTS: UserProfile = { dob: '', country: 'Bolivia' };

export const COUNTRIES = [
  'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador',
  'Mexico', 'Paraguay', 'Peru', 'United States', 'Uruguay', 'Venezuela', 'Other',
];

export function computeAge(dob: string): number {
  if (!dob) return 25;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 25;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return Math.max(0, Math.min(120, age));
}

export function isValidDob(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  const [y, m, day] = s.split('-').map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

function storageKey(userId?: number) {
  return userId ? `vault_user_profile_${userId}` : 'vault_user_profile_anon';
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfileState] = useState<UserProfile>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const key = storageKey(user?.id);
    AsyncStorage.getItem(key)
      .then(raw => {
        // Start from what the backend knows about this user
        const base: UserProfile = {
          dob: user?.dob ?? '',
          country: user?.country ?? DEFAULTS.country,
        };
        if (raw) {
          try {
            const local = JSON.parse(raw);
            // Local broker preference overrides; dob/country come from backend
            setProfileState({ ...base, broker: local.broker });
          } catch {
            setProfileState(base);
          }
        } else {
          setProfileState(base);
        }
      })
      .finally(() => setReady(true));
  }, [user?.id, user?.dob, user?.country]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    const key = storageKey(user?.id);
    AsyncStorage.setItem(key, JSON.stringify(p)).catch(() => {});
  }, [user?.id]);

  return { profile, setProfile, ready };
}
