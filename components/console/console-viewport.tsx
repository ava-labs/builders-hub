'use client';

import { ReactNode, useEffect } from 'react';

/**
 * CSS variable name children read via `var(--console-viewport)` to size
 * themselves against the available console viewport. Exported so call
 * sites use the constant rather than hardcoding the string.
 */
export const CONSOLE_VIEWPORT_VAR = '--console-viewport';

/**
 * Available height for the console layout: full viewport minus the navbar
 * (h-14 → 3.5rem) and the fumadocs banner if it's mounted (banner sets
 * `--fd-banner-height` itself).
 *
 * Three nested elements (SidebarProvider, SidebarInset, inner scroll
 * container) each subtract a different amount from this base. With the
 * variable, only the base is defined here; subtractions stay readable at
 * the call site (`calc(var(--console-viewport) - 1rem)`).
 */
const VIEWPORT_VALUE = 'calc(100vh - 3.5rem - var(--fd-banner-height,0px))';

/**
 * Wraps the console layout to:
 *   1. Set `--console-viewport` so children read the available height via
 *      a single CSS variable instead of repeating the calc string.
 *   2. Lock `document.body.style.overflow = 'hidden'` while mounted. The
 *      console owns its own scroll container; without this lock, a second
 *      scrollbar appears whenever the document height computes slightly
 *      higher than the viewport (banner + navbar + content not zeroing out).
 *
 * Renders `display: contents` so the wrapper doesn't insert a box into
 * the layout tree — only the CSS variable cascades through.
 */
export function ConsoleViewport({ children }: { children: ReactNode }) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      className="contents"
      style={{ [CONSOLE_VIEWPORT_VAR]: VIEWPORT_VALUE } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
