'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** The copied mark of a copy button: it shows on a copy and clears itself after a delay. */
export interface CopiedFlash {
  /** Show the mark. A copy while it shows restarts the wait, so the mark stays the full delay after the last copy. */
  show: () => void;
  /** Clear the mark at once, and the pending clear with it. */
  hide: () => void;
  /** Cancel the pending clear and set nothing, as when the button unmounts. */
  dispose: () => void;
}

export function createCopiedFlash(set: (shown: boolean) => void, ms: number): CopiedFlash {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    show: () => {
      dispose();
      set(true);
      timer = setTimeout(() => {
        timer = undefined;
        set(false);
      }, ms);
    },
    hide: () => {
      dispose();
      set(false);
    },
    dispose,
  };
}

/** The hook's effect: puts a new mark in `slot`, and returns the cleanup that disposes it and empties the slot. */
export function holdCopiedFlash(
  slot: { current: CopiedFlash | null },
  set: (shown: boolean) => void,
  ms: number,
): () => void {
  const current = createCopiedFlash(set, ms);
  slot.current = current;
  return () => {
    current.dispose();
    slot.current = null;
  };
}

/**
 * [shown, show, hide] for a copy button's copied mark, cleared `ms` after the last copy (docs-code-copy,
 * docs-copy-markdown). Each mount makes its own mark and an unmount disposes it, so no timer outlives the button.
 */
export function useCopiedFlash(ms: number): readonly [boolean, () => void, () => void] {
  const [shown, setShown] = useState(false);
  const mark = useRef<CopiedFlash | null>(null);

  useEffect(() => holdCopiedFlash(mark, setShown, ms), [ms]);

  const show = useCallback(() => mark.current?.show(), []);
  const hide = useCallback(() => mark.current?.hide(), []);
  return [shown, show, hide] as const;
}
