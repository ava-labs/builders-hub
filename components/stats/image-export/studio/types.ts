import type React from "react";
import type {
  ChartExportData,
  Period,
  ChartType,
  CollageMetricConfig,
  PlaygroundChartData,
  ExportMode,
} from "../types";

// Generic chart data point — the studio supports both `date` and `day` keys
// because different upstream charts use different conventions.
export interface ChartDataPoint {
  date?: string;
  day?: string;
  value?: number;
  [key: string]: string | number | undefined;
}

// Series info for multi-series charts.
export interface SeriesInfo {
  id: string;
  name: string;
  color: string;
  yAxis?: string;
}

export interface ImageExportStudioProps {
  isOpen: boolean;
  onClose: () => void;
  chartData: ChartExportData;
  // Chart data array for rendering.
  dataArray?: ChartDataPoint[];
  seriesInfo?: SeriesInfo[];
  // Period selector props.
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  allowedPeriods?: Period[];
  // Collage mode props (chain-based).
  chainId?: string;
  chainName?: string;
  availableMetrics?: CollageMetricConfig[];
  // Playground collage mode props.
  playgroundCharts?: PlaygroundChartData[];
  // Initial mode when opening the studio.
  initialMode?: ExportMode;
}

// Keyboard shortcuts shown in the help tooltip. The `keys` array is rendered
// as adjacent <kbd> chips.
export interface KeyboardShortcut {
  keys: string[];
  description: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: ["⌘", "S"], description: "Save image" },
  { keys: ["⌘", "C"], description: "Copy image" },
  { keys: ["1-9"], description: "Presets & templates" },
  { keys: ["L", "B", "A"], description: "Chart type" },
  { keys: ["G"], description: "Toggle grid" },
  { keys: ["D"], description: "Toggle labels" },
  { keys: ["R"], description: "Avg reference" },
  { keys: ["T"], description: "Total line" },
  { keys: ["Del"], description: "Delete annotation" },
  { keys: ["↑↓←→"], description: "Nudge annotation" },
];

export type { ChartType };
