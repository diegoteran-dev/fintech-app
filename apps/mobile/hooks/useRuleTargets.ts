import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RuleTargets {
  needs: number;
  wants: number;
  savings: number;
}

export const DEFAULT_TARGETS: RuleTargets = { needs: 50, wants: 30, savings: 20 };
const STORAGE_KEY = 'vault-rule-targets';

export function useRuleTargets() {
  const [targets, setTargetsState] = useState<RuleTargets>(DEFAULT_TARGETS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
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
  }, []);

  const setTargets = useCallback((t: RuleTargets) => {
    setTargetsState(t);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t)).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setTargetsState(DEFAULT_TARGETS);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const isDefault =
    targets.needs === DEFAULT_TARGETS.needs &&
    targets.wants === DEFAULT_TARGETS.wants &&
    targets.savings === DEFAULT_TARGETS.savings;

  return { targets, setTargets, reset, isDefault, ready };
}
