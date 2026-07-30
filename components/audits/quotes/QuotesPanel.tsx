"use client";

import type { OwnerQuote } from "@/server/services/audits/visibility";
import { ViewSwitcher, useQuoteViewPreference } from "@/components/audits/shared/ViewSwitcher";
import { QuoteRows } from "@/components/audits/quotes/QuoteRows";
import { QuoteTable } from "@/components/audits/quotes/QuoteTable";
import { QuoteCards } from "@/components/audits/quotes/QuoteCards";

export type QuoteChip = { label: string; tone: "info" | "positive" };

/**
 * Callout chips are objective facts only (lowest price, earliest start,
 * re-audit included): the marketplace never recommends a firm.
 */
export function chipsFor(quote: OwnerQuote, quotes: OwnerQuote[]): QuoteChip[] {
  const chips: QuoteChip[] = [];
  if (quotes.length > 1) {
    const lowest = Math.min(...quotes.map((q) => q.price_usd));
    const earliest = Math.min(...quotes.map((q) => new Date(q.earliest_start).getTime()));
    if (quote.price_usd === lowest) chips.push({ label: "Lowest price", tone: "info" });
    if (new Date(quote.earliest_start).getTime() === earliest) {
      chips.push({ label: "Earliest start", tone: "info" });
    }
  }
  if (quote.reaudit_included) chips.push({ label: "Re-audit included", tone: "positive" });
  return chips;
}

interface QuotesPanelProps {
  quotes: OwnerQuote[];
  userId: string;
  /** The reveal line under the list (collecting/deciding states). */
  showAcceptNote?: boolean;
}

export function QuotesPanel({ quotes, userId, showAcceptNote = false }: QuotesPanelProps) {
  const { view, setView, forcedCards } = useQuoteViewPreference(userId);

  if (quotes.length === 0) return null;

  return (
    <section aria-label="Quotes">
      <div className="mb-3 flex items-center justify-end">
        <ViewSwitcher value={view} onChange={setView} disabled={forcedCards} />
      </div>
      {view === "rows" && <QuoteRows quotes={quotes} />}
      {view === "table" && <QuoteTable quotes={quotes} />}
      {view === "cards" && <QuoteCards quotes={quotes} />}
      {showAcceptNote ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Accepting reveals contact details both ways, closes the request, and notifies the other
          firms automatically.
        </p>
      ) : null}
    </section>
  );
}

export function QuoteChipPill({ chip }: { chip: QuoteChip }) {
  const tone =
    chip.tone === "positive"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "border-info/30 bg-info/10 text-info dark:text-info-soft";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}
    >
      {chip.label}
    </span>
  );
}
