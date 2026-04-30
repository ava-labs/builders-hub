'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'console:search:include-substeps';
const CHANGED_EVENT = 'console:search:include-substeps-changed';

function readValue(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function emitChanged() {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => window.dispatchEvent(new Event(CHANGED_EVENT)), 0);
}

export function useSubStepSearchToggle() {
  const [includeSubSteps, setIncludeSubSteps] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setIncludeSubSteps(readValue());
    sync();
    setIsHydrated(true);
    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setValue = useCallback((next: boolean) => {
    setIncludeSubSteps(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Ignore persistence failures; local state still updates for this tab.
    }
    emitChanged();
  }, []);

  const toggle = useCallback(() => setValue(!includeSubSteps), [includeSubSteps, setValue]);

  return { includeSubSteps, setIncludeSubSteps: setValue, toggle, isHydrated };
}
