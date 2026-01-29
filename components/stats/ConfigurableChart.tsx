"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { Area, Bar, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer, ComposedChart } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, X, Eye, EyeOff, Plus, Camera, Loader2, ChevronLeft, GripVertical, Layers, Pencil, Maximize2, Minimize2, Trash2, CalendarIcon, RefreshCw, Sparkles, Download, Copy } from "lucide-react";
import l1ChainsData from "@/constants/l1-chains.json";
import Image from "next/image";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import { ChartWatermark } from "@/components/stats/ChartWatermark";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { ImageExportStudio } from "@/components/stats/image-export";

// Types
interface TimeSeriesDataPoint {
  date: string;
  value: number | string;
}

interface TimeSeriesMetric {
  current_value: number | string;
  data: TimeSeriesDataPoint[];
}

interface ICMDataPoint {
  date: string;
  messageCount: number;
}

interface ICMMetric {
  current_value: number;
  data: ICMDataPoint[];
}

interface ChainMetrics {
  activeAddresses: TimeSeriesMetric;
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
  dailyRewards?: TimeSeriesMetric;
  cumulativeRewards?: TimeSeriesMetric;
  // Primary Network specific metrics
  netCumulativeEmissions?: TimeSeriesMetric;
  netEmissionsDaily?: TimeSeriesMetric;
  cumulativeBurn?: TimeSeriesMetric;
  totalBurnDaily?: TimeSeriesMetric;
  cChainFeesDaily?: TimeSeriesMetric;
  pChainFeesDaily?: TimeSeriesMetric;
  xChainFeesDaily?: TimeSeriesMetric;
  validatorFeesDaily?: TimeSeriesMetric;
  cumulativeCChainFees?: TimeSeriesMetric;
  cumulativePChainFees?: TimeSeriesMetric;
  cumulativeXChainFees?: TimeSeriesMetric;
  cumulativeValidatorFees?: TimeSeriesMetric;
  last_updated: number;
}

export interface DataSeries {
  id: string;
  name: string;
  color: string;
  yAxis: "left" | "right" | "y3" | "y4";
  visible: boolean;
  chartStyle: "line" | "bar" | "area";
  chainId: string;
  chainName: string;
  metricKey: string;
  zIndex: number;
}

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface ConfigurableChartProps {
  title?: string;
  initialDataSeries?: Partial<DataSeries>[];
  initialStackSameMetrics?: boolean;
  initialAbbreviateNumbers?: boolean;
  colSpan?: 6 | 12;
  onColSpanChange?: (colSpan: 6 | 12) => void;
  onTitleChange?: (title: string) => void;
  onDataSeriesChange?: (dataSeries: DataSeries[]) => void;
  onStackSameMetricsChange?: (stackSameMetrics: boolean) => void;
  onAbbreviateNumbersChange?: (abbreviateNumbers: boolean) => void;
  onRemove?: () => void;
  disableControls?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  onTimeFilterChange?: (startTime: string | null, endTime: string | null) => void;
  reloadTrigger?: number;
  initialBrushStartIndex?: number | null;
  initialBrushEndIndex?: number | null;
  onBrushChange?: (startIndex: number | null, endIndex: number | null) => void;
}

const DEFAULT_COLORS = [
  "#FF6B35", // Orange
  "#4ECDC4", // Cyan
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#A855F7", // Purple
  "#EC4899", // Pink
];

// Available metrics from ChainMetricsPage
const AVAILABLE_METRICS = [
  { id: "activeAddresses", name: "Active Addresses" },
  { id: "activeSenders", name: "Active Senders" },
  { id: "cumulativeAddresses", name: "Cumulative Addresses" },
  { id: "cumulativeDeployers", name: "Cumulative Deployers" },
  { id: "txCount", name: "Transactions" },
  { id: "cumulativeTxCount", name: "Cumulative Transactions" },
  { id: "cumulativeContracts", name: "Cumulative Contracts" },
  { id: "contracts", name: "Contracts" },
  { id: "deployers", name: "Deployers" },
  { id: "gasUsed", name: "Gas Used" },
  { id: "avgGps", name: "Avg GPS" },
  { id: "maxGps", name: "Max GPS" },
  { id: "avgTps", name: "Avg TPS" },
  { id: "maxTps", name: "Max TPS" },
  { id: "avgGasPrice", name: "Avg Gas Price" },
  { id: "maxGasPrice", name: "Max Gas Price" },
  { id: "feesPaid", name: "Fees Paid" },
  { id: "icmMessages", name: "ICM Messages" },
  { id: "dailyRewards", name: "Daily Rewards" },
  { id: "cumulativeRewards", name: "Cumulative Rewards" },
  // Primary Network specific metrics
  { id: "cChainFeesDaily", name: "C-Chain Fees" },
  { id: "pChainFeesDaily", name: "P-Chain Fees" },
  { id: "xChainFeesDaily", name: "X-Chain Fees" },
  { id: "validatorFeesDaily", name: "Validator Fees" },
  { id: "cumulativeCChainFees", name: "Cumulative C-Chain Fees" },
  { id: "cumulativePChainFees", name: "Cumulative P-Chain Fees" },
  { id: "cumulativeXChainFees", name: "Cumulative X-Chain Fees" },
  { id: "cumulativeValidatorFees", name: "Cumulative Validator Fees" },
  { id: "totalBurnDaily", name: "Burn" },
  { id: "cumulativeBurn", name: "Cumulative Burn" },
  { id: "netEmissionsDaily", name: "Net Emissions" },
  { id: "netCumulativeEmissions", name: "Net Cumulative Emissions" },
];

// Metrics that are only available for the Primary Network
const PRIMARY_NETWORK_ONLY_METRICS = [
  "dailyRewards", "cumulativeRewards",
  "netCumulativeEmissions", "netEmissionsDaily", "cumulativeBurn", "totalBurnDaily",
  "cChainFeesDaily", "pChainFeesDaily", "xChainFeesDaily", "validatorFeesDaily",
  "cumulativeCChainFees", "cumulativePChainFees", "cumulativeXChainFees", "cumulativeValidatorFees",
];

