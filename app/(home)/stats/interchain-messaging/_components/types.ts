import type { LucideIcon } from "lucide-react";
import type { ICMMetric } from "@/types/stats";
import type {
  ICMFlowData,
  ChainNode as ICMChainNode,
} from "@/components/stats/ICMFlowChart";
import type { Transfer as ICTTTransfer } from "@/components/stats/ICTTDashboard";

export type ChartPeriod = "D" | "W" | "M" | "Q" | "Y";

export interface AggregatedICMDataPoint {
  timestamp: number;
  date: string;
  totalMessageCount: number;
  chainBreakdown: Record<string, number>;
}

export interface ICMStats {
  dailyMessageVolume: ICMMetric;
  aggregatedData: AggregatedICMDataPoint[];
  last_updated: number;
}

export interface ICTTStats {
  overview: {
    totalTransfers: number;
    totalVolumeUsd: number;
    activeChains: number;
    activeRoutes: number;
    topToken: {
      name: string;
      percentage: string;
    };
  };
  topRoutes: Array<{
    name: string;
    total: number;
    direction: string;
  }>;
  tokenDistribution: Array<{
    name: string;
    symbol: string;
    value: number;
    address: string;
  }>;
  transfers: ICTTTransfer[];
  last_updated: number;
}

export interface ICMFlowResponse {
  flows: ICMFlowData[];
  sourceNodes: ICMChainNode[];
  targetNodes: ICMChainNode[];
  totalMessages: number;
  last_updated: number;
}

export interface ChartConfig {
  title: string;
  icon: LucideIcon;
  metricKey: "dailyMessageVolume";
  description: string;
  color: string;
  chartType: "bar";
}

export interface ChartDataPoint {
  day: string;
  value: number;
  chainBreakdown?: Record<string, number>;
}

export interface TopChainSummary {
  chainName: string;
  count: number;
  logo: string;
  color: string;
}

export interface TopPeer {
  name: string;
  count: number;
  logo: string;
  color: string;
}

export interface SectionDefinition {
  id: string;
  label: string;
}
