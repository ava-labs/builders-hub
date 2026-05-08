"use client";
import { useState } from "react";
import type {
  CollageMetricConfig,
  CollageSettings,
  CustomAspectRatio,
  ExportMode,
  PlaygroundChartData,
} from "../types";

interface UseStudioModeOptions {
  initialMode?: ExportMode;
  availableMetrics: CollageMetricConfig[];
  playgroundCharts: PlaygroundChartData[];
}

// Owns the studio's mode + collage selection state. Derives the boolean flags
// the page-level component reads to decide what UI to show (single chart vs
// collage, chain-based vs playground-based).
export function useStudioMode({
  initialMode,
  availableMetrics,
  playgroundCharts,
}: UseStudioModeOptions) {
  const [activeMode, setActiveMode] = useState<ExportMode>(
    initialMode ?? "single"
  );
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedPlaygroundChartIds, setSelectedPlaygroundChartIds] = useState<
    string[]
  >([]);
  const [collageSettings, setCollageSettings] = useState<CollageSettings>({
    showIndividualTitles: true,
    chartSpacing: 8,
  });
  const [customAspectRatio, setCustomAspectRatio] = useState<CustomAspectRatio>({
    width: 1280,
    height: 720,
  });

  // Mobile collapsible section state (hosted here because it's mode-aware).
  const [mobileMetricsExpanded, setMobileMetricsExpanded] = useState(false);
  const [mobileCustomizeExpanded, setMobileCustomizeExpanded] = useState(false);

  const hasChainCollageMode = availableMetrics.length > 0;
  const hasPlaygroundCollageMode = playgroundCharts.length >= 2;
  const hasCollageMode = hasChainCollageMode || hasPlaygroundCollageMode;
  const isPlaygroundMode = hasPlaygroundCollageMode && !hasChainCollageMode;
  const isCollageMode = activeMode === "collage";

  return {
    activeMode,
    setActiveMode,
    selectedMetrics,
    setSelectedMetrics,
    selectedPlaygroundChartIds,
    setSelectedPlaygroundChartIds,
    collageSettings,
    setCollageSettings,
    customAspectRatio,
    setCustomAspectRatio,
    mobileMetricsExpanded,
    setMobileMetricsExpanded,
    mobileCustomizeExpanded,
    setMobileCustomizeExpanded,
    hasChainCollageMode,
    hasPlaygroundCollageMode,
    hasCollageMode,
    isPlaygroundMode,
    isCollageMode,
  };
}
