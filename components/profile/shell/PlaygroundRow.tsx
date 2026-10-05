"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import ConfigurableChart from "@/components/stats/ConfigurableChart";
import { boardHref, playgroundBoardId } from "@/lib/explorer-query/board-links";
import { boardFromPlayground, PLAYGROUND_SCOPE } from "@/lib/explorer-query/playground";
import { normalizePlaygroundCharts } from "./normalizePlaygroundCharts";
import type { PlaygroundListItem } from "./PlaygroundsCard";

interface Props {
  dashboard: PlaygroundListItem;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PlaygroundRow({ dashboard }: Props) {
  const [expanded, setExpanded] = React.useState(false);

  // Charts ship with the list payload; normalize once (handles the new object
  // shape and the legacy bare array) rather than re-fetching on expand.
  const { charts, globalStartTime, globalEndTime } = React.useMemo(
    () => normalizePlaygroundCharts(dashboard.charts),
    [dashboard.charts],
  );

  const chartCount = charts.length;
  const updated = formatDate(dashboard.updated_at);
  // Query opens the dashboard as a board (lib/explorer-query/playground.ts).
  // A dashboard with no chart that draws makes no board, so it gets no link.
  const opensInQuery = React.useMemo(() => boardFromPlayground(dashboard) !== null, [dashboard]);
  const [network, chain] = PLAYGROUND_SCOPE.split(":");

  return (
    <div className="pr-pg-row">
      <div className="pr-pg-row__head">
        <button
          type="button"
          className="pr-pg-row__toggle"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse dashboard" : "Expand dashboard"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="pr-pg-row__meta">
          <span className="pr-pg-row__name">
            {dashboard.name || "Untitled dashboard"}
          </span>
          <div className="pr-pg-row__sub">
            <span>
              {chartCount} chart{chartCount === 1 ? "" : "s"}
            </span>
            {updated && <span>Updated {updated}</span>}
          </div>
        </div>
        {opensInQuery && (
          <Link
            href={boardHref(network, chain, playgroundBoardId(dashboard.id))}
            className="pr-btn pr-btn--sm pr-btn--outline pr-pg-row__open"
          >
            Open in Query
            <ExternalLink size={13} />
          </Link>
        )}
      </div>

      {expanded && (
        <div className="pr-pg-row__charts">
          {chartCount === 0 ? (
            <div className="pr-empty">This dashboard has no charts yet.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6">
              {charts.map((chart, idx) => (
                <div
                  key={chart.id || idx}
                  className={chart.colSpan === 6 ? "lg:col-span-6" : "lg:col-span-12"}
                >
                  <ConfigurableChart
                    title={chart.title}
                    colSpan={chart.colSpan}
                    initialDataSeries={chart.dataSeries || []}
                    initialStackSameMetrics={chart.stackSameMetrics || false}
                    initialAbbreviateNumbers={
                      chart.abbreviateNumbers !== undefined
                        ? chart.abbreviateNumbers
                        : true
                    }
                    initialBrushStartIndex={chart.brushStartIndex}
                    initialBrushEndIndex={chart.brushEndIndex}
                    startTime={chart.startTime || globalStartTime || null}
                    endTime={chart.endTime || globalEndTime || null}
                    disableControls
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
