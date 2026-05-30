"use client";
import { useMemo, useCallback } from "react";
import l1ChainsData from "@/constants/l1-chains.json";
import type { ChainNode as ICMChainNode } from "@/components/stats/ICMFlowChart";
import type {
  ChartDataPoint,
  ICMStats,
  ICTTStats,
  ICMFlowResponse,
  TopChainSummary,
  TopPeer,
} from "../_components/types";

interface UseFilteredIcmDataResult {
  chartData: ChartDataPoint[];
  topChains: TopChainSummary[];
  totalICMMessages: number;
  dailyICM: number;
  filteredIcmFlowData: ICMFlowResponse | null;
  filteredIcttData: ICTTStats | null;
  getTopPeers: (chainName: string) => TopPeer[];
}

// Single hook that owns every chains-filtered derivation rendered on the page:
// chart series, top-chain leaderboard, header totals, the rebuilt ICM flow
// graph, and ICTT transfer filtering. Centralized so we don't duplicate the
// `selectedChainNames.has(...)` predicate across five separate memos.
export function useFilteredIcmData(
  metrics: ICMStats | null,
  icttData: ICTTStats | null,
  icmFlowData: ICMFlowResponse | null,
  selectedChainNames: Set<string>
): UseFilteredIcmDataResult {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!metrics?.aggregatedData) return [];

    return metrics.aggregatedData
      .map((point) => {
        const filteredBreakdown: Record<string, number> = {};
        let filteredTotal = 0;

        Object.entries(point.chainBreakdown).forEach(([chainName, count]) => {
          if (selectedChainNames.has(chainName)) {
            filteredBreakdown[chainName] = count;
            filteredTotal += count;
          }
        });

        return {
          day: point.date,
          value: filteredTotal,
          chainBreakdown: filteredBreakdown,
        };
      })
      .reverse();
  }, [metrics?.aggregatedData, selectedChainNames]);

  const topChains = useMemo<TopChainSummary[]>(() => {
    if (!metrics?.aggregatedData) return [];

    const chainTotals: Record<string, number> = {};
    metrics.aggregatedData.forEach((point) => {
      Object.entries(point.chainBreakdown).forEach(([chainName, count]) => {
        if (selectedChainNames.has(chainName)) {
          chainTotals[chainName] = (chainTotals[chainName] || 0) + count;
        }
      });
    });

    return Object.entries(chainTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([chainName, count]) => {
        const chain = l1ChainsData.find((c) => c.chainName === chainName);
        return {
          chainName,
          count,
          logo: chain?.chainLogoURI || "",
          color: chain?.color || "#E84142",
        };
      });
  }, [metrics?.aggregatedData, selectedChainNames]);

  const totalICMMessages = useMemo(() => {
    if (!metrics?.aggregatedData) return 0;
    return metrics.aggregatedData.reduce((sum, point) => {
      const filteredSum = Object.entries(point.chainBreakdown).reduce(
        (acc, [chainName, count]) =>
          selectedChainNames.has(chainName) ? acc + count : acc,
        0
      );
      return sum + filteredSum;
    }, 0);
  }, [metrics?.aggregatedData, selectedChainNames]);

  const dailyICM = useMemo(() => {
    if (!metrics?.aggregatedData || metrics.aggregatedData.length === 0)
      return 0;
    const latestPoint = metrics.aggregatedData[0];
    return Object.entries(latestPoint.chainBreakdown).reduce(
      (acc, [chainName, count]) =>
        selectedChainNames.has(chainName) ? acc + count : acc,
      0
    );
  }, [metrics?.aggregatedData, selectedChainNames]);

  const filteredIcmFlowData = useMemo<ICMFlowResponse | null>(() => {
    if (!icmFlowData) return null;

    const filteredFlows = icmFlowData.flows.filter(
      (flow) =>
        selectedChainNames.has(flow.sourceChain) ||
        selectedChainNames.has(flow.targetChain)
    );

    const sourceNodeMap = new Map<string, ICMChainNode>();
    const targetNodeMap = new Map<string, ICMChainNode>();
    let totalMessages = 0;

    filteredFlows.forEach((flow) => {
      totalMessages += flow.messageCount;

      const existingSource = sourceNodeMap.get(flow.sourceChain);
      if (existingSource) {
        existingSource.totalMessages += flow.messageCount;
      } else {
        sourceNodeMap.set(flow.sourceChain, {
          id: flow.sourceChainId,
          name: flow.sourceChain,
          logo: flow.sourceLogo,
          color: flow.sourceColor,
          totalMessages: flow.messageCount,
          isSource: true,
        });
      }

      const existingTarget = targetNodeMap.get(flow.targetChain);
      if (existingTarget) {
        existingTarget.totalMessages += flow.messageCount;
      } else {
        targetNodeMap.set(flow.targetChain, {
          id: flow.targetChainId,
          name: flow.targetChain,
          logo: flow.targetLogo,
          color: flow.targetColor,
          totalMessages: flow.messageCount,
          isSource: false,
        });
      }
    });

    return {
      ...icmFlowData,
      flows: filteredFlows,
      sourceNodes: Array.from(sourceNodeMap.values()),
      targetNodes: Array.from(targetNodeMap.values()),
      totalMessages,
    };
  }, [icmFlowData, selectedChainNames]);

  const filteredIcttData = useMemo<ICTTStats | null>(() => {
    if (!icttData) return null;
    const filteredTransfers = icttData.transfers.filter((transfer) => {
      const candidates = [
        transfer.homeChainName,
        transfer.remoteChainName,
        transfer.homeChainDisplayName,
        transfer.remoteChainDisplayName,
      ];
      return candidates.some(
        (name): name is string => !!name && selectedChainNames.has(name)
      );
    });
    return { ...icttData, transfers: filteredTransfers };
  }, [icttData, selectedChainNames]);

  const getTopPeers = useCallback(
    (chainName: string): TopPeer[] => {
      if (!filteredIcmFlowData?.flows) return [];

      const peerMap = new Map<
        string,
        { count: number; logo: string; color: string }
      >();

      filteredIcmFlowData.flows.forEach((flow) => {
        if (flow.sourceChain === chainName) {
          const current = peerMap.get(flow.targetChain) || {
            count: 0,
            logo: flow.targetLogo,
            color: flow.targetColor,
          };
          current.count += flow.messageCount;
          peerMap.set(flow.targetChain, current);
        } else if (flow.targetChain === chainName) {
          const current = peerMap.get(flow.sourceChain) || {
            count: 0,
            logo: flow.sourceLogo,
            color: flow.sourceColor,
          };
          current.count += flow.messageCount;
          peerMap.set(flow.sourceChain, current);
        }
      });

      return Array.from(peerMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([name, data]) => ({ name, ...data }));
    },
    [filteredIcmFlowData]
  );

  return {
    chartData,
    topChains,
    totalICMMessages,
    dailyICM,
    filteredIcmFlowData,
    filteredIcttData,
    getTopPeers,
  };
}
