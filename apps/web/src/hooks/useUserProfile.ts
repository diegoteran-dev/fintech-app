import { useState, useCallback } from 'react';

export interface UserProfile {
  age: number;
  country: string;
}

const KEY = 'vault_user_profile';
const DEFAULTS: UserProfile = { age: 25, country: 'Bolivia' };

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
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
