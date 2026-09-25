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
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";
import { QuoteDocLink } from "@/components/audits/quotes/QuoteDocLink";

/* zinc row hairlines + hover (ledger L-8): the ui/table defaults inject
   slate-tinted semantic tokens inside this zinc card. */
const ROW = "border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.03]";

interface QuoteComparisonProps {
  quotes: AdminRequestDetail["quotes"];
  fanoutCount: number;
  submittedAt: Date | null;
  quoteDeadline: Date | null;
  displayStatus: string;
  neededBy: Date | null;
}

/**
 * Every quote side by side (design 1b): the card owns its header row, price
 * bars run a single brand-blue hue with the TOP price de-emphasized, the
 * project's pick is a quiet mono sub-label · NEVER red (red is not a status
 * here), and starts outside the requested window carry the ⚠ flag.
 */
export function QuoteComparison({
  quotes,
  fanoutCount,
  submittedAt,
  quoteDeadline,
  displayStatus,
  neededBy,
}: QuoteComparisonProps) {
  // Before approval there has been no fan-out and no window, so the usual
  // "fan-out {date} · window closed {date}" line would state two things that
  // never happened.
  const awaitingReview = displayStatus === "pending_review";
  const headerMeta = awaitingReview
    ? [
        ...(submittedAt ? [`submitted ${formatIsoDate(submittedAt)}`] : []),
        "no firm notified yet",
      ].join(" · ")
    : [
        ...(submittedAt ? [`fan-out ${formatIsoDate(submittedAt)}`] : []),
        ...(quoteDeadline
          ? [
              `window ${displayStatus === "collecting" ? "closes" : "closed"} ${formatIsoDate(quoteDeadline)}`,
            ]
          : []),
      ].join(" · ");

  if (quotes.length === 0) {
    return (
      <div className={CARD}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <p className="text-sm font-semibold">
            {awaitingReview ? "Quotes · awaiting approval" : `Quotes · 0 of ${fanoutCount} firms responded`}
          </p>
          {headerMeta ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{headerMeta}</p>
          ) : null}
        </div>
        <p className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
          {awaitingReview
            ? "Firms can quote as soon as you approve this request."
            : "No quotes yet."}
        </p>
      </div>
    );
  }

  const highest = Math.max(...quotes.map((quote) => quote.price_usd));
  const neededByTime = neededBy ? new Date(neededBy).getTime() : null;

  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-semibold">
          Quotes · {quotes.length} of {fanoutCount} firms responded
        </p>
        {headerMeta ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{headerMeta}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.02]">
              <TableHead className={cn(MONO_LABEL_SM, "px-4")}>Auditor</TableHead>
              <TableHead className={MONO_LABEL_SM}>Price ↑</TableHead>
              <TableHead className={cn(MONO_LABEL_SM, "min-w-28")}>Vs highest</TableHead>
              <TableHead className={MONO_LABEL_SM}>Weeks</TableHead>
              <TableHead className={MONO_LABEL_SM}>Start</TableHead>
              <TableHead className={MONO_LABEL_SM}>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const isPick = quote.status === "accepted";
              const isHighest = quotes.length > 1 && quote.price_usd === highest;
              const outside =
                neededByTime !== null &&
                new Date(quote.earliest_start).getTime() > neededByTime;
              return (
                <TableRow
                  key={quote.id}
                  className={cn(ROW, isPick && "bg-info/5", !isPick && isHighest && "opacity-75")}
                >
                  <TableCell className="px-4">
                    <span className="font-medium">{quote.firm_name}</span>
                    {isPick ? (
                      <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.08em] text-info dark:text-info-soft">
                        Project&apos;s pick
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-semibold tabular-nums">
                    {formatUsd(quote.price_usd)}
                  </TableCell>
                  <TableCell>
                    <div className="h-2 w-full min-w-20 rounded-[4px] bg-zinc-100 dark:bg-white/[0.06]">
                      <div
                        className={cn("h-2 rounded-[4px]", isHighest ? "bg-info-soft" : "bg-bar")}
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
                    {outside ? <span aria-label="outside the requested window"> ⚠</span> : null}
                  </TableCell>
                  {/* w-full + max-w-0 is the trick that makes a table cell
                      actually shrink (auto layout ignores max-w-64), so the
                      clamp can bite instead of running off the card edge
                      (round-4 L4-3). */}
                  <TableCell className="w-full min-w-56 max-w-0">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="line-clamp-2 min-w-0 flex-1 text-xs text-zinc-500 dark:text-zinc-400"
                        title={outside ? undefined : quote.message}
                      >
                        {outside ? "Start is outside the requested window" : quote.message}
                      </span>
                      <QuoteDocLink url={quote.deal_doc_url} variant="cell" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
