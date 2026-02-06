import type { ExportSettings, PresetType } from "./types";

// Background color palette - 10 curated colors
export const BACKGROUND_COLORS = [
  { id: "white", color: "#ffffff", label: "White" },
  { id: "black", color: "#000000", label: "Black" },
  { id: "light-gray", color: "#f5f5f5", label: "Light Gray" },
  { id: "mint", color: "#d1fae5", label: "Mint" },
  { id: "teal", color: "#14b8a6", label: "Teal" },
  { id: "emerald", color: "#10b981", label: "Emerald" },
  { id: "blue", color: "#3b82f6", label: "Blue" },
  { id: "purple", color: "#8b5cf6", label: "Purple" },
  { id: "pink", color: "#ec4899", label: "Pink" },
  { id: "slate", color: "#334155", label: "Slate" },
];

// Avalanche brand colors (based on logo)
export const AVALANCHE_BRAND_COLORS = [
  { id: "red", color: "#e84142", label: "Avalanche Red" },
  { id: "red-dark", color: "#c53030", label: "Dark Red" },
  { id: "red-darker", color: "#9b2c2c", label: "Darker Red" },
  { id: "red-light", color: "#fc8181", label: "Light Red" },
];

// Border colors for presets
export const BORDER_COLORS = {
  blue: "#3b82f6",
  red: "#e84142",
  green: "#10b981",
  purple: "#8b5cf6",
  teal: "#14b8a6",
  pink: "#ec4899",
  none: "transparent",
};

// Default new settings shared across presets
const DEFAULT_WATERMARK = {
  visible: true,
  opacity: 0.15,
  position: "center" as const,
  layer: "back" as const,
};

const DEFAULT_CHART_DISPLAY = {
  showDataLabels: false,
  showGridLines: true,
  showSummaryStats: true,
  showTrendIndicator: false,
  showAvgLine: true,
  showTotalLine: false,
};

const DEFAULT_EXPORT_QUALITY = {
  resolution: "2x" as const,
  format: "png" as const,
  jpegQuality: 90,
};

