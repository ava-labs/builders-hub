"use client";

/* Query history: this page's past threads, newest first, by day, as the
   past chats beside a chat app's conversation. An entry opens in a tab
   (in the tab that holds it already, if one does), and the reader can
   delete it. A column on a wide screen, a drawer on a narrow one
   (query-tab-strip.tsx). */

import { useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { type HistoryEntry, byDay, threadOf } from "@/lib/explorer-query/threads";
import { FILTER_MARK } from "./query-client";

/** a question as a tab or history names it: its words, without the filter the page added to them */
export function questionName(q: string): string {
  return q.split(FILTER_MARK)[0].trim();
}

const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500";

export function HistoryList({
  entries,
  current,
  onOpen,
  onDelete,
}: {
  entries: HistoryEntry[];
  /** the entry the tab in view holds */
  current: string | null;
  onOpen: (e: HistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const id = useId();
  const groups = byDay(entries, Date.now());
  return (
    // a div, not a nav: the site's navbar rules (global.css) style every nav's divs and buttons
    <div role="navigation" aria-label="Query history" className="flex flex-col gap-5">
      {groups.length === 0 && <p className="px-2.5 font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">Questions you ask show here.</p>}
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1">
          <span id={`${id}-${g.label}`} className={cn(LABEL, "px-2.5")}>
            {g.label}
          </span>
          <ul aria-labelledby={`${id}-${g.label}`} className="flex flex-col">
            {g.entries.map((e) => {
              const [q = "", ...then] = threadOf(e.kept).map(questionName);
              const on = e.id === current;
              return (
                <li key={e.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onOpen(e)}
                    aria-current={on ? "true" : undefined}
                    title={[q, ...then].join(" / ")}
                    className={cn(
                      "flex w-full min-w-0 flex-col gap-0.5 rounded-lg py-2 pl-2.5 pr-8 text-left transition-colors",
                      on ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60",
                    )}
                  >
                    <span className={cn("truncate text-[13px] leading-snug", on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300")}>{q}</span>
                    {then.length > 0 && <span className="truncate font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">/ {then.join(" / ")}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    aria-label={`Delete ${q}`}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200/70 hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** history on a narrow screen: a drawer from the left, over the page */
export function HistoryDrawer({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal>
      <SheetContent side="left" aria-describedby={undefined} className="w-[85%] max-w-xs gap-0 overflow-y-auto border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950">
        <SheetTitle className={cn(LABEL, "px-5 pb-4 pt-5 text-zinc-500 dark:text-zinc-400")}>Query history</SheetTitle>
        <div className="px-2.5 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
