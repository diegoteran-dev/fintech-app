import { useState, useCallback } from 'react';

export interface UserProfile {
  dob: string;     // ISO date string e.g. "2002-04-18", empty string = not set
  country: string;
  broker?: string;
}

const DEFAULTS: UserProfile = { dob: '', country: 'Bolivia' };

function profileKey(userId: number | string) {
  return `vault_user_profile_${userId}`;
}

export function computeAge(dob: string): number {
  if (!dob) return 25;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return Math.max(0, Math.min(120, age));
}

export function loadProfile(userId?: number | string): UserProfile {
  if (!userId) return DEFAULTS;
  try {
    const raw = localStorage.getItem(profileKey(userId));
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

export function useUserProfile(userId?: number | string) {
  const [profile, setProfileState] = useState<UserProfile>(() => loadProfile(userId));

  const setProfile = useCallback((p: UserProfile) => {
    if (userId) localStorage.setItem(profileKey(userId), JSON.stringify(p));
    setProfileState(p);
  }, [userId]);

  return { profile, setProfile };
}
