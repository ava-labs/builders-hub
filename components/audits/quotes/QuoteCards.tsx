"use client";

import { cn } from "@/lib/utils";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import {
  formatIsoDate,
  formatUsd,
  isOutsideWindow,
  priceDeltaLabel,
  weeksLabel,
} from "@/components/audits/shared/format";
import { QuoteChipPill, chipsFor } from "@/components/audits/quotes/QuotesPanel";
import { QuoteDocLink } from "@/components/audits/quotes/QuoteDocLink";
import { QuoteMessage } from "@/components/audits/quotes/QuoteMessage";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface QuoteCardsProps {
  quotes: OwnerQuote[];
  /** Request-level date; starts after it get the ⚠ treatment (round-5 5a). */
  neededBy?: string | Date | null;
  onAccept?: (quote: OwnerQuote) => void;
}

/** Card grid (design 1i); the forced view below 900px. Identical spec rows
    keep cards comparable: Duration / Can start / Re-audit render for EVERY
    card, so re-audit is visible even when no chip fires. */
export function QuoteCards({ quotes, neededBy = null, onAccept }: QuoteCardsProps) {
  const lowest = Math.min(...quotes.map((quote) => quote.price_usd));
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quotes.map((quote) => (
        <li
          key={quote.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-white/10 dark:bg-[#1F1F1F] dark:hover:border-white/25"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-zinc-200 bg-zinc-100 font-mono text-[10px] font-bold text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300"
            >
              {initialsOf(quote.firm_name)}
            </span>
            <p className="font-semibold">{quote.firm_name}</p>
            {quote.display_status !== "submitted" ? (
              <StatusBadge kind="quote" status={quote.display_status} />
            ) : null}
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
            {formatUsd(quote.price_usd)}
          </p>
          {quotes.length > 1 && priceDeltaLabel(quote.price_usd, lowest) ? (
            <p className="mt-0.5 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
              {priceDeltaLabel(quote.price_usd, lowest)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chipsFor(quote, quotes).map((chip) => (
              <QuoteChipPill key={chip.label} chip={chip} />
            ))}
          </div>
          <dl className="mt-3 rounded-[10px] border border-zinc-200 dark:border-white/10">
            <div className="flex items-baseline justify-between gap-4 px-3.5 py-2.5 text-sm">
              <dt className="text-zinc-600 dark:text-[#A2AFB2]">Duration</dt>
              <dd className="font-mono text-[13px]">{weeksLabel(quote.duration_weeks)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-zinc-200 px-3.5 py-2.5 text-sm dark:border-white/[0.08]">
              <dt className="text-zinc-600 dark:text-[#A2AFB2]">Can start</dt>
              <dd
                className={cn(
                  "text-right font-mono text-[13px]",
                  isOutsideWindow(quote.earliest_start, neededBy) &&
                    "text-brand-deep dark:text-brand-soft",
                )}
              >
                {formatIsoDate(quote.earliest_start)}
                {isOutsideWindow(quote.earliest_start, neededBy) ? (
                  <>
                    <span aria-label="outside your window"> ⚠</span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.08em]">
                      outside your window
                    </span>
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
          {quote.message ? <QuoteMessage message={quote.message} /> : null}
          <div className="mt-3">
            <QuoteDocLink url={quote.deal_doc_url} />
          </div>
          {onAccept && quote.display_status === "submitted" ? (
            <button
              type="button"
              onClick={() => onAccept(quote)}
              className="mt-3 h-11 w-full cursor-pointer rounded-lg border border-zinc-300 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40 md:h-10"
            >
              Accept quote…
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
