'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* The desktop column and the phone drawer. Both stay in the DOM; the hidden one has no layout boxes. */
const SIDEBAR_IDS = ['nd-sidebar', 'nd-sidebar-mobile'];
const VIEWPORT = '[data-radix-scroll-area-viewport]';
const ACTIVE_ROW = 'a[data-active="true"]';
const PART_ATTR = 'data-bk-active-part';
const IN_PART_ATTR = 'data-bk-in-part';
/* The viewport fades its top and bottom 12px. Keep the active row clear of the fade. */
const EDGE = 32;
/* fumadocs opens a folder in 150ms. Check the row again after that. */
const AFTER_OPEN_MS = 400;

function forEachSidebar(fn: (sidebar: HTMLElement) => void) {
  for (const id of SIDEBAR_IDS) {
    const sidebar = document.getElementById(id);
    if (sidebar) fn(sidebar);
  }
}

/* A separator with a name starts a part. An empty separator is a spacer inside a part. */
function isPartSeparator(el: Element) {
  return el.tagName === 'P' && !!el.textContent?.trim();
}

/* Set the attribute on the elements in `keep` and remove it from the other children of the list.
   An element that already has the correct state is not touched, so no extra mutation occurs. */
function markChildren(list: Element, attr: string, keep: ReadonlySet<Element>) {
  for (const marked of list.querySelectorAll(`:scope > [${attr}]`)) {
    if (!keep.has(marked)) marked.removeAttribute(attr);
  }
  for (const el of keep) {
    if (!el.hasAttribute(attr)) el.setAttribute(attr, '');
  }
}

/* Find the part that holds the active page. The separators are flat siblings of the top-level rows
   (fumadocs-ui sidebar.js), so the part starts at the nearest named separator before the top-level
   row that holds the active row, and ends at the next named separator. sidebar.css colors the
   separator and draws the part rail beside each top-level row of the part. Without parts, or for a
   row before the first part, nothing is marked and the folders draw the active path. */
function markActivePart(sidebar: HTMLElement) {
  const list = sidebar.querySelector(VIEWPORT)?.firstElementChild;
  if (!list) return;

  let part: Element | null = null;
  let row: Element | null = list.querySelector(ACTIVE_ROW);
  while (row && row.parentElement !== list) row = row.parentElement;
  for (let el = row?.previousElementSibling; el; el = el.previousElementSibling) {
    if (isPartSeparator(el)) {
      part = el;
      break;
    }
  }

  const rows = new Set<Element>();
  for (let el = part?.nextElementSibling; el && !isPartSeparator(el); el = el.nextElementSibling) rows.add(el);

  markChildren(list, PART_ATTR, new Set(part ? [part] : []));
  markChildren(list, IN_PART_ATTR, rows);
}

/* Scroll the sidebar viewport, never the window, by the smallest distance that shows the active row
   (block: 'nearest'). A hidden sidebar or a row in a closed folder has no layout box: skip it. */
function revealActiveRow(sidebar: HTMLElement) {
  const viewport = sidebar.querySelector<HTMLElement>(VIEWPORT);
  const row = viewport?.querySelector<HTMLElement>(ACTIVE_ROW);
  if (!viewport || !row || row.getClientRects().length === 0) return;

  const view = viewport.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  if (box.top < view.top + EDGE) viewport.scrollTop -= view.top + EDGE - box.top;
  else if (box.bottom > view.bottom - EDGE) viewport.scrollTop += box.bottom - (view.bottom - EDGE);
}

/**
 * Keeps the docs sidebar's active part and its rows marked, and its active row in view. It renders nothing.
 * On load and after each route change, it marks the part and scrolls the active row into view in both sidebars.
 * A re-render without a route change (a new tree, the drawer at the 1024px breakpoint) can drop the marks, so a
 * MutationObserver marks the part again. Each time the phone drawer opens, it scrolls the active row into view.
 */
export function SidebarActive() {
  const pathname = usePathname();

  useEffect(() => {
    const run = () =>
      forEachSidebar((sidebar) => {
        markActivePart(sidebar);
        revealActiveRow(sidebar);
      });
    const frame = requestAnimationFrame(run);
    const timer = window.setTimeout(run, AFTER_OPEN_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const root = document.querySelector('[data-route-layout="docs"]');
    if (!root) return;

    let frame = 0;
    let drawerOpened = false;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (target instanceof HTMLElement && target.id === 'nd-sidebar-mobile' && target.dataset.state === 'open') {
          drawerOpened = true;
        }
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        forEachSidebar(markActivePart);
        const drawer = document.getElementById('nd-sidebar-mobile');
        if (drawerOpened && drawer) revealActiveRow(drawer);
        drawerOpened = false;
      });
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-active', 'data-state'],
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
