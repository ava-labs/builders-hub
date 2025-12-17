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

// Color palette for version breakdown
export const versionColors = [
  "bg-blue-500 dark:bg-blue-600",
  "bg-purple-500 dark:bg-purple-600",
  "bg-pink-500 dark:bg-pink-600",
  "bg-indigo-500 dark:bg-indigo-600",
  "bg-cyan-500 dark:bg-cyan-600",
  "bg-teal-500 dark:bg-teal-600",
  "bg-emerald-500 dark:bg-emerald-600",
  "bg-lime-500 dark:bg-lime-600",
  "bg-yellow-500 dark:bg-yellow-600",
  "bg-amber-500 dark:bg-amber-600",
  "bg-orange-500 dark:bg-orange-600",
  "bg-red-500 dark:bg-red-600",
];

export function getVersionColor(index: number): string {
  return versionColors[index % versionColors.length];
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
  return (
    <div className={`flex ${height} w-full rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800`}>
      {Object.entries(versionBreakdown.byClientVersion)
        .sort(([v1], [v2]) => compareVersions(v2, v1))
        .map(([version, data]) => {
          const percentage = totalNodes > 0 ? (data.nodes / totalNodes) * 100 : 0;
          const isAboveTarget = compareVersions(version, minVersion) >= 0;
          return (
            <div
              key={version}
              className={`h-full transition-all ${
                isAboveTarget
                  ? "bg-green-700 dark:bg-green-800"
                  : "bg-gray-200 dark:bg-gray-500"
              }`}
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
                className={`${dotSize} rounded-full flex-shrink-0 ${
                  isAboveTarget
                    ? "bg-green-700 dark:bg-green-800"
                    : "bg-gray-200 dark:bg-gray-500"
                }`}
              />
              <span
                className={`font-mono ${
                  isAboveTarget
                    ? "text-black dark:text-white"
                    : "text-neutral-500 dark:text-neutral-500"
                }`}
              >
                {version}
              </span>
              <span className="text-neutral-500 dark:text-neutral-500">
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
    <Card className="border border-[#e1e2ea] dark:border-neutral-800 bg-[#fcfcfd] dark:bg-neutral-900 py-0">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-white">
              {title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="version-select"
              className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
            >
              Target Version:
            </label>
            <select
              id="version-select"
              value={minVersion}
              onChange={(e) => onVersionChange(e.target.value)}
              className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-colors"
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
 * Inline version breakdown for hero sections (shows top N versions)
 */
export function VersionBreakdownInline({
  versions,
  minVersion,
  limit = 5,
}: VersionBreakdownInlineProps) {
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
        .map(([version, data], index) => (
          <div key={version} className="flex items-center gap-1.5">
            <div
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getVersionColor(index)}`}
            />
            <span className="text-xs sm:text-sm font-mono text-zinc-700 dark:text-zinc-300">
              {version}
            </span>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              ({data.nodes})
            </span>
          </div>
        ))}
    </div>
  );
}

