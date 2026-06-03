"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  Globe,
  Heart,
  Lock,
} from "lucide-react";
import ConfigurableChart from "@/components/stats/ConfigurableChart";
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
            <span className="pr-pg-row__tag">
              {dashboard.is_public ? (
                <>
                  <Globe size={12} /> Public
                </>
              ) : (
                <>
                  <Lock size={12} /> Private
                </>
              )}
            </span>
            <span>
              {chartCount} chart{chartCount === 1 ? "" : "s"}
            </span>
            {updated && <span>Updated {updated}</span>}
            <span className="pr-pg-row__tag">
              <Heart size={12} /> {(dashboard.favorite_count ?? 0).toLocaleString()}
            </span>
            <span className="pr-pg-row__tag">
              <Eye size={12} /> {(dashboard.view_count ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
        <Link
          href={`/stats/playground?id=${dashboard.id}`}
          className="pr-btn pr-btn--sm pr-btn--outline pr-pg-row__open"
        >
          Open in Playground
          <ExternalLink size={13} />
        </Link>
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
