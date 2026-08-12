"use client";

import { Card } from "@/components/ui/card";

// Version data structure
export interface VersionData {
  nodes: number;
  stakeString?: string;
}

export interface VersionBreakdownData {
  byClientVersion: Record<string, VersionData>;
  totalStakeString?: string;
}

// Compare semantic versions
export function compareVersions(v1: string, v2: string): number {
  if (v1 === "Unknown") return -1;
  if (v2 === "Unknown") return 1;

  const extractNumbers = (v: string) => {
    const match = v.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  };

  const [major1, minor1, patch1] = extractNumbers(v1);
  const [major2, minor2, patch2] = extractNumbers(v2);

  if (major1 !== major2) return major1 - major2;
  if (minor1 !== minor2) return minor1 - minor2;
  return patch1 - patch2;
}

// Calculate version stats
export function calculateVersionStats(
  versionBreakdown: VersionBreakdownData | null,
  minVersion: string
) {
  if (!versionBreakdown || !minVersion) {
    return {
      totalNodes: 0,
      nodesPercentAbove: 0,
      stakePercentAbove: 0,
      aboveTargetNodes: 0,
      belowTargetNodes: 0,
    };
  }

  const totalStake = versionBreakdown.totalStakeString 
    ? BigInt(versionBreakdown.totalStakeString) 
    : 0n;
  let aboveTargetNodes = 0;
  let belowTargetNodes = 0;
  let aboveTargetStake = 0n;

  Object.entries(versionBreakdown.byClientVersion).forEach(([version, data]) => {
    const isAboveTarget = compareVersions(version, minVersion) >= 0;
    if (isAboveTarget) {
      aboveTargetNodes += data.nodes;
      if (data.stakeString) {
        aboveTargetStake += BigInt(data.stakeString);
      }
    } else {
      belowTargetNodes += data.nodes;
    }
  });

  const totalNodes = aboveTargetNodes + belowTargetNodes;
  const nodesPercentAbove = totalNodes > 0 ? (aboveTargetNodes / totalNodes) * 100 : 0;
  const stakePercentAbove = totalStake > 0n
    ? Number((aboveTargetStake * 10000n) / totalStake) / 100
    : 0;

  return {
    totalNodes,
    aboveTargetNodes,
    belowTargetNodes,
    nodesPercentAbove,
    stakePercentAbove,
    isStakeHealthy: stakePercentAbove >= 80,
  };
}

/* Segment/legend tone, shared by the bar and its labels so they always
   agree. Above-target stays the single health green; below-target versions
   get a zinc ramp (newer = darker) so adjacent segments stay tellable
   apart from each other AND from the empty track; Unknown clients get
   amber — they're a "can't verify" flag, not just another old version. */
function versionTone(version: string, isAboveTarget: boolean, belowRank: number): string {
  if (isAboveTarget) return "bg-green-700 dark:bg-green-600";
  if (version === "Unknown") return "bg-amber-400 dark:bg-amber-500";
  const ramp = [
    "bg-zinc-500 dark:bg-zinc-400",
    "bg-zinc-400 dark:bg-zinc-500",
    "bg-zinc-300 dark:bg-zinc-600",
  ];
  return ramp[Math.min(belowRank, ramp.length - 1)];
}

interface VersionBarChartProps {
  versionBreakdown: VersionBreakdownData;
  minVersion: string;
  totalNodes: number;
  height?: string;
}

/**
 * Horizontal bar chart showing version distribution
 */
export function VersionBarChart({ 
  versionBreakdown, 
  minVersion, 
  totalNodes,
  height = "h-6",
}: VersionBarChartProps) {
  let belowRank = 0;
  return (
    <div className={`flex ${height} w-full gap-px overflow-hidden bg-zinc-100 dark:bg-zinc-900`}>
      {Object.entries(versionBreakdown.byClientVersion)
        .sort(([v1], [v2]) => compareVersions(v2, v1))
        .map(([version, data]) => {
          const percentage = totalNodes > 0 ? (data.nodes / totalNodes) * 100 : 0;
          const isAboveTarget = compareVersions(version, minVersion) >= 0;
          const tone = versionTone(version, isAboveTarget, isAboveTarget ? 0 : belowRank++);
          return (
            <div
              key={version}
              className={`h-full transition-all ${tone}`}
              style={{ width: `${percentage}%` }}
              title={`${version}: ${data.nodes} nodes (${percentage.toFixed(1)}%)`}
            />
          );
        })}
    </div>
  );
}

