"use client";

/* The city's frame: the cards that stand over the 3D city on a large screen (city-app.tsx), all on one spacing token.
   --frame, set on the app, is how far every card stands in from the app's edges, and the least room between two
   cards: the sidebar at the left and the pane at the right share their top and bottom edges and the search's top,
   and the key and the news button keep the bottom corners on the same line. Every card moves on one curve. */

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIEW_SWITCH } from "@/components/explorer-v2/view-switch";

/** the token itself, on the app's root */
export const FRAME = "[--frame:1rem]";
/** the sidebar's width, and the open chain's live pane's */
export const PANEL_W = 372;
export const LIVE_W = 344;
/** the news button's width (news-feed.tsx): it keeps the bottom right corner while no pane stands there */
const NEWS_W = 48;
/** the frame's motion: fast attack, long decay */
export const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** the cards' glass: the sidebar's, the panes' and the news' */
export const GLASS =
  "border border-zinc-200/90 bg-white/[0.94] shadow-[0_24px_60px_-28px_rgba(30,27,58,0.35)] backdrop-blur-xl dark:border-zinc-800/90 dark:bg-zinc-950/[0.9]";
/** the sidebar and the panes, from the frame's top (under the site's navbar when the page scrolls, --under) to its
    bottom; each adds its side, its width and its slide (Tailwind's translate-* set translate, not transform) */
export const PANE = cn(
  "absolute bottom-(--frame) top-[calc(var(--frame)+var(--under,0px))] z-20 flex flex-col overflow-hidden rounded-2xl transition-[translate,opacity] duration-300",
  EASE,
  GLASS,
);
/** the open sidebar's head row, which the controls settle into: the search's height and 8 px above and below it */
export const HEAD_ROW = "h-[3.75rem] shrink-0 border-b border-zinc-100 dark:border-zinc-900";

/* the sidebar's head: the list's door and the switch to the 2D explorer. Shut, each is a card of its own in the city's
   top left corner, level with the search; open, the sidebar comes in under them from the same corner, their cards
   fade, and they settle 8 px down and 4 px in, the door's icon on the list's edge, as its head row. A sibling of the
   sidebar, not its child: the shut sidebar is inert, and the door stays live. The door is the sidebar's one close;
   a close while the reader is in the sidebar (Escape, a row's back) hands the focus to it, which inert would drop.
   A pointer press outside the sidebar, on the city too, which takes no focus, says the reader has left it */
export function SidebarHead({ open, count, explorer, onDoor }: { open: boolean; count: string; explorer: string; onDoor: () => void }) {
  const door = useRef<HTMLButtonElement>(null);
  const within = useRef(false);
  useEffect(() => {
    const on = (e: Event) => {
      within.current = e.target instanceof Element && !!e.target.closest("#city-sidebar");
    };
    document.addEventListener("focusin", on);
    document.addEventListener("pointerdown", on, true);
    return () => {
      document.removeEventListener("focusin", on);
      document.removeEventListener("pointerdown", on, true);
    };
  }, []);
  // before the browser lets the inert sidebar's focus go
  useLayoutEffect(() => {
    if (open || !within.current) return;
    within.current = false;
    const at = document.activeElement;
    if (!at || at === document.body || at.closest("#city-sidebar")) door.current?.focus();
  }, [open]);
  // a card's glass, behind its content: it fades while the sidebar's comes in under it
  const card = cn(
    "absolute inset-0 -z-10 rounded-2xl border border-zinc-200/90 bg-white/[0.94] shadow-[0_12px_32px_-18px_rgba(30,27,58,0.45)] backdrop-blur-xl transition-opacity duration-200 dark:border-zinc-800/90 dark:bg-zinc-950/[0.9]",
    open && "opacity-0",
  );
  const Door = open ? PanelLeftClose : PanelLeftOpen;
  return (
    // divs, not a nav: the site's navbar rules (nav > div, nav button) would pad and underline them
    <div
      className={cn(
        "absolute left-(--frame) top-[calc(var(--frame)+var(--under,0px))] z-30 flex items-center gap-2 transition-transform duration-300",
        EASE,
        open && "translate-x-1 translate-y-2",
      )}
    >
      <button
        ref={door}
        type="button"
        onClick={onDoor}
        aria-expanded={open}
        aria-controls="city-sidebar"
        title={open ? "Close the list" : "Open the list"}
        data-city-chrome
        className="relative isolate flex h-11 items-center gap-2 rounded-2xl pl-3.5 pr-4 text-[13px] font-medium text-zinc-800 transition-colors hover:text-zinc-950 dark:text-zinc-100 dark:hover:text-white"
      >
        <span aria-hidden className={card} />
        <Door className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        Chains
        <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{count}</span>
      </button>
      <div role="group" aria-label="Explorer view" data-city-chrome className="relative isolate flex h-11 items-stretch gap-0.5 rounded-2xl p-1 text-[13px] font-medium">
        <span aria-hidden className={card} />
        {/* Explorer first, City second: the same order as the 2D subnav's toggle */}
        <Link
          href={explorer}
          transitionTypes={VIEW_SWITCH}
          className="flex items-center rounded-xl px-3 text-zinc-500 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          Explorer
        </Link>
        <span aria-current="page" className="flex items-center rounded-xl bg-zinc-100 px-3 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
          City
        </span>
      </div>
    </div>
  );
}

/** the strip's cells drop by its room, the first named first: the six hold about 721 px, without the market cap
    598, without the chains too 499, and AVAX, ICM and Tx alone 370, each rule with 8 px to spare. Only max rules:
    the phone's figures stand in no container, so a max rule never matches there */
export const STRIP_FIT = {
  marketCap: "@max-[730px]/strip:hidden",
  chains: "@max-[606px]/strip:hidden",
  validators: "@max-[507px]/strip:hidden",
};

/* the figures at the city's foot, centred on the window whatever is open: the strip's box stands as far in from both
   edges as the wider side needs (the sidebar, or the key from xl, at the left; a pane, or the news button, at the
   right), so nothing moves it sideways, and its cells drop by the room that leaves (STRIP_FIT). With no room for
   AVAX, ICM and Tx it fades out: a pane never stands over it */
export function FigureStrip({ sidebar, legend, right, children }: { sidebar: boolean; legend: boolean; right: number; children: ReactNode }) {
  // the key (city-key.tsx, KEY_W 320) stands from xl only, so the breakpoint sets its edge
  const left = sidebar ? `calc(${PANEL_W}px + 2 * var(--frame))` : legend ? "var(--key-edge)" : "var(--frame)";
  const edge = `max(${left}, calc(${right || NEWS_W}px + 2 * var(--frame)))`;
  return (
    <div
      className="pointer-events-none absolute bottom-(--frame) z-10 flex justify-center @container/strip [--key-edge:var(--frame)] xl:[--key-edge:calc(320px+2*var(--frame))]"
      style={{ left: edge, right: edge }}
    >
      <div
        role="group"
        aria-label="Network figures"
        className="pointer-events-auto flex divide-x divide-zinc-200/80 rounded-2xl border border-zinc-200/90 bg-white/[0.92] shadow-[0_12px_32px_-20px_rgba(30,27,58,0.35)] backdrop-blur-xl transition-[opacity,visibility] duration-200 @max-[378px]/strip:invisible @max-[378px]/strip:opacity-0 dark:divide-zinc-800 dark:border-zinc-800/90 dark:bg-zinc-950/[0.88]"
      >
        {children}
      </div>
    </div>
  );
}
