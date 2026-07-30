"use client";

import type { OwnerQuote } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";
import { QuoteChipPill, chipsFor } from "@/components/audits/quotes/QuotesPanel";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Stacked rows · message-forward (design 1g). Sorted by price ascending. */
export function QuoteRows({ quotes }: { quotes: OwnerQuote[] }) {
  return (
    <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#1F1F1F]">
      {quotes.map((quote) => (
        <li key={quote.id} className="flex flex-wrap items-start gap-4 p-5">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
          >
            {initialsOf(quote.firm_name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{quote.firm_name}</p>
              {chipsFor(quote, quotes).map((chip) => (
                <QuoteChipPill key={chip.label} chip={chip} />
              ))}
              {quote.display_status !== "submitted" ? (
                <StatusBadge kind="quote" status={quote.display_status} />
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-[#A2AFB2]">{quote.message}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums">{formatUsd(quote.price_usd)}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {quote.duration_weeks} weeks · starts {formatIsoDate(quote.earliest_start)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
