"use client";

import type { OwnerQuote } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { formatIsoDate, formatUsd, weeksLabel } from "@/components/audits/shared/format";
import { QuoteChipPill, chipsFor } from "@/components/audits/quotes/QuotesPanel";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface QuoteCardsProps {
  quotes: OwnerQuote[];
  onAccept?: (quote: OwnerQuote) => void;
}

/** Card grid (design 1i); the forced view below 900px. Identical spec rows
    keep cards comparable: Duration / Can start / Re-audit render for EVERY
    card, so re-audit is visible even when no chip fires. */
export function QuoteCards({ quotes, onAccept }: QuoteCardsProps) {
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
              <dd className="font-mono text-[13px]">{formatIsoDate(quote.earliest_start)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-zinc-200 px-3.5 py-2.5 text-sm dark:border-white/[0.08]">
              <dt className="text-zinc-600 dark:text-[#A2AFB2]">Re-audit of fixes</dt>
              <dd className="font-mono text-[13px]">
                {quote.reaudit_included ? "Included" : "Not included"}
              </dd>
            </div>
          </dl>
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
