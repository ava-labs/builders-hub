import { type SubnetStats } from "@/types/validator-stats";
import { compareVersions } from "@/components/stats/VersionBreakdown";

export interface ValidatorStatsBreakdown {
  totalNodes: number;
  aboveTargetNodes: number;
  belowTargetNodes: number;
  nodesPercentAbove: number;
  stakePercentAbove: number;
  isStakeHealthy: boolean;
}

export function calculateValidatorStats(
  subnet: SubnetStats,
  minVersion: string
): ValidatorStatsBreakdown {
  const totalStake = BigInt(subnet.totalStakeString);
  let aboveTargetNodes = 0;
  let belowTargetNodes = 0;
  let aboveTargetStake = 0n;

  Object.entries(subnet.byClientVersion).forEach(([version, data]) => {
    const isAboveTarget = compareVersions(version, minVersion) >= 0;
    if (isAboveTarget) {
      aboveTargetNodes += data.nodes;
      aboveTargetStake += BigInt(data.stakeString);
    } else {
      belowTargetNodes += data.nodes;
    }
  });

  const totalNodes = aboveTargetNodes + belowTargetNodes;
  const nodesPercentAbove =
    totalNodes > 0 ? (aboveTargetNodes / totalNodes) * 100 : 0;
  const stakePercentAbove =
    totalStake > 0n
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

export function getHealthColor(percent: number): string {
  if (percent === 0) return "text-red-600 dark:text-red-400";
  if (percent < 80) return "text-orange-600 dark:text-orange-400";
  return "text-green-600 dark:text-green-400";
}
