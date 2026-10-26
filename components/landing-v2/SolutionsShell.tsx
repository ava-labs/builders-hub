"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, ViewTransition } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import ConsoleBar from "@/components/landing-v2/ConsoleBar";
import { PILLARS } from "@/components/landing-v2/pillars";

/* ------------------------------------------------------------------ */
/* Solutions shell: the explorer's chrome grammar for /solutions       */
/*                                                                      */
/* Same sheet column as NetworkShell (90rem, hairline edges past that   */
/* width) and the same sticky subnav spine: a scope label, a divider,   */
/* then one underline tab per surface. The index and the four pillars   */
/* read as one sectioned product, like the explorer's network facets.   */
/* ------------------------------------------------------------------ */

const TABS = [
  { label: "Overview", href: "/solutions" },
  ...PILLARS.map((p) => ({ label: p.label, href: `/solutions/${p.slug}` })),
];

/* sol-tab-glide: a tab tags its navigation, so the red underline travels to
   the tab opened while the page below the subnav cross-fades and the subnav
   holds still (app/global.css). React names the underline, the subnav and
   the page only for that navigation: Back, Forward and every other link
   swap at once. So does a tab while the consent card shows: the fade would
   draw the page over the card, and a card named to hold above it takes no
   presses while it runs (watchConsentCard). */
const TAB_GLIDE = ["sol-tab"];

/* Each page mounts its own shell, so a tab click hands the tab strip's
   scroll to the next page's subnav. The hand-off lives only as long as the
   page that armed it: the next page's subnav takes it in the commit that
   swaps the pages (a layout effect), and the leaving subnav drops whatever
   is left once that commit is done (a passive cleanup). A press on the open
   page's own tab drops it too: that navigation keeps the page, and with it
   the subnav, so a tab navigation it overtakes would leave its hand-off for
   a later arrival at that page by another link. */
let handoff: { href: string; stripLeft: number } | null = null;

export function armHandoff(href: string, stripLeft: number) {
  handoff = { href, stripLeft };
}

/** The hand-off armed for this page, once; any page's arrival clears it. */
export function takeHandoff(pathname: string) {
  const kept = handoff;
  handoff = null;
  return kept?.href === pathname ? kept : null;
}

export function dropHandoff() {
  handoff = null;
}

/** Calls `onChange` with whether the consent card shows (app/layout.tsx,
 *  #privacy-banner-root: a card with a box; embed mode hides it), now and
 *  whenever it mounts (after hydration) or goes. Returns the cleanup. */
export function watchConsentCard(doc: Document, onChange: (shown: boolean) => void): () => void {
  const root = doc.getElementById("privacy-banner-root");
  if (!root) return () => {};
  const sync = () => onChange((root.firstElementChild?.getBoundingClientRect().height ?? 0) > 0);
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true });
  return () => observer.disconnect();
}

export default function SolutionsShell({ children }: { children: React.ReactNode }) {
  // React gives enter and exit only to a ViewTransition with no DOM node
  // above it in the page, so it wraps the whole page; the subnav and its
  // underline are named apart, so they stay out of the page's fade
  return (
    <ViewTransition
      enter={{ "sol-tab": "sol-page-in", default: "none" }}
      exit={{ "sol-tab": "sol-page-out", default: "none" }}
      default="none"
    >
      <main className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
        <SheetBackdrop snowOnly />
        <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
          <SolutionsSubnav className="mb-6" />
          {children}
        </div>
        <ConsoleBar />
      </main>
    </ViewTransition>
  );
}

