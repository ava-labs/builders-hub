"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CollageMetricConfig, CollageMetricData, ChartDataPoint, Period } from "../types";

// Aggregate data points by period using SUM (matching single chart behavior in ChainMetricsPage)
const aggregateByPeriod = (
  data: ChartDataPoint[],
  period: Period | undefined
): ChartDataPoint[] => {
  if (!period || period === "D") return data; // Daily = no aggregation needed

  const grouped = new Map<string, number>();

  data.forEach((point) => {
    const dateStr = point.date || point.day || "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;

    let key: string;
    switch (period) {
      case "W": {
        // Sunday-based week calculation (matching ChainMetricsPage.tsx)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      }
      case "M":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "Q": {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        break;
      }
      case "Y":
        key = `${date.getFullYear()}`;
        break;
      default:
        key = dateStr;
    }

    const existing = grouped.get(key) || 0;
    grouped.set(key, existing + (point.value || 0));
  });

  // Convert back to ChartDataPoint array using SUM (matching single chart behavior)
  return Array.from(grouped.entries())
    .map(([key, sum]) => ({
      date: key,
      value: sum,
    }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
};

interface UseCollageMetricsReturn {
  metricsData: Map<string, CollageMetricData>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCollageMetrics(
  chainId: string | undefined,
  selectedMetricKeys: string[],
  availableMetrics: CollageMetricConfig[],
  period: Period | undefined
): UseCollageMetricsReturn {
  const [metricsData, setMetricsData] = useState<Map<string, CollageMetricData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid dependency changes causing infinite loops
  const selectedMetricKeysRef = useRef(selectedMetricKeys);
  const availableMetricsRef = useRef(availableMetrics);
  selectedMetricKeysRef.current = selectedMetricKeys;
  availableMetricsRef.current = availableMetrics;

  const selectedMetricKeysKey = selectedMetricKeys.join(',');

  const fetchMetrics = useCallback(async () => {
    const currentSelectedKeys = selectedMetricKeysRef.current;
    const currentAvailableMetrics = availableMetricsRef.current;

    if (!chainId || currentSelectedKeys.length === 0) {
      setMetricsData(prev => prev.size === 0 ? prev : new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    // Initialize loading states for all selected metrics
    const initialData = new Map<string, CollageMetricData>();
    currentSelectedKeys.forEach((key) => {
      const config = currentAvailableMetrics.find((m) => m.metricKey === key);
      if (config) {
        initialData.set(key, {
          config,
          data: [],
          isLoading: true,
        });
      }
    });
    setMetricsData(initialData);

    try {
      // Fetch all metrics data at once
      const response = await fetch(
        `/api/chain-stats/${chainId}?timeRange=all`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();

      // Process response and update metrics data
      const newMetricsData = new Map<string, CollageMetricData>();

      currentSelectedKeys.forEach((metricKey) => {
        const config = currentAvailableMetrics.find((m) => m.metricKey === metricKey);
        if (!config) return;

        // Handle nested metric structures (like activeAddresses.daily/weekly/monthly)
        let metricData = data[metricKey];

        // activeAddresses has pre-aggregated data at different intervals
        // We must use the correct interval based on period (can't sum daily to get monthly - addresses overlap)
        if (metricKey === "activeAddresses" && data.activeAddresses) {
          if (period === "W" && data.activeAddresses.weekly) {
            metricData = data.activeAddresses.weekly;
          } else if ((period === "M" || period === "Q" || period === "Y") && data.activeAddresses.monthly) {
            metricData = data.activeAddresses.monthly;
          } else {
            metricData = data.activeAddresses.daily;
          }
        }

        if (metricData?.data && Array.isArray(metricData.data)) {
          // Transform data to ChartDataPoint format
          const chartData: ChartDataPoint[] = metricData.data
            .map((point: { date: string; value: string | number }) => ({
              date: point.date,
              value: typeof point.value === "string"
                ? parseFloat(point.value)
                : point.value,
            }))
            .filter((point: ChartDataPoint) => point.value !== undefined && !isNaN(point.value as number))
            .reverse(); // Reverse to get chronological order

          // For activeAddresses with W/M periods, data is already pre-aggregated from API
          // Don't aggregate further (matching ChainMetricsPage behavior)
          // But we need to normalize dates to match format used by other metrics
          const shouldSkipAggregation = metricKey === "activeAddresses" &&
            (period === "W" || period === "M");

          let aggregatedData: ChartDataPoint[];
          if (shouldSkipAggregation) {
            // Normalize dates to match aggregated format for consistent filtering
            // API returns dates like "2025-11-01", we need "2025-11" for monthly
            aggregatedData = chartData.map((point) => {
              const dateStr = point.date || "";
              const date = new Date(dateStr);
              if (isNaN(date.getTime())) return point;

              let normalizedDate: string;
              if (period === "W") {
                // Sunday-based week start (matching other metrics)
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                normalizedDate = weekStart.toISOString().split("T")[0];
              } else {
                // Monthly format: "YYYY-MM"
                normalizedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
              }

              return { ...point, date: normalizedDate };
            });
          } else {
            aggregatedData = aggregateByPeriod(chartData, period);
          }

          newMetricsData.set(metricKey, {
            config,
            data: aggregatedData,
            isLoading: false,
          });
        } else {
          newMetricsData.set(metricKey, {
            config,
            data: [],
            isLoading: false,
            error: "No data available",
          });
        }
      });

      setMetricsData(newMetricsData);
    } catch (err) {
      console.error("Failed to fetch collage metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");

      // Mark all metrics as errored
      const errorData = new Map<string, CollageMetricData>();
      currentSelectedKeys.forEach((key) => {
        const config = currentAvailableMetrics.find((m) => m.metricKey === key);
        if (config) {
          errorData.set(key, {
            config,
            data: [],
            isLoading: false,
            error: "Failed to load",
          });
        }
      });
      setMetricsData(errorData);
    } finally {
      setIsLoading(false);
    }
  }, [chainId, selectedMetricKeysKey, period]);

  // Fetch when dependencies change
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metricsData,
    isLoading,
    error,
    refetch: fetchMetrics,
  };
}
