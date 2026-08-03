import { cn } from "@/lib/utils";
import type { AdminOverview } from "@/server/services/audits/visibility";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { ROW_ENTER } from "@/components/audits/shared/motion";

const kUsd = (value: number) => `$${(value / 1000).toFixed(value >= 100_000 ? 0 : 1)}k`;

/** Stat tiles (design 1a + 2a). Every number is derived at read time; figures
 * live in the mono slot. The row is capped at SIX: a seventh wraps into an
 * orphan on its own line. The two things that wait on an admin are therefore
 * one "Waiting on you" tile whose sub-line carries the split, which also
 * makes the queue louder than two half-empty tiles did. */
export function OverviewTiles({ overview }: { overview: AdminOverview }) {
  const waiting = overview.pending_review_count + overview.needs_subsidy_count;
  const tiles = [
    {
      label: "Waiting on you",
      value: String(waiting),
      sub: `${overview.pending_review_count} to approve · ${overview.needs_subsidy_count} to subsidize`,
      tone: waiting > 0 ? ("amber" as const) : undefined,
    },
    {
      label: "Open requests",
      value: String(overview.open_requests),
      sub: `${overview.open_closing_this_week} close this week`,
    },
    {
      label: "Quotes collected",
      value: String(overview.quotes_collected),
      sub:
        overview.open_requests > 0
          ? `${(overview.quotes_collected / overview.open_requests).toFixed(1)} avg per open request`
          : "across the program",
    },
    {
      label: "Median quote",
      value: overview.median_quote_usd ? kUsd(overview.median_quote_usd) : "·",
      sub: "across open requests",
    },
    {
      label: "Engaged via marketplace",
      value: String(overview.engaged_count),
      sub: "since launch",
    },
    {
      label: "Fees not paid to Areta",
      value: kUsd(overview.fees_not_paid_usd),
      sub: "10% of engaged volume",
      tone: "green" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {tiles.map((tile, index) => (
        // Entrance stagger only (round-4 M4-A): the inbox recipe, no hover
        // lift · these tiles are not clickable.
        <div
          key={tile.label}
          className={cn(CARD, ROW_ENTER, "fill-mode-backwards rounded-[10px] p-[13px_15px]")}
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <p className={MONO_LABEL_SM}>{tile.label}</p>
          <p
            className={cn(
              "mt-2 font-mono text-2xl font-bold tabular-nums",
              tile.tone === "green" && "text-emerald-700 dark:text-emerald-400",
              tile.tone === "amber" && "text-amber-700 dark:text-amber-400",
            )}
          >
            {tile.value}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tile.sub}</p>
        </div>
      ))}
    </div>
  );
}
