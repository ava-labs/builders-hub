'use client';

import { ReactNode, useEffect } from 'react';
import { installFetchDiagnostics } from '@/lib/console/fetch-diagnostics';

/**
 * CSS variable name children read via `var(--console-viewport)` to size
 * themselves against the available console viewport. Exported so call
 * sites use the constant rather than hardcoding the string.
 */
export const CONSOLE_VIEWPORT_VAR = '--console-viewport';

/**
 * Available height for the console layout: the visible viewport minus the
 * navbar (h-14 → 3.5rem, plus its 1px bottom border) and the fumadocs banner
 * if it's mounted (banner sets `--fd-banner-height` itself). `dvh`, not `vh`:
 * on phones 100vh includes the area behind the browser's address bar, which
 * made the page taller than the screen so it scrolled the console's header
 * up under the site navbar.
 *
 * Three nested elements (SidebarProvider, SidebarInset, inner scroll
 * container) each subtract a different amount from this base. With the
 * variable, only the base is defined here; subtractions stay readable at
 * the call site (`calc(var(--console-viewport) - 1rem)`).
 */
const VIEWPORT_VALUE = 'calc(100dvh - 3.5rem - 1px - var(--fd-banner-height,0px))';

/**
 * Wraps the console layout to:
 *   1. Set `--console-viewport` so children read the available height via
 *      a single CSS variable instead of repeating the calc string.
 *   2. Lock overflow on both `<html>` and `<body>` while mounted. The
 *      console owns its own scroll container; without this lock, a second
 *      scrollbar appears whenever the document height computes slightly
 *      higher than the viewport, and iOS scrolls the root element even
 *      when only the body is locked.
 *   3. Put the document back at the top whenever something scrolls it. A lock
 *      only stops the user: iOS still scrolls the page to a focused field, on
 *      a dialog's focus restore, or on returning from a wallet app, and then
 *      the console's own header and bottom sit off screen with no way back.
 *      The page never moves; when the keyboard opens, the focused field is
 *      scrolled into view inside its own scroll container instead.
 *
 * Renders `display: contents` so the wrapper doesn't insert a box into
 * the layout tree — only the CSS variable cascades through.
 */
export function ConsoleViewport({ children }: { children: ReactNode }) {
  useEffect(() => {
    installFetchDiagnostics();
    const root = document.documentElement;
    const original = { html: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const toTop = () => {
      if (window.scrollY !== 0 || root.scrollTop !== 0) window.scrollTo(0, 0);
    };
    // The document never scrolls in the console. When the keyboard opens, the focused field is brought into view
    // inside its own scroll container (the pane or a dialog) instead of iOS shifting the whole page.
    const onScroll = () => toTop();
    const onViewportResize = () => {
      toTop();
      const field = document.activeElement;
      if (field instanceof HTMLElement && field.matches('input, textarea, select, [contenteditable="true"]')) {
        field.scrollIntoView({ block: 'center', inline: 'nearest' });
        toTop();
      }
    };
    const onFocusOut = () => requestAnimationFrame(toTop);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusout', onFocusOut);
    window.visualViewport?.addEventListener('resize', onViewportResize);
    window.visualViewport?.addEventListener('scroll', onScroll);
    window.addEventListener('pageshow', toTop);
    toTop();

    return () => {
      root.style.overflow = original.html;
      document.body.style.overflow = original.body;
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusout', onFocusOut);
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      window.visualViewport?.removeEventListener('scroll', onScroll);
      window.removeEventListener('pageshow', toTop);
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
