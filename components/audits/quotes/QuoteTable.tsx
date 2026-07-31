"use client";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";

interface QuoteTableProps {
  quotes: OwnerQuote[];
  /** Request-level "needed by": starts after it get the ⚠ treatment (1h). */
  neededBy?: string | Date | null;
  onAccept?: (quote: OwnerQuote) => void;
}

/* zinc row hairlines + hover: the ui/table defaults inject slate-tinted
   semantic tokens inside this zinc card (ledger L-8). */
const ROW = "border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.03]";

/** Comparison table · numbers-forward (design 1h). Bars in brand blue, never red. */
export function QuoteTable({ quotes, neededBy = null, onAccept }: QuoteTableProps) {
  const highest = Math.max(...quotes.map((quote) => quote.price_usd));
  const neededByTime = neededBy ? new Date(neededBy).getTime() : null;
  const outOfWindow = (quote: OwnerQuote) =>
    neededByTime !== null && new Date(quote.earliest_start).getTime() > neededByTime;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.02]">
            <TableHead className={cn(MONO_LABEL_SM, "px-4")}>Auditor</TableHead>
            <TableHead className={MONO_LABEL_SM}>Price ↑</TableHead>
            <TableHead className={cn(MONO_LABEL_SM, "min-w-32")}>Vs highest</TableHead>
            <TableHead className={MONO_LABEL_SM}>Weeks</TableHead>
            <TableHead className={MONO_LABEL_SM}>Can start</TableHead>
            {onAccept ? <TableHead aria-label="Accept" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => {
            const isHighest = quotes.length > 1 && quote.price_usd === highest;
            const outside = outOfWindow(quote);
            return (
              <TableRow key={quote.id} className={cn(ROW, isHighest && "opacity-75")}>
                <TableCell className="px-4">
                  <p className={cn("font-medium", outside && "text-zinc-600 dark:text-zinc-300")}>
                    {quote.firm_name}
                  </p>
                  {outside ? (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Start is outside your requested window
                    </p>
                  ) : quote.message ? (
                    <p className="mt-0.5 max-w-64 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {quote.message}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-sm font-semibold tabular-nums">
                  {formatUsd(quote.price_usd)}
                </TableCell>
                <TableCell>
                  <div className="h-2 w-full min-w-24 rounded-[4px] bg-zinc-100 dark:bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-2 rounded-[4px]",
                        isHighest ? "bg-info-soft" : "bg-bar",
                      )}
                      style={{ width: `${Math.round((quote.price_usd / highest) * 100)}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{quote.duration_weeks}</TableCell>
                <TableCell
                  className={cn(
                    "font-mono text-sm",
                    outside && "text-brand-deep dark:text-brand-soft",
                  )}
                >
                  {formatIsoDate(quote.earliest_start)}
                  {outside ? <span aria-label="outside your window"> ⚠</span> : null}
                </TableCell>
                {onAccept ? (
                  <TableCell>
                    {quote.display_status === "submitted" ? (
                      <button
                        type="button"
                        onClick={() => onAccept(quote)}
                        className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40"
                      >
                        Accept…
                      </button>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
