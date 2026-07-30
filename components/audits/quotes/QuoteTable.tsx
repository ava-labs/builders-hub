"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";

/** Comparison table · numbers-forward (design 1h). Bars in info blue, never red. */
export function QuoteTable({ quotes }: { quotes: OwnerQuote[] }) {
  const highest = Math.max(...quotes.map((quote) => quote.price_usd));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Auditor</TableHead>
            <TableHead>Price ↑</TableHead>
            <TableHead className="min-w-32">Vs highest</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Can start</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => (
            <TableRow key={quote.id}>
              <TableCell>
                <p className="font-medium">{quote.firm_name}</p>
                {quote.message ? (
                  <p className="mt-0.5 max-w-64 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {quote.message}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="font-semibold tabular-nums">
                {formatUsd(quote.price_usd)}
              </TableCell>
              <TableCell>
                <div className="h-1.5 w-full min-w-24 rounded-full bg-zinc-100 dark:bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-info dark:bg-info-soft"
                    style={{ width: `${Math.round((quote.price_usd / highest) * 100)}%` }}
                  />
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{quote.duration_weeks} wk</TableCell>
              <TableCell className="font-mono text-sm">
                {formatIsoDate(quote.earliest_start)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
