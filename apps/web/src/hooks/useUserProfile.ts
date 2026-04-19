import { useState, useCallback } from 'react';

export interface UserProfile {
  dob: string;     // ISO date string e.g. "2002-04-18", empty string = not set
  country: string;
  broker?: string; // selected broker id e.g. "ibkr"
}

const KEY = 'vault_user_profile';
const DEFAULTS: UserProfile = { dob: '', country: 'Bolivia' };

/** Compute current age from an ISO date string. Returns 25 if dob is empty. */
export function computeAge(dob: string): number {
  if (!dob) return 25;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return Math.max(0, Math.min(120, age));
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old { age, country } format — can't recover DOB so leave blank (triggers onboarding)
      if (parsed.age !== undefined && !parsed.dob) {
        return { dob: '', country: parsed.country ?? DEFAULTS.country };
      }
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return DEFAULTS;
}

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(loadProfile);

  const setProfile = useCallback((p: UserProfile) => {
    localStorage.setItem(KEY, JSON.stringify(p));
    setProfileState(p);
  }, []);

  return { profile, setProfile };
}
