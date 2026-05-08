'use client';

import { useEffect } from 'react';

interface KeyboardSubmitArgs {
  onSubmit: () => void;
  /** When false (e.g., while a deploy is in flight), the shortcut is
   *  ignored. Mirrors the disabled state of the visible primary button. */
  enabled: boolean;
}

/**
 * Binds Cmd+Enter (macOS) / Ctrl+Enter (others) to the inspector's
 * primary action. Listens at the window level so the shortcut works
 * even when an inspector input has focus, but ignores the keystroke
 * when typing inside a textarea (where Enter has its own meaning) or
 * when a modifier-only key is held without Enter.
 */
export function useKeyboardSubmit({ onSubmit, enabled }: KeyboardSubmitArgs) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      // Don't hijack textarea Enter — the user might be inside a
      // multi-line note. Inputs are fine to intercept since they're
      // single-line and Enter would normally submit.
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      onSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSubmit, enabled]);
}
