'use client';

import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { DocsSubNav } from '@/components/navigation/docs-subnav';
import { DocsNavbarToggle } from '@/components/navigation/docs-navbar-toggle';
import { ForceMobileSidebar } from '@/components/navigation/force-mobile-sidebar';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { SidebarActive } from '@/components/docs-book/sidebar-active';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  documentationOptions,
  apiReferenceOptions,
  nodesOptions,
  toolingOptions,
} from '@/components/navigation/docs-nav-config';

/* docs-anchor-flash: the heading a reader jumps to (an On this page entry, a heading's own link, a #section link)
   carries a brief wash ([data-bk-anchor-mark], book/tokens.css) that fades on its own. html scrolls smoothly
   (app/global.css), so the mark starts when the jump lands: on scrollend, or at once when no scroll starts. */
const ANCHOR_HEADING = '#nd-page article :is(h1, h2, h3, h4, h5, h6)[id]';
const ANCHOR_MARK = 'data-bk-anchor-mark';
/** A jump starts its scroll within a frame or two; no scroll by then means the heading is already in place. */
const NO_SCROLL_MS = 120;
/** A scroll that has been quiet this long has landed: the fallback for a browser without the scrollend event. */
const SCROLL_QUIET_MS = 200;
/** Below 1280px the On this page list is a popover that stays open after an entry is picked (fumadocs closes it on a
    click outside it) and covers the heading, so a mark that lands under it starts when it closes. */
const TOC_POPOVER_OPEN = '#nd-tocnav[data-state="open"]';

/** The id that a URL fragment names ("#a%20b" names "a b"), or null. */
export function idFromHash(hash: string): string | null {
  if (hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

/** The link that a plain click follows within this page, or null. */
function inPageLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(link instanceof HTMLAnchorElement) || (link.target !== '' && link.target !== '_self')) return null;
  return link.origin === location.origin && link.pathname === location.pathname ? link : null;
}

