"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLinkStatus } from "next/link";
import { EASE_CSS } from "@/components/explorer-v2/motion";
import type { Tab } from "@/components/explorer-v2/subnav-tabs";

/* exp-tab-answer: the subnav rail (ExplorerSubnav.tsx) answers a tab click before the page lands.
   Explorer routes are dynamic and have no loading.tsx, so a page commits 180 to 350 ms after the
   click; until then the tab whose page is on the way is the lit one: its label goes dark and the bar
   slides under it. */

/** The rail's lit tab: the page's own, or from a click on, the tab whose page is on the way. Its bar
 *  slides from the tab it leaves, from where it is if a slide is under way: transform only, 180ms on
 *  the explorer's curve; under Reduce Motion it moves at once, and the label's colour keeps the nav's
 *  150ms fade either way. */
export function useTabAnswer(tabs: Tab[], pathname: string) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const onPending = useCallback(
    (href: string, pending: boolean) => setPendingHref((cur) => (pending ? href : cur === href ? null : cur)),
    [],
  );
  const isLit = (tab: Tab) => (pendingHref ? tab.href === pendingHref : tab.isActive(pathname));
  const litIndex = tabs.findIndex(isLit);
  // the bar's box as it leaves its tab, and the bar now drawn
  const barFrom = useRef<DOMRect | null>(null);
  const barEl = useRef<HTMLSpanElement | null>(null);
  const barRef = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    barEl.current = el;
    return () => {
      barFrom.current = el.getBoundingClientRect();
    };
  }, []);
  useLayoutEffect(() => {
    const from = barFrom.current;
    barFrom.current = null;
    const bar = barEl.current;
    if (!from || !bar?.isConnected || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = bar.getBoundingClientRect();
    if (!to.width || Math.abs(from.left - to.left) < 0.5) return;
    bar.animate(
      [{ transform: `translateX(${from.left - to.left}px) scaleX(${from.width / to.width})` }, { transform: "none" }],
      { duration: 180, easing: EASE_CSS },
    );
  }, [litIndex]);
  return { isLit, onPending, barRef };
}

/** A tab's mark, inside its Link so useLinkStatus reads that link: the rail hears a click at once and
 *  keeps the tab lit until its page lands. Next keeps only the last clicked link pending, so a second
 *  click wins. The lit tab draws the bar. */
export function TabMark({
  href,
  lit,
  onPending,
  barRef,
}: {
  href: string;
  lit: boolean;
  onPending: (href: string, pending: boolean) => void;
  barRef: (el: HTMLSpanElement | null) => void | (() => void);
}) {
  const { pending } = useLinkStatus();
  useLayoutEffect(() => {
    if (!pending) return;
    onPending(href, true);
    return () => onPending(href, false);
  }, [href, pending, onPending]);
  return lit ? (
    <span ref={barRef} aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[var(--chain-accent,#E6212F)]" />
  ) : null;
}
