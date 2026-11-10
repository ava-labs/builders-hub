'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { centredScrollTop, isFullyVisible } from './sidebar-scroll';

/** fumadocs' desktop sidebar and its phone drawer; the drawer stays mounted, and laid out, while closed. */
const SIDEBAR_ROOTS = '#nd-sidebar, #nd-sidebar-mobile';
const DRAWER_ID = 'nd-sidebar-mobile';
/** The Radix ScrollArea viewport: the one element that scrolls the sidebar list. */
const VIEWPORT = '[data-radix-scroll-area-viewport]';
/** fumadocs marks the link of the current page. */
const ACTIVE_LINK = 'a[data-active="true"]';
/** The viewport's mask fades its first and last 12 px; an item there is not in full view. */
const FADE_PX = 12;
/**
 * The instant scroll. Every browser accepts 'auto', which follows the viewport's computed scroll-behavior;
 * that is auto (the smooth rule on html is not inherited), so the list jumps.
 */
const JUMP: ScrollBehavior = 'auto';

function sidebarViewports(): HTMLElement[] {
  return Array.from(document.querySelectorAll(SIDEBAR_ROOTS), (root) =>
    root.querySelector<HTMLElement>(VIEWPORT),
  ).filter((viewport): viewport is HTMLElement => viewport !== null);
}

/** Scrolls the viewport, and nothing else, to centre its active link, unless that link is in full view. */
function revealActiveLink(viewport: HTMLElement, behavior: ScrollBehavior): void {
  const link = viewport.querySelector(ACTIVE_LINK);
  if (!link || viewport.clientHeight === 0) return;
  const item = link.getBoundingClientRect();
  const view = viewport.getBoundingClientRect();
  if (isFullyVisible(item, view, FADE_PX)) return;
  viewport.scrollTo({ top: centredScrollTop(item, view, viewport), behavior });
}

/** Resolves when the animations running in the list have ended: an opening folder grows it for 150 ms. */
function animationsSettled(viewport: HTMLElement): Promise<unknown> {
  const running = viewport
    .getAnimations({ subtree: true })
    .filter(
      (animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity,
    );
  return Promise.allSettled(running.map((animation) => animation.finished));
}

/** Reveals each sidebar's active link on the next frame, once its list has settled. Returns a cancel function. */
function scheduleReveal(behavior: ScrollBehavior): () => void {
  let cancelled = false;
  const frame = requestAnimationFrame(() => {
    sidebarViewports().forEach((viewport) => {
      void animationsSettled(viewport).then(() => {
        if (!cancelled) revealActiveLink(viewport, behavior);
      });
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

/** Calls `onOpen` each time the phone drawer's data-state turns to "open". Returns a disconnect function. */
function watchDrawerOpen(onOpen: () => void): () => void {
  const observer = new MutationObserver((records) => {
    const opened = records.some(
      ({ target }) =>
        target instanceof Element && target.id === DRAWER_ID && target.getAttribute('data-state') === 'open',
    );
    if (opened) onOpen();
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
  return () => observer.disconnect();
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Keeps the current page in view in the Academy sidebar: on the first load (instant), after each client
 * navigation (smooth, so the move shows, or instant when the reader prefers reduced motion) and when the
 * phone drawer opens (instant). A fresh mount of the course layout, arrival from a track landing or /docs
 * included, counts as the first load. Only the sidebar's own scroll container moves. Renders nothing.
 */
export function RevealActiveSidebarItem() {
  const pathname = usePathname();
  const shownPath = useRef<string | null>(null);

  useEffect(() => {
    const navigated = shownPath.current !== null && shownPath.current !== pathname;
    shownPath.current = pathname;
    const cancelPageReveal = scheduleReveal(navigated && !prefersReducedMotion() ? 'smooth' : JUMP);
    // The drawer watcher belongs to this page, so a navigation also cancels a reveal it has scheduled.
    let cancelDrawerReveal = () => {};
    const disconnect = watchDrawerOpen(() => {
      cancelDrawerReveal();
      cancelDrawerReveal = scheduleReveal(JUMP);
    });
    return () => {
      cancelPageReveal();
      disconnect();
      cancelDrawerReveal();
    };
  }, [pathname]);

  return null;
}
