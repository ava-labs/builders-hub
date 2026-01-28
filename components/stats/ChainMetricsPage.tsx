"use client";
import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer, ComposedChart } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMAConfig, calculateMovingAverage } from "@/utils/chart-utils";
import { Users, Activity, FileText, MessageCircleMore, TrendingUp, UserPlus, Hash, Code2, Gauge, DollarSign, Clock, Fuel, ArrowUpRight, Twitter, Linkedin, Download, Camera, Sparkles } from "lucide-react";
import { ImageExportStudio } from "@/components/stats/image-export";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import { StickyNavBar } from "@/components/stats/StickyNavBar";
import { PeriodSelector } from "@/components/stats/PeriodSelector";
import { MobileSocialLinks } from "@/components/stats/MobileSocialLinks";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { ChartWatermark } from "@/components/stats/ChartWatermark";
import { calculateDateRangeDays, formatXAxisLabel, generateXAxisTicks } from "@/components/stats/chart-axis-utils";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { ChainCategoryFilter, allChains } from "@/components/stats/ChainCategoryFilter";
import { useSectionNavigation } from "@/hooks/use-section-navigation";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

interface TimeSeriesDataPoint {
  date: string;
  value: number | string;
}

interface ICMDataPoint {
  date: string;
  messageCount: number;
}

interface TimeSeriesMetric {
  current_value: number | string;
  data: TimeSeriesDataPoint[];
}

interface ICMMetric {
  current_value: number;
  data: ICMDataPoint[];
}

interface ActiveAddressesMetric {
  daily: TimeSeriesMetric;
  weekly: TimeSeriesMetric;
  monthly: TimeSeriesMetric;
}

interface CChainMetrics {
  activeAddresses: ActiveAddressesMetric;
  activeSenders: TimeSeriesMetric;
  cumulativeAddresses: TimeSeriesMetric;
  cumulativeDeployers: TimeSeriesMetric;
  txCount: TimeSeriesMetric;
  cumulativeTxCount: TimeSeriesMetric;
  cumulativeContracts: TimeSeriesMetric;
  contracts: TimeSeriesMetric;
  deployers: TimeSeriesMetric;
  gasUsed: TimeSeriesMetric;
  avgGps: TimeSeriesMetric;
  maxGps: TimeSeriesMetric;
  avgTps: TimeSeriesMetric;
  maxTps: TimeSeriesMetric;
  avgGasPrice: TimeSeriesMetric;
  maxGasPrice: TimeSeriesMetric;
  feesPaid: TimeSeriesMetric;
  icmMessages: ICMMetric;
  last_updated: number;
}

interface ChainMetricsPageProps {
  chainId?: string;
  chainName?: string;
  chainSlug?: string;
  description?: string;
  themeColor?: string;
  chainLogoURI?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  rpcUrl?: string;
  category?: string;
  explorers?: Array<{
    name: string;
    link: string;
  }>;
  blockchainId?: string;
  subnetId?: string;
}