// Primary Network option for chain selector
const PRIMARY_NETWORK_OPTION = {
  chainId: "primary",
  chainName: "Primary Network",
  chainLogoURI: "", // Will use Avalanche logo
};

export default function ConfigurableChart({
  title = "Chart",
  initialDataSeries = [],
  initialStackSameMetrics = false,
  initialAbbreviateNumbers = true,
  colSpan = 12,
  onColSpanChange,
  onTitleChange,
  onDataSeriesChange,
  onStackSameMetricsChange,
  onAbbreviateNumbersChange,
  onRemove,
  disableControls = false,
  startTime,
  endTime,
  onTimeFilterChange,
  reloadTrigger = 0,
  initialBrushStartIndex,
  initialBrushEndIndex,
  onBrushChange,
}: ConfigurableChartProps) {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [dataSeries, setDataSeries] = useState<DataSeries[]>(() => {
    if (initialDataSeries.length > 0) {
      return initialDataSeries.map((ds, idx) => ({
        id: ds.id || `series-${idx}`,
        name: ds.name || `Series ${idx + 1}`,
        color: ds.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        yAxis: ds.yAxis || "left",
        visible: ds.visible !== undefined ? ds.visible : true,
        chartStyle: ds.chartStyle || "line",
        chainId: ds.chainId || "",
        chainName: ds.chainName || "",
        metricKey: ds.metricKey || "",
        zIndex: ds.zIndex !== undefined ? ds.zIndex : idx + 1,
      }));
    }
    return [];
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [stackSameMetrics, setStackSameMetrics] = useState<boolean>(initialStackSameMetrics);
  const [abbreviateNumbers, setAbbreviateNumbers] = useState<boolean>(initialAbbreviateNumbers);

  const [chartData, setChartData] = useState<Record<string, ChartDataPoint[]>>({});
  const [loadingMetrics, setLoadingMetrics] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<"D" | "W" | "M" | "Q" | "Y">("D");
  const [chartTitle, setChartTitle] = useState<string>(title);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [showTimeFilterPopover, setShowTimeFilterPopover] = useState(false);
  const [localReloadTrigger, setLocalReloadTrigger] = useState<number>(0);
  const prevReloadTriggerRef = useRef<number>(reloadTrigger);
  // Use refs to track latest filter values for reload
  const startTimeRef = useRef<string | null>(startTime);
  const endTimeRef = useRef<string | null>(endTime);
  
  // Update refs when values change
  useEffect(() => {
    startTimeRef.current = startTime;
    endTimeRef.current = endTime;
  }, [startTime, endTime]);
  // Temporary state for editing (only used when popover is open) - includes date and time
  const [tempStartTime, setTempStartTime] = useState<Date | undefined>(
    startTime ? new Date(startTime) : undefined
  );
  const [tempEndTime, setTempEndTime] = useState<Date | undefined>(
    endTime ? new Date(endTime) : undefined
  );
  const [showMetricFilter, setShowMetricFilter] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [metricSearchTerm, setMetricSearchTerm] = useState("");
  const [chainSearchTerm, setChainSearchTerm] = useState("");
  const [showImageStudio, setShowImageStudio] = useState(false);
  const [brushRange, setBrushRange] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setChartTitle(title);
  }, [title]);

  // Initialize temp state when popover opens
  useEffect(() => {
    if (showTimeFilterPopover) {
      setTempStartTime(startTime ? new Date(startTime) : undefined);
      setTempEndTime(endTime ? new Date(endTime) : undefined);
    }
  }, [showTimeFilterPopover, startTime, endTime]);

  // Notify parent when dataSeries changes
  const prevDataSeriesRef = useRef<DataSeries[]>(dataSeries);
  const onDataSeriesChangeRef = useRef(onDataSeriesChange);
  onDataSeriesChangeRef.current = onDataSeriesChange;

  useEffect(() => {
    // Only call callback if dataSeries actually changed
    const hasChanged = JSON.stringify(prevDataSeriesRef.current) !== JSON.stringify(dataSeries);
    if (hasChanged && onDataSeriesChangeRef.current) {
      prevDataSeriesRef.current = dataSeries;
      onDataSeriesChangeRef.current(dataSeries);
    }
  }, [dataSeries]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".metric-filter-dropdown") &&
        !target.closest(".chain-selector-dropdown") &&
        !target.closest("button")
      ) {
        setShowMetricFilter(false);
        setShowChainSelector(false);
        setSelectedMetric(null);
      }
    };

    if (showMetricFilter || showChainSelector) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMetricFilter, showChainSelector]);

  // Fetch metric data for a chain
  const fetchMetricData = async (chainId: string, metricKey: string, forceReload: boolean = false) => {
    const seriesId = `${chainId}-${metricKey}`;
    
    // Use refs to get latest values, especially important during reloads
    const effectiveStartTime = startTimeRef.current;
    const effectiveEndTime = endTimeRef.current;
    
    // Convert ISO timestamps to Unix timestamps (seconds)
    const startTimestamp = effectiveStartTime ? Math.floor(new Date(effectiveStartTime).getTime() / 1000) : undefined;
    const endTimestamp = effectiveEndTime ? Math.floor(new Date(effectiveEndTime).getTime() / 1000) : undefined;
    
    // Create cache key that includes timestamps
    const cacheKey = startTimestamp && endTimestamp 
      ? `${seriesId}-${startTimestamp}-${endTimestamp}`
      : `${seriesId}-all`;
    
    // Check if we already have this data cached (unless forcing reload)
    if (!forceReload && chartData[cacheKey]) {
      return; // Data already loaded for this time range
    }
    
    if (loadingMetrics.has(cacheKey)) {
      return; // Already loading this data
    }

    setLoadingMetrics((prev) => new Set(prev).add(cacheKey));

    try {
      // Build query string with timestamps if available and the specific metric
      let queryString = `timeRange=all&metrics=${metricKey}`;
      if (startTimestamp !== undefined && endTimestamp !== undefined) {
        queryString += `&startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}`;
      }
      
      const response = await fetch(`/api/chain-stats/${chainId}?${queryString}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const chainMetrics: ChainMetrics = await response.json();
      const metric = chainMetrics[metricKey as keyof ChainMetrics];

      if (!metric) {
        throw new Error(`Metric ${metricKey} not found`);
      }

      let data: ChartDataPoint[] = [];
      if (metricKey === "icmMessages") {
        const icmMetric = metric as ICMMetric;
        data = icmMetric.data
          .map((point: ICMDataPoint) => ({
            date: point.date,
            [seriesId]: point.messageCount,
          }))
          .reverse();
      } else {
        const tsMetric = metric as TimeSeriesMetric;
        data = tsMetric.data
          .map((point: TimeSeriesDataPoint) => ({
            date: point.date,
            [seriesId]:
              typeof point.value === "string"
                ? Number.parseFloat(point.value)
                : point.value,
          }))
          .reverse();
      }

      setChartData((prev) => ({ 
        ...prev, 
        [seriesId]: data, // Keep seriesId for compatibility
        [cacheKey]: data // Cache with timestamp key for future lookups
      }));
    } catch (error) {
      console.error(`Error fetching ${metricKey} for chain ${chainId}:`, error);
    } finally {
      setLoadingMetrics((prev) => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  };

  // Clear chart data cache when reload trigger changes (only on manual reload)
  useEffect(() => {
    if (reloadTrigger !== prevReloadTriggerRef.current) {
      prevReloadTriggerRef.current = reloadTrigger;
      // Clear cache completely
      setChartData({});
      // Use setTimeout to ensure state updates (like globalStartTime/globalEndTime) have propagated
      setTimeout(() => {
        dataSeries.forEach((series) => {
          if (series.visible && series.chainId && series.metricKey) {
            fetchMetricData(series.chainId, series.metricKey, true);
          }
        });
      }, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadTrigger]);

  // Clear cache and reload when local reload trigger changes (only on manual reload)
  useEffect(() => {
    if (localReloadTrigger > 0) {
      // Clear cache completely
      setChartData({});
      // Use setTimeout to ensure state updates (like startTime/endTime) have propagated
      setTimeout(() => {
        dataSeries.forEach((series) => {
          if (series.visible && series.chainId && series.metricKey) {
            fetchMetricData(series.chainId, series.metricKey, true);
          }
        });
      }, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReloadTrigger]);

  // Fetch data for all visible series (only on initial load or when series change)
  useEffect(() => {
    dataSeries.forEach((series) => {
      if (series.visible && series.chainId && series.metricKey) {
        fetchMetricData(series.chainId, series.metricKey);
      }
    });
  }, [dataSeries]);

  // Merge all chart data
  const mergedData = useMemo(() => {
    const dateMap = new Map<string, ChartDataPoint>();

    // Only process data entries that match seriesId pattern (not cache keys with timestamps)
    dataSeries.forEach((series) => {
      const seriesId = `${series.chainId}-${series.metricKey}`;
      const data = chartData[seriesId];
      
      if (data) {
        data.forEach((point) => {
          if (!dateMap.has(point.date)) {
            dateMap.set(point.date, { date: point.date });
          }
          Object.keys(point).forEach((k) => {
            if (k !== "date") {
              dateMap.get(point.date)![k] = point[k];
            }
          });
        });
      }
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [chartData, dataSeries]);

  // Aggregate data based on resolution
  const aggregatedData = useMemo(() => {
    if (resolution === "D" || mergedData.length === 0) return mergedData;

    const grouped = new Map<
      string,
      { sum: Record<string, number>; count: number; date: string }
    >();

    mergedData.forEach((point) => {
      // Parse date string directly to avoid timezone issues
      // point.date is in format "YYYY-MM-DD"
      const [year, month, day] = point.date.split("-").map(Number);
      let key: string;

      if (resolution === "W") {
        // Create date in local time to calculate week start
        const date = new Date(year, month - 1, day);
        const weekStartDay = day - date.getDay();
        const weekStart = new Date(year, month - 1, weekStartDay);
        // Format as YYYY-MM-DD
        const wy = weekStart.getFullYear();
        const wm = String(weekStart.getMonth() + 1).padStart(2, "0");
        const wd = String(weekStart.getDate()).padStart(2, "0");
        key = `${wy}-${wm}-${wd}`;
      } else if (resolution === "M") {
        key = `${year}-${String(month).padStart(2, "0")}`;
      } else if (resolution === "Q") {
        const quarter = Math.floor((month - 1) / 3) + 1;
        key = `${year}-Q${quarter}`;
      } else {
        key = String(year);
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          sum: {},
          count: 0,
          date: key,
        });
      }

      const group = grouped.get(key)!;
      Object.keys(point).forEach((k) => {
        if (k !== "date") {
          if (!group.sum[k]) group.sum[k] = 0;
          const value = typeof point[k] === "number" ? point[k] : 0;
          // For cumulative metrics, take max; for others, sum
          if (k.includes("cumulative") || k.includes("Cumulative")) {
            group.sum[k] = Math.max(group.sum[k], value);
          } else {
            group.sum[k] += value;
          }
        }
      });
      group.count += 1;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        date: group.date,
        ...group.sum,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [mergedData, resolution]);

  // Data is already filtered by the API, so use aggregatedData directly
  const filteredData = aggregatedData;

  // Calculate filtered date range in days to determine which resolutions to enable
  // IMPORTANT: Use mergedData.length (original daily data) not filteredData.length (aggregated data)
  // This ensures resolution buttons stay enabled when switching between resolutions
  const filteredDaysCount = useMemo(() => {
    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days;
    }
    
    // If no filter, use the original merged data length (daily data) as an estimate
    // Using mergedData instead of filteredData because filteredData is already aggregated
    // and would give incorrect counts for non-daily resolutions
    return mergedData.length;
  }, [startTime, endTime, mergedData.length]);

  // Determine which resolutions should be enabled based on filtered days
  const isResolutionEnabled = useMemo(() => {
    return {
      D: true, // Daily is always enabled
      W: filteredDaysCount >= 7 * 2, // Weekly needs at least 7 days
      M: filteredDaysCount >= 30 * 2, // Monthly needs at least 30 days
      Q: filteredDaysCount >= 90 * 2, // Quarterly needs at least 90 days
      Y: filteredDaysCount >= 365 * 2, // Yearly needs at least 365 days
    };
  }, [filteredDaysCount]);

  // Auto-switch to Daily if current resolution becomes disabled
  useEffect(() => {
    if (!isResolutionEnabled[resolution]) {
      setResolution("D");
    }
  }, [isResolutionEnabled, resolution]);

  // Track if we've used the initial brush values
  const hasUsedInitialBrush = useRef(false);
  // Track if user has manually interacted with brush
  const userHasInteractedWithBrush = useRef(false);

  // Initialize brush from saved values (runs once when initial values are available)
  useEffect(() => {
    if (aggregatedData.length === 0) return;
    if (hasUsedInitialBrush.current) return;
    
    if (initialBrushStartIndex !== undefined && initialBrushStartIndex !== null &&
        initialBrushEndIndex !== undefined && initialBrushEndIndex !== null) {
      hasUsedInitialBrush.current = true;
      setBrushRange({
        startIndex: Math.max(0, Math.min(initialBrushStartIndex, aggregatedData.length - 1)),
        endIndex: Math.max(0, Math.min(initialBrushEndIndex, aggregatedData.length - 1)),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregatedData.length]);

  // Set default brush range when resolution changes (only if user hasn't interacted)
  useEffect(() => {
    if (aggregatedData.length === 0) return;
    if (hasUsedInitialBrush.current && !userHasInteractedWithBrush.current) {
      // Skip on first render when we have initial values
      return;
    }
    if (userHasInteractedWithBrush.current) {
      // User has interacted, don't reset
      userHasInteractedWithBrush.current = false; // Reset for next resolution change
      return;
    }
    
    if (resolution === "D") {
      setBrushRange({
        startIndex: Math.max(0, aggregatedData.length - 90),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      setBrushRange({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [resolution, aggregatedData.length]);

  // Compute safe brush indices that are always valid for current data
  const safeBrushRange = useMemo(() => {
    const maxIndex = Math.max(0, aggregatedData.length - 1);
    
    if (!brushRange) {
      return {
        startIndex: 0,
        endIndex: maxIndex,
      };
    }
    
    return {
      startIndex: Math.max(0, Math.min(brushRange.startIndex, maxIndex)),
      endIndex: Math.max(0, Math.min(brushRange.endIndex, maxIndex)),
    };
  }, [brushRange, aggregatedData.length]);

  const displayData = useMemo(() => {
    if (filteredData.length === 0) return filteredData;
    
    return filteredData.slice(safeBrushRange.startIndex, safeBrushRange.endIndex + 1);
  }, [safeBrushRange, filteredData]);

  const visibleSeries = useMemo(() => {
    return dataSeries
      .filter((s) => s.visible)
      .sort((a, b) => a.zIndex - b.zIndex); // Sort by z-index: lower values render first (behind)
  }, [dataSeries]);

  // Group series by metricKey for stacking
  const seriesByMetric = useMemo(() => {
    const grouped: Record<string, DataSeries[]> = {};
    visibleSeries.forEach((series) => {
      if (!grouped[series.metricKey]) {
        grouped[series.metricKey] = [];
      }
      grouped[series.metricKey].push(series);
    });
    return grouped;
  }, [visibleSeries]);


  // Parse date string as local time to avoid timezone issues
  const parseLocalDate = (value: string): Date => {
    // Handle different formats: "YYYY-MM-DD", "YYYY-MM", "YYYY"
    const parts = value.split("-");
    const year = parseInt(parts[0], 10);
    const month = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
    const day = parts[2] ? parseInt(parts[2], 10) : 1;
    return new Date(year, month, day);
  };

  const formatXAxis = (value: string) => {
    if (resolution === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} '${parts[0].slice(-2)}`;
      return value;
    }
    if (resolution === "Y") return value;
    const date = parseLocalDate(value);
    if (resolution === "M") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
    if (resolution === "Y") return value;
    if (resolution === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return value;
    }
    const date = parseLocalDate(value);
    if (resolution === "M") {
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Always abbreviate for Y-axis labels to ensure they fit
  const formatYAxis = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Format values for tooltip - respects abbreviateNumbers setting
  const formatValue = (value: number) => {
    if (abbreviateNumbers) {
      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const toggleSeriesVisibility = (seriesId: string) => {
    setDataSeries((prev) =>
      prev.map((s) =>
        s.id === seriesId ? { ...s, visible: !s.visible } : s
      )
    );
  };

  const removeSeries = (seriesId: string) => {
    setDataSeries((prev) => prev.filter((s) => s.id !== seriesId));
    setChartData((prev) => {
      const next = { ...prev };
      delete next[seriesId];
      return next;
    });
  };

  const handleMetricClick = (metricId: string) => {
    setSelectedMetric(metricId);
    setShowMetricFilter(false);
    setShowChainSelector(true);
    setChainSearchTerm("");
  };

  const handleChainSelect = (chainId: string, chainName: string) => {
    if (!selectedMetric) return;

    const metric = AVAILABLE_METRICS.find((m) => m.id === selectedMetric);
    if (!metric) return;

    // Special handling for "All Chains" option
    const isAllChains = chainId === "all";
    const chain = isAllChains ? null : l1ChainsData.find((c) => c.chainId === chainId);
    const chainColor = isAllChains ? "#E84142" : (chain?.color || DEFAULT_COLORS[0]);

    const seriesId = `${chainId}-${selectedMetric}`;
    const existingSeries = dataSeries.find((s) => s.id === seriesId);

    if (existingSeries) {
      toggleSeriesVisibility(seriesId);
      setShowChainSelector(false);
      setSelectedMetric(null);
      return;
    }

    const seriesName = `${chainName}: ${metric.name}`;

    // Group by metric: same metrics use same Y-axis by default
    const existingSeriesForMetric = dataSeries.filter(
      (s) => s.metricKey === selectedMetric
    );
    const defaultYAxis =
      existingSeriesForMetric.length > 0
        ? existingSeriesForMetric[0].yAxis
        : dataSeries.length % 2 === 0
        ? "left"
        : "right";

    // Default z-index: higher for newer series (appear on top)
    const maxZIndex = dataSeries.length > 0 
      ? Math.max(...dataSeries.map(s => s.zIndex))
      : 0;
    const defaultZIndex = maxZIndex + 1;

    const newSeries: DataSeries = {
      id: seriesId,
      name: seriesName,
      color: chainColor,
      yAxis: defaultYAxis,
      visible: true,
      chartStyle: "line",
      chainId: chainId,
      chainName: chainName,
      metricKey: selectedMetric,
      zIndex: defaultZIndex,
    };

    setDataSeries([...dataSeries, newSeries]);
    setShowChainSelector(false);
    setSelectedMetric(null);
    fetchMetricData(chainId, selectedMetric);
  };

  const updateSeriesProperty = (
    seriesId: string,
    property: keyof DataSeries,
    value: any
  ) => {
    setDataSeries((prev) =>
      prev.map((s) => (s.id === seriesId ? { ...s, [property]: value } : s))
    );
  };

  const filteredMetrics = AVAILABLE_METRICS.filter((m) =>
    m.name.toLowerCase().includes(metricSearchTerm.toLowerCase())
  );

  // Special "All Chains" option for aggregated metrics
  const ALL_CHAINS_OPTION = {
    chainId: "all",
    chainName: "All Chains",
    chainLogoURI: "",
    color: "#E84142", // Avalanche red
  };

  // Avalanche C-Chain option for Avalanche-only metrics
  const AVALANCHE_CCHAIN_OPTION = {
    chainId: "43114",
    chainName: "Avalanche C-Chain",
    chainLogoURI: "",
    color: "#E84142", // Avalanche red
  };

  // Check if selected metric is Primary Network only
  const isPrimaryNetworkOnlyMetric = selectedMetric && PRIMARY_NETWORK_ONLY_METRICS.includes(selectedMetric);

  const filteredChains = isPrimaryNetworkOnlyMetric
    ? // For Primary Network only metrics, show Primary Network option
      [PRIMARY_NETWORK_OPTION].filter((chain) =>
        chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase())
      )
    : [
        // Include "All Chains" at the top if it matches the search
        ...(ALL_CHAINS_OPTION.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase()) ? [ALL_CHAINS_OPTION] : []),
        ...l1ChainsData.filter((chain) => (chain as any).isTestnet !== true &&
          chain.chainName.toLowerCase().includes(chainSearchTerm.toLowerCase())
        ),
      ];

  const getThemedLogoUrl = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;
    if (resolvedTheme === "dark") {
      return logoUrl.replace(/Light/g, "Dark");
    } else {
      return logoUrl.replace(/Dark/g, "Light");
    }
  };

  const renderChart = () => {
    if (visibleSeries.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          No data series selected. Click "+ Add" to add a metric.
        </div>
      );
    }

    // Y3 maps to left axis, Y4 maps to right axis
    const hasLeftAxis = visibleSeries.some((s) => s.yAxis === "left" || s.yAxis === "y3");
    const hasRightAxis = visibleSeries.some((s) => s.yAxis === "right" || s.yAxis === "y4");

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={displayData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            className="text-xs text-gray-600 dark:text-gray-400"
            tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
            minTickGap={80}
            interval="preserveStartEnd"
          />
          {hasLeftAxis && (
            <YAxis
              yAxisId="left"
              tickFormatter={formatYAxis}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
            />
          )}
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={formatYAxis}
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
            />
          )}
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const date = payload[0]?.payload?.date;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-sm">
                  <div className="font-medium text-sm mb-2">
                    {formatTooltipDate(date)}
                  </div>
                  {payload.map((entry: any, idx: number) => (
                    <div
                      key={idx}
                      className="text-xs flex items-center gap-2 mb-1"
                    >
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span>{entry.name}:</span>
                      <span className="font-mono">
                        {formatValue(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          {Object.entries(seriesByMetric).map(([metricKey, seriesList]) => {
            // When stacking is enabled, stack all series together (not just same metrics)
            const stackId = stackSameMetrics ? "stack-all" : undefined;

            return seriesList.map((series) => {
              // Map Y-axis values to left/right (only 2 axes shown on chart)
              const yAxisId = series.yAxis === "left" || series.yAxis === "y3" ? "left" : "right";
              const dataKey = series.id;
              const isLoading = loadingMetrics.has(dataKey);

              if (isLoading) {
                return null;
              }

              if (series.chartStyle === "bar") {
                return (
                  <Bar
                    key={series.id}
                    dataKey={dataKey}
                    yAxisId={yAxisId}
                    fill={series.color}
                    radius={[0, 0, 0, 0]}
                    name={series.name}
                    stackId={stackId}
                  />
                );
              } else if (series.chartStyle === "area") {
                return (
                  <Area
                    key={series.id}
                    type="monotone"
                    dataKey={dataKey}
                    yAxisId={yAxisId}
                    stroke={series.color}
                    fill={series.color}
                    fillOpacity={stackSameMetrics ? 0.6 : 0.3}
                    strokeWidth={1}
                    name={series.name}
                    stackId={stackId}
                  />
                );
              } else {
                // Lines don't support stacking, render normally
                return (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={dataKey}
                    yAxisId={yAxisId}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={false}
                    name={series.name}
                  />
                );
              }
            });
          }).flat()}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

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
      link.download = `${chartTitle || "chart"}-${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  const toggleColSpan = () => {
    if (onColSpanChange) {
      onColSpanChange(colSpan === 12 ? 6 : 12);
    }
  };

  return (
    <Card className="border-gray-200 dark:border-gray-700 py-0" ref={chartContainerRef}>
      <CardContent className="p-0">
        {/* Header Controls */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-4">
          {/* Data Series Legends */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {dataSeries.map((series) => {
              const index = dataSeries.findIndex(s => s.id === series.id);
              const isLoading = loadingMetrics.has(series.id);
              const chain = l1ChainsData.find((c) => c.chainId === series.chainId);
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              const canDrag = !disableControls && dataSeries.length > 1;
              
              return (
                <div
                  key={series.id}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (!canDrag) {
                      e.preventDefault();
                      return;
                    }
                    // Only allow drag from grip icon or empty space, not from buttons/selects
                    const target = e.target as HTMLElement;
                    if (target.tagName === "BUTTON" || target.tagName === "SELECT" || target.tagName === "INPUT" || target.closest("button") || target.closest("select") || target.closest("input")) {
                      e.preventDefault();
                      return;
                    }
                    setDraggedIndex(index);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/html", series.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                    if (draggedIndex !== null && draggedIndex !== index) {
                      setDragOverIndex(index);
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== index) {
                      setDragOverIndex(index);
                    }
                  }}
                  onDragLeave={(e) => {
                    // Only clear if we're actually leaving the element (not entering a child)
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;
                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                      if (dragOverIndex === index) {
                        setDragOverIndex(null);
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (draggedIndex === null || draggedIndex === index) {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                      return;
                    }
                    
                    const newSeries = [...dataSeries];
                    const draggedItem = newSeries[draggedIndex];
                    
                    // Remove the dragged item from its original position
                    newSeries.splice(draggedIndex, 1);
                    
                    // Calculate the new insertion index
                    // If dragging forward (draggedIndex < index), adjust index by -1
                    // If dragging backward (draggedIndex > index), use index as-is
                    const insertIndex = draggedIndex < index ? index - 1 : index;
                    
                    // Insert the dragged item at the new position
                    newSeries.splice(insertIndex, 0, draggedItem);
                    
                    // Update z-index based on new order
                    const updatedSeries = newSeries.map((s, idx) => ({
                      ...s,
                      zIndex: idx + 1,
                    }));
                    
                    setDataSeries(updatedSeries);
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white dark:bg-neutral-900 border transition-all ${
                    disableControls || !canDrag
                      ? "cursor-default border-gray-200 dark:border-neutral-800"
                      : isDragging 
                        ? "opacity-50 cursor-grabbing border-gray-300 dark:border-neutral-700 shadow-lg scale-95" 
                        : "cursor-grab border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 hover:shadow-sm"
                  } ${
                    isDragOver ? "border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-500/20 dark:ring-blue-400/20" : ""
                  } ${!series.visible ? "opacity-60" : ""}`}
                >
                  {/* Only show grip icon when there are multiple series to reorder */}
                  {canDrag && (
                    <div
                      onMouseDown={(e) => {
                        // Make the grip icon area draggable
                        const div = e.currentTarget.parentElement;
                        if (div) {
                          div.draggable = true;
                        }
                      }}
                      className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors hidden sm:block"
                    >
                      <GripVertical className="h-4 w-4 flex-shrink-0" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      if (disableControls) return;
                      e.stopPropagation();
                      toggleSeriesVisibility(series.id);
                    }}
                    onMouseDown={(e) => {
                      if (disableControls) return;
                      e.stopPropagation();
                      // Prevent drag when clicking button
                      const div = e.currentTarget.closest('[draggable="true"]') as HTMLElement;
                      if (div) {
                        div.draggable = false;
                        setTimeout(() => {
                          div.draggable = true;
                        }, 0);
                      }
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2.5 transition-opacity flex-1 min-w-0 ${disableControls ? "cursor-default" : "hover:opacity-80"}`}
                    disabled={isLoading || disableControls}
                    title={series.visible ? "Hide from chart" : "Show in chart"}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />
                    ) : (
                      <>
                        {series.chainId === "all" || series.chainId === "43114" || series.chainId === "primary" ? (
                          <div className="relative h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 flex items-center justify-center">
                            <AvalancheLogo className="h-4 w-4 sm:h-5 sm:w-5" fill="#E84142" />
                          </div>
                        ) : chain?.chainLogoURI && (
                          <div className="relative h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-neutral-700">
                            <Image
                              src={getThemedLogoUrl(chain.chainLogoURI)}
                              alt={`${series.chainName} logo`}
                              width={20}
                              height={20}
                              className="rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        {/* On mobile: show only metric name (chain icon is enough). On desktop: show full name */}
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[100px] sm:max-w-[150px] md:max-w-none">
                          <span className="sm:hidden">
                            {AVAILABLE_METRICS.find(m => m.id === series.metricKey)?.name || series.name}
                          </span>
                          <span className="hidden sm:inline">
                            {series.name}
                          </span>
                        </span>
                      </>
                    )}
                    {!disableControls && (
                      <>
                        {series.visible ? (
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        )}
                      </>
                    )}
                  </button>
                  {series.visible && !isLoading && !disableControls && (
                    <div className="flex items-center gap-1 sm:gap-1.5 ml-0.5 sm:ml-1 border-l border-gray-200 dark:border-neutral-700 pl-1.5 sm:pl-2">
                      <select
                        value={series.chartStyle}
                        onChange={(e) =>
                          updateSeriesProperty(
                            series.id,
                            "chartStyle",
                            e.target.value
                          )
                        }
                        className="text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-neutral-500 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="line">Line</option>
                        <option value="bar">Bar</option>
                        <option value="area">Area</option>
                      </select>
                      <select
                        value={series.yAxis}
                        onChange={(e) =>
                          updateSeriesProperty(
                            series.id,
                            "yAxis",
                            e.target.value
                          )
                        }
                        className="text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-neutral-500 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="left">Y1</option>
                        <option value="right">Y2</option>
                        <option value="y3">Y3</option>
                        <option value="y4">Y4</option>
                      </select>
                      <div className="relative">
                        <input
                          type="color"
                          value={series.color}
                          onChange={(e) =>
                            updateSeriesProperty(
                              series.id,
                              "color",
                              e.target.value
                            )
                          }
                          className="w-5 h-5 sm:w-7 sm:h-7 rounded border border-gray-200 dark:border-neutral-700 cursor-pointer hover:border-gray-300 dark:hover:border-neutral-600 transition-colors appearance-none p-0 overflow-hidden"
                          style={{
                            backgroundColor: series.color,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                  {!disableControls && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSeries(series.id);
                      }}
                      className="ml-0.5 sm:ml-1 p-0.5 sm:p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                      title="Remove series"
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Configuration Controls */}
          {!disableControls && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stack-same-metrics"
                  checked={stackSameMetrics}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setStackSameMetrics(newValue);
                    if (onStackSameMetricsChange) {
                      onStackSameMetricsChange(newValue);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                />
                <label
                  htmlFor="stack-same-metrics"
                  className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Stack all series</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="abbreviate-numbers"
                  checked={abbreviateNumbers}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setAbbreviateNumbers(newValue);
                    if (onAbbreviateNumbersChange) {
                      onAbbreviateNumbersChange(newValue);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                />
                <label
                  htmlFor="abbreviate-numbers"
                  className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <span>Abbreviate numbers</span>
                </label>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowMetricFilter(!showMetricFilter);
                      setShowChainSelector(false);
                    }}
                    className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    title="Add metric"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                {showMetricFilter && (
                  <div className="metric-filter-dropdown absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Filter by metric..."
                          value={metricSearchTerm}
                          onChange={(e) => setMetricSearchTerm(e.target.value)}
                          className="pl-8 pr-8 text-sm"
                        />
                        {metricSearchTerm && (
                          <button
                            onClick={() => setMetricSearchTerm("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredMetrics.map((metric) => (
                        <button
                          key={metric.id}
                          onClick={() => handleMetricClick(metric.id)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                        >
                          <span>{metric.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showChainSelector && selectedMetric && (
                  <div className="chain-selector-dropdown absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => {
                            setShowChainSelector(false);
                            setShowMetricFilter(true);
                            setSelectedMetric(null);
                            setChainSearchTerm("");
                          }}
                          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Metric List</span>
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Filter by chain..."
                          value={chainSearchTerm}
                          onChange={(e) => setChainSearchTerm(e.target.value)}
                          className="pl-8 pr-8 text-sm"
                        />
                        {chainSearchTerm && (
                          <button
                            onClick={() => setChainSearchTerm("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredChains.map((chain, index) => {
                        const seriesId = `${chain.chainId}-${selectedMetric}`;
                        const isAdded = dataSeries.some((s) => s.id === seriesId);
                        const isAllChains = chain.chainId === "all";
                        const isAvalancheCChain = chain.chainId === "43114";
                        const isPrimaryNetwork = chain.chainId === "primary";
                        const isLastAllChains = isAllChains && index < filteredChains.length - 1 && filteredChains[index + 1].chainId !== "all";
                        
                        return (
                          <div key={chain.chainId}>
                            <button
                              onClick={() =>
                                handleChainSelect(chain.chainId, chain.chainName)
                              }
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                            >
                              {isAllChains || isAvalancheCChain || isPrimaryNetwork ? (
                                <div className="relative h-5 w-5 flex-shrink-0 flex items-center justify-center">
                                  <AvalancheLogo className="h-5 w-5" fill="#E84142" />
                                </div>
                              ) : chain.chainLogoURI ? (
                                <div className="relative h-5 w-5 flex-shrink-0">
                                  <Image
                                    src={getThemedLogoUrl(chain.chainLogoURI)}
                                    alt={`${chain.chainName} logo`}
                                    width={20}
                                    height={20}
                                    className="rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                </div>
                              ) : null}
                              <span className="flex-1">{chain.chainName}</span>
                              {isAdded && (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </button>
                            {isLastAllChains && (
                              <hr className="border-t border-gray-200 dark:border-gray-700" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>
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
                {onTimeFilterChange && !disableControls && (
                  <Popover open={showTimeFilterPopover} onOpenChange={setShowTimeFilterPopover}>
                    <PopoverTrigger asChild>
                      <button
                        className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                          (startTime || endTime) 
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        title="Set time filter"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        selected={{
                          from: tempStartTime,
                          to: tempEndTime,
                        }}
                        onSelect={(range) => {
                          // Update dates, preserving existing times if dates already exist
                          if (range?.from) {
                            const newDate = new Date(range.from);
                            if (tempStartTime) {
                              // Preserve time from existing tempStartTime
                              newDate.setHours(tempStartTime.getHours(), tempStartTime.getMinutes(), 0, 0);
                            } else {
                              // Default to 00:00 if no existing time
                              newDate.setHours(0, 0, 0, 0);
                            }
                            setTempStartTime(newDate);
                          } else {
                            setTempStartTime(undefined);
                          }
                          
                          if (range?.to) {
                            const newDate = new Date(range.to);
                            if (tempEndTime) {
                              // Preserve time from existing tempEndTime
                              newDate.setHours(tempEndTime.getHours(), tempEndTime.getMinutes(), 0, 0);
                            } else {
                              // Default to 23:59 if no existing time
                              newDate.setHours(23, 59, 0, 0);
                            }
                            setTempEndTime(newDate);
                          } else {
                            setTempEndTime(undefined);
                          }
                        }}
                        initialFocus
                      />
                      <div className="p-3 border-t space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[50px]">Start:</label>
                          <Input
                            type="time"
                            value={tempStartTime ? tempStartTime.toTimeString().slice(0, 5) : "00:00"}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":").map(Number);
                              if (tempStartTime) {
                                const updated = new Date(tempStartTime);
                                updated.setHours(hours, minutes, 0, 0);
                                setTempStartTime(updated);
                              } else {
                                // If no date selected, create a new date with today's date
                                const today = new Date();
                                today.setHours(hours, minutes, 0, 0);
                                setTempStartTime(today);
                              }
                            }}
                            className="text-xs sm:text-sm"
                            disabled={!tempStartTime}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[50px]">End:</label>
                          <Input
                            type="time"
                            value={tempEndTime ? tempEndTime.toTimeString().slice(0, 5) : "23:59"}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":").map(Number);
                              if (tempEndTime) {
                                const updated = new Date(tempEndTime);
                                updated.setHours(hours, minutes, 0, 0);
                                setTempEndTime(updated);
                              } else {
                                // If no date selected, create a new date with today's date
                                const today = new Date();
                                today.setHours(hours, minutes, 0, 0);
                                setTempEndTime(today);
                              }
                            }}
                            className="text-xs sm:text-sm"
                            disabled={!tempEndTime}
                          />
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          {(tempStartTime || tempEndTime || startTime || endTime) && (
                            <Button
                              onClick={() => {
                                // Clear temp state
                                setTempStartTime(undefined);
                                setTempEndTime(undefined);
                                // Clear actual state via parent callback
                                if (onTimeFilterChange) {
                                  onTimeFilterChange(null, null);
                                }
                                // Trigger reload and close popover
                                setLocalReloadTrigger((prev: number) => prev + 1);
                                setShowTimeFilterPopover(false);
                              }}
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                            >
                              <X className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                              Clear
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              // Convert Date objects to ISO strings
                              const newStartTime = tempStartTime ? tempStartTime.toISOString() : null;
                              const newEndTime = tempEndTime ? tempEndTime.toISOString() : null;
                              // Apply to actual state via parent callback
                              if (onTimeFilterChange) {
                                onTimeFilterChange(newStartTime, newEndTime);
                              }
                              // Trigger reload and close popover
                              setLocalReloadTrigger((prev: number) => prev + 1);
                              setShowTimeFilterPopover(false);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                            title="Reload data"
                          >
                            <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                            Reload
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {onColSpanChange && (
                  <button
                    onClick={toggleColSpan}
                    className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    title={colSpan === 12 ? "Make half width" : "Make full width"}
                  >
                    {colSpan === 12 ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                )}
                {onRemove && !disableControls && (
                  <button
                    onClick={onRemove}
                    className="p-1.5 sm:p-2 rounded-md text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer"
                    title="Remove chart"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Chart Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 group flex-1">
            <h3
              contentEditable={!disableControls}
              suppressContentEditableWarning
              onBlur={(e) => {
                if (disableControls) return;
                const newTitle = e.currentTarget.textContent || title;
                setChartTitle(newTitle);
                setIsEditingTitle(false);
                if (onTitleChange) {
                  onTitleChange(newTitle);
                }
              }}
              onKeyDown={(e) => {
                if (disableControls) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.currentTarget.textContent = chartTitle;
                  e.currentTarget.blur();
                }
              }}
              onFocus={() => {
                if (!disableControls) setIsEditingTitle(true);
              }}
              className="text-base sm:text-lg font-normal outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded px-1 -mx-1 min-w-[100px]"
              style={{
                cursor: disableControls ? "default" : isEditingTitle ? "text" : "pointer",
              }}
            >
              {chartTitle}
            </h3>
            {!disableControls && <Pencil className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
          </div>
          <div className="flex gap-0.5 sm:gap-1">
            {(["D", "W", "M", "Q", "Y"] as const).map((p) => {
              const primaryColor = visibleSeries[0]?.color || "#888";
              const isEnabled = isResolutionEnabled[p];
              const isSelected = resolution === p;
              
              return (
                <button
                  key={p}
                  onClick={() => {
                    if (isEnabled) {
                      setResolution(p);
                    }
                  }}
                  disabled={!isEnabled}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                    isSelected && isEnabled
                      ? "text-white dark:text-white cursor-pointer"
                      : isEnabled
                      ? "text-muted-foreground hover:bg-muted cursor-pointer"
                      : "text-muted-foreground opacity-40 cursor-not-allowed"
                  }`}
                  style={
                    isSelected && isEnabled
                      ? { backgroundColor: primaryColor, opacity: 0.9 }
                      : {}
                  }
                  title={!isEnabled ? `Requires at least ${p === "W" ? "7" : p === "M" ? "30" : p === "Q" ? "90" : "365"} days of filtered data` : undefined}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <ChartWatermark className="p-6">
            {renderChart()}

            {/* Brush Slider */}
            {filteredData.length > 0 && visibleSeries.length > 0 && (
              <div 
                className="mt-4 bg-white dark:bg-black pl-[60px] brush-slider-container cursor-default"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                draggable={false}
                data-no-drag="true"
              >
              <ResponsiveContainer width="100%" height={80}>
                <LineChart
                  data={aggregatedData}
                  margin={{ top: 0, right: 30, left: 0, bottom: 5 }}
                >
                  <Brush
                    dataKey="date"
                    height={80}
                    stroke={visibleSeries[0]?.color || "#888"}
                    fill={`${visibleSeries[0]?.color || "#888"}20`}
                    alwaysShowText={false}
                    startIndex={safeBrushRange.startIndex}
                    endIndex={safeBrushRange.endIndex}
                    onChange={(e: any) => {
                      if (
                        e.startIndex !== undefined &&
                        e.endIndex !== undefined
                      ) {
                        userHasInteractedWithBrush.current = true;
                        setBrushRange({
                          startIndex: e.startIndex,
                          endIndex: e.endIndex,
                        });
                        // Notify parent of brush change
                        onBrushChange?.(e.startIndex, e.endIndex);
                      }
                    }}
                    travellerWidth={8}
                    tickFormatter={formatXAxis}
                  >
                    <LineChart>
                      <Line
                        type="monotone"
                        dataKey={visibleSeries[0]?.id || "date"}
                        stroke={visibleSeries[0]?.color || "#888"}
                        strokeWidth={1}
                        dot={false}
                      />
                    </LineChart>
                  </Brush>
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}
        </ChartWatermark>
      </CardContent>

      {/* Image Export Studio Modal */}
      <ImageExportStudio
        isOpen={showImageStudio}
        onClose={() => setShowImageStudio(false)}
        period={resolution}
        onPeriodChange={setResolution}
        allowedPeriods={(["D", "W", "M", "Q", "Y"] as const).filter((p) => isResolutionEnabled[p])}
        dataArray={aggregatedData}
        seriesInfo={visibleSeries.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          yAxis: s.yAxis,
        }))}
        chartData={{
          title: chartTitle,
          source: "Token Terminal",
          sourceDescription: dataSeries[0]?.name ? `${dataSeries[0].name} metric data` : undefined,
          chainName: dataSeries[0]?.chainName || "Avalanche",
          metricValue: dataSeries[0] && chartData[dataSeries[0].id]?.length
            ? formatYAxis(Number(chartData[dataSeries[0].id][chartData[dataSeries[0].id].length - 1]?.[dataSeries[0].id]) || 0)
            : undefined,
          metricLabel: "Latest",
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }}
      />
    </Card>
  );
}