interface VersionLabelsProps {
  versionBreakdown: VersionBreakdownData;
  minVersion: string;
  totalNodes: number;
  showPercentage?: boolean;
  size?: "sm" | "md";
}

/**
 * Version labels with colored dots
 */
export function VersionLabels({ 
  versionBreakdown, 
  minVersion, 
  totalNodes,
  showPercentage = true,
  size = "sm",
}: VersionLabelsProps) {
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const dotSize = size === "sm" ? "h-2 w-2" : "h-3 w-3";
  let belowRank = 0;

  return (
    <div className={`flex flex-wrap gap-x-2 gap-y-1 ${textSize}`}>
      {Object.entries(versionBreakdown.byClientVersion)
        .sort(([v1], [v2]) => compareVersions(v2, v1))
        .map(([version, data]) => {
          const isAboveTarget = compareVersions(version, minVersion) >= 0;
          const percentage = totalNodes > 0 ? (data.nodes / totalNodes) * 100 : 0;
          return (
            <div key={version} className="flex items-center gap-1">
              <div
                className={`${dotSize} rounded-full flex-shrink-0 ${versionTone(
                  version,
                  isAboveTarget,
                  isAboveTarget ? 0 : belowRank++,
                )}`}
              />
              <span
                className={`font-mono ${
                  isAboveTarget
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {version}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">
                ({data.nodes}{showPercentage ? ` - ${percentage.toFixed(1)}%` : ''})
              </span>
            </div>
          );
        })}
    </div>
  );
}

interface VersionBreakdownCardProps {
  versionBreakdown: VersionBreakdownData;
  availableVersions: string[];
  minVersion: string;
  onVersionChange: (version: string) => void;
  totalValidators: number;
  title?: string;
  description?: string;
}

/**
 * Full version breakdown card with selector, bar chart, and labels
 */
export function VersionBreakdownCard({
  versionBreakdown,
  availableVersions,
  minVersion,
  onVersionChange,
  totalValidators,
  title = "Version Breakdown",
  description = "Distribution of validator versions",
}: VersionBreakdownCardProps) {
  return (
    <Card className="py-0 rounded-none shadow-none border-zinc-200 !bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:!bg-zinc-950/80">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="version-select"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500 whitespace-nowrap"
            >
              Target Version:
            </label>
            <select
              id="version-select"
              value={minVersion}
              onChange={(e) => onVersionChange(e.target.value)}
              className="px-3 py-1 bg-transparent border border-zinc-200 dark:border-zinc-800 font-mono text-[12px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
            >
              {availableVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-4">
          <VersionBarChart
            versionBreakdown={versionBreakdown}
            minVersion={minVersion}
            totalNodes={totalValidators}
            height="h-8"
          />
          <VersionLabels
            versionBreakdown={versionBreakdown}
            minVersion={minVersion}
            totalNodes={totalValidators}
            showPercentage={true}
            size="md"
          />
        </div>
      </div>
    </Card>
  );
}

interface VersionBreakdownInlineProps {
  versions: Record<string, { nodes: number }>;
  minVersion: string;
  limit?: number;
}

/**
 * Inline version breakdown for hero sections (shows top N versions).
 * Dots take their tone from versionTone, the same mapping the stacked bar
 * paints with: this legend always sits under a VersionBarChart, so an
 * index-rainbow here described a bar drawn in a different language.
 */
export function VersionBreakdownInline({
  versions,
  minVersion,
  limit = 5,
}: VersionBreakdownInlineProps) {
  let belowRank = 0;
  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8">
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Version Breakdown:
        </span>
      </div>
      {Object.entries(versions)
        .sort(([v1], [v2]) => compareVersions(v2, v1))
        .slice(0, limit)
        .map(([version, data]) => {
          const isAboveTarget = compareVersions(version, minVersion) >= 0;
          return (
            <div key={version} className="flex items-center gap-1.5">
              <div
                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${versionTone(
                  version,
                  isAboveTarget,
                  isAboveTarget ? 0 : belowRank++,
                )}`}
              />
              <span
                className={`text-xs sm:text-sm font-mono ${
                  isAboveTarget
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {version}
              </span>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                ({data.nodes})
              </span>
            </div>
          );
        })}
    </div>
  );
}

