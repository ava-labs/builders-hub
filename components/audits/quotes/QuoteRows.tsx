"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CARD } from "@/components/audits/shared/classes";
import { HOVER_LIFT, ROW_ENTER } from "@/components/audits/shared/motion";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";
import { QuoteChipPill, chipsFor } from "@/components/audits/quotes/QuotesPanel";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Above this the tail collapses into a dashed summary row (board 1g). */
const VISIBLE_COLLAPSED = 3;

interface QuoteRowsProps {
  quotes: OwnerQuote[];
  onAccept?: (quote: OwnerQuote) => void;
}

/** Discrete competing cards · message-forward (design 1g). Sorted by price ascending. */
export function QuoteRows({ quotes, onAccept }: QuoteRowsProps) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = quotes.length > VISIBLE_COLLAPSED + 1;
  const visible = collapsible && !expanded ? quotes.slice(0, VISIBLE_COLLAPSED) : quotes;
  const hidden = collapsible && !expanded ? quotes.slice(VISIBLE_COLLAPSED) : [];

  return (
    <div>
      <ul className="space-y-2.5">
        {visible.map((quote, index) => (
          <li
            key={quote.id}
            className={cn(ROW_ENTER, "fill-mode-backwards")}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div
              className={cn(
                CARD,
                HOVER_LIFT,
                "grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-[15px_18px] hover:border-zinc-400 dark:hover:border-white/25",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-zinc-200 bg-zinc-100 font-mono text-[10px] font-bold text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300"
                  >
                    {initialsOf(quote.firm_name)}
                  </span>
                  <p className="font-semibold">{quote.firm_name}</p>
                  {chipsFor(quote, quotes).map((chip) => (
                    <QuoteChipPill key={chip.label} chip={chip} />
                  ))}
                  {quote.display_status !== "submitted" ? (
                    <StatusBadge kind="quote" status={quote.display_status} />
                  ) : null}
                </div>
                <p className="mt-2 max-w-[80ch] text-sm leading-relaxed text-zinc-600 dark:text-[#A2AFB2]">
                  {quote.message}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                <p className="font-mono text-xl font-bold tabular-nums">
                  {formatUsd(quote.price_usd)}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {quote.duration_weeks} weeks · starts {formatIsoDate(quote.earliest_start)}
                </p>
                {onAccept && quote.display_status === "submitted" ? (
                  <button
                    type="button"
                    onClick={() => onAccept(quote)}
                    className="mt-1 cursor-pointer rounded-lg border border-zinc-300 px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40"
                  >
                    Accept quote…
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {hidden.length > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2.5 flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-zinc-300 px-[18px] py-[11px] text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-700 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/40 dark:hover:text-zinc-200"
        >
          <span className="min-w-0 truncate">
            {hidden.length} more {hidden.length === 1 ? "quote" : "quotes"} ·{" "}
            {hidden.map((quote) => `${quote.firm_name} ${formatUsd(quote.price_usd)}`).join(" · ")}
          </span>
          <span aria-hidden className="ml-3 shrink-0">
            ⌄
          </span>
        </button>
      ) : null}
    </div>
  );
}