function useAnchorFlash(pathname: string) {
  useEffect(() => {
    let marked: Element | null = null;
    let stopWaiting = () => {};

    const markWhenLanded = (id: string) => {
      stopWaiting();
      const heading = document.getElementById(id);
      if (!heading?.matches(ANCHOR_HEADING)) return;
      // The old mark goes at once. The frames before the jump lands let a second jump to it start the wash again.
      marked?.removeAttribute(ANCHOR_MARK);
      marked = null;
      let popover: MutationObserver | null = null;
      const show = () => {
        stopWaiting();
        heading.setAttribute(ANCHOR_MARK, '');
        marked = heading;
      };
      const land = () => {
        window.clearTimeout(quiet);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('scrollend', land);
        const toc = document.querySelector(TOC_POPOVER_OPEN);
        if (!toc) return show();
        popover = new MutationObserver(() => {
          if (toc.getAttribute('data-state') !== 'open') show();
        });
        popover.observe(toc, { attributes: true, attributeFilter: ['data-state'] });
      };
      let quiet = window.setTimeout(land, NO_SCROLL_MS);
      const onScroll = () => {
        window.clearTimeout(quiet);
        quiet = window.setTimeout(land, SCROLL_QUIET_MS);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('scrollend', land);
      stopWaiting = () => {
        window.clearTimeout(quiet);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('scrollend', land);
        popover?.disconnect();
        stopWaiting = () => {};
      };
    };

    const onClick = (event: MouseEvent) => {
      const id = idFromHash(inPageLink(event)?.hash ?? '');
      if (id) markWhenLanded(id);
    };

    document.addEventListener('click', onClick, true);
    const deepLink = idFromHash(location.hash);
    if (deepLink) markWhenLanded(deepLink);
    return () => {
      document.removeEventListener('click', onClick, true);
      stopWaiting();
    };
  }, [pathname]);
}

/* docs-tabs-slide: book/code.css draws one underline under each tab list marked [data-bk-tab-line], from --bk-tab-x
   and --bk-tab-w, and moves it to the chosen tab. Only lists whose tabs draw their own underline (fumadocs Tabs)
   take it. The line travels when the active tab changes; its first draw and a resize place it without travel. The
   observers watch the page's article only. */
const TAB_LINE = 'data-bk-tab-line';

function useTabLine(pathname: string) {
  useEffect(() => {
    const article = document.querySelector<HTMLElement>('#nd-page article');
    if (!article) return;
    const placed = new WeakMap<Element, { tab: Element; x: number; w: number }>();
    const resizes = new ResizeObserver(() => sync());

    const place = (list: HTMLElement) => {
      const tab = list.querySelector(':scope > [role="tab"][data-state="active"]');
      if (!tab || getComputedStyle(tab).borderBottomWidth === '0px') return;
      const box = tab.getBoundingClientRect();
      // In the list's scrolled content, so the line scrolls with the tabs.
      const x = box.left - list.getBoundingClientRect().left - list.clientLeft + list.scrollLeft;
      const w = box.width;
      const last = placed.get(list);
      if (last && last.tab === tab && Math.abs(last.x - x) < 0.5 && Math.abs(last.w - w) < 0.5) return;
      list.setAttribute(TAB_LINE, last && last.tab !== tab ? '' : 'still');
      list.style.setProperty('--bk-tab-x', `${x}px`);
      list.style.setProperty('--bk-tab-w', String(w));
      if (!last) [list, ...list.querySelectorAll(':scope > [role="tab"]')].forEach((el) => resizes.observe(el));
      placed.set(list, { tab, x, w });
    };
    const sync = () => article.querySelectorAll<HTMLElement>('[role="tablist"]').forEach(place);
    const changes = new MutationObserver(sync);

    changes.observe(article, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
    sync();
    return () => {
      changes.disconnect();
      resizes.disconnect();
    };
  }, [pathname]);
}

/* site-page-transition: going to another docs page fades the article (app/global.css), but only when a pointer started
   it on the page in plain view (the article with its TOC and pager, the sidebar or the docs bar), not on a hover card's
   trigger, with no floating layer open, no consent card showing and the chat below the docs bars. A press like that
   marks html[data-bk-page-fade]. A press anywhere else clears the mark, since the phone sidebar, search and the menus
   close over the change and a fade would draw the pages above them. So does a mouse or pen press on a hover card's
   trigger (a desktop docs-bar tab: its card opens 100ms after the pointer arrives, over the fade; Radix opens none for
   a touch pointer), focus landing on such a trigger (Radix opens its card on focus too, and a tap focuses the tab in
   Chromium), a press while a hover card, other Radix popper content or a dialog is open, a press while the consent card
   shows (a fade would draw the pages over it, and naming it to hold above them would leave it unpressable while the
   fade runs), a press while the chat reaches above the docs bars (a short window, a phone held sideways: the fade's
   clip would cut it), a key press, and Back or Forward: a keyboard change (a focused link, a search result picked with
   Enter) and a history change swap at once. */
const PAGE_FADE = 'data-bk-page-fade';
const IN_VIEW = '#nd-page, #nd-sidebar, #docs-subnav';
/** Something that opens a hover card under the pointer, or when it takes focus. */
const HOVER_TRIGGER = '[data-slot="hover-card-trigger"]';
/** Floating layers, open or still closing: hover cards and the rest of Radix's popper content, and open dialogs. A Radix
    dialog is a div that exists only while open; a native dialog can stay in the page closed (an image zoom), so it
    counts only with [open]. */
const FLOATING =
  '[data-slot="hover-card-content"], [data-radix-popper-content-wrapper], [role="dialog"]:not(dialog), dialog[open]';
/** The cookie consent card (app/layout.tsx). */
const CONSENT = '#privacy-banner-root > div';
/** The chat, named to hold still above the fading pages (app/global.css), and the docs bars the fade is clipped
    below. */
const CHAT = '[data-chatbot]';
const BARS = '#docs-subnav';

/** The box of `layer` on screen, or null when it is absent or hidden (no height: embed mode hides the card and the
    chat). */
function shownBox(layer: Element | null): DOMRect | null {
  const box = layer?.getBoundingClientRect();
  return box && box.height > 0 ? box : null;
}

/**
 * What a pointer press on `target` makes of the page change it may start: a fade, or a swap at once ('cut'). Any
 * pointer but touch can hover, as Radix counts it (excludeTouch), so a press with no pointer type cuts on a trigger.
 */
export function pressMode(target: EventTarget | null, pointerType = ''): 'fade' | 'cut' {
  const element = target as Element | null;
  if (typeof element?.closest !== 'function' || element.closest(IN_VIEW) === null) return 'cut';
  if (pointerType !== 'touch' && element.closest(HOVER_TRIGGER) !== null) return 'cut';
  const doc = element.ownerDocument;
  if (doc.querySelector(FLOATING) !== null || shownBox(doc.querySelector(CONSENT)) !== null) return 'cut';
  const bars = doc.querySelector(BARS)?.getBoundingClientRect().bottom ?? 0;
  const chat = shownBox(doc.querySelector(CHAT));
  return chat !== null && chat.top < bars ? 'cut' : 'fade';
}

/** Keeps html[data-bk-page-fade] in step with the input that may start a page change. Returns the cleanup. */
export function watchPageFade(doc: Document, win: Window): () => void {
  const root = doc.documentElement;
  const cut = () => root.removeAttribute(PAGE_FADE);
  const press = (event: Event) =>
    pressMode(event.target, (event as PointerEvent).pointerType) === 'fade' ? root.setAttribute(PAGE_FADE, '') : cut();
  const focus = (event: Event) => {
    const element = event.target as Element | null;
    if (typeof element?.closest === 'function' && element.closest(HOVER_TRIGGER) !== null) cut();
  };
  doc.addEventListener('pointerdown', press, true);
  doc.addEventListener('focusin', focus, true);
  doc.addEventListener('keydown', cut, true);
  win.addEventListener('popstate', cut);
  return () => {
    doc.removeEventListener('pointerdown', press, true);
    doc.removeEventListener('focusin', focus, true);
    doc.removeEventListener('keydown', cut, true);
    win.removeEventListener('popstate', cut);
    cut();
  };
}

function usePageFadeGate() {
  useEffect(() => watchPageFade(document, window), []);
}

interface DocsLayoutWrapperProps {
  children: ReactNode;
  documentationTree: any;
  apiReferenceTree: any;
  rpcsTree: any;
  toolingTree: any;
  acpsTree: any;
}

export function DocsLayoutWrapper({
  children,
  documentationTree,
  apiReferenceTree,
  rpcsTree,
  toolingTree,
  acpsTree,
}: DocsLayoutWrapperProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  useAnchorFlash(pathname);
  useTabLine(pathname);
  usePageFadeGate();

  // Add data attribute to body for CSS targeting
  useEffect(() => {
    // Set layout attribute for scoping styles
    if (pathname.startsWith('/docs')) {
      document.body.setAttribute('data-layout', 'docs');
    } else {
      document.body.removeAttribute('data-layout');
    }

    if (pathname.startsWith('/docs/tooling')) {
      document.body.setAttribute('data-docs-section', 'tooling');
    } else if (pathname.startsWith('/docs/acps')) {
      document.body.setAttribute('data-docs-section', 'acps');
    } else if (pathname.startsWith('/docs/api-reference')) {
      document.body.setAttribute('data-docs-section', 'api-reference');
    } else if (pathname.startsWith('/docs/rpcs') || pathname.startsWith('/docs/nodes')) {
      document.body.setAttribute('data-docs-section', 'nodes');
    } else if (pathname.startsWith('/docs')) {
      document.body.setAttribute('data-docs-section', 'documentation');
    }

    return () => {
      document.body.removeAttribute('data-docs-section');
      document.body.removeAttribute('data-layout');
    };
  }, [pathname]);

  // Determine which section we're in and get the appropriate tree
  let pageTree;
  let sidebarOptions: any = {};

  if (pathname.startsWith('/docs/api-reference')) {
    pageTree = apiReferenceTree;
    sidebarOptions = {
      tabs: apiReferenceOptions,
    };
  } else if (pathname.startsWith('/docs/rpcs') || pathname.startsWith('/docs/nodes')) {
    pageTree = rpcsTree;
    sidebarOptions = {
      tabs: nodesOptions,
    };
  } else if (pathname.startsWith('/docs/tooling')) {
    pageTree = toolingTree;
    sidebarOptions = {
      tabs: toolingOptions,
    };
  } else if (pathname.startsWith('/docs/acps')) {
    pageTree = acpsTree;
    // No hamburger menu for ACPs - explicitly disable tabs
    sidebarOptions = {
      tabs: false,
    };
  } else {
    pageTree = documentationTree;
    sidebarOptions = {
      tabs: documentationOptions,
    };
  }

  const docsOptions: DocsLayoutProps = {
    tree: pageTree,
    nav: {
      enabled: false,
    },
    // Disable fumadocs search toggle - we use our own search in the main header
    searchToggle: {
      enabled: false,
    },
    // Disable fumadocs theme switch - we use our own in the main header
    themeSwitch: {
      enabled: false,
    },
    sidebar: {
      tabs: isMobile ? sidebarOptions.tabs : false,
      side: 'left', // Open sidebar from left on mobile
    } as any,
  };

  return (
    <div data-route-layout="docs">
      <NavbarDropdownInjector />
      <ForceMobileSidebar />
      <DocsNavbarToggle />
      <DocsSubNav />
      <SidebarActive />
      <DocsLayout {...docsOptions}>
      {children}
    </DocsLayout>
    </div>
  );
}
