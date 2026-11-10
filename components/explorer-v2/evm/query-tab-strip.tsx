"use client";

/* What a Query page's tabs look like: the strip of questions above the
   page, and the history beside it, a column on a wide screen and a
   drawer on a narrow one. These parts only draw. query-tabs.tsx holds
   the tabs, and a search box's first frame (QueryWorking) draws the same
   parts, so the swap to the page moves nothing. */

import { useEffect, useRef, useState } from "react";
import { History, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type HistoryEntry, type QueryTab, landOn, readHistory, readTabs, setHistoryOpen, useHistoryOpen } from "@/lib/explorer-query/threads";
import { HistoryDrawer, HistoryList, questionName } from "./query-history";

export interface TabActions {
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onOpen: (e: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

const PANEL = "query-tab-panel";
const tabId = (id: string) => `query-tab-${id}`;

const QUIET = "flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100";

/** the strip, the history and the page of the tab in view. Off: the page alone, for a chain with nothing to ask */
export function TabsView({
  tabs,
  active,
  entries,
  actions,
  off = false,
  children,
}: {
  tabs: QueryTab[];
  active: string;
  entries: HistoryEntry[];
  actions: TabActions;
  off?: boolean;
  children: React.ReactNode;
}) {
  const open = useHistoryOpen();
  const [drawer, setDrawer] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const shown = useRef(active);
  const rail = useRef<HTMLDivElement>(null);
  // a rail wider than the strip fades at the edge it runs past, as the subnav's does
  const [past, setPast] = useState({ left: false, right: false });
  const measure = () => {
    const r = rail.current;
    if (!r) return;
    const left = r.scrollLeft > 4;
    const right = r.scrollLeft + r.clientWidth < r.scrollWidth - 4;
    setPast((p) => (p.left === left && p.right === right ? p : { left, right }));
  };
  const current = tabs.find((t) => t.id === active)?.entry || null;

  // the tab in view stays in view on the rail; when the reader puts another tab in view from below the strip, the strip comes back on screen
  useEffect(() => {
    const el = document.getElementById(tabId(active))?.parentElement;
    const r = rail.current;
    if (el && r) {
      if (el.offsetLeft < r.scrollLeft) r.scrollLeft = el.offsetLeft;
      else if (el.offsetLeft + el.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = el.offsetLeft + el.offsetWidth - r.clientWidth;
    }
    if (shown.current !== active && strip.current && strip.current.getBoundingClientRect().top < 0) strip.current.scrollIntoView({ block: "start" });
    shown.current = active;
    measure();
    // a blank tab takes its question's name: the rail grows with no new tab
  }, [active, tabs.map((t) => `${t.id}:${t.name ?? ""}`).join("|")]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const fade = past.left || past.right ? `linear-gradient(to right, ${past.left ? "transparent 0, black 28px" : "black 0"}, ${past.right ? "black calc(100% - 28px), transparent 100%" : "black 100%"})` : undefined;

  // arrows, Home and End move between the tabs, as a tab list does
  const keys = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const t = tabs[(to + tabs.length) % tabs.length];
    actions.onSelect(t.id);
    requestAnimationFrame(() => document.getElementById(tabId(t.id))?.focus());
  };

  const list = (then?: () => void) => (
    <HistoryList
      entries={entries}
      current={current}
      onOpen={(e) => {
        then?.();
        actions.onOpen(e);
      }}
      onDelete={actions.onDelete}
    />
  );

  return (
    <div className="flex items-start gap-8">
      {!off && open && <aside className="sticky top-24 hidden max-h-[calc(100svh-7rem)] w-60 shrink-0 overflow-y-auto pt-3 xl:block">{list()}</aside>}
      <div className="flex min-w-0 flex-1 flex-col">
        {!off && (
          <div ref={strip} className="mb-6 flex items-stretch gap-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
            {/* a column on a wide screen, a drawer on a narrow one: one button each, so only one is there at a time */}
            <button type="button" onClick={() => setHistoryOpen(!open)} aria-expanded={open} className={cn(QUIET, "hidden xl:flex", open && "text-zinc-900 dark:text-zinc-100")}>
              <History className="h-3.5 w-3.5" />
              History
            </button>
            <button type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} className={cn(QUIET, "xl:hidden")}>
              <History className="h-3.5 w-3.5" />
              <span className="max-sm:sr-only">History</span>
            </button>
            <span aria-hidden className="my-3 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />
            <div
              ref={rail}
              role="tablist"
              aria-label="Questions"
              onScroll={measure}
              style={fade ? { WebkitMaskImage: fade, maskImage: fade } : undefined}
              className="scrollbar-hide relative flex min-w-0 flex-1 items-stretch overflow-x-auto"
            >
              {tabs.map((t, i) => {
                const on = t.id === active;
                const label = t.name ? questionName(t.name) : "New question";
                // the one blank tab has nothing to close
                const closable = tabs.length > 1 || !!t.name;
                return (
                  <div key={t.id} className="relative flex shrink-0 items-center">
                    <button
                      type="button"
                      role="tab"
                      id={tabId(t.id)}
                      aria-selected={on}
                      aria-controls={PANEL}
                      tabIndex={on ? 0 : -1}
                      title={label}
                      onClick={() => actions.onSelect(t.id)}
                      onKeyDown={(e) => keys(e, i)}
                      className={cn(
                        "max-w-[9rem] truncate py-3 pl-3 font-mono text-[11.5px] transition-colors sm:max-w-[15rem]",
                        closable ? "pr-1.5" : "pr-3",
                        on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100",
                      )}
                    >
                      {label}
                    </button>
                    {closable && (
                      <button
                        type="button"
                        onClick={() => actions.onClose(t.id)}
                        aria-label={`Close ${label}`}
                        className="mr-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {on && <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[var(--chain-accent,#E6212F)]" />}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={actions.onNew} className={cn(QUIET, "hover:text-[#E6212F] dark:hover:text-[#E6212F]")}>
              <Plus className="h-3.5 w-3.5" />
              <span className="max-sm:sr-only">New question</span>
            </button>
          </div>
        )}
        <div role={off ? undefined : "tabpanel"} id={off ? undefined : PANEL} aria-labelledby={off ? undefined : tabId(active)}>
          {children}
        </div>
      </div>
      {!off && (
        <HistoryDrawer open={drawer} onOpenChange={setDrawer}>
          {list(() => setDrawer(false))}
        </HistoryDrawer>
      )}
    </div>
  );
}

const INERT: TabActions = { onSelect: () => {}, onClose: () => {}, onNew: () => {}, onOpen: () => {}, onDelete: () => {} };

/** the tabs as a page will land on a question still on its way there: drawn from the stores, not live */
export function TabsFrame({ path, chain, question, children }: { path: string; chain: string; question: string; children: React.ReactNode }) {
  const view = landOn(readTabs(path), [question], chain, "boot");
  return (
    <TabsView tabs={view.tabs} active={view.active} entries={readHistory(path)} actions={INERT}>
      {children}
    </TabsView>
  );
}
