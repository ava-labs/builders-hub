"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Link2, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import type { ExportSettings, ChartExportData } from "./types";
import { TITLE_SIZE_MAP } from "./constants";
import { cn } from "@/lib/utils";

export interface SeriesStats {
  seriesId: string;
  seriesName: string;
  seriesColor: string;
  min: number;
  max: number;
  avg: number;
  percentChange: number;
  trend: "up" | "down" | "neutral";
}

export interface ChartStats {
  min: number;
  max: number;
  avg: number;
  percentChange: number;
  trend: "up" | "down" | "neutral";
  seriesName?: string;
  seriesColor?: string;
  allSeries?: SeriesStats[];
  cumulativeTotal?: number;
}

interface ImagePreviewProps {
  settings: ExportSettings;
  chartData: ChartExportData;
  children: React.ReactNode;
  stats?: ChartStats;
  capturedAt?: Date;
}

// Map gradient direction to CSS linear-gradient direction
const GRADIENT_DIRECTION_MAP: Record<string, string> = {
  "to-right": "to right",
  "to-left": "to left",
  "to-bottom": "to bottom",
  "to-top": "to top",
  "to-br": "to bottom right",
  "to-bl": "to bottom left",
  "to-tr": "to top right",
  "to-tl": "to top left",
};

// Format number for display
const formatStatNumber = (value: number) => {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Format percent change with appropriate precision
const formatPercentChange = (value: number) => {
  const absValue = Math.abs(value);
  const sign = value >= 0 ? "+" : "";

  if (absValue >= 10) {
    return `${sign}${value.toFixed(0)}%`;
  } else if (absValue >= 1) {
    return `${sign}${value.toFixed(1)}%`;
  } else if (absValue >= 0.1) {
    return `${sign}${value.toFixed(2)}%`;
  } else if (absValue > 0.01) {
    return `${sign}${value.toFixed(2)}%`;
  } else {
    // Very small change, essentially flat
    return "~0%";
  }
};

// Format date for footer display
const formatCaptureDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const ImagePreview = forwardRef<HTMLDivElement, ImagePreviewProps>(
  function ImagePreview({ settings, chartData, children, stats, capturedAt }, ref) {
    const { padding, logo, title, background, footer, theme, chartDisplay } = settings;

    // Minimum padding for footer content when main padding is 0
    const footerPadding = Math.max(padding, 12);

    const hasLogo = logo.type !== "none";
    const showHeader = hasLogo && logo.position === "header";
    const showInlineLogo = hasLogo && logo.position === "inline";

    const titleSizeClass = TITLE_SIZE_MAP[title.size];
    const titleWeightClass = title.style === "bold" ? "font-bold" : "font-normal";
    const titleColorStyle = title.color ? { color: title.color } : undefined;

    // Build source text
    const sourceText = chartData.source
      ? `Sources: ${chartData.source}. ${chartData.title}${chartData.chainName ? ` (${chartData.chainName})` : ""}${chartData.sourceDescription ? `: ${chartData.sourceDescription}` : ""}`
      : null;

    const hasBackground = background.type === "gradient"
      ? (background.gradientFrom && background.gradientTo)
      : (background.color && background.color !== "transparent");

    // Build background style
    const getBackgroundStyle = () => {
      if (background.type === "gradient" && background.gradientFrom && background.gradientTo) {
        const direction = GRADIENT_DIRECTION_MAP[background.gradientDirection || "to-right"];
        return {
          background: `linear-gradient(${direction}, ${background.gradientFrom}, ${background.gradientTo})`,
        };
      }
      return {
        backgroundColor: hasBackground ? background.color : undefined,
      };
    };

    // Determine theme class for the inner card
    const getThemeClass = () => {
      switch (theme) {
        case "light":
          return "bg-white text-zinc-950";
        case "dark":
          return "bg-zinc-950 text-white";
        case "rich":
          return "bg-zinc-900 text-white";
        default:
          return "bg-white text-zinc-950";
      }
    };

    // Get text color class based on theme
    const getTextColorClass = () => {
      switch (theme) {
        case "light":
          return "text-zinc-950";
        case "dark":
        case "rich":
          return "text-white";
        default:
          return "text-zinc-950";
      }
    };

    // Get trend indicator colors based on theme and trend direction
    // Same style for all themes: colored text with subtle background
    const getTrendColorClass = (trend: "up" | "down" | "neutral") => {
      const isLightTheme = theme === "light";

      if (trend === "up") {
        return isLightTheme
          ? "bg-emerald-100 text-emerald-700"  // Colored text, subtle bg
          : "bg-emerald-900/50 text-emerald-400";
      }
      if (trend === "down") {
        return isLightTheme
          ? "bg-red-100 text-red-700"  // Colored text, subtle bg
          : "bg-red-900/50 text-red-400";
      }
      // neutral
      return isLightTheme
        ? "bg-zinc-200 text-zinc-700"  // Colored text, subtle bg
        : "bg-zinc-700 text-zinc-300";
    };

    // Get muted text color class based on theme
    const getMutedTextColorClass = () => {
      switch (theme) {
        case "light":
          return "text-zinc-500";
        case "dark":
        case "rich":
          return "text-zinc-400";
        default:
          return "text-zinc-500";
      }
    };

    // Get border color class based on theme
    const getBorderColorClass = () => {
      switch (theme) {
        case "light":
          return "border-gray-200";
        case "dark":
          return "border-zinc-800";
        case "rich":
          return "border-zinc-700";
        default:
          return "border-gray-200";
      }
    };

    // Footer visibility logic - show if any footer content is enabled
    const hasFooterContent =
      (footer.showSources && sourceText) ||
      (footer.showUrl && chartData.pageUrl) ||
      footer.showQrCode;

    const showFooterInside = footer.visible && footer.position === "inside" && hasFooterContent;
    const showFooterOutside = footer.visible && footer.position === "outside" && hasFooterContent && hasBackground;

    return (
      <div className="flex flex-col">
        {/* Main export container */}
        <div
          ref={ref}
          className="relative overflow-hidden"
          style={{
            ...getBackgroundStyle(),
            padding: hasBackground ? `${padding}px` : 0,
            borderRadius: `${background.borderRadius ?? 8}px`,
          }}
        >
          <div
            className={cn(
              "flex flex-col overflow-hidden",
              getThemeClass()
            )}
            style={{
              borderRadius: `${Math.max(0, (background.borderRadius ?? 8) - 4)}px`,
            }}
          >
            {/* Header with logo (for Social Media preset) */}
            {showHeader && (
              <div
                className="flex items-center gap-3 shrink-0"
                style={{ padding: `${padding}px`, paddingBottom: 0 }}
              >
                {logo.type === "avalanche" && (
                  <Image
                    src="/small-logo.png"
                    alt="Avalanche"
                    width={40}
                    height={40}
                    className="rounded-md"
                  />
                )}
                {logo.type === "custom" && logo.customUrl && (
                  <img
                    src={logo.customUrl}
                    alt="Custom logo"
                    width={40}
                    height={40}
                    className="rounded-md object-contain"
                  />
                )}
                <h2
                  className={cn(!titleColorStyle && getTextColorClass(), titleSizeClass, titleWeightClass)}
                  style={titleColorStyle}
                >
                  {chartData.title}
                </h2>
              </div>
            )}

            {/* Main content area */}
            <div className="flex flex-col" style={{ padding: `${padding}px` }}>
              {/* Title with inline logo */}
              {!showHeader && (
                <div className="flex items-center gap-3 mb-2 shrink-0">
                  {showInlineLogo && logo.type === "avalanche" && (
                    <Image
                      src="/small-logo.png"
                      alt="Avalanche"
                      width={32}
                      height={32}
                      className="rounded-md"
                    />
                  )}
                  {showInlineLogo && logo.type === "custom" && logo.customUrl && (
                    <img
                      src={logo.customUrl}
                      alt="Custom logo"
                      width={32}
                      height={32}
                      className="rounded-md object-contain"
                    />
                  )}
                  <h2
                    className={cn(!titleColorStyle && getTextColorClass(), titleSizeClass, titleWeightClass)}
                    style={titleColorStyle}
                  >
                    {chartData.title}
                  </h2>
                </div>
              )}

              {/* Custom description */}
              {settings.description && (
                <p className={cn("text-sm mb-2 shrink-0", getMutedTextColorClass())}>
                  {settings.description}
                </p>
              )}

              {/* Metric value display */}
              {chartData.metricValue && (
                <div className="mb-4 shrink-0">
                  {chartData.chainName && (
                    <div className={cn("flex items-center gap-2 text-sm mb-1", getMutedTextColorClass())}>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{chartData.chainName}</span>
                    </div>
                  )}
                  <div className={cn("text-2xl font-bold", getTextColorClass())}>
                    {chartData.metricValue}
                  </div>
                  {chartData.metricLabel && (
                    <div className={cn("text-sm", getMutedTextColorClass())}>
                      {chartData.metricLabel}
                    </div>
                  )}
                </div>
              )}

              {/* Chart content - fixed height to ensure visibility */}
              <div className="w-full" style={{ height: "280px" }}>
                {children}
              </div>

              {/* Stats badges */}
              {stats && (chartDisplay.showSummaryStats || chartDisplay.showTrendIndicator) && (
                <div className="flex flex-col gap-2 -mt-1">
                  {/* Multi-series stats */}
                  {stats.allSeries && stats.allSeries.length > 1 ? (
                    stats.allSeries.map((s) => (
                      <div key={s.seriesId} className="flex items-center gap-3 flex-wrap">
                        {/* Series color indicator and name */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.seriesColor }}
                          />
                          <span className={cn("text-xs font-medium", getMutedTextColorClass())}>
                            {s.seriesName}
                          </span>
                        </div>
                        {/* Trend indicator */}
                        {chartDisplay.showTrendIndicator && (
                          <div
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                              getTrendColorClass(s.trend)
                            )}
                          >
                            {s.trend === "up" && <TrendingUp className="h-3 w-3" />}
                            {s.trend === "down" && <TrendingDown className="h-3 w-3" />}
                            {s.trend === "neutral" && <Minus className="h-3 w-3" />}
                            {formatPercentChange(s.percentChange)}
                          </div>
                        )}
                        {/* Summary stats */}
                        {chartDisplay.showSummaryStats && (
                          <>
                            <div className={cn("text-xs", getMutedTextColorClass())}>
                              <span className="font-medium">Min:</span> {formatStatNumber(s.min)}
                            </div>
                            <div className={cn("text-xs", getMutedTextColorClass())}>
                              <span className="font-medium">Max:</span> {formatStatNumber(s.max)}
                            </div>
                            <div className={cn("text-xs", getMutedTextColorClass())}>
                              <span className="font-medium">Avg:</span> {formatStatNumber(s.avg)}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    /* Single series stats (original layout) */
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Trend indicator */}
                      {chartDisplay.showTrendIndicator && (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                            getTrendColorClass(stats.trend)
                          )}
                        >
                          {stats.trend === "up" && <TrendingUp className="h-3 w-3" />}
                          {stats.trend === "down" && <TrendingDown className="h-3 w-3" />}
                          {stats.trend === "neutral" && <Minus className="h-3 w-3" />}
                          {formatPercentChange(stats.percentChange)}
                        </div>
                      )}
                      {/* Summary stats */}
                      {chartDisplay.showSummaryStats && (
                        <>
                          <div className={cn("text-xs", getMutedTextColorClass())}>
                            <span className="font-medium">Min:</span> {formatStatNumber(stats.min)}
                          </div>
                          <div className={cn("text-xs", getMutedTextColorClass())}>
                            <span className="font-medium">Max:</span> {formatStatNumber(stats.max)}
                          </div>
                          <div className={cn("text-xs", getMutedTextColorClass())}>
                            <span className="font-medium">Avg:</span> {formatStatNumber(stats.avg)}
                          </div>
                        </>
                      )}
                      {/* Total cumulative value */}
                      {chartDisplay.showTotalLine && stats.cumulativeTotal !== undefined && (
                        <div className="text-xs flex items-center gap-1.5">
                          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: "#a855f7" }} />
                          <span style={{ color: "#a855f7" }}>
                            <span className="font-medium">Total:</span> {formatStatNumber(stats.cumulativeTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer (inside) - below chart within the card */}
            {showFooterInside && (
              <div
                className={cn("text-xs shrink-0 border-t", getMutedTextColorClass(), getBorderColorClass())}
                style={{
                  paddingLeft: `${footerPadding}px`,
                  paddingRight: `${footerPadding}px`,
                  paddingTop: `${Math.max(padding / 2, 8)}px`,
                  paddingBottom: `${Math.max(padding / 2, 8)}px`,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Text content (sources + URL + date) */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Sources */}
                    {footer.showSources && sourceText && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
                          </svg>
                        </span>
                        <span className="leading-relaxed break-words">{sourceText}</span>
                      </div>
                    )}
                    {/* URL */}
                    {footer.showUrl && chartData.pageUrl && (
                      <div className="flex items-start gap-2">
                        <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="break-all leading-relaxed">{chartData.pageUrl}</span>
                      </div>
                    )}
                    {/* Capture date */}
                    {footer.showCaptureDate && capturedAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>Captured {formatCaptureDate(capturedAt)}</span>
                      </div>
                    )}
                  </div>
                  {/* QR Code */}
                  {footer.showQrCode && chartData.pageUrl && (
                    <div className="shrink-0 bg-white p-1 rounded">
                      <QRCodeSVG
                        value={chartData.pageUrl}
                        size={48}
                        level="L"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer (outside) - below the main container */}
        {showFooterOutside && (
          <div
            className={cn("text-xs mt-2", getMutedTextColorClass())}
            style={{ paddingLeft: `${footerPadding}px`, paddingRight: `${footerPadding}px` }}
          >
            <div className="flex items-start gap-3">
              {/* Text content (sources + URL + date) */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Sources */}
                {footer.showSources && sourceText && (
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                        <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
                      </svg>
                    </span>
                    <span className="leading-relaxed break-words">{sourceText}</span>
                  </div>
                )}
                {/* URL */}
                {footer.showUrl && chartData.pageUrl && (
                  <div className="flex items-start gap-2">
                    <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="break-all leading-relaxed">{chartData.pageUrl}</span>
                  </div>
                )}
                {/* Capture date */}
                {footer.showCaptureDate && capturedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>Captured {formatCaptureDate(capturedAt)}</span>
                  </div>
                )}
              </div>
              {/* QR Code */}
              {footer.showQrCode && chartData.pageUrl && (
                <div className="shrink-0 bg-white p-1 rounded">
                  <QRCodeSVG
                    value={chartData.pageUrl}
                    size={48}
                    level="L"
                    includeMargin={false}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
