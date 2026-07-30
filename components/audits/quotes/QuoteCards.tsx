"use client";

import type { OwnerQuote } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";
import { QuoteChipPill, chipsFor } from "@/components/audits/quotes/QuotesPanel";

interface QuoteCardsProps {
  quotes: OwnerQuote[];
  onAccept?: (quote: OwnerQuote) => void;
}

/** Card grid (design 1i); the forced view below 900px. */
export function QuoteCards({ quotes, onAccept }: QuoteCardsProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quotes.map((quote) => (
        <li
          key={quote.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#1F1F1F]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{quote.firm_name}</p>
            {quote.display_status !== "submitted" ? (
              <StatusBadge kind="quote" status={quote.display_status} />
            ) : null}
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatUsd(quote.price_usd)}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {quote.duration_weeks} weeks · starts {formatIsoDate(quote.earliest_start)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chipsFor(quote, quotes).map((chip) => (
              <QuoteChipPill key={chip.label} chip={chip} />
            ))}
          </div>
          {quote.message ? (
            <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-[#A2AFB2]">
              {quote.message}
            </p>
          ) : null}
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
