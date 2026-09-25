"use client";

import { useState } from "react";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { ViewSwitcher, useQuoteViewPreference } from "@/components/audits/shared/ViewSwitcher";
import { formatUsd } from "@/components/audits/shared/format";
import { QuoteRows } from "@/components/audits/quotes/QuoteRows";
import { QuoteTable } from "@/components/audits/quotes/QuoteTable";
import { QuoteCards } from "@/components/audits/quotes/QuoteCards";
import { AcceptQuoteDialog } from "@/components/audits/quotes/AcceptQuoteDialog";

export type QuoteChip = { label: string };

/**
 * Callout chips are objective facts only (lowest price, earliest start):
 * the marketplace never recommends a firm.
 */
export function chipsFor(quote: OwnerQuote, quotes: OwnerQuote[]): QuoteChip[] {
  const chips: QuoteChip[] = [];
  if (quotes.length > 1) {
    const lowest = Math.min(...quotes.map((q) => q.price_usd));
    const earliest = Math.min(...quotes.map((q) => new Date(q.earliest_start).getTime()));
    if (quote.price_usd === lowest) chips.push({ label: "Lowest price" });
    if (new Date(quote.earliest_start).getTime() === earliest) {
      chips.push({ label: "Earliest start" });
    }
  }
  return chips;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

interface QuotesPanelProps {
  quotes: OwnerQuote[];
  userId: string;
  /** Request-level date; the table flags starts outside it (board 1h). */
  neededBy?: string | Date | null;
  /** The reveal line under the list (collecting/deciding states). */
  showAcceptNote?: boolean;
  /** When set, quotes carry the quiet accept affordance (dialog holds the red). */
  acceptRequestId?: string | null;
}

export function QuotesPanel({
  quotes,
  userId,
  neededBy = null,
  showAcceptNote = false,
  acceptRequestId = null,
}: QuotesPanelProps) {
  const { view, setView } = useQuoteViewPreference(userId);
  const [accepting, setAccepting] = useState<OwnerQuote | null>(null);

  if (quotes.length === 0) return null;

  const onAccept = acceptRequestId ? (quote: OwnerQuote) => setAccepting(quote) : undefined;
  const prices = quotes.map((quote) => quote.price_usd);
  const summary =
    quotes.length > 1
      ? `${quotes.length} quotes · ${formatUsd(Math.min(...prices))}–${formatUsd(Math.max(...prices))} · median ${formatUsd(median(prices))}`
      : `1 quote · ${formatUsd(prices[0])}`;

  return (
    <section aria-label="Quotes">
      {/* Title row (board 2a): summary + switcher live WITH the content they control. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[17px] font-bold tracking-tight">Quotes</h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {summary}
        </p>
        <span className="flex-1" />
        <ViewSwitcher value={view} onChange={setView} />
      </div>
      {/* Every view receives neededBy (round-5 5a): the out-of-window warning
          was table-only, so rows/cards users and everyone on mobile missed it. */}
      {view === "rows" && <QuoteRows quotes={quotes} neededBy={neededBy} onAccept={onAccept} />}
      {view === "table" && <QuoteTable quotes={quotes} neededBy={neededBy} onAccept={onAccept} />}
      {view === "cards" && <QuoteCards quotes={quotes} neededBy={neededBy} onAccept={onAccept} />}
      {showAcceptNote ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Accepting reveals contact details both ways, closes the request, and notifies the other
          firms automatically.
        </p>
      ) : null}
      {acceptRequestId ? (
        <AcceptQuoteDialog
          requestId={acceptRequestId}
          quote={accepting}
          otherCount={Math.max(0, quotes.length - 1)}
          onClose={() => setAccepting(null)}
        />
      ) : null}
    </section>
  );
}

export function QuoteChipPill({ chip }: { chip: QuoteChip }) {
  return (
    <span className="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-info dark:text-info-soft">
      {chip.label}
    </span>
  );
}
