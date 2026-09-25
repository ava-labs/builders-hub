"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { HOVER_LIFT, ROW_ENTER } from "@/components/audits/shared/motion";
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

/** Above this the tail collapses into a dashed summary row (board 1g). */
const VISIBLE_COLLAPSED = 3;

/** Terms-strip cell: label above value from sm, label + value on one line
    below it, so the strip stays scannable at 375 without a forced view. */
function TermCell({
  label,
  divided = false,
  children,
}: {
  label: string;
  divided?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-3.5 py-2.5 sm:block",
        divided &&
          "border-zinc-200 max-sm:border-t sm:border-l dark:border-white/[0.08]",
      )}
    >
      <p className={MONO_LABEL_SM}>{label}</p>
      <div className="text-right font-mono text-[13px] sm:mt-0.5 sm:text-left">{children}</div>
    </div>
  );
}

interface QuoteRowsProps {
  quotes: OwnerQuote[];
  /** Request-level date; starts after it get the ⚠ treatment (round-5 5a). */
  neededBy?: string | Date | null;
  onAccept?: (quote: OwnerQuote) => void;
}

/** The reading view (round-5 dossier): identity + chips, price with a factual
    delta, an aligned terms strip, the message as body text, and the proposal
    as a first-class footer action. Sorted by price ascending. */
export function QuoteRows({ quotes, neededBy = null, onAccept }: QuoteRowsProps) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = quotes.length > VISIBLE_COLLAPSED + 1;
  const visible = collapsible && !expanded ? quotes.slice(0, VISIBLE_COLLAPSED) : quotes;
  const hidden = collapsible && !expanded ? quotes.slice(VISIBLE_COLLAPSED) : [];
  const lowest = Math.min(...quotes.map((quote) => quote.price_usd));

  return (
    <div>
      <ul className="space-y-2.5">
        {visible.map((quote, index) => {
          const outside = isOutsideWindow(quote.earliest_start, neededBy);
          const delta = quotes.length > 1 ? priceDeltaLabel(quote.price_usd, lowest) : null;
          return (
            <li
              key={quote.id}
              className={cn(ROW_ENTER, "fill-mode-backwards")}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div
                className={cn(
                  CARD,
                  HOVER_LIFT,
                  "p-[15px_18px] hover:border-zinc-400 dark:hover:border-white/25",
                )}
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                  <div className="ml-auto shrink-0 text-right">
                    <p className="font-mono text-xl font-bold tabular-nums">
                      {formatUsd(quote.price_usd)}
                    </p>
                    {delta ? (
                      <p className="mt-0.5 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
                        {delta}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid rounded-[10px] border border-zinc-200 sm:grid-cols-2 dark:border-white/10">
                  <TermCell label="Duration">{weeksLabel(quote.duration_weeks)}</TermCell>
                  <TermCell label="Can start" divided>
                    <span className={cn(outside && "text-brand-deep dark:text-brand-soft")}>
                      {formatIsoDate(quote.earliest_start)}
                      {outside ? <span aria-label="outside your window"> ⚠</span> : null}
                    </span>
                    {outside ? (
                      <span className="block font-mono text-[9.5px] uppercase tracking-[0.08em] text-brand-deep dark:text-brand-soft">
                        outside your window
                      </span>
                    ) : null}
                  </TermCell>
                </div>

                {quote.message ? <QuoteMessage message={quote.message} /> : null}

                <div className="mt-3.5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <QuoteDocLink url={quote.deal_doc_url} />
                  <span className="hidden flex-1 sm:block" />
                  {onAccept && quote.display_status === "submitted" ? (
                    <button
                      type="button"
                      onClick={() => onAccept(quote)}
                      className="h-11 cursor-pointer rounded-lg border border-zinc-300 px-3.5 text-sm font-medium transition-colors hover:border-zinc-500 sm:h-9 dark:border-white/15 dark:hover:border-white/40"
                    >
                      Accept quote…
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
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
