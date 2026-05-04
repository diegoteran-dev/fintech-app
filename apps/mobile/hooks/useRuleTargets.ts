import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

export interface RuleTargets {
  needs: number;
  wants: number;
  savings: number;
}

export const DEFAULT_TARGETS: RuleTargets = { needs: 50, wants: 30, savings: 20 };

function storageKey(userId?: number) {
  return userId ? `vault-rule-targets-${userId}` : 'vault-rule-targets-anon';
}

export function useRuleTargets() {
  const { user } = useAuth();
  const [targets, setTargetsState] = useState<RuleTargets>(DEFAULT_TARGETS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    AsyncStorage.getItem(storageKey(user?.id))
      .then(raw => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (
            typeof parsed.needs === 'number' &&
            typeof parsed.wants === 'number' &&
            typeof parsed.savings === 'number' &&
            Math.round(parsed.needs + parsed.wants + parsed.savings) === 100
          ) {
            setTargetsState(parsed);
          }
        } catch {}
      })
      .finally(() => setReady(true));
  }, [user?.id]);

  const setTargets = useCallback((t: RuleTargets) => {
    setTargetsState(t);
    AsyncStorage.setItem(storageKey(user?.id), JSON.stringify(t)).catch(() => {});
  }, [user?.id]);

  const reset = useCallback(() => {
    setTargetsState(DEFAULT_TARGETS);
    AsyncStorage.removeItem(storageKey(user?.id)).catch(() => {});
  }, [user?.id]);

  const isDefault =
    targets.needs === DEFAULT_TARGETS.needs &&
    targets.wants === DEFAULT_TARGETS.wants &&
    targets.savings === DEFAULT_TARGETS.savings;

  return { targets, setTargets, reset, isDefault, ready };
}
