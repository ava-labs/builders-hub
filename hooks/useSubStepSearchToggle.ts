'use client';

import { useCallback } from 'react';
import { createLocalPref } from '@/lib/console/local-pref';

const subStepSearchPref = createLocalPref<boolean>({
  key: 'console:search:include-substeps',
  changedEvent: 'console:search:include-substeps-changed',
  defaultValue: false,
  parse: (raw) => raw === 'true',
  serialize: (value) => String(value),
});

export function useSubStepSearchToggle() {
  const { value: includeSubSteps, setValue, isHydrated } = subStepSearchPref.usePref();

  const toggle = useCallback(
    () => setValue((prev) => !prev),
    [setValue],
  );

  return {
    includeSubSteps,
    setIncludeSubSteps: setValue,
    toggle,
    isHydrated,
  };
}
