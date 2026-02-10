// Types for the Image Export Studio feature

export type AspectRatio = "landscape" | "square" | "portrait" | "instagram" | "social-card" | "collage" | "custom";
export type Padding = 0 | 8 | 16 | 24 | 32;
export type LogoPosition = "inline" | "header";
export type TitleStyle = "bold" | "normal";
export type TitleSize = "small" | "medium" | "large";
export type FooterPosition = "inside" | "outside";
export type PresetType = "default" | "social-media" | "slide-deck" | "collage" | "customize";
export type ChartType = "line" | "bar" | "area";
export type DateRangePreset = "1M" | "3M" | "6M" | "1Y" | "ALL";
export type ExportTheme = "light" | "dark" | "rich";
export type ExportResolution = "1x" | "2x" | "3x";
export type ExportFormat = "png" | "jpeg" | "svg";
export type GradientDirection = "to-right" | "to-left" | "to-bottom" | "to-top" | "to-br" | "to-bl" | "to-tr" | "to-tl";

export interface BrushRange {
  startIndex: number;
  endIndex: number;
}

export interface LogoSettings {
  type: "avalanche" | "custom" | "none";
  customUrl?: string;
  position: LogoPosition;
}

export interface TitleSettings {
  style: TitleStyle;
  size: TitleSize;
  color?: string; // Custom title color (hex)
}

export interface BackgroundSettings {
  type: "solid" | "gradient";
  color: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: GradientDirection;
  borderRadius?: number;
}

export interface FooterSettings {
  position: FooterPosition;
  showSources: boolean;
  showUrl: boolean;
  showQrCode: boolean;
  showCaptureDate: boolean;
  visible: boolean;
}

export type WatermarkPosition =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type WatermarkLayer = "back" | "front";

export interface WatermarkSettings {
  visible: boolean;
  opacity: number;
  position?: WatermarkPosition;
  layer?: WatermarkLayer;
}

export interface ChartDisplaySettings {
  showDataLabels: boolean;
  showGridLines: boolean;
  showSummaryStats: boolean;
  showTrendIndicator: boolean;
  showAvgLine: boolean;
  showTotalLine: boolean;
}

export interface ExportQualitySettings {
  resolution: ExportResolution;
  format: ExportFormat;
  jpegQuality: number;
}

// Annotation types
export type AnnotationType = "highlight" | "text" | "arrow" | "freehand" | "rectangle";
export type AnnotationSize = "small" | "medium" | "large";
export type ArrowLineStyle = "solid" | "dashed";
export type ArrowheadStyle = "filled" | "outline" | "none";

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
  opacity: number; // 0-100
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  size: AnnotationSize;
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  text: string;
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  size: AnnotationSize;
  hasBackground: boolean;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  startX: number; // Percentage position (0-100)
  startY: number;
  endX: number;
  endY: number;
  size: AnnotationSize;
  lineStyle?: ArrowLineStyle;
  arrowheadStyle?: ArrowheadStyle;
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: "freehand";
  points: Array<{ x: number; y: number }>; // Array of percentage positions
  strokeWidth: number;
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: "rectangle";
  x: number; // Top-left percentage position
  y: number;
  width: number; // Width in percentage
  height: number; // Height in percentage
  strokeWidth: number;
}

export type Annotation = HighlightAnnotation | TextAnnotation | ArrowAnnotation | FreehandAnnotation | RectangleAnnotation;

export interface AnnotationSettings {
  annotations: Annotation[];
  activeToolType: AnnotationType | null;
  selectedAnnotationId: string | null;
}

export interface ExportSettings {
  preset: PresetType;
  aspectRatio: AspectRatio;
  padding: Padding;
  logo: LogoSettings;
  title: TitleSettings;
  background: BackgroundSettings;
  footer: FooterSettings;
  chartType: ChartType;
  theme: ExportTheme;
  watermark: WatermarkSettings;
  chartDisplay: ChartDisplaySettings;
  exportQuality: ExportQualitySettings;
  description?: string;
}

export interface ChartExportData {
  title: string;
  source?: string;
  sourceDescription?: string;
  chainName?: string;
  metricValue?: string | number;
  metricLabel?: string;
  pageUrl?: string;
}

export type Period = "D" | "W" | "M" | "Q" | "Y";

export interface ImageExportStudioProps {
  isOpen: boolean;
  onClose: () => void;
  chartRef: React.RefObject<HTMLElement | null>;
  chartData: ChartExportData;
  resolvedTheme?: string;
  // Period selector props
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  allowedPeriods?: Period[];
}

// Dimensions for each aspect ratio (in pixels)
export interface AspectRatioDimensions {
  width: number;
  height: number;
  ratio: string;
}

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, AspectRatioDimensions> = {
  landscape: { width: 1200, height: 675, ratio: "16:9" },
  square: { width: 1080, height: 1080, ratio: "1:1" },
  portrait: { width: 1080, height: 1920, ratio: "9:16" },
  instagram: { width: 1080, height: 1350, ratio: "4:5" },
  "social-card": { width: 1200, height: 628, ratio: "1.91:1" },
  collage: { width: 1800, height: 1200, ratio: "3:2" },
  custom: { width: 1280, height: 720, ratio: "16:9" }, // Default custom, overridden at runtime
};

// Collage Mode Types
export type ExportMode = "single" | "collage";

export interface CollageMetricConfig {
  metricKey: string;
  title: string;
  description: string;
  color: string;
}

export interface ChartDataPoint {
  date?: string;
  day?: string;
  value?: number;
  [key: string]: string | number | undefined;
}

export interface CollageMetricData {
  config: CollageMetricConfig;
  data: ChartDataPoint[];
  isLoading: boolean;
  error?: string;
}

export interface CollageSettings {
  showIndividualTitles: boolean;
  chartSpacing: number;
  gridLayout?: { cols: number; rows: number } | null; // null = auto-calculate
}

// Custom aspect ratio dimensions
export interface CustomAspectRatio {
  width: number;
  height: number;
}
