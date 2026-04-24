import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  dob: string;     // ISO date string e.g. "2002-04-18", empty string = not set
  country: string;
  broker?: string;
}

const KEY = 'vault_user_profile';
const DEFAULTS: UserProfile = { dob: '', country: 'Bolivia' };

export const COUNTRIES = [
  'Argentina',
  'Bolivia',
  'Brazil',
  'Chile',
  'Colombia',
  'Ecuador',
  'Mexico',
  'Paraguay',
  'Peru',
  'United States',
  'Uruguay',
  'Venezuela',
  'Other',
];

/** Compute current age from an ISO date string. Returns 25 if dob is empty. */
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

/** YYYY-MM-DD validator — rejects impossible calendar dates (e.g. 2002-02-31). */
export function isValidDob(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  const [y, m, day] = s.split('-').map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.age !== undefined && !parsed.dob) {
            setProfileState({ dob: '', country: parsed.country ?? DEFAULTS.country });
          } else {
            setProfileState({ ...DEFAULTS, ...parsed });
          }
        } catch {}
      })
      .finally(() => setReady(true));
  }, []);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  return { profile, setProfile, ready };
}
