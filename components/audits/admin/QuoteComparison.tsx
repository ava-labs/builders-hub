import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AdminRequestDetail } from "@/server/services/audits/visibility";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";

/**
 * Every quote side by side (design 1b): price bars in a single info-blue
 * hue, the project's pick tinted blue, NEVER red (red is not a status here).
 */
export function QuoteComparison({ quotes }: { quotes: AdminRequestDetail["quotes"] }) {
  if (quotes.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        No quotes yet.
      </p>
    );
  }
  const highest = Math.max(...quotes.map((quote) => quote.price_usd));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Auditor</TableHead>
            <TableHead>Price ↑</TableHead>
            <TableHead className="min-w-28">Vs highest</TableHead>
            <TableHead>Weeks</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => {
            const isPick = quote.status === "accepted";
            return (
              <TableRow key={quote.id} className={cn(isPick && "bg-info/5")}>
                <TableCell>
                  <span className="font-medium">{quote.firm_name}</span>
                  {isPick ? (
                    <span className="ml-2 inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-info dark:text-info-soft">
                      Project&apos;s pick
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {formatUsd(quote.price_usd)}
                </TableCell>
                <TableCell>
                  <div className="h-1.5 w-full min-w-20 rounded-full bg-zinc-100 dark:bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-info dark:bg-info-soft"
                      style={{ width: `${Math.round((quote.price_usd / highest) * 100)}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{quote.duration_weeks}</TableCell>
                <TableCell className="font-mono text-sm">
                  {formatIsoDate(quote.earliest_start)}
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {quote.message}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