function SolutionsSubnav({ className }: { className?: string }) {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLElement>(null);
  const [consentCard, setConsentCard] = useState(false);
  useEffect(() => watchConsentCard(document, setConsentCard), []);
  useLayoutEffect(() => {
    const kept = takeHandoff(pathname);
    if (kept && barRef.current && stripRef.current) keepSubnav(barRef.current, stripRef.current, kept.stripLeft);
  }, [pathname]);
  // the leaving subnav drops a hand-off no arrival took (a tab navigation that left for another page)
  useEffect(() => dropHandoff, []);
  return (
    <ViewTransition name="sol-subnav" share={{ "sol-tab": "sol-tab-bar", default: "none" }} default="none">
      {/* sticky just below the global navbar, the same offsets and layers as
          ExplorerSubnav so the two products pin identically */}
      <div
        ref={barRef}
        data-solutions-subnav
        className={cn(
          "sticky top-[calc(var(--fd-banner-height,0px)+3.5rem)] z-[35] -mx-5 flex items-stretch justify-between gap-x-4 border-b border-zinc-200 bg-white/85 px-5 backdrop-blur-[12px] md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/85",
          className,
        )}
      >
        <div className="flex min-w-0 items-stretch gap-x-3 sm:gap-x-4 md:gap-x-5">
          <Link href="/solutions" className="flex shrink-0 items-center gap-2.5">
            <AvalancheLogo className="h-5 w-5 shrink-0 text-zinc-900 dark:text-zinc-100 [&_path]:fill-current" />
            <span className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 sm:block dark:text-zinc-100">
              Solutions
            </span>
          </Link>
          <div className="my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />
          <nav
            ref={stripRef}
            aria-label="Solutions sections"
            className="scrollbar-hide flex items-stretch gap-x-3 overflow-x-auto sm:gap-x-4 md:gap-x-5"
          >
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  // another tab keeps the subnav in place (keepSubnav) instead of scrolling to the top
                  scroll={active}
                  transitionTypes={consentCard ? undefined : TAB_GLIDE}
                  onNavigate={() => (active ? dropHandoff() : armHandoff(tab.href, stripRef.current?.scrollLeft ?? 0))}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                >
                  {tab.label}
                  {active && (
                    <ViewTransition name="sol-tab-underline" share={{ "sol-tab": "sol-tab-glide", default: "none" }} default="none">
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E6212F]" />
                    </ViewTransition>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        {/* the rail's one action, set like the explorer's network control */}
        <Link
          href="/console"
          className="group hidden shrink-0 items-center gap-2 self-center border border-zinc-200 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 transition-colors hover:border-zinc-900 sm:inline-flex dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-100"
        >
          Console
          <ArrowRight className="h-3 w-3 text-[#E6212F] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </ViewTransition>
  );
}

/** sol-tab-glide: the new page's subnav takes the old one's place, so only
 *  the underline travels. The tab strip keeps its scroll (moved just enough
 *  to show the opened tab whole), and a page scrolled past the point where
 *  the subnav pins opens at that point, its content starting right under
 *  the subnav (scroll={false} keeps Next from scrolling to the top). */
function keepSubnav(bar: HTMLElement, strip: HTMLElement, stripLeft: number) {
  const tab = strip.querySelector<HTMLElement>('a[aria-current="page"]');
  if (tab) {
    const left = tab.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    strip.scrollLeft = stripScrollFor(stripLeft, left, tab.offsetWidth, strip.clientWidth);
  }
  const sheet = bar.parentElement;
  if (!sheet) return;
  const pinAt = pinScrollY(
    sheet.getBoundingClientRect().top + window.scrollY,
    parseFloat(getComputedStyle(sheet).paddingTop),
    parseFloat(getComputedStyle(bar).top),
  );
  const top = keptScrollY(window.scrollY, pinAt);
  if (top !== window.scrollY) window.scrollTo({ top, behavior: "instant" });
}

/** The tab strip's scroll: where it was, moved just enough to show the
 *  opened tab whole (its start, if it is wider than the strip). */
export function stripScrollFor(kept: number, tabLeft: number, tabWidth: number, stripWidth: number): number {
  return Math.min(Math.max(kept, tabLeft + tabWidth - stripWidth), tabLeft);
}

/** The page scroll at which the subnav pins: its natural top (the sheet's
 *  top in the page plus its top padding) less its sticky offset. */
export function pinScrollY(sheetTop: number, sheetPaddingTop: number, stickyTop: number): number {
  return sheetTop + sheetPaddingTop - stickyTop;
}

/** A page scrolled past the pin point opens there, its content right under
 *  the subnav; a page above it keeps its scroll. */
export function keptScrollY(scrollY: number, pinAt: number): number {
  return Math.min(scrollY, pinAt);
}