export default function ChainMetricsPage({
  chainId = "43114",
  chainName = "Avalanche C-Chain",
  chainSlug,
  description = "Real-time metrics and analytics for the Avalanche C-Chain",
  themeColor = "#E57373",
  chainLogoURI,
  website,
  socials,
  rpcUrl,
  category: categoryProp,
  explorers: explorersProp,
  blockchainId: blockchainIdProp,
  subnetId: subnetIdProp,
}: ChainMetricsPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [metrics, setMetrics] = useState<CChainMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache for "all chains" data - fetched once and reused for filtering
  const [cachedAllData, setCachedAllData] = useState<CChainMetrics | null>(
    null
  );

  // Filtering state (only for "all chains" view)
  const isAllChainsView =
    chainSlug === "all" ||
    chainSlug === "all-chains" ||
    chainSlug === "network-metrics";

  // Initialize selectedChainIds from URL params (only for all chains view)
  const getInitialSelectedChainIds = useCallback(() => {
    // Only read from URL params if we're on the "all" page
    if (isAllChainsView) {
      const excludedParam = searchParams.get("excludedChainIds");
      if (excludedParam) {
        const excludedIds = new Set(excludedParam.split(",").filter(Boolean));
        // Return all chains except excluded ones
        return new Set(
          allChains.map((c) => c.chainId).filter((id) => !excludedIds.has(id))
        );
      }
    }
    // Default: all chains selected
    return new Set(allChains.map((c) => c.chainId));
  }, [searchParams, isAllChainsView]);

  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(
    getInitialSelectedChainIds
  );

  // Track if this is user-initiated change (not from URL sync)
  const [urlSyncNeeded, setUrlSyncNeeded] = useState(false);

  // Update URL when selection changes (only for all chains view) - via useEffect to avoid setState during render
  useEffect(() => {
    if (!isAllChainsView || !urlSyncNeeded) return;

    const excludedIds = allChains
      .filter((c) => !selectedChainIds.has(c.chainId))
      .map((c) => c.chainId);

    const params = new URLSearchParams(searchParams.toString());

    if (excludedIds.length === 0) {
      // All selected, remove param
      params.delete("excludedChainIds");
    } else {
      params.set("excludedChainIds", excludedIds.join(","));
    }

    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
    setUrlSyncNeeded(false);
  }, [
    isAllChainsView,
    pathname,
    router,
    searchParams,
    selectedChainIds,
    urlSyncNeeded,
  ]);

  // Sync state from URL params on initial load and when URL changes externally (only for all chains view)
  useEffect(() => {
    if (isAllChainsView) {
      const initialSelected = getInitialSelectedChainIds();
      setSelectedChainIds(initialSelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAllChainsView]);

  // Handle selection change from filter component
  const handleSelectionChange = useCallback((newSelection: Set<string>) => {
    setSelectedChainIds(newSelection);
    setUrlSyncNeeded(true);
  }, []);

  // Look up chain data to get category, explorers, blockchainId, subnetId if not provided
  const chainData = chainSlug
    ? (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug)
    : null;
  const category = categoryProp || chainData?.category;
  const blockchainId = blockchainIdProp || (chainData as any)?.blockchainId;
  const subnetId = subnetIdProp || chainData?.subnetId;

  // Build explorers list - add BuilderHub explorer first if rpcUrl is provided
  const baseExplorers = explorersProp || chainData?.explorers || [];
  const explorers = useMemo(() => {
    const effectiveRpcUrl = rpcUrl || chainData?.rpcUrl;
    if (effectiveRpcUrl && chainSlug) {
      // Prepend BuilderHub explorer if chain has RPC URL
      return [
        { name: "BuilderHub", link: `/explorer/${chainSlug}` },
        ...baseExplorers.filter((e) => e.name !== "BuilderHub"), // Avoid duplicates
      ];
    }
    return baseExplorers;
  }, [rpcUrl, chainData?.rpcUrl, chainSlug, baseExplorers]);

  // Determine which chainIds are EXCLUDED (not selected)
  const excludedChainIds = useMemo(() => {
    if (!isAllChainsView) return [];
    if (selectedChainIds.size === allChains.length) return []; // All selected, no exclusions
    if (selectedChainIds.size === 0) return allChains.map((c) => c.chainId); // None selected, all excluded
    return allChains
      .filter((c) => !selectedChainIds.has(c.chainId))
      .map((c) => c.chainId);
  }, [isAllChainsView, selectedChainIds]);

  // Helper function to subtract metric values
  const subtractMetricValues = (
    allData: CChainMetrics,
    excludedData: CChainMetrics[]
  ): CChainMetrics => {
    const result = JSON.parse(JSON.stringify(allData)) as CChainMetrics;

    // Helper to subtract time series data
    const subtractTimeSeries = (allSeries: any, excludedSeries: any[]) => {
      if (!allSeries?.data) return allSeries;

      const subtracted = { ...allSeries };
      subtracted.data = allSeries.data.map((point: any) => {
        let value =
          typeof point.value === "number"
            ? point.value
            : parseFloat(point.value) || 0;

        excludedSeries.forEach((excluded) => {
          if (excluded?.data) {
            const matchingPoint = excluded.data.find(
              (p: any) => p.date === point.date
            );
            if (matchingPoint) {
              const excludedValue =
                typeof matchingPoint.value === "number"
                  ? matchingPoint.value
                  : parseFloat(matchingPoint.value) || 0;
              value = Math.max(0, value - excludedValue);
            }
          }
        });

        return { ...point, value };
      });

      // Update current value
      if (subtracted.data.length > 0) {
        subtracted.current_value = subtracted.data[0].value;
      }

      return subtracted;
    };

    // Subtract each metric type
    const metricKeys = [
      "activeSenders",
      "cumulativeAddresses",
      "cumulativeDeployers",
      "txCount",
      "cumulativeTxCount",
      "cumulativeContracts",
      "contracts",
      "deployers",
      "gasUsed",
      "feesPaid",
    ] as const;

    metricKeys.forEach((key) => {
      if (result[key]) {
        result[key] = subtractTimeSeries(
          result[key],
          excludedData.map((d) => d[key]).filter(Boolean)
        );
      }
    });

    // Handle activeAddresses (nested structure)
    if (result.activeAddresses) {
      ["daily", "weekly", "monthly"].forEach((period) => {
        if ((result.activeAddresses as any)[period]) {
          (result.activeAddresses as any)[period] = subtractTimeSeries(
            (result.activeAddresses as any)[period],
            excludedData
              .map((d) => (d.activeAddresses as any)?.[period])
              .filter(Boolean)
          );
        }
      });
    }

    // Handle ICM messages
    if (result.icmMessages?.data) {
      result.icmMessages = {
        ...result.icmMessages,
        data: result.icmMessages.data.map((point: any) => {
          let messageCount = point.messageCount || 0;

          excludedData.forEach((excluded) => {
            if (excluded?.icmMessages?.data) {
              const matchingPoint = excluded.icmMessages.data.find(
                (p: any) => p.date === point.date
              );
              if (matchingPoint) {
                messageCount = Math.max(
                  0,
                  messageCount - (matchingPoint.messageCount || 0)
                );
              }
            }
          });

          return { ...point, messageCount };
        }),
        current_value: 0,
      };
      if (result.icmMessages.data.length > 0) {
        result.icmMessages.current_value =
          result.icmMessages.data[0].messageCount || 0;
      }
    }

    return result;
  };

  const fetchData = async () => {
    // If not all chains view, use regular single chain fetch
    if (!isAllChainsView) {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/chain-stats/${chainId}?timeRange=all`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setMetrics(data);
        setIsInitialLoad(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
      return;
    }

    // If no chains selected, show empty state
    if (selectedChainIds.size === 0) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use cached "all" data if available, otherwise fetch it
      let allData: CChainMetrics;
      if (cachedAllData) {
        allData = cachedAllData;
      } else {
        const allResponse = await fetch(`/api/chain-stats/all?timeRange=all`);
        if (!allResponse.ok) {
          throw new Error(`HTTP error! status: ${allResponse.status}`);
        }
        allData = await allResponse.json();
        setCachedAllData(allData); // Cache for future filter changes
      }

      // If all chains are selected, just use the "all" data
      if (excludedChainIds.length === 0) {
        setMetrics(allData);
      } else {
        // Fetch data for excluded chains and subtract
        const excludedResults = await Promise.all(
          excludedChainIds.map(async (cid) => {
            try {
              const response = await fetch(
                `/api/chain-stats/${cid}?timeRange=all`
              );
              if (!response.ok) return null;
              return await response.json();
            } catch {
              return null;
            }
          })
        );

        const validExcluded = excludedResults.filter(
          (r) => r !== null
        ) as CChainMetrics[];

        // Subtract excluded data from all data
        const filteredMetrics = subtractMetricValues(allData, validExcluded);
        setMetrics(filteredMetrics);
      }
      setIsInitialLoad(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    isAllChainsView,
    chainId,
    selectedChainIds.size,
    excludedChainIds.join(","),
  ]);

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "") return "N/A";
    const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
    if (isNaN(numValue)) return "N/A";

    if (numValue >= 1e12) {
      return `${(numValue / 1e12).toFixed(2)}T`;
    } else if (numValue >= 1e9) {
      return `${(numValue / 1e9).toFixed(2)}B`;
    } else if (numValue >= 1e6) {
      return `${(numValue / 1e6).toFixed(2)}M`;
    } else if (numValue >= 1e3) {
      return `${(numValue / 1e3).toFixed(2)}K`;
    }
    return numValue.toLocaleString();
  };

  const formatGasPrice = (price: number | string): string => {
    if (price === "N/A" || price === "") return "N/A";
    const priceValue =
      typeof price === "string" ? Number.parseFloat(price) : price;
    if (isNaN(priceValue)) return "N/A";

    // values are already in nano terms, no conversion needed
    const isC_Chain = chainName.includes("C-Chain");
    const unit = isC_Chain ? " nAVAX" : "";

    if (priceValue < 1) {
      return `${priceValue.toFixed(3)}${unit}`;
    }
    return `${priceValue.toFixed(2)}${unit}`;
  };

  const formatGas = (gas: number | string): string => {
    if (gas === "N/A" || gas === "") return "N/A";
    const gasValue = typeof gas === "string" ? Number.parseFloat(gas) : gas;
    if (isNaN(gasValue)) return "N/A";

    if (gasValue >= 1e9) {
      return `${(gasValue / 1e9).toFixed(2)}B gas`;
    } else if (gasValue >= 1e6) {
      return `${(gasValue / 1e6).toFixed(2)}M gas`;
    } else if (gasValue >= 1e3) {
      return `${(gasValue / 1e3).toFixed(2)}K gas`;
    }
    return `${gasValue.toLocaleString()} gas`;
  };

  const formatRate = (rate: number | string, unit: string): string => {
    if (rate === "N/A" || rate === "") return "N/A";
    const rateValue = typeof rate === "string" ? Number.parseFloat(rate) : rate;
    if (isNaN(rateValue)) return "N/A";

    if (rateValue >= 1e9) {
      return `${(rateValue / 1e9).toFixed(2)}B ${unit}`;
    } else if (rateValue >= 1e6) {
      return `${(rateValue / 1e6).toFixed(2)}M ${unit}`;
    } else if (rateValue >= 1e3) {
      return `${(rateValue / 1e3).toFixed(2)}K ${unit}`;
    }
    return `${rateValue.toFixed(2)} ${unit}`;
  };

  const formatEther = (avaxValue: number | string): string => {
    if (avaxValue === "N/A" || avaxValue === "") return "N/A";
    const value =
      typeof avaxValue === "string" ? Number.parseFloat(avaxValue) : avaxValue;
    if (isNaN(value)) return "N/A";
    const isC_Chain = chainName.includes("C-Chain");
    const unit = isC_Chain ? " AVAX" : "";

    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M${unit}`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K${unit}`;
    } else if (value >= 1) {
      return `${value.toFixed(2)}${unit}`;
    } else {
      return `${value.toFixed(6)}${unit}`;
    }
  };

  const getChartData = (
    metricKey:
      | keyof Omit<
          CChainMetrics,
          "last_updated" | "icmMessages" | "activeAddresses"
        >
      | "activeAddresses",
    period?: "D" | "W" | "M" | "Q" | "Y"
  ) => {
    if (!metrics) return [];

    // Handle activeAddresses specially based on period
    if (metricKey === "activeAddresses") {
      if (!metrics.activeAddresses) return [];

      let data;
      if (period === "D" || !period) {
        data = metrics.activeAddresses.daily?.data;
      } else if (period === "W") {
        data = metrics.activeAddresses.weekly?.data;
      } else if (period === "M") {
        data = metrics.activeAddresses.monthly?.data;
      } else {
        // For Q and Y, we'll return N/A
        data = null;
      }

      if (!data) return [];
      return data
        .map((point: TimeSeriesDataPoint) => ({
          day: point.date,
          value:
            typeof point.value === "string"
              ? Number.parseFloat(point.value)
              : point.value,
        }))
        .reverse();
    }

    // Handle other metrics normally
    const metric =
      metrics[
        metricKey as keyof Omit<
          CChainMetrics,
          "last_updated" | "icmMessages" | "activeAddresses"
        >
      ];
    if (!metric?.data) return [];

    return metric.data
      .map((point: TimeSeriesDataPoint) => ({
        day: point.date,
        value:
          typeof point.value === "string"
            ? Number.parseFloat(point.value)
            : point.value,
      }))
      .reverse();
  };

  const getICMChartData = () => {
    if (!metrics?.icmMessages?.data) return [];

    return metrics.icmMessages.data
      .map((point: ICMDataPoint) => ({
        day: point.date,
        value: point.messageCount,
      }))
      .reverse();
  };

  const formatTooltipValue = (value: number, metricKey: string): string => {
    const roundedValue = [
      "activeAddresses",
      "activeSenders",
      "txCount",
      "cumulativeAddresses",
      "cumulativeDeployers",
      "cumulativeTxCount",
      "cumulativeContracts",
      "contracts",
      "deployers",
      "icmMessages",
    ].includes(metricKey)
      ? Math.round(value)
      : value;

    switch (metricKey) {
      case "activeAddresses":
        return `${formatNumber(roundedValue)} Active Addresses`;
      case "activeSenders":
        return `${formatNumber(roundedValue)} Active Senders`;
      case "txCount":
        return `${formatNumber(roundedValue)} Transactions`;
      case "cumulativeAddresses":
        return `${formatNumber(roundedValue)} Total Addresses`;
      case "cumulativeDeployers":
        return `${formatNumber(roundedValue)} Total Deployers`;
      case "cumulativeTxCount":
        return `${formatNumber(roundedValue)} Total Transactions`;
      case "cumulativeContracts":
        return `${formatNumber(roundedValue)} Total Contracts`;
      case "contracts":
        return `${formatNumber(roundedValue)} Contracts Deployed`;
      case "deployers":
        return `${formatNumber(roundedValue)} Contract Deployers`;
      case "gasUsed":
        return formatGas(value);
      case "avgGps":
        return formatRate(value, "GPS");
      case "maxGps":
        return formatRate(value, "GPS");
      case "avgTps":
        return formatRate(value, "TPS");
      case "maxTps":
        return formatRate(value, "TPS");
      case "avgGasPrice":
        return formatGasPrice(value);
      case "maxGasPrice":
        return formatGasPrice(value);
      case "feesPaid":
        return formatEther(value);
      case "icmMessages":
        return `${formatNumber(roundedValue)} Interchain Messages`;
      default:
        return formatNumber(value);
    }
  };

  // Helper function to get the current value from raw data based on period
  const getCurrentValueFromData = (
    rawData: { day: string; value: number }[],
    period: "D" | "W" | "M" | "Q" | "Y",
    metricKey: string
  ): number | string => {
    if (!rawData || rawData.length === 0) return "N/A";

    // For activeAddresses with W/M periods, data is already aggregated from API
    if (metricKey === "activeAddresses" && (period === "W" || period === "M")) {
      return rawData[rawData.length - 1].value;
    }

    // For daily period, just return the latest value
    if (period === "D") {
      return rawData[rawData.length - 1].value;
    }

    // For other periods, aggregate the data to get the latest period's value
    const grouped = new Map<
      string,
      { sum: number; count: number; date: string }
    >();

    rawData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        // Y
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { sum: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;
    });

    // Get the latest aggregated value
    const aggregated = Array.from(grouped.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return aggregated.length > 0
      ? aggregated[aggregated.length - 1].sum
      : "N/A";
  };

  const getCurrentValue = (
    metricKey: keyof Omit<CChainMetrics, "last_updated">,
    period?: "D" | "W" | "M" | "Q" | "Y"
  ): number | string => {
    if (!metrics) return "N/A";

    // Handle activeAddresses specially based on period
    if (metricKey === "activeAddresses") {
      if (!metrics.activeAddresses) return "N/A";

      if (period === "W") {
        return metrics.activeAddresses.weekly?.current_value ?? "N/A";
      } else if (period === "M" || period === "Q" || period === "Y") {
        return metrics.activeAddresses.monthly?.current_value ?? "N/A";
      } else {
        // Default to daily
        return metrics.activeAddresses.daily?.current_value ?? "N/A";
      }
    }

    const metric =
      metrics[
        metricKey as keyof Omit<
          CChainMetrics,
          "last_updated" | "activeAddresses"
        >
      ];
    if (!metric) return "N/A";
    return metric.current_value;
  };

  const chartConfigs = [
    {
      title: "Active Addresses",
      icon: Users,
      metricKey: "activeAddresses" as const,
      description: "Distinct addresses active on the network",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Active Senders",
      icon: UserPlus,
      metricKey: "activeSenders" as const,
      description: "Addresses sending transactions",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Transactions",
      icon: Activity,
      metricKey: "txCount" as const,
      description: "Transaction volume over time",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Total Addresses",
      icon: Hash,
      metricKey: "cumulativeAddresses" as const,
      description: "Total unique addresses since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Total Transactions",
      icon: Hash,
      metricKey: "cumulativeTxCount" as const,
      description: "Total transaction count since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Smart Contracts",
      icon: FileText,
      metricKey: "contracts" as const,
      description: "New smart contracts deployed over time",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Contract Deployers",
      icon: Code2,
      metricKey: "deployers" as const,
      description: "Unique addresses deploying contracts",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Gas Used",
      icon: Fuel,
      metricKey: "gasUsed" as const,
      description: "Gas consumption over time",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Gas Per Second",
      icon: Gauge,
      metricKey: "avgGps" as const,
      description: "Average gas per second",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Transactions Per Second",
      icon: Clock,
      metricKey: "avgTps" as const,
      secondaryMetricKey: "maxTps" as const,
      description: "Average and peak transactions per second",
      color: themeColor,
      chartType: "dual" as const,
    },
    {
      title: "Fees Paid",
      icon: DollarSign,
      metricKey: "feesPaid" as const,
      description: "Total transaction fees over time",
      color: themeColor,
      chartType: "bar" as const,
      isCurrency: true,
    },
    {
      title: "Avg Gas Price",
      icon: DollarSign,
      metricKey: "avgGasPrice" as const,
      description: "Average gas price over time",
      color: themeColor,
      chartType: "bar" as const,
      showMovingAverage: true,
      isCurrency: true,
    },
    {
      title: "Max Gas Price",
      icon: DollarSign,
      metricKey: "maxGasPrice" as const,
      description: "Peak gas price over time",
      color: "#a855f7",
      chartType: "area" as const,
      isCurrency: true,
    },
    {
      title: "Interchain Messages",
      icon: MessageCircleMore,
      metricKey: "icmMessages" as const,
      description: "Interchain messaging activity",
      color: themeColor,
      chartType: "bar" as const,
    },
  ];

  const [chartPeriods, setChartPeriods] = useState<
    Record<string, "D" | "W" | "M" | "Q" | "Y">
  >(Object.fromEntries(chartConfigs.map((config) => [config.metricKey, "D"])));

  // Global period selector state
  const [globalPeriod, setGlobalPeriod] = useState<"D" | "W" | "M" | "Q" | "Y">(
    "D"
  );
  const [, startTransition] = useTransition();

  const handlePeriodChange = (newPeriod: "D" | "W" | "M" | "Q" | "Y") => {
    startTransition(() => {
      setGlobalPeriod(newPeriod);
    });
  };

  // Sync all chart periods when global period changes
  useEffect(() => {
    setChartPeriods(
      Object.fromEntries(
        chartConfigs.map((config) => [config.metricKey, globalPeriod])
      )
    );
  }, [globalPeriod]);

  // Chart categories for navigation
  const chartCategories = [
    { id: "overview", label: "Overview" },
    {
      id: "activity",
      label: "Activity",
      metricKeys: ["activeAddresses", "activeSenders", "txCount"],
    },
    {
      id: "contracts",
      label: "Contracts",
      metricKeys: ["contracts", "deployers"],
    },
    {
      id: "performance",
      label: "Performance",
      metricKeys: ["gasUsed", "avgGps", "avgTps"],
    },
    { id: "fees", label: "Fees", metricKeys: ["feesPaid", "avgGasPrice", "maxGasPrice"] },
    { id: "interchain", label: "Interchain", metricKeys: ["icmMessages"] },
  ];

  // export all metrics as csv
  const downloadAllMetricsCSV = useCallback(() => {
    if (!metrics) return;

    const rows: string[] = [];
    const periodLabel = globalPeriod === "D" ? "Daily" : globalPeriod === "W" ? "Weekly" : globalPeriod === "M" ? "Monthly" : globalPeriod === "Q" ? "Quarterly" : "Yearly";
    
    // metadata headers
    rows.push(`# ${chainName} Metrics Export`);
    rows.push(`# Generated: ${new Date().toISOString()}`);
    rows.push(`# Period: ${periodLabel}`);
    rows.push(`# Chain ID: ${chainId}`);
    rows.push("");

    const getAllDates = (): string[] => {
      const dateSet = new Set<string>();

      // active addresses
      if (metrics.activeAddresses) {
        const activeData = globalPeriod === "W" ? metrics.activeAddresses.weekly?.data : globalPeriod === "M" || globalPeriod === "Q" || globalPeriod === "Y" ? metrics.activeAddresses.monthly?.data : metrics.activeAddresses.daily?.data;
        activeData?.forEach((p) => dateSet.add(p.date));
      }
      
      // other metrics
      const metricKeys: (keyof Omit<CChainMetrics, "last_updated" | "icmMessages" | "activeAddresses">)[] = [
        "activeSenders", "txCount", "cumulativeAddresses", "cumulativeDeployers",
        "cumulativeTxCount", "cumulativeContracts", "contracts", "deployers",
        "gasUsed", "avgGps", "maxGps", "avgTps", "maxTps", "avgGasPrice", 
        "maxGasPrice", "feesPaid"
      ];

      metricKeys.forEach((key) => {
        const metric = metrics[key];
        if (metric?.data) {
          metric.data.forEach((p) => dateSet.add(p.date));
        }
      });
      
      // ICM messages
      if (metrics.icmMessages?.data) {
        metrics.icmMessages.data.forEach((p) => dateSet.add(p.date));
      }
      
      return Array.from(dateSet).sort();
    };

    const buildDateMap = (data: { date: string; value: number | string }[] | undefined): Map<string, number | string> => {
      const map = new Map<string, number | string>();
      data?.forEach((p) => map.set(p.date, p.value));
      return map;
    };

    const buildICMDateMap = (data: { date: string; messageCount: number }[] | undefined): Map<string, number> => {
      const map = new Map<string, number>();
      data?.forEach((p) => map.set(p.date, p.messageCount));
      return map;
    };

    const allDates = getAllDates();

    const activeAddressesData = globalPeriod === "W" ? metrics.activeAddresses?.weekly?.data  : globalPeriod === "M" || globalPeriod === "Q" || globalPeriod === "Y" ? metrics.activeAddresses?.monthly?.data : metrics.activeAddresses?.daily?.data;
    const dataMapActiveAddresses = buildDateMap(activeAddressesData);
    const dataMapActiveSenders = buildDateMap(metrics.activeSenders?.data);
    const dataMapTxCount = buildDateMap(metrics.txCount?.data);
    const dataMapCumulativeAddresses = buildDateMap(metrics.cumulativeAddresses?.data);
    const dataMapCumulativeTxCount = buildDateMap(metrics.cumulativeTxCount?.data);
    const dataMapCumulativeContracts = buildDateMap(metrics.cumulativeContracts?.data);
    const dataMapContracts = buildDateMap(metrics.contracts?.data);
    const dataMapDeployers = buildDateMap(metrics.deployers?.data);
    const dataMapCumulativeDeployers = buildDateMap(metrics.cumulativeDeployers?.data);
    const dataMapGasUsed = buildDateMap(metrics.gasUsed?.data);
    const dataMapAvgGps = buildDateMap(metrics.avgGps?.data);
    const dataMapMaxGps = buildDateMap(metrics.maxGps?.data);
    const dataMapAvgTps = buildDateMap(metrics.avgTps?.data);
    const dataMapMaxTps = buildDateMap(metrics.maxTps?.data);
    const dataMapAvgGasPrice = buildDateMap(metrics.avgGasPrice?.data);
    const dataMapMaxGasPrice = buildDateMap(metrics.maxGasPrice?.data);
    const dataMapFeesPaid = buildDateMap(metrics.feesPaid?.data);
    const dataMapICM = buildICMDateMap(metrics.icmMessages?.data);

    rows.push("=== CURRENT SUMMARY ===");
    rows.push("Metric,Current Value");

    // dynamic period prefix
    const periodPrefix = globalPeriod === "W" ? "Weekly" : globalPeriod === "M" ? "Monthly" : globalPeriod === "Q" ? "Quarterly" : globalPeriod === "Y" ? "Yearly" : "Daily";

    const activeAddressLabel = `${periodPrefix} Active Addresses`;
    const activeAddressCurrent = globalPeriod === "W" ? metrics.activeAddresses?.weekly?.current_value : globalPeriod === "M" || globalPeriod === "Q" || globalPeriod === "Y" ? metrics.activeAddresses?.monthly?.current_value : metrics.activeAddresses?.daily?.current_value;

    rows.push(`${activeAddressLabel},${activeAddressCurrent ?? "N/A"}`);
    rows.push(`${periodPrefix} Active Senders,${metrics.activeSenders?.current_value ?? "N/A"}`);
    rows.push(`${periodPrefix} Transactions,${metrics.txCount?.current_value ?? "N/A"}`);
    rows.push(`Total Addresses,${metrics.cumulativeAddresses?.current_value ?? "N/A"}`);
    rows.push(`Total Transactions,${metrics.cumulativeTxCount?.current_value ?? "N/A"}`);
    rows.push(`Total Contracts Deployed,${metrics.cumulativeContracts?.current_value ?? "N/A"}`);
    rows.push(`${periodPrefix} Contracts Deployed,${metrics.contracts?.current_value ?? "N/A"}`);
    rows.push(`${periodPrefix} Contract Deployers,${metrics.deployers?.current_value ?? "N/A"}`);
    rows.push(`Total Contract Deployers,${metrics.cumulativeDeployers?.current_value ?? "N/A"}`);
    rows.push(`${periodPrefix} Gas Used,${metrics.gasUsed?.current_value ?? "N/A"}`);
    rows.push(`Avg Gas Per Second,${metrics.avgGps?.current_value ?? "N/A"}`);
    rows.push(`Max Gas Per Second,${metrics.maxGps?.current_value ?? "N/A"}`);
    rows.push(`Avg TPS,${metrics.avgTps?.current_value ?? "N/A"}`);
    rows.push(`Max TPS,${metrics.maxTps?.current_value ?? "N/A"}`);
    rows.push(`Avg Gas Price (nAVAX),${metrics.avgGasPrice?.current_value ?? "N/A"}`);
    rows.push(`Max Gas Price (nAVAX),${metrics.maxGasPrice?.current_value ?? "N/A"}`);
    rows.push(`${periodPrefix} Fees Paid,${metrics.feesPaid?.current_value ?? "N/A"}`);
    rows.push(`${periodPrefix} Interchain Messages,${metrics.icmMessages?.current_value ?? "N/A"}`);
    rows.push("");

    rows.push("=== TIME SERIES DATA ===");
    const headers = ["Date", activeAddressLabel, `${periodPrefix} Active Senders`, `${periodPrefix} Transactions`, "Total Addresses", "Total Transactions", "Total Contracts", `${periodPrefix} Contracts Deployed`, `${periodPrefix} Contract Deployers`, "Total Deployers", `${periodPrefix} Gas Used`, "Avg GPS", "Max GPS", "Avg TPS", "Max TPS", "Avg Gas Price (nAVAX)", "Max Gas Price (nAVAX)", `${periodPrefix} Fees Paid`, `${periodPrefix} Interchain Messages`];
    rows.push(headers.join(","));

    const sortedDates = [...allDates].sort().reverse();

    sortedDates.forEach((date) => {
      const row = [
        date,
        dataMapActiveAddresses.get(date) ?? "",
        dataMapActiveSenders.get(date) ?? "",
        dataMapTxCount.get(date) ?? "",
        dataMapCumulativeAddresses.get(date) ?? "",
        dataMapCumulativeTxCount.get(date) ?? "",
        dataMapCumulativeContracts.get(date) ?? "",
        dataMapContracts.get(date) ?? "",
        dataMapDeployers.get(date) ?? "",
        dataMapCumulativeDeployers.get(date) ?? "",
        dataMapGasUsed.get(date) ?? "",
        dataMapAvgGps.get(date) ?? "",
        dataMapMaxGps.get(date) ?? "",
        dataMapAvgTps.get(date) ?? "",
        dataMapMaxTps.get(date) ?? "",
        dataMapAvgGasPrice.get(date) ?? "",
        dataMapMaxGasPrice.get(date) ?? "",
        dataMapFeesPaid.get(date) ?? "",
        dataMapICM.get(date) ?? "",
      ];
      rows.push(row.join(","));
    });

    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `${chainSlug || chainName.toLowerCase().replace(/\s+/g, "-")}-metrics-${periodPrefix.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [metrics, globalPeriod, chainName, chainId, chainSlug]);

  // Section navigation using reusable hook
  const { activeSection, scrollToSection } = useSectionNavigation({
    categories: chartCategories,
    offset: 180,
    initialSection: "overview",
  });

  // Get charts for a category
  const getChartsByCategory = (metricKeys: string[]) => {
    return chartConfigs.filter((config) =>
      metricKeys.includes(config.metricKey)
    );
  };

  // Only show full skeleton on initial load, not on filter changes
  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Hero Skeleton with gradient */}
        <div className="relative overflow-hidden">
          {/* Gradient decoration skeleton */}
          <div
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            {/* Breadcrumb Skeleton */}
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>

            <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
              <div className="space-y-4 sm:space-y-6 flex-1">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-red-200 dark:bg-red-900/30 rounded animate-pulse" />
                    <div className="h-3 sm:h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    {chainLogoURI && (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                    )}
                    <div className="h-8 sm:h-10 md:h-12 w-64 sm:w-80 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                  <div className="h-4 sm:h-5 w-full max-w-2xl bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mt-3" />
                  <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse mt-3" />
                </div>
              </div>
              {!chainName.includes("C-Chain") && (
                <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* Navbar Skeleton */}
        <div className="sticky top-14 z-40 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800">
          <div className="w-full">
            <div className="flex items-center gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-7 sm:h-8 w-20 sm:w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse flex-shrink-0"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">
          {/* Network Overview Skeleton */}
          <section className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <div className="h-6 sm:h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="!bg-white dark:!bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                    <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </section>

          {/* Charts Skeleton */}
          <section className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <div className="h-6 sm:h-8 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                >
                  <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                        <div>
                          <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-1" />
                          <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((j) => (
                          <div
                            key={j}
                            className="h-7 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pt-6 pb-6">
                    <div className="mb-4 flex items-baseline gap-2">
                      <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                    <div className="h-[350px] bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                    <div className="mt-4 h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        {chainSlug && !isAllChainsView ? (
          <L1BubbleNav
            chainSlug={chainSlug}
            themeColor={themeColor}
            rpcUrl={rpcUrl}
            isCustomChain={!chainData}
          />
        ) : (
          <StatsBubbleNav />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 pt-8">
        <div className="container mx-auto p-6 pb-24">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-destructive text-lg mb-4">
                Error loading data: {error}
              </p>
              <Button onClick={fetchData}>Retry</Button>
            </div>
          </div>
        </div>
        {chainSlug && !isAllChainsView ? (
          <L1BubbleNav
            chainSlug={chainSlug}
            themeColor={themeColor}
            rpcUrl={rpcUrl}
            isCustomChain={!chainData}
          />
        ) : (
          <StatsBubbleNav />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero - Clean typographic approach with gradient accent */}
      <div className="relative overflow-hidden">
        {/* Gradient decoration on the right */}
        {chainLogoURI && (
          <div
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
            }}
          />
        )}
        {!chainLogoURI && (
          <div
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.12) 40%, rgba(239, 68, 68, 0.04) 70%, transparent 100%)`,
            }}
          />
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          {/* Breadcrumb */}
          {chainSlug && (
            <StatsBreadcrumb
              chainSlug={chainSlug}
              chainName={chainName}
              chainLogoURI={chainLogoURI}
              showStats={true}
              themeColor={themeColor}
            />
          )}

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <AvalancheLogo
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="#E84142"
                  />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  {chainLogoURI && (
                    <img
                      src={chainLogoURI}
                      alt={`${chainName} logo`}
                      className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {chainName.includes("C-Chain")
                      ? "C-Chain Metrics"
                      : `${chainName} Metrics`}
                  </h1>
                </div>
                {/* Blockchain ID and Subnet ID chips + Add to Wallet */}
                {(subnetId || blockchainId || rpcUrl || chainData?.rpcUrl) && (
                  <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ChainIdChips
                          subnetId={subnetId}
                          blockchainId={blockchainId}
                        />
                      </div>
                      {(rpcUrl || chainData?.rpcUrl) && !isAllChainsView && (
                        <div className="flex-shrink-0">
                          <AddToWalletButton
                            rpcUrl={(rpcUrl || chainData?.rpcUrl)!}
                            chainName={chainName}
                            chainId={chainId ? parseInt(chainId) : undefined}
                            tokenSymbol={chainData?.networkToken?.symbol}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                    {description}
                  </p>
                </div>
                {/* Mobile Social Links - shown below description */}
                <MobileSocialLinks
                  website={website}
                  socials={socials}
                  explorers={explorers}
                />
                {category && (
                  <div className="mt-3">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${themeColor}15`,
                        color: themeColor,
                      }}
                    >
                      {category}
                    </span>
                  </div>
                )}

                {/* Chain Filters - inline in hero for "all chains" view */}
                {isAllChainsView && (
                  <div className="mt-6">
                    <ChainCategoryFilter
                      selectedChainIds={selectedChainIds}
                      onSelectionChange={handleSelectionChange}
                      showChainChips={true}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Social Links and Period Selector - hidden on mobile */}
            <div className="hidden sm:flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                {website && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      Website
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}

                {/* Social buttons */}
                {socials && (socials.twitter || socials.linkedin) && (
                  <>
                    {socials.twitter && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a
                          href={`https://x.com/${socials.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Twitter"
                        >
                          <Twitter className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {socials.linkedin && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a
                          href={`https://linkedin.com/company/${socials.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="LinkedIn"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </>
                )}

                {explorers && (
                  <div className="[&_button]:border-zinc-300 dark:[&_button]:border-zinc-700 [&_button]:text-zinc-600 dark:[&_button]:text-zinc-400 [&_button]:hover:border-zinc-400 dark:[&_button]:hover:border-zinc-600">
                    <ExplorerDropdown
                      explorers={explorers}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation Bar - full width, positioned below main navbar */}
      <StickyNavBar
        categories={chartCategories}
        activeSection={activeSection}
        onNavigate={scrollToSection}
      >
        <div className="flex items-center">
          <PeriodSelector selected={globalPeriod} onChange={handlePeriodChange} />
          <div className="ml-3 sm:ml-4 pl-3 sm:pl-4 border-l border-zinc-200 dark:border-zinc-700">
            <button
              onClick={downloadAllMetricsCSV}
              disabled={!metrics || loading}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Download all metrics as CSV"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </StickyNavBar>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* Loading skeleton for filter changes (not initial load) */}
        {loading && !isInitialLoad && (
          <div className="space-y-12 sm:space-y-16">
            {/* Network Overview Skeleton */}
            <section className="space-y-4 sm:space-y-6">
              <div className="h-6 sm:h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="!bg-white dark:!bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                      <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </section>

            {/* Charts Skeleton */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <div className="h-6 sm:h-8 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                          <div>
                            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-1" />
                            <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((j) => (
                            <div
                              key={j}
                              className="h-7 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pt-6 pb-6">
                      <div className="mb-4 flex items-baseline gap-2">
                        <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                        <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      </div>
                      <div className="h-[350px] bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                      <div className="mt-4 h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Actual content - hidden during filter loading */}
        {(!loading || isInitialLoad) && (
          <>
            {/* Network Overview */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <LinkableHeading
                  as="h2"
                  id="overview"
                  className="text-lg sm:text-2xl font-medium text-left"
                >
                  Network Overview
                </LinkableHeading>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    key: "activeAddresses",
                    icon: Users,
                    label: "Daily Active Addresses",
                  },
                  {
                    key: "txCount",
                    icon: Activity,
                    label: "Daily Transactions",
                  },
                  {
                    key: "cumulativeContracts",
                    icon: FileText,
                    label: "Total Contracts Deployed",
                  },
                  {
                    key: "icmMessages",
                    icon: MessageCircleMore,
                    label: "Daily Interchain Messages",
                  },
                ].map((item) => {
                  const currentValue = getCurrentValue(
                    item.key as keyof Omit<CChainMetrics, "last_updated">,
                    "D" // Always use daily for overview cards
                  );
                  const Icon = item.icon;

                  return (
                    <Card
                      key={item.key}
                      className="relative overflow-hidden !bg-white dark:!bg-black border-gray-200 dark:border-zinc-800 p-4"
                    >
                      <div className="relative">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {loading ? (
                            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                          ) : (
                            formatNumber(currentValue)
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Activity Section */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <LinkableHeading
                  as="h2"
                  id="activity"
                  className="text-lg sm:text-2xl font-medium text-left"
                >
                  Activity
                </LinkableHeading>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Address and transaction activity over time
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {getChartsByCategory([
                  "activeAddresses",
                  "activeSenders",
                  "txCount",
                ]).map((config) => {
                  const period = chartPeriods[config.metricKey];

                  const rawData =
                    config.metricKey === "icmMessages"
                      ? getICMChartData()
                      : getChartData(config.metricKey, period);
                  if (rawData.length === 0) return null;

                  // Get current value from aggregated data based on selected period
                  const currentValue = getCurrentValueFromData(
                    rawData,
                    period,
                    config.metricKey
                  );
                  let cumulativeData = null;
                  if (config.metricKey === "txCount")
                    cumulativeData = getChartData("cumulativeTxCount");
                  else if (config.metricKey === "activeAddresses")
                    cumulativeData = getChartData("cumulativeAddresses");
                  let secondaryData = null;
                  let secondaryCurrentValue = null;
                  if (
                    config.chartType === "dual" &&
                    config.secondaryMetricKey
                  ) {
                    secondaryData = getChartData(config.secondaryMetricKey);
                    secondaryCurrentValue = getCurrentValue(
                      config.secondaryMetricKey
                    );
                  }

                  // Determine allowed periods based on metric type
                  let allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = [
                    "D",
                    "W",
                    "M",
                    "Q",
                    "Y",
                  ];
                  // Active addresses only supports D, W, M (data fetched from API with those intervals)
                  if (config.metricKey === "activeAddresses") {
                    allowedPeriods = ["D", "W", "M"];
                  }

                  return (
                    <ChartCard
                      key={config.metricKey}
                      config={config}
                      rawData={rawData}
                      cumulativeData={cumulativeData}
                      secondaryData={secondaryData}
                      period={period}
                      currentValue={currentValue}
                      secondaryCurrentValue={secondaryCurrentValue}
                      onPeriodChange={(newPeriod) =>
                        setChartPeriods((prev) => ({
                          ...prev,
                          [config.metricKey]: newPeriod,
                        }))
                      }
                      formatTooltipValue={(value) =>
                        formatTooltipValue(value, config.metricKey)
                      }
                      formatYAxisValue={formatNumber}
                      allowedPeriods={allowedPeriods}
                      chainId={chainId}
                      chainName={chainName}
                      allChartConfigs={chartConfigs.map((c) => ({
                        metricKey: c.metricKey,
                        title: c.title,
                        description: c.description,
                        color: c.color,
                      }))}
                    />
                  );
                })}
              </div>
            </section>

            {/* Contracts Section */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <LinkableHeading
                  as="h2"
                  id="contracts"
                  className="text-lg sm:text-2xl font-medium text-left"
                >
                  Contracts
                </LinkableHeading>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Smart contract deployment activity
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {getChartsByCategory(["contracts", "deployers"]).map(
                  (config) => {
                    const period = chartPeriods[config.metricKey];
                    const rawData = getChartData(
                      config.metricKey as keyof Omit<
                        CChainMetrics,
                        "last_updated" | "icmMessages"
                      >,
                      period
                    );
                    if (rawData.length === 0) return null;
                    // Get current value from aggregated data based on selected period
                    const currentValue = getCurrentValueFromData(
                      rawData,
                      period,
                      config.metricKey
                    );
                    let cumulativeData = null;
                    if (config.metricKey === "contracts")
                      cumulativeData = getChartData("cumulativeContracts");
                    else if (config.metricKey === "deployers")
                      cumulativeData = getChartData("cumulativeDeployers");

                    // All periods allowed for contracts and deployers
                    const allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = [
                      "D",
                      "W",
                      "M",
                      "Q",
                      "Y",
                    ];

                    return (
                      <ChartCard
                        key={config.metricKey}
                        config={config}
                        rawData={rawData}
                        cumulativeData={cumulativeData}
                        secondaryData={null}
                        period={period}
                        currentValue={currentValue}
                        secondaryCurrentValue={null}
                        onPeriodChange={(newPeriod) =>
                          setChartPeriods((prev) => ({
                            ...prev,
                            [config.metricKey]: newPeriod,
                          }))
                        }
                        formatTooltipValue={(value) =>
                          formatTooltipValue(value, config.metricKey)
                        }
                        formatYAxisValue={formatNumber}
                        allowedPeriods={allowedPeriods}
                        chainId={chainId}
                        chainName={chainName}
                        allChartConfigs={chartConfigs.map((c) => ({
                          metricKey: c.metricKey,
                          title: c.title,
                          description: c.description,
                          color: c.color,
                        }))}
                      />
                    );
                  }
                )}
              </div>
            </section>

            {/* Performance Section */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <LinkableHeading
                  as="h2"
                  id="performance"
                  className="text-lg sm:text-2xl font-medium text-left"
                >
                  Performance
                </LinkableHeading>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Network throughput and gas metrics
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {getChartsByCategory([
                  "gasUsed",
                  "avgGps",
                  "avgTps",
                ]).map((config) => {
                  const period = chartPeriods[config.metricKey];
                  const rawData = getChartData(
                    config.metricKey as keyof Omit<
                      CChainMetrics,
                      "last_updated" | "icmMessages"
                    >,
                    period
                  );
                  if (rawData.length === 0) return null;
                  // Get current value from aggregated data based on selected period
                  const currentValue = getCurrentValueFromData(
                    rawData,
                    period,
                    config.metricKey
                  );
                  let secondaryData = null;
                  let secondaryCurrentValue = null;
                  if (
                    config.chartType === "dual" &&
                    config.secondaryMetricKey
                  ) {
                    secondaryData = getChartData(config.secondaryMetricKey);
                    secondaryCurrentValue = getCurrentValue(
                      config.secondaryMetricKey
                    );
                  }

                  // Determine allowed periods based on metric type
                  let allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = [
                    "D",
                    "W",
                    "M",
                    "Q",
                    "Y",
                  ];
                  // GPS, TPS, and Gas Price are only available on Daily
                  if (
                    [
                      "avgGps",
                      "maxGps",
                      "avgTps",
                      "maxTps",
                      "avgGasPrice",
                      "maxGasPrice",
                    ].includes(config.metricKey)
                  ) {
                    allowedPeriods = ["D"];
                  }

                  return (
                    <ChartCard
                      key={config.metricKey}
                      config={config}
                      rawData={rawData}
                      cumulativeData={null}
                      secondaryData={secondaryData}
                      period={period}
                      currentValue={currentValue}
                      secondaryCurrentValue={secondaryCurrentValue}
                      onPeriodChange={(newPeriod) =>
                        setChartPeriods((prev) => ({
                          ...prev,
                          [config.metricKey]: newPeriod,
                        }))
                      }
                      formatTooltipValue={(value) =>
                        formatTooltipValue(value, config.metricKey)
                      }
                      formatYAxisValue={formatNumber}
                      allowedPeriods={allowedPeriods}
                      chainId={chainId}
                      chainName={chainName}
                      allChartConfigs={chartConfigs.map((c) => ({
                        metricKey: c.metricKey,
                        title: c.title,
                        description: c.description,
                        color: c.color,
                      }))}
                    />
                  );
                })}
              </div>
            </section>

            {/* Fees Section */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <LinkableHeading
                  as="h2"
                  id="fees"
                  className="text-lg sm:text-2xl font-medium text-left"
                >
                  Fees
                </LinkableHeading>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Transaction fee metrics
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {getChartsByCategory(["feesPaid", "avgGasPrice", "maxGasPrice"]).map((config) => {
                  const period = chartPeriods[config.metricKey];
                  const rawData = getChartData(
                    config.metricKey as keyof Omit<
                      CChainMetrics,
                      "last_updated" | "icmMessages"
                    >,
                    period
                  );
                  if (rawData.length === 0) return null;
                  // Get current value from aggregated data based on selected period
                  const currentValue = getCurrentValueFromData(
                    rawData,
                    period,
                    config.metricKey
                  );

                  // Handle secondary data for dual charts (Gas Price)
                  let secondaryData = null;
                  let secondaryCurrentValue = null;
                  if (
                    config.chartType === "dual" &&
                    config.secondaryMetricKey
                  ) {
                    secondaryData = getChartData(config.secondaryMetricKey);
                    secondaryCurrentValue = getCurrentValue(
                      config.secondaryMetricKey
                    );
                  }

                  // Determine allowed periods - Gas Price only available on Daily
                  let allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = [
                    "D",
                    "W",
                    "M",
                    "Q",
                    "Y",
                  ];
                  if (
                    ["avgGasPrice", "maxGasPrice"].includes(config.metricKey)
                  ) {
                    allowedPeriods = ["D"];
                  }

                  return (
                    <ChartCard
                      key={config.metricKey}
                      config={config}
                      rawData={rawData}
                      cumulativeData={null}
                      secondaryData={secondaryData}
                      period={period}
                      currentValue={currentValue}
                      secondaryCurrentValue={secondaryCurrentValue}
                      onPeriodChange={(newPeriod) =>
                        setChartPeriods((prev) => ({
                          ...prev,
                          [config.metricKey]: newPeriod,
                        }))
                      }
                      formatTooltipValue={(value) =>
                        formatTooltipValue(value, config.metricKey)
                      }
                      formatYAxisValue={formatNumber}
                      allowedPeriods={allowedPeriods}
                      showMovingAverage={config.showMovingAverage || config.metricKey === "feesPaid"}
                      chainId={chainId}
                      chainName={chainName}
                      allChartConfigs={chartConfigs.map((c) => ({
                        metricKey: c.metricKey,
                        title: c.title,
                        description: c.description,
                        color: c.color,
                      }))}
                    />
                  );
                })}
              </div>
            </section>

            {/* Interchain Section */}
            <section className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <LinkableHeading
                  as="h2"
                  id="interchain"
                  className="text-lg sm:text-2xl font-medium text-left"
                >
                  Interchain
                </LinkableHeading>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Cross-chain messaging activity
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {getChartsByCategory(["icmMessages"]).map((config) => {
                  const rawData = getICMChartData();
                  if (rawData.length === 0) return null;
                  const period = chartPeriods[config.metricKey];
                  const currentValue = getCurrentValue(config.metricKey);
                  return (
                    <ChartCard
                      key={config.metricKey}
                      config={config}
                      rawData={rawData}
                      cumulativeData={null}
                      secondaryData={null}
                      period={period}
                      currentValue={currentValue}
                      secondaryCurrentValue={null}
                      onPeriodChange={(newPeriod) =>
                        setChartPeriods((prev) => ({
                          ...prev,
                          [config.metricKey]: newPeriod,
                        }))
                      }
                      formatTooltipValue={(value) =>
                        formatTooltipValue(value, config.metricKey)
                      }
                      formatYAxisValue={formatNumber}
                      chainId={chainId}
                      chainName={chainName}
                      allChartConfigs={chartConfigs.map((c) => ({
                        metricKey: c.metricKey,
                        title: c.title,
                        description: c.description,
                        color: c.color,
                      }))}
                    />
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Bubble Navigation */}
      {chainSlug && !isAllChainsView ? (
        <L1BubbleNav
          chainSlug={chainSlug}
          themeColor={themeColor}
          rpcUrl={rpcUrl}
          isCustomChain={!chainData}
        />
      ) : (
        <StatsBubbleNav />
      )}
    </div>
  );
}

function ChartCard({
  config,
  rawData,
  cumulativeData,
  secondaryData,
  period,
  currentValue,
  secondaryCurrentValue,
  onPeriodChange,
  formatTooltipValue,
  formatYAxisValue,
  allowedPeriods = ["D", "W", "M", "Q", "Y"],
  showMovingAverage = false,
  // Collage mode props
  chainId,
  chainName,
  allChartConfigs,
}: {
  config: any;
  rawData: any[];
  cumulativeData?: any[] | null;
  secondaryData?: any[] | null;
  period: "D" | "W" | "M" | "Q" | "Y";
  currentValue: number | string;
  secondaryCurrentValue?: number | string | null;
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
  formatTooltipValue: (value: number) => string;
  formatYAxisValue: (value: number) => string;
  allowedPeriods?: ("D" | "W" | "M" | "Q" | "Y")[];
  showMovingAverage?: boolean;
  // Collage mode props
  chainId?: string;
  chainName?: string;
  allChartConfigs?: { metricKey: string; title: string; description: string; color: string }[];
}) {
  // Get moving average config based on period
  const maConfig = useMemo(() => getMAConfig(period), [period]);
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [showImageStudio, setShowImageStudio] = useState(false);

  // Screenshot handler for downloading chart as image
  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;

    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `${config.title.replace(/\s+/g, "_")}_${period}_${
        new Date().toISOString().split("T")[0]
      }.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  // Aggregate data based on selected period
  const aggregatedData = useMemo(() => {
    if (period === "D") {
      // Add moving average if enabled for daily data
      if (showMovingAverage) {
        return calculateMovingAverage(rawData, maConfig.window);
      }
      return rawData;
    }

    // For active addresses, don't aggregate since data is already fetched with proper interval
    if (
      config.metricKey === "activeAddresses" &&
      (period === "W" || period === "M")
    ) {
      if (showMovingAverage) {
        return calculateMovingAverage(rawData, maConfig.window);
      }
      return rawData;
    }

    const grouped = new Map<
      string,
      { sum: number; count: number; date: string }
    >();

    rawData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        // Y
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { sum: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;
    });

    const aggregated = Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.sum,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Add moving average if enabled
    if (showMovingAverage) {
      return calculateMovingAverage(aggregated, maConfig.window);
    }
    return aggregated;
  }, [rawData, period, config.metricKey, showMovingAverage, maConfig.window]);

  // Aggregate cumulative data - take the last (max) value in each period
  const aggregatedCumulativeData = useMemo(() => {
    if (!cumulativeData || period === "D") return cumulativeData;

    const grouped = new Map<string, { maxValue: number; date: string }>();

    cumulativeData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        // Y
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { maxValue: point.value, date: key });
      } else {
        const group = grouped.get(key)!;
        group.maxValue = Math.max(group.maxValue, point.value);
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.maxValue,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [cumulativeData, period]);

  // Aggregate secondary data for dual y-axis charts
  const aggregatedSecondaryData = useMemo(() => {
    if (!secondaryData || period === "D") return secondaryData;

    const grouped = new Map<
      string,
      { sum: number; count: number; date: string }
    >();

    secondaryData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        // Y
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { sum: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.sum,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [secondaryData, period]);

  // Set default brush range based on period
  useEffect(() => {
    if (!aggregatedData || aggregatedData.length === 0) {
      setBrushIndexes(null);
      return;
    }

    if (period === "D") {
      // Show last 90 days for daily view only
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      // Show all data for W, M, Q, Y
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData]);

  const displayData = useMemo(() => {
    if (!brushIndexes || !aggregatedData || aggregatedData.length === 0)
      return [];
    const start = Math.max(
      0,
      Math.min(brushIndexes.startIndex, aggregatedData.length - 1)
    );
    const end = Math.max(
      0,
      Math.min(brushIndexes.endIndex, aggregatedData.length - 1)
    );
    if (start > end) return [];
    return aggregatedData.slice(start, end + 1);
  }, [brushIndexes, aggregatedData]);

  // Calculate the number of days in the brush range for dynamic x-axis formatting
  const brushRangeDays = useMemo(() => {
    return calculateDateRangeDays(displayData, "day");
  }, [displayData]);

  // Calculate the total days in the full data for brush slider formatting
  const totalDataDays = useMemo(() => {
    return calculateDateRangeDays(aggregatedData || [], "day");
  }, [aggregatedData]);

  // Merge actual cumulative transaction data with daily data
  const displayDataWithCumulative = useMemo(() => {
    let result = displayData;

    // Add cumulative data if available
    if (aggregatedCumulativeData && aggregatedCumulativeData.length > 0) {
      const cumulativeMap = new Map(
        aggregatedCumulativeData.map((point) => [point.day, point.value])
      );
      result = result.map((point) => ({
        ...point,
        cumulative: cumulativeMap.get(point.day) || null,
      }));
    }

    // Add secondary data for dual y-axis charts (stacked bars)
    if (aggregatedSecondaryData && aggregatedSecondaryData.length > 0) {
      const secondaryMap = new Map(
        aggregatedSecondaryData.map((point) => [point.day, point.value])
      );
      result = result.map((point) => {
        const secondary = secondaryMap.get(point.day) || null;
        const avg = point.value;
        const maxMinusAvg = secondary && avg ? secondary - avg : 0;
        return {
          ...point,
          secondary: secondary,
          maxMinusAvg: maxMinusAvg,
        };
      });
    }

    return result;
  }, [displayData, aggregatedCumulativeData, aggregatedSecondaryData]);

  // Calculate percentage change based on brush selection
  const dynamicChange = useMemo(() => {
    if (!displayData || displayData.length < 2) {
      return { change: 0, isPositive: true };
    }

    const firstValue = displayData[0].value;
    const lastValue = displayData[displayData.length - 1].value;

    if (lastValue === 0) {
      return { change: 0, isPositive: true };
    }

    const changePercentage = ((lastValue - firstValue) / firstValue) * 100;

    return {
      change: Math.abs(changePercentage),
      isPositive: changePercentage >= 0,
    };
  }, [displayData]);

  const formatXAxis = (value: string) => formatXAxisLabel(value, brushRangeDays);

  // Formatter for the brush slider - uses total data range
  const formatBrushXAxis = (value: string) => formatXAxisLabel(value, totalDataDays);

  // Generate custom ticks aligned to meaningful boundaries
  const xAxisTicks = useMemo(() => {
    return generateXAxisTicks(displayData, brushRangeDays, "day");
  }, [displayData, brushRangeDays]);

  const formatTooltipDate = (value: string) => {
    if (period === "Y") {
      return value;
    }

    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
      }
      return value;
    }

    const date = new Date(value);

    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);

      const startMonth = date.toLocaleDateString("en-US", { month: "long" });
      const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
      const startDay = date.getDate();
      const endDay = endDate.getDate();
      const year = endDate.getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay}-${endDay}, ${year}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
      }
    }

    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const Icon = config.icon;

  // export single chart data as csv
  const downloadChartCSV = () => {
    if (!displayDataWithCumulative || displayDataWithCumulative.length === 0)
      return;

    // Build CSV headers based on available data
    const headers = ["Date", config.title];
    const hasSecondary = displayDataWithCumulative.some(
      (d: any) => d.secondary !== undefined && d.secondary !== null
    );
    const hasCumulative = displayDataWithCumulative.some(
      (d: any) => d.cumulative !== undefined && d.cumulative !== null
    );

    if (hasSecondary) {
      headers.push(`${config.title} (Max)`);
    }
    if (hasCumulative) {
      headers.push(`${config.title} (Cumulative)`);
    }

    const rows = displayDataWithCumulative.map((point: any) => {
      const row = [point.day, point.value];
      if (hasSecondary) {
        row.push(point.secondary ?? "");
      }
      if (hasCumulative) {
        row.push(point.cumulative ?? "");
      }
      return row.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.title.replace(/\s+/g, "_")}_${period}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      className="py-0 border-gray-200 rounded-md dark:border-gray-700"
      ref={chartContainerRef}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon
                className="h-5 w-5 sm:h-6 sm:w-6"
                style={{ color: config.color }}
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">
                {config.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) =>
                onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")
              }
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D"
                    ? "Daily"
                    : period === "W"
                    ? "Weekly"
                    : period === "M"
                    ? "Monthly"
                    : period === "Q"
                    ? "Quarterly"
                    : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const)
                  .filter((p) => allowedPeriods.includes(p))
                  .map((p) => (
                    <SelectItem key={p} value={p}>
                      {p === "D"
                        ? "Daily"
                        : p === "W"
                        ? "Weekly"
                        : p === "M"
                        ? "Monthly"
                        : p === "Q"
                        ? "Quarterly"
                        : "Yearly"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Image options"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowImageStudio(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Open in studio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleScreenshot}>
                  <Download className="h-4 w-4 mr-2" />
                  Download as image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={downloadChartCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Check if period is supported */}
          {!allowedPeriods.includes(period) ? (
            <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground gap-2">
              <p className="text-sm">
                Data not available in{" "}
                {period === "D"
                  ? "daily"
                  : period === "W"
                  ? "weekly"
                  : period === "M"
                  ? "monthly"
                  : period === "Q"
                  ? "quarterly"
                  : "yearly"}{" "}
                granularity
              </p>
              <p className="text-xs">
                Available:{" "}
                {allowedPeriods
                  .map((p) =>
                    p === "D"
                      ? "Daily"
                      : p === "W"
                      ? "Weekly"
                      : p === "M"
                      ? "Monthly"
                      : p === "Q"
                      ? "Quarterly"
                      : "Yearly"
                  )
                  .join(", ")}
              </p>
            </div>
          ) : (
            <>
              {/* Current Value and Change */}
              <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 flex-wrap">
                {config.chartType === "dual" &&
                secondaryCurrentValue !== null &&
                secondaryCurrentValue !== undefined ? (
                  <div className="text-md sm:text-base font-mono">
                    Avg:{" "}
                    {formatTooltipValue(
                      typeof currentValue === "string"
                        ? parseFloat(currentValue)
                        : currentValue
                    )}{" "}
                    / Max:{" "}
                    {formatTooltipValue(
                      typeof secondaryCurrentValue === "string"
                        ? parseFloat(secondaryCurrentValue)
                        : secondaryCurrentValue
                    )}
                  </div>
                ) : (
                  <div className="text-md sm:text-base font-mono break-all">
                    {formatTooltipValue(
                      typeof currentValue === "string"
                        ? parseFloat(currentValue)
                        : currentValue
                    )}
                  </div>
                )}
                {dynamicChange.change > 0 && config.chartType !== "dual" && (
                  <div
                    className={`flex items-center gap-1 text-xs sm:text-sm ${
                      dynamicChange.isPositive
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                    title={`Change over selected time range`}
                  >
                    <TrendingUp
                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                        dynamicChange.isPositive ? "" : "rotate-180"
                      }`}
                    />
                    {dynamicChange.change >= 1000
                      ? dynamicChange.change >= 1000000
                        ? `${(dynamicChange.change / 1000000).toFixed(1)}M%`
                        : `${(dynamicChange.change / 1000).toFixed(1)}K%`
                      : `${dynamicChange.change.toFixed(1)}%`}
                  </div>
                )}
                {/* for cumulative charts */}
                {config.chartType === "bar" &&
                  (config.metricKey === "txCount" ||
                    config.metricKey === "activeAddresses" ||
                    config.metricKey === "contracts" ||
                    config.metricKey === "deployers") && (
                    <div className="flex items-center gap-3 ml-auto text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-muted-foreground">
                          {period === "D"
                            ? "Daily"
                            : period === "W"
                            ? "Weekly"
                            : period === "M"
                            ? "Monthly"
                            : period === "Q"
                            ? "Quarterly"
                            : "Yearly"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-0.5"
                          style={{ backgroundColor: "#a855f7" }}
                        />
                        <span style={{ color: "#a855f7" }}>Total</span>
                      </div>
                    </div>
                  )}
                {/* for dual charts */}
                {config.chartType === "dual" && (
                  <div className="flex items-center gap-3 ml-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-muted-foreground">Avg</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: "#a855f7" }}
                      />
                      <span style={{ color: "#a855f7" }}>Max</span>
                    </div>
                  </div>
                )}
                {/* for charts with moving average */}
                {showMovingAverage &&
                  config.chartType === "bar" &&
                  !(
                    config.metricKey === "txCount" ||
                    config.metricKey === "activeAddresses" ||
                    config.metricKey === "contracts" ||
                    config.metricKey === "deployers"
                  ) && (
                    <div className="flex items-center gap-3 ml-auto text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-muted-foreground">
                          {period === "D"
                            ? "Daily"
                            : period === "W"
                            ? "Weekly"
                            : period === "M"
                            ? "Monthly"
                            : period === "Q"
                            ? "Quarterly"
                            : "Yearly"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-0.5"
                          style={{ backgroundColor: "#22c55e" }}
                        />
                        <span style={{ color: "#22c55e" }}>
                          {maConfig.label}
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              <ChartWatermark className="mb-6">
                {displayData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    {config.chartType === "bar" &&
                    (config.metricKey === "txCount" ||
                      config.metricKey === "activeAddresses" ||
                      config.metricKey === "contracts" ||
                      config.metricKey === "deployers") ? (
                      <ComposedChart
                        data={displayDataWithCumulative}
                        margin={{ top: 10, right: 15, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatXAxis}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                          ticks={xAxisTicks}
                          interval={0}
                        />
                        <YAxis
                          yAxisId="left"
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: `${config.color}20` }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(
                              payload[0].payload.day
                            );
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="font-medium text-sm">
                                    {formattedDate}
                                  </div>
                                  <div className="text-xs">
                                    {formatTooltipValue(
                                      payload[0].value as number
                                    )}
                                  </div>
                                  {payload[0].payload.cumulative && (
                                    <div className="text-xs text-muted-foreground">
                                      Total:{" "}
                                      {formatYAxisValue(
                                        payload[0].payload.cumulative
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill={config.color}
                          radius={[4, 4, 0, 0]}
                          yAxisId="left"
                          name={
                            config.metricKey === "txCount"
                              ? "Transactions"
                              : config.metricKey === "activeAddresses"
                              ? "Active Addresses"
                              : config.metricKey === "contracts"
                              ? "Contracts Deployed"
                              : "Contract Deployers"
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#a855f7"
                          strokeWidth={1}
                          dot={false}
                          yAxisId="right"
                          name={
                            config.metricKey === "txCount"
                              ? "Total Transactions"
                              : config.metricKey === "activeAddresses"
                              ? "Total Addresses"
                              : config.metricKey === "contracts"
                              ? "Total Contracts"
                              : "Total Deployers"
                          }
                          strokeOpacity={0.9}
                        />
                      </ComposedChart>
                    ) : config.chartType === "bar" && showMovingAverage ? (
                      <ComposedChart
                        data={displayDataWithCumulative}
                        margin={{ top: 10, right: 40, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatXAxis}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                          ticks={xAxisTicks}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: `${config.color}20` }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(
                              payload[0].payload.day
                            );
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="font-medium text-xs">
                                    {formattedDate}
                                  </div>
                                  <div className="text-xs">
                                    {formatTooltipValue(
                                      payload[0].value as number
                                    )}
                                  </div>
                                  {payload[0].payload.ma !== undefined && (
                                    <div
                                      className="text-xs"
                                      style={{ color: "#22c55e" }}
                                    >
                                      {maConfig.label}:{" "}
                                      {formatTooltipValue(
                                        payload[0].payload.ma
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill={config.color}
                          radius={[4, 4, 0, 0]}
                        />
                        <Line
                          type="monotone"
                          dataKey="ma"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          name="Moving Average"
                        />
                      </ComposedChart>
                    ) : config.chartType === "bar" ? (
                      <BarChart
                        data={displayDataWithCumulative}
                        margin={{ top: 10, right: 40, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatXAxis}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                          ticks={xAxisTicks}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: `${config.color}20` }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(
                              payload[0].payload.day
                            );
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="font-medium text-xs">
                                    {formattedDate}
                                  </div>
                                  <div className="text-xs">
                                    {formatTooltipValue(
                                      payload[0].value as number
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill={config.color}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    ) : config.chartType === "area" ? (
                      <AreaChart
                        data={displayDataWithCumulative}
                        margin={{ top: 10, right: 40, left: 15, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id={`gradient-${config.metricKey}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={config.color}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={config.color}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatXAxis}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                          ticks={xAxisTicks}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: `${config.color}20` }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(
                              payload[0].payload.day
                            );
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="font-medium text-xs">
                                    {formattedDate}
                                  </div>
                                  <div className="text-xs">
                                    {formatTooltipValue(
                                      payload[0].value as number
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={config.color}
                          fill={`url(#gradient-${config.metricKey})`}
                          strokeWidth={1}
                        />
                      </AreaChart>
                    ) : config.chartType === "dual" ? (
                      <BarChart
                        data={displayDataWithCumulative}
                        margin={{ top: 10, right: 40, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatXAxis}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                          ticks={xAxisTicks}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: `${config.color}20` }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(
                              payload[0].payload.day
                            );
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="font-medium text-sm">
                                    {formattedDate}
                                  </div>
                                  {payload[0].payload.secondary && (
                                    <div className="text-xs flex items-center gap-1.5">
                                      <div
                                        className="w-2 h-2 rounded"
                                        style={{ backgroundColor: "#a855f7" }}
                                      />
                                      <span style={{ color: "#a855f7" }}>
                                        Max:{" "}
                                        {formatTooltipValue(
                                          payload[0].payload.secondary
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  <div className="text-xs flex items-center gap-1.5">
                                    <div
                                      className="w-2 h-2 rounded"
                                      style={{ backgroundColor: config.color }}
                                    />
                                    <span style={{ color: config.color }}>
                                      Avg:{" "}
                                      {formatTooltipValue(
                                        payload[0].payload.value
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="value"
                          stackId="stack"
                          fill={config.color}
                          radius={[0, 0, 0, 0]}
                          name="Average"
                        />
                        <Bar
                          dataKey="maxMinusAvg"
                          stackId="stack"
                          fill="#a855f7"
                          radius={[4, 4, 0, 0]}
                          name="Max (additional)"
                        />
                      </BarChart>
                    ) : (
                      <LineChart
                        data={displayDataWithCumulative}
                        margin={{ top: 10, right: 40, left: 15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatXAxis}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                          ticks={xAxisTicks}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={formatYAxisValue}
                          className="text-xs text-gray-600 dark:text-gray-400"
                          tick={{
                            className: "fill-gray-600 dark:fill-gray-400",
                          }}
                        />
                        <Tooltip
                          cursor={{
                            stroke: config.color,
                            strokeWidth: 1,
                            strokeDasharray: "5 5",
                          }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(
                              payload[0].payload.day
                            );
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="font-medium text-xs">
                                    {formattedDate}
                                  </div>
                                  <div className="text-xs">
                                    {formatTooltipValue(
                                      payload[0].value as number
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={config.color}
                          strokeWidth={1}
                          dot={false}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Loading chart data...
                  </div>
                )}
              </ChartWatermark>

              {/* Brush Slider */}
              {aggregatedData.length > 0 &&
                brushIndexes &&
                !isNaN(brushIndexes.startIndex) &&
                !isNaN(brushIndexes.endIndex) &&
                brushIndexes.startIndex >= 0 &&
                brushIndexes.endIndex < aggregatedData.length && (
                  <div className="mt-4 bg-white dark:bg-black pl-[60px]">
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart
                        data={aggregatedData}
                        margin={{ top: 0, right: 40, left: 15, bottom: 5 }}
                      >
                        <Brush
                          dataKey="day"
                          height={80}
                          stroke={config.color}
                          fill={`${config.color}20`}
                          alwaysShowText={false}
                          startIndex={brushIndexes.startIndex}
                          endIndex={brushIndexes.endIndex}
                          onChange={(e: any) => {
                            if (
                              e.startIndex !== undefined &&
                              e.endIndex !== undefined &&
                              !isNaN(e.startIndex) &&
                              !isNaN(e.endIndex)
                            ) {
                              setBrushIndexes({
                                startIndex: e.startIndex,
                                endIndex: e.endIndex,
                              });
                            }
                          }}
                          travellerWidth={8}
                          tickFormatter={formatBrushXAxis}
                        >
                          <LineChart>
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={config.color}
                              strokeWidth={1}
                              dot={false}
                            />
                          </LineChart>
                        </Brush>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </>
          )}
        </div>
      </CardContent>

      {/* Image Export Studio Modal */}
      <ImageExportStudio
        isOpen={showImageStudio}
        onClose={() => setShowImageStudio(false)}
        period={period}
        onPeriodChange={onPeriodChange}
        allowedPeriods={allowedPeriods}
        dataArray={aggregatedData}
        seriesInfo={[{
          id: "value",
          name: config.title,
          color: config.color,
          yAxis: "left",
        }]}
        chartData={{
          title: config.title,
          source: "Avalanche Metrics",
          sourceDescription: config.description,
          chainName: chainName || "Avalanche",
          metricValue: currentValue !== undefined && currentValue !== null
            ? typeof currentValue === 'number'
              ? (() => {
                  const prefix = config.isCurrency ? '$' : '';
                  if (currentValue >= 1e9) return `${prefix}${(currentValue / 1e9).toFixed(1)}B`;
                  if (currentValue >= 1e6) return `${prefix}${(currentValue / 1e6).toFixed(1)}M`;
                  if (currentValue >= 1e3) return `${prefix}${(currentValue / 1e3).toFixed(1)}K`;
                  return currentValue.toLocaleString();
                })()
              : String(currentValue)
            : undefined,
          metricLabel: "Latest",
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }}
        // Collage mode props
        chainId={chainId}
        chainName={chainName || "Avalanche"}
        availableMetrics={allChartConfigs}
      />
    </Card>
  );
}
