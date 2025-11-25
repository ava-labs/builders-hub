"use client";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  ArrowRightLeft,
  RefreshCw,
  Loader2,
  Network,
  Zap,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import ICMFlowChart from "@/components/stats/ICMFlowChart";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";

interface ICMFlowData {
  sourceChain: string;
  sourceChainId: string;
  sourceLogo: string;
  sourceColor: string;
  targetChain: string;
  targetChainId: string;
  targetLogo: string;
  targetColor: string;
  messageCount: number;
}

interface ChainNode {
  id: string;
  name: string;
  logo: string;
  color: string;
  totalMessages: number;
  isSource: boolean;
}

interface ICMFlowResponse {
  flows: ICMFlowData[];
  sourceNodes: ChainNode[];
  targetNodes: ChainNode[];
  totalMessages: number;
  last_updated: number;
}

type TimeRangeOption = "7d" | "30d" | "90d";

export default function ICMFlowPage() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [flowData, setFlowData] = useState<ICMFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("30d");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchFlowData = async (days: number, refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = refresh 
        ? `/api/icm-flow?days=${days}&clearCache=true`
        : `/api/icm-flow?days=${days}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ICM flow data: ${response.status}`);
      }

      const data = await response.json();
      setFlowData(data);
    } catch (err: any) {
      console.error("Error fetching ICM flow data:", err);
      setError(err?.message || "Failed to load ICM flow data");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
    fetchFlowData(days);
  }, [timeRange]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate stats
  const totalMessages = flowData?.totalMessages || 0;
  const activeRoutes = flowData?.flows?.length || 0;
  const uniqueChains = new Set([
    ...(flowData?.sourceNodes?.map(n => n.id) || []),
    ...(flowData?.targetNodes?.map(n => n.id) || []),
  ]).size;
  const topRoute = flowData?.flows?.[0];

  if (!isMounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-blue-500/5 dark:from-red-500/10 dark:to-blue-500/10" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 dark:bg-red-500/20 rounded-full text-red-600 dark:text-red-400 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Interchain Communication Protocol
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 dark:from-white dark:via-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-4">
              ICM Message Flow
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Visualize real-time cross-chain message flows between Avalanche L1s and the C-Chain
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/20 to-transparent rounded-bl-full" />
              <div className="relative">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Total Messages
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : (
                    formatNumber(totalMessages)
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Last {timeRange === "7d" ? "7" : timeRange === "90d" ? "90" : "30"} days
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-full" />
              <div className="relative">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  Active Routes
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : (
                    activeRoutes
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Unique paths
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-bl-full" />
              <div className="relative">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                  <Network className="w-4 h-4" />
                  Connected Chains
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : (
                    uniqueChains
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  L1s & C-Chain
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/20 to-transparent rounded-bl-full" />
              <div className="relative">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                  <TrendingUp className="w-4 h-4" />
                  Top Route
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {loading ? (
                    <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : topRoute ? (
                    <span className="text-sm">
                      {topRoute.sourceChain.length > 10 
                        ? topRoute.sourceChain.slice(0, 10) + "..." 
                        : topRoute.sourceChain}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {topRoute ? formatNumber(topRoute.messageCount) + " msgs" : "No data"}
                </div>
              </div>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Time Range:</div>
              <div className="flex bg-gray-100 dark:bg-gray-800/80 rounded-lg p-1">
                {(["7d", "30d", "90d"] as TimeRangeOption[]).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className={`px-4 ${
                      timeRange === range 
                        ? "bg-red-500 hover:bg-red-600 text-white shadow-md" 
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {flowData?.last_updated && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Updated: {formatDate(flowData.last_updated)}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
                  fetchFlowData(days, true);
                }}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Card className="relative overflow-hidden bg-transparent border-0 shadow-none">
          {error ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Data
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md">
                {error}
              </p>
              <Button onClick={() => {
                const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
                fetchFlowData(days);
              }} variant="outline">
                Try Again
              </Button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-[500px]">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-t-red-500 rounded-full animate-spin" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-4">
                Loading ICM flow data...
              </p>
            </div>
          ) : (
            <div className="w-full">
              <ICMFlowChart
                data={flowData}
                height={550}
                maxFlows={60}
                showLabels={true}
                animationEnabled={true}
              />
            </div>
          )}
        </Card>

        {/* Legend / Info Section */}
        {!loading && !error && flowData && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Sources */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Top Message Sources
              </h3>
              <div className="space-y-3">
                {flowData.sourceNodes.slice(0, 5).map((node, i) => (
                  <div key={node.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                        {i + 1}.
                      </span>
                      {node.logo ? (
                        <img
                          src={node.logo}
                          alt={node.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ background: node.color }}
                        >
                          {node.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {node.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumber(node.totalMessages)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Destinations */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                Top Message Destinations
              </h3>
              <div className="space-y-3">
                {flowData.targetNodes.slice(0, 5).map((node, i) => (
                  <div key={node.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                        {i + 1}.
                      </span>
                      {node.logo ? (
                        <img
                          src={node.logo}
                          alt={node.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ background: node.color }}
                        >
                          {node.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {node.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumber(node.totalMessages)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                About ICM (Interchain Messaging)
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The Interchain Messaging Protocol enables secure communication between Avalanche L1s and the C-Chain.
                This visualization shows the flow of messages between chains, with thicker lines indicating higher message volumes.
                Hover over connections to see detailed message counts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bubble Navigation */}
      <StatsBubbleNav />
    </div>
  );
}