// Default settings for each preset
export const PRESET_DEFAULTS: Record<PresetType, ExportSettings> = {
  default: {
    preset: "default",
    aspectRatio: "social-card",
    padding: 16,
    logo: {
      type: "none",
      position: "inline",
    },
    title: {
      style: "bold",
      size: "medium",
    },
    background: {
      type: "gradient",
      color: "transparent",
      gradientFrom: "#f97316",
      gradientTo: "#ec4899",
      gradientDirection: "to-tr",
      borderRadius: 20,
    },
    footer: {
      position: "inside",
      showSources: false,
      showUrl: true,
      showQrCode: false,
      showCaptureDate: true,
      visible: true,
    },
    chartType: "bar",
    theme: "light",
    watermark: DEFAULT_WATERMARK,
    chartDisplay: DEFAULT_CHART_DISPLAY,
    exportQuality: DEFAULT_EXPORT_QUALITY,
  },
  "social-media": {
    preset: "social-media",
    aspectRatio: "square",
    padding: 24,
    logo: {
      type: "avalanche",
      position: "header",
    },
    title: {
      style: "bold",
      size: "medium",
    },
    background: {
      type: "gradient",
      color: "transparent",
      gradientFrom: "#8b5cf6",
      gradientTo: "#ec4899",
      gradientDirection: "to-br",
      borderRadius: 12,
    },
    footer: {
      position: "inside",
      showSources: false,
      showUrl: true,
      showQrCode: false,
      showCaptureDate: true,
      visible: true,
    },
    chartType: "bar",
    theme: "dark",
    watermark: DEFAULT_WATERMARK,
    chartDisplay: DEFAULT_CHART_DISPLAY,
    exportQuality: DEFAULT_EXPORT_QUALITY,
  },
  "slide-deck": {
    preset: "slide-deck",
    aspectRatio: "landscape",
    padding: 16,
    logo: {
      type: "avalanche",
      position: "inline",
    },
    title: {
      style: "bold",
      size: "medium",
    },
    background: {
      type: "solid",
      color: "#f5f5f5",
      borderRadius: 4,
    },
    footer: {
      position: "inside",
      showSources: false,
      showUrl: true,
      showQrCode: false,
      showCaptureDate: true,
      visible: true,
    },
    chartType: "bar",
    theme: "light",
    watermark: DEFAULT_WATERMARK,
    chartDisplay: DEFAULT_CHART_DISPLAY,
    exportQuality: DEFAULT_EXPORT_QUALITY,
  },
  collage: {
    preset: "collage",
    aspectRatio: "collage",
    padding: 8,
    logo: {
      type: "avalanche",
      position: "inline",
    },
    title: {
      style: "bold",
      size: "medium",
    },
    background: {
      type: "gradient",
      color: "transparent",
      gradientFrom: "#f97316",
      gradientTo: "#ec4899",
      gradientDirection: "to-tr",
      borderRadius: 20,
    },
    footer: {
      position: "inside",
      showSources: false,
      showUrl: true,
      showQrCode: false,
      showCaptureDate: true,
      visible: true,
    },
    chartType: "bar",
    theme: "dark",
    watermark: DEFAULT_WATERMARK,
    chartDisplay: DEFAULT_CHART_DISPLAY,
    exportQuality: DEFAULT_EXPORT_QUALITY,
  },
  customize: {
    preset: "customize",
    aspectRatio: "landscape",
    padding: 16,
    logo: {
      type: "avalanche",
      position: "inline",
    },
    title: {
      style: "bold",
      size: "small",
    },
    background: {
      type: "gradient",
      color: "transparent",
      gradientFrom: "#f97316",
      gradientTo: "#ec4899",
      gradientDirection: "to-tr",
      borderRadius: 20,
    },
    footer: {
      position: "inside",
      showSources: false,
      showUrl: true,
      showQrCode: false,
      showCaptureDate: true,
      visible: true,
    },
    chartType: "bar",
    theme: "light",
    watermark: DEFAULT_WATERMARK,
    chartDisplay: DEFAULT_CHART_DISPLAY,
    exportQuality: DEFAULT_EXPORT_QUALITY,
  },
};

// Gradient presets
export const GRADIENT_PRESETS = [
  { id: "sunset", from: "#f97316", to: "#ec4899", label: "Sunset" },
  { id: "ocean", from: "#06b6d4", to: "#3b82f6", label: "Ocean" },
  { id: "forest", from: "#10b981", to: "#14b8a6", label: "Forest" },
  { id: "purple-haze", from: "#8b5cf6", to: "#ec4899", label: "Purple Haze" },
  { id: "fire", from: "#ef4444", to: "#f97316", label: "Fire" },
  { id: "mint-lime", from: "#10b981", to: "#84cc16", label: "Mint Lime" },
];

// Title size to font size mapping
export const TITLE_SIZE_MAP = {
  small: "text-lg",
  medium: "text-xl",
  large: "text-2xl",
};

// Title size to pixel values for export
export const TITLE_SIZE_PX = {
  small: 18,
  medium: 20,
  large: 24,
};

// Padding values in pixels
export const PADDING_OPTIONS = [0, 8, 16, 24, 32] as const;

// Logo options
export const LOGO_OPTIONS = [
  { id: "avalanche", label: "Avalanche", icon: "/small-logo.png" },
  { id: "custom", label: "Custom", icon: null },
  { id: "none", label: "None", icon: null },
];

// Position options
export const LOGO_POSITION_OPTIONS = [
  { id: "inline", label: "Inline" },
  { id: "header", label: "Header" },
];

// Title style options
export const TITLE_STYLE_OPTIONS = [
  { id: "bold", label: "Aa", fontWeight: "font-bold" },
  { id: "normal", label: "Aa", fontWeight: "font-normal" },
];

// Title size options
export const TITLE_SIZE_OPTIONS = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

// Footer position options
export const FOOTER_POSITION_OPTIONS = [
  { id: "inside", label: "Inside" },
  { id: "outside", label: "Outside" },
];

