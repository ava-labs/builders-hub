"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer, ComposedChart } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {Users, Activity, FileText, MessageSquare, TrendingUp, UserPlus, Hash, Code2, Gauge, DollarSign, Clock, Fuel, ArrowUpRight, Twitter, Linkedin } from "lucide-react";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import Link from "next/link";
import Image from "next/image";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { ChainCategoryFilter, allChains } from "@/components/stats/ChainCategoryFilter";
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
  const [cachedAllData, setCachedAllData] = useState<CChainMetrics | null>(null);
  
  // Filtering state (only for "all chains" view)
  const isAllChainsView = chainSlug === 'all' || chainSlug === 'all-chains' || chainSlug === 'network-metrics';
  
  // Initialize selectedChainIds from URL params (only for all chains view)
  const getInitialSelectedChainIds = useCallback(() => {
    // Only read from URL params if we're on the "all" page
    if (isAllChainsView) {
      const excludedParam = searchParams.get('excludedChainIds');
      if (excludedParam) {
        const excludedIds = new Set(excludedParam.split(',').filter(Boolean));
        // Return all chains except excluded ones
        return new Set(allChains.map(c => c.chainId).filter(id => !excludedIds.has(id)));
      }
    }
    // Default: all chains selected
    return new Set(allChains.map(c => c.chainId));
  }, [searchParams, isAllChainsView]);
  
  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(getInitialSelectedChainIds);
  
  // Track if this is user-initiated change (not from URL sync)
  const [urlSyncNeeded, setUrlSyncNeeded] = useState(false);
  
  // Update URL when selection changes (only for all chains view) - via useEffect to avoid setState during render
  useEffect(() => {
    if (!isAllChainsView || !urlSyncNeeded) return;
    
    const excludedIds = allChains
      .filter(c => !selectedChainIds.has(c.chainId))
      .map(c => c.chainId);
    
    const params = new URLSearchParams(searchParams.toString());
    
    if (excludedIds.length === 0) {
      // All selected, remove param
      params.delete('excludedChainIds');
    } else {
      params.set('excludedChainIds', excludedIds.join(','));
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
    setUrlSyncNeeded(false);
  }, [isAllChainsView, pathname, router, searchParams, selectedChainIds, urlSyncNeeded]);
  
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
    ? (l1ChainsData as L1Chain[]).find(c => c.slug === chainSlug) 
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
        ...baseExplorers.filter(e => e.name !== "BuilderHub"), // Avoid duplicates
      ];
    }
    return baseExplorers;
  }, [rpcUrl, chainData?.rpcUrl, chainSlug, baseExplorers]);
  
  // Determine which chainIds are EXCLUDED (not selected)
  const excludedChainIds = useMemo(() => {
    if (!isAllChainsView) return [];
    if (selectedChainIds.size === allChains.length) return []; // All selected, no exclusions
    if (selectedChainIds.size === 0) return allChains.map(c => c.chainId); // None selected, all excluded
    return allChains.filter(c => !selectedChainIds.has(c.chainId)).map(c => c.chainId);
  }, [isAllChainsView, selectedChainIds]);

  // Helper function to subtract metric values
  const subtractMetricValues = (allData: CChainMetrics, excludedData: CChainMetrics[]): CChainMetrics => {
    const result = JSON.parse(JSON.stringify(allData)) as CChainMetrics;
    
    // Helper to subtract time series data
    const subtractTimeSeries = (allSeries: any, excludedSeries: any[]) => {
      if (!allSeries?.data) return allSeries;
      
      const subtracted = { ...allSeries };
      subtracted.data = allSeries.data.map((point: any) => {
        let value = typeof point.value === 'number' ? point.value : parseFloat(point.value) || 0;
        
        excludedSeries.forEach(excluded => {
          if (excluded?.data) {
            const matchingPoint = excluded.data.find((p: any) => p.date === point.date);
            if (matchingPoint) {
              const excludedValue = typeof matchingPoint.value === 'number' ? matchingPoint.value : parseFloat(matchingPoint.value) || 0;
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
      'activeSenders', 'cumulativeAddresses', 'cumulativeDeployers', 
      'txCount', 'cumulativeTxCount', 'cumulativeContracts', 'contracts', 
      'deployers', 'gasUsed', 'feesPaid'
    ] as const;
    
    metricKeys.forEach(key => {
      if (result[key]) {
        result[key] = subtractTimeSeries(
          result[key], 
          excludedData.map(d => d[key]).filter(Boolean)
        );
      }
    });
    
    // Handle activeAddresses (nested structure)
    if (result.activeAddresses) {
      ['daily', 'weekly', 'monthly'].forEach(period => {
        if ((result.activeAddresses as any)[period]) {
          (result.activeAddresses as any)[period] = subtractTimeSeries(
            (result.activeAddresses as any)[period],
            excludedData.map(d => (d.activeAddresses as any)?.[period]).filter(Boolean)
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
          
          excludedData.forEach(excluded => {
            if (excluded?.icmMessages?.data) {
              const matchingPoint = excluded.icmMessages.data.find((p: any) => p.date === point.date);
              if (matchingPoint) {
                messageCount = Math.max(0, messageCount - (matchingPoint.messageCount || 0));
              }
            }
          });
          
          return { ...point, messageCount };
        }),
        current_value: 0,
      };
      if (result.icmMessages.data.length > 0) {
        result.icmMessages.current_value = result.icmMessages.data[0].messageCount || 0;
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
      const response = await fetch(`/api/chain-stats/${chainId}?timeRange=all`);
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
              const response = await fetch(`/api/chain-stats/${cid}?timeRange=all`);
              if (!response.ok) return null;
              return await response.json();
            } catch {
              return null;
            }
          })
        );
        
        const validExcluded = excludedResults.filter(r => r !== null) as CChainMetrics[];
        
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
  }, [isAllChainsView, chainId, selectedChainIds.size, excludedChainIds.join(',')]);

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
    const value = typeof avaxValue === "string" ? Number.parseFloat(avaxValue) : avaxValue;
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
    metricKey: keyof Omit<CChainMetrics, "last_updated" | "icmMessages" | "activeAddresses"> | "activeAddresses",
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
          value: typeof point.value === "string" ? Number.parseFloat(point.value) : point.value,
        }))
        .reverse();
    }

    // Handle other metrics normally
    const metric = metrics[metricKey as keyof Omit<CChainMetrics, "last_updated" | "icmMessages" | "activeAddresses">];
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
      "icmMessages"
    ].includes(metricKey) ? Math.round(value) : value;

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
    const grouped = new Map<string, { sum: number; count: number; date: string }>();
    
    rawData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    const aggregated = Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return aggregated.length > 0 ? aggregated[aggregated.length - 1].sum : "N/A";
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

    const metric = metrics[metricKey as keyof Omit<CChainMetrics, "last_updated" | "activeAddresses">];
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
      secondaryMetricKey: "maxGps" as const,
      description: "Average and peak gas per second",
      color: themeColor,
      chartType: "dual" as const,
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
      title: "Gas Price",
      icon: DollarSign,
      metricKey: "avgGasPrice" as const,
      secondaryMetricKey: "maxGasPrice" as const,
      description: "Average and peak gas price over time",
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
    },
    {
      title: "Interchain Messages",
      icon: MessageSquare,
      metricKey: "icmMessages" as const,
      description: "Interchain messaging activity",
      color: themeColor,
      chartType: "bar" as const,
    },
  ];

  const [chartPeriods, setChartPeriods] = useState<
    Record<string, "D" | "W" | "M" | "Q" | "Y">
  >(Object.fromEntries(chartConfigs.map((config) => [config.metricKey, "D"])));

  // Active section tracking
  const [activeSection, setActiveSection] = useState<string>("overview");

  // Chart categories for navigation
  const chartCategories = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity", metricKeys: ["activeAddresses", "activeSenders", "txCount"] },
    { id: "contracts", label: "Contracts", metricKeys: ["contracts", "deployers"] },
    { id: "performance", label: "Performance", metricKeys: ["gasUsed", "avgGps", "avgTps", "avgGasPrice"] },
    { id: "fees", label: "Fees", metricKeys: ["feesPaid"] },
    { id: "interchain", label: "Interchain", metricKeys: ["icmMessages"] },
  ];

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = chartCategories.map(cat => document.getElementById(cat.id));
      const scrollPosition = window.scrollY + 180; // Account for navbar height

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(chartCategories[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Set initial state
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 180; // Account for both navbars
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  };

  // Get charts for a category
  const getChartsByCategory = (metricKeys: string[]) => {
    return chartConfigs.filter((config) => metricKeys.includes(config.metricKey));
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
                <div key={i} className="h-7 sm:h-8 w-20 sm:w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse flex-shrink-0" />
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
                <div key={i} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
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
                <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
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
                          <div key={j} className="h-7 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
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
          <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} isCustomChain={!chainData} />
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
          <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} isCustomChain={!chainData} />
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
                  <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142" />
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
                        (e.target as HTMLImageElement).style.display = 'none';
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
                {(subnetId || blockchainId || (rpcUrl || chainData?.rpcUrl)) && (
                  <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ChainIdChips subnetId={subnetId} blockchainId={blockchainId} />
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
                {(website || socials || explorers) && (
                  <div className="flex sm:hidden items-center gap-2 mt-4">
                    {website && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                      >
                        <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                          Website
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
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
                )}
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

            {/* Desktop Social Links - hidden on mobile */}
            <div className="hidden sm:flex flex-row items-end gap-2">
              <div className="flex items-center gap-2">
                {website && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
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
      <div className="sticky top-14 z-30 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800">
        <div className="w-full">
          <div 
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto"
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {chartCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => scrollToSection(category.id)}
                className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                  activeSection === category.id
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">

        {/* Loading skeleton for filter changes (not initial load) */}
        {loading && !isInitialLoad && (
          <div className="space-y-12 sm:space-y-16">
            {/* Network Overview Skeleton */}
            <section className="space-y-4 sm:space-y-6">
              <div className="h-6 sm:h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
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
                  <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
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
                            <div key={j} className="h-7 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
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
        <section id="overview" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Network Overview
            </h2>
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
                icon: MessageSquare,
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
                  className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-800 p-4"
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
        <section id="activity" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Activity
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Address and transaction activity over time
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {getChartsByCategory(["activeAddresses", "activeSenders", "txCount"])
              .map((config) => {
                const period = chartPeriods[config.metricKey];
                
                const rawData = config.metricKey === "icmMessages" ? getICMChartData() : getChartData(config.metricKey, period);
                if (rawData.length === 0) return null;
                
                // Get current value from aggregated data based on selected period
                const currentValue = getCurrentValueFromData(rawData, period, config.metricKey);
                let cumulativeData = null;
                if (config.metricKey === "txCount") cumulativeData = getChartData("cumulativeTxCount");
                else if (config.metricKey === "activeAddresses") cumulativeData = getChartData("cumulativeAddresses");
                let secondaryData = null;
                let secondaryCurrentValue = null;
                if (config.chartType === "dual" && config.secondaryMetricKey) {
                  secondaryData = getChartData(config.secondaryMetricKey);
                  secondaryCurrentValue = getCurrentValue(config.secondaryMetricKey);
                }

                // Determine allowed periods based on metric type
                let allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = ["D", "W", "M", "Q", "Y"];
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
                    onPeriodChange={(newPeriod) => setChartPeriods((prev) => ({ ...prev, [config.metricKey]: newPeriod }))}
                    formatTooltipValue={(value) => formatTooltipValue(value, config.metricKey)}
                    formatYAxisValue={formatNumber}
                    allowedPeriods={allowedPeriods}
                  />
                );
              })}
          </div>
        </section>

        {/* Contracts Section */}
        <section id="contracts" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Contracts
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Smart contract deployment activity
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {getChartsByCategory(["contracts", "deployers"])
              .map((config) => {
                const period = chartPeriods[config.metricKey];
                const rawData = getChartData(config.metricKey as keyof Omit<CChainMetrics, "last_updated" | "icmMessages">, period);
                if (rawData.length === 0) return null;
                // Get current value from aggregated data based on selected period
                const currentValue = getCurrentValueFromData(rawData, period, config.metricKey);
                let cumulativeData = null;
                if (config.metricKey === "contracts") cumulativeData = getChartData("cumulativeContracts");
                else if (config.metricKey === "deployers") cumulativeData = getChartData("cumulativeDeployers");

                // All periods allowed for contracts and deployers
                const allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = ["D", "W", "M", "Q", "Y"];
                
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
                    onPeriodChange={(newPeriod) => setChartPeriods((prev) => ({ ...prev, [config.metricKey]: newPeriod }))}
                    formatTooltipValue={(value) => formatTooltipValue(value, config.metricKey)}
                    formatYAxisValue={formatNumber}
                    allowedPeriods={allowedPeriods}
                  />
                );
              })}
          </div>
        </section>

        {/* Performance Section */}
        <section id="performance" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Performance
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Network throughput and gas metrics
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {getChartsByCategory(["gasUsed", "avgGps", "avgTps", "avgGasPrice"])
              .map((config) => {
                const period = chartPeriods[config.metricKey];
                const rawData = getChartData(config.metricKey as keyof Omit<CChainMetrics, "last_updated" | "icmMessages">, period);
                if (rawData.length === 0) return null;
                // Get current value from aggregated data based on selected period
                const currentValue = getCurrentValueFromData(rawData, period, config.metricKey);
                let secondaryData = null;
                let secondaryCurrentValue = null;
                if (config.chartType === "dual" && config.secondaryMetricKey) {
                  secondaryData = getChartData(config.secondaryMetricKey);
                  secondaryCurrentValue = getCurrentValue(config.secondaryMetricKey);
                }

                // Determine allowed periods based on metric type
                let allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = ["D", "W", "M", "Q", "Y"];
                // GPS, TPS, and Gas Price are only available on Daily
                if (["avgGps", "maxGps", "avgTps", "maxTps", "avgGasPrice", "maxGasPrice"].includes(config.metricKey)) {
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
                    onPeriodChange={(newPeriod) => setChartPeriods((prev) => ({ ...prev, [config.metricKey]: newPeriod }))}
                    formatTooltipValue={(value) => formatTooltipValue(value, config.metricKey)}
                    formatYAxisValue={formatNumber}
                    allowedPeriods={allowedPeriods}
                  />
                );
              })}
          </div>
        </section>

        {/* Fees Section */}
        <section id="fees" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Fees
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Transaction fee metrics
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {getChartsByCategory(["feesPaid"])
              .map((config) => {
                const period = chartPeriods[config.metricKey];
                const rawData = getChartData(config.metricKey as keyof Omit<CChainMetrics, "last_updated" | "icmMessages">, period);
                if (rawData.length === 0) return null;
                // Get current value from aggregated data based on selected period
                const currentValue = getCurrentValueFromData(rawData, period, config.metricKey);

                // All periods allowed for fees
                const allowedPeriods: ("D" | "W" | "M" | "Q" | "Y")[] = ["D", "W", "M", "Q", "Y"];
                
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
                    onPeriodChange={(newPeriod) => setChartPeriods((prev) => ({ ...prev, [config.metricKey]: newPeriod }))}
                    formatTooltipValue={(value) => formatTooltipValue(value, config.metricKey)}
                    formatYAxisValue={formatNumber}
                    allowedPeriods={allowedPeriods}
                  />
                );
              })}
          </div>
        </section>

        {/* Interchain Section */}
        <section id="interchain" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Interchain
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Cross-chain messaging activity
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {getChartsByCategory(["icmMessages"])
              .map((config) => {
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
                    onPeriodChange={(newPeriod) => setChartPeriods((prev) => ({ ...prev, [config.metricKey]: newPeriod }))}
                    formatTooltipValue={(value) => formatTooltipValue(value, config.metricKey)}
                    formatYAxisValue={formatNumber}
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
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} isCustomChain={!chainData} />
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
}) {
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  // Aggregate data based on selected period
  const aggregatedData = useMemo(() => {
    if (period === "D") return rawData;

    // For active addresses, don't aggregate since data is already fetched with proper interval
    if (
      config.metricKey === "activeAddresses" &&
      (period === "W" || period === "M")
    ) {
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

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.sum,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rawData, period, config.metricKey]);

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
    if (aggregatedData.length === 0) return;

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
  }, [period, aggregatedData.length]);

  const displayData = brushIndexes
    ? aggregatedData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1)
    : aggregatedData;

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

  const formatXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) { return `${parts[1]} '${parts[0].slice(-2)}` }
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatBrushXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) { return `${parts[1]} ${parts[0]}` }
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") { return value }
    
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

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
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
          <div className="flex gap-0.5 sm:gap-1">
            {(["D", "W", "M", "Q", "Y"] as const)
              .filter((p) => allowedPeriods.includes(p))
              .map((p) => (
                <button
                  key={p}
                  onClick={() => onPeriodChange(p)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm  rounded-md transition-colors ${
                    period === p
                      ? "text-white dark:text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  style={
                    period === p
                      ? { backgroundColor: `${config.color}`, opacity: 0.9 }
                      : {}
                  }
                >
                  {p}
                </button>
              ))}
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Current Value and Change */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4 flex-wrap">
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
                className={`flex items-center gap-1 text-xs sm:text-sm ${dynamicChange.isPositive ? "text-green-600" : "text-red-600"}`}
                title={`Change over selected time range`}
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${dynamicChange.isPositive ? "" : "rotate-180"}`}
                />
                {dynamicChange.change >= 1000
                  ? dynamicChange.change >= 1000000
                    ? `${(dynamicChange.change / 1000000).toFixed(1)}M%`
                    : `${(dynamicChange.change / 1000).toFixed(1)}K%`
                  : `${dynamicChange.change.toFixed(1)}%`}
              </div>
            )}
            {/* for cumulative charts */}
            {config.chartType === "bar" && (config.metricKey === "txCount" || config.metricKey === "activeAddresses" || config.metricKey === "contracts" || config.metricKey === "deployers") && (
                <div className="flex items-center gap-3 ml-auto text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color }}/>
                    <span className="text-muted-foreground">
                      {period === "D" ? "Daily": period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
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
          </div>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={400}>
              {config.chartType === "bar" &&
              (config.metricKey === "txCount" ||
                config.metricKey === "activeAddresses" ||
                config.metricKey === "contracts" ||
                config.metricKey === "deployers") ? (
                <ComposedChart
                  data={displayDataWithCumulative}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
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
                              {formatTooltipValue(payload[0].value as number)}
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
              ) : config.chartType === "bar" ? (
                <BarChart
                  data={displayDataWithCumulative}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${config.color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-xs">
                              {formattedDate}
                            </div>
                            <div className="text-xs">
                              {formatTooltipValue(payload[0].value as number)}
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
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${config.color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-xs">
                              {formattedDate}
                            </div>
                            <div className="text-xs">
                              {formatTooltipValue(payload[0].value as number)}
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
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
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
                                {formatTooltipValue(payload[0].payload.value)}
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
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{
                      stroke: config.color,
                      strokeWidth: 1,
                      strokeDasharray: "5 5",
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-xs">
                              {formattedDate}
                            </div>
                            <div className="text-xs">
                              {formatTooltipValue(payload[0].value as number)}
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
          </div>

          {/* Brush Slider */}
          <div className="mt-4 bg-white dark:bg-black pl-[60px]">
            <ResponsiveContainer width="100%" height={80}>
              <LineChart
                data={aggregatedData}
                margin={{ top: 0, right: 30, left: 0, bottom: 5 }}
              >
                <Brush
                  dataKey="day"
                  height={80}
                  stroke={config.color}
                  fill={`${config.color}20`}
                  alwaysShowText={false}
                  startIndex={brushIndexes?.startIndex ?? 0}
                  endIndex={brushIndexes?.endIndex ?? aggregatedData.length - 1}
                  onChange={(e: any) => {
                    if (
                      e.startIndex !== undefined &&
                      e.endIndex !== undefined
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
        </div>
      </CardContent>
    </Card>
  );
}