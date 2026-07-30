import type { AdminOverview } from "@/server/services/audits/visibility";

const kUsd = (value: number) => `$${(value / 1000).toFixed(value >= 100_000 ? 0 : 1)}k`;

/** Stat tiles (design 1a). Every number is derived at read time. */
export function OverviewTiles({ overview }: { overview: AdminOverview }) {
  const tiles = [
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
      positive: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#1F1F1F]"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {tile.label}
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              tile.positive ? "text-emerald-600 dark:text-emerald-400" : ""
            }`}
          >
            {tile.value}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tile.sub}</p>
        </div>
      ))}
    </div>
  );
}