// Chart type options
export const CHART_TYPE_OPTIONS = [
  { id: "line", label: "Line", icon: "TrendingUp" },
  { id: "bar", label: "Bar", icon: "BarChart3" },
  { id: "area", label: "Area", icon: "AreaChart" },
] as const;

// Date range preset options
export const DATE_RANGE_PRESETS = [
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "ALL", label: "All", days: null },
] as const;

// Arrow line style options
export const ARROW_LINE_STYLES = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
] as const;

// Arrow head style options
export const ARROW_HEAD_STYLES = [
  { id: "filled", label: "Filled" },
  { id: "outline", label: "Outline" },
  { id: "none", label: "None" },
] as const;

// Arrow stroke width by size
export const ARROW_STROKE_WIDTH = {
  small: 1,
  medium: 2,
  large: 4,
} as const;

// Freehand stroke width by size
export const FREEHAND_STROKE_WIDTH = {
  small: 2,
  medium: 4,
  large: 6,
} as const;

// Rectangle stroke width by size
export const RECTANGLE_STROKE_WIDTH = {
  small: 1,
  medium: 2,
  large: 3,
} as const;

// Title color palette - curated colors for text
export const TITLE_COLORS = [
  { id: "default", color: null, label: "Default" }, // Uses theme color
  { id: "white", color: "#ffffff", label: "White" },
  { id: "black", color: "#000000", label: "Black" },
  { id: "gray", color: "#6b7280", label: "Gray" },
  { id: "red", color: "#e84142", label: "Red" },
  { id: "blue", color: "#3b82f6", label: "Blue" },
  { id: "green", color: "#10b981", label: "Green" },
  { id: "purple", color: "#8b5cf6", label: "Purple" },
] as const;

// Generate valid grid layout options for a given metric count
export function getGridLayoutOptions(metricCount: number): Array<{ cols: number; rows: number; label: string }> {
  const options: Array<{ cols: number; rows: number; label: string }> = [];

  if (metricCount <= 0) return options;

  // Add auto option
  options.push({ cols: 0, rows: 0, label: "Auto" });

  // Collect candidate layouts, categorized by empty cell count
  const exactFits: Array<{ cols: number; rows: number }> = [];
  const oneEmpty: Array<{ cols: number; rows: number }> = [];

  const maxDimension = Math.min(metricCount, 5); // Limit to reasonable sizes

  for (let cols = 2; cols <= maxDimension; cols++) {
    for (let rows = 2; rows <= maxDimension; rows++) {
      const capacity = cols * rows;

      // Exact fit
      if (capacity === metricCount) {
        exactFits.push({ cols, rows });
      }
      // One empty cell
      else if (capacity === metricCount + 1) {
        oneEmpty.push({ cols, rows });
      }
    }
  }

  // Also check 1×N and N×1 for small counts only (2-4 metrics)
  if (metricCount <= 4) {
    if (metricCount >= 2) {
      exactFits.push({ cols: metricCount, rows: 1 }); // horizontal row
      exactFits.push({ cols: 1, rows: metricCount }); // vertical column
    }
  }

  // Sort by how "square" the layout is (prefer balanced cols/rows)
  const sortBySquareness = (a: { cols: number; rows: number }, b: { cols: number; rows: number }) => {
    const ratioA = Math.abs(a.cols - a.rows);
    const ratioB = Math.abs(b.cols - b.rows);
    return ratioA - ratioB;
  };

  exactFits.sort(sortBySquareness);
  oneEmpty.sort(sortBySquareness);

  // Add exact fits first (up to 4)
  for (const layout of exactFits.slice(0, 4)) {
    options.push({ cols: layout.cols, rows: layout.rows, label: `${layout.cols}×${layout.rows}` });
  }

  // If we have few options, add some with 1 empty cell
  const remainingSlots = Math.max(0, 4 - exactFits.length);
  for (const layout of oneEmpty.slice(0, remainingSlots)) {
    options.push({ cols: layout.cols, rows: layout.rows, label: `${layout.cols}×${layout.rows}` });
  }

  return options;
}
