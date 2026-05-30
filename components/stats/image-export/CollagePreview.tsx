"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Link2, Calendar } from "lucide-react";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { MiniChart } from "./MiniChart";
import type {
  CollageMetricData,
  ExportSettings,
  CollageSettings,
  Period,
  WatermarkPosition,
} from "./types";
import { cn } from "@/lib/utils";

interface CollagePreviewProps {
  metrics: CollageMetricData[];
  settings: ExportSettings;
  collageSettings: CollageSettings;
  chainName?: string;
  period?: Period;
  pageUrl?: string;
  capturedAt?: Date;
}

// Map gradient direction to CSS
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

// Calculate auto-grid layout based on chart count
const calculateGridLayout = (count: number): { cols: number; rows: number } => {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(count / 4) };
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

// Map watermark position to CSS styles
const getWatermarkPositionStyles = (position: WatermarkPosition): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };

  switch (position) {
    case "top-left":
      return { ...baseStyle, top: "16px", left: "16px" };
    case "top-center":
      return { ...baseStyle, top: "16px", left: "50%", transform: "translateX(-50%)" };
    case "top-right":
      return { ...baseStyle, top: "16px", right: "16px" };
    case "center-left":
      return { ...baseStyle, top: "50%", left: "16px", transform: "translateY(-50%)" };
    case "center":
      return { ...baseStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "center-right":
      return { ...baseStyle, top: "50%", right: "16px", transform: "translateY(-50%)" };
    case "bottom-left":
      return { ...baseStyle, bottom: "16px", left: "16px" };
    case "bottom-center":
      return { ...baseStyle, bottom: "16px", left: "50%", transform: "translateX(-50%)" };
    case "bottom-right":
      return { ...baseStyle, bottom: "16px", right: "16px" };
    default:
      return { ...baseStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
};

export const CollagePreview = forwardRef<HTMLDivElement, CollagePreviewProps>(
  function CollagePreview(
    { metrics, settings, collageSettings, chainName, period, pageUrl, capturedAt },
    ref
  ) {
    const { padding, logo, background, theme, footer, chartType, chartDisplay, watermark } = settings;
    const { showIndividualTitles, chartSpacing, gridLayout } = collageSettings;

    // Use manual grid layout if specified, otherwise auto-calculate
    const { cols, rows } = gridLayout ?? calculateGridLayout(metrics.length);

    // Calculate chart height based on grid
    const baseHeight = 110;
    const chartHeight = rows === 1 ? 160 : rows === 2 ? 130 : baseHeight;

    const hasBackground =
      background.type === "gradient"
        ? background.gradientFrom && background.gradientTo
        : background.color && background.color !== "transparent";

    // Build background style
    const getBackgroundStyle = () => {
      if (
        background.type === "gradient" &&
        background.gradientFrom &&
        background.gradientTo
      ) {
        const direction =
          GRADIENT_DIRECTION_MAP[background.gradientDirection || "to-right"];
        return {
          background: `linear-gradient(${direction}, ${background.gradientFrom}, ${background.gradientTo})`,
        };
      }
      return {
        backgroundColor: hasBackground ? background.color : undefined,
      };
    };

    // Determine theme class
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

    const hasLogo = logo.type !== "none";

    // Title color from settings
    const titleColorStyle = settings.title?.color ? { color: settings.title.color } : undefined;

    // Build source text for collage
    const sourceText = `Sources: Avalanche Metrics. ${chainName || "Avalanche"} metrics overview.`;

    // Footer visibility logic
    const footerPadding = Math.max(padding, 12);
    const hasFooterContent =
      footer.showSources ||
      (footer.showUrl && pageUrl) ||
      footer.showQrCode ||
      (footer.showCaptureDate && capturedAt);

    const showFooterInside = footer.visible && footer.position === "inside" && hasFooterContent;
    const showFooterOutside = footer.visible && footer.position === "outside" && hasFooterContent && hasBackground;

    if (metrics.length === 0) {
      return (
        <div
          ref={ref}
          className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg"
        >
          <p className={cn("text-sm", getMutedTextColorClass())}>
            Select metrics to preview collage
          </p>
        </div>
      );
    }

    // Watermark z-index based on layer setting
    const watermarkZIndex = watermark.layer === "front" ? 20 : 1;

    return (
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
          className={cn("flex flex-col overflow-hidden", getThemeClass())}
          style={{
            borderRadius: `${Math.max(0, (background.borderRadius ?? 8) - 4)}px`,
          }}
        >
          {/* Header with logo and chain name */}
          <div
            className="flex items-center gap-3 shrink-0"
            style={{ padding: `${padding}px`, paddingBottom: padding / 2 }}
          >
            {hasLogo && logo.type === "avalanche" && (
              <Image
                src="/small-logo.png"
                alt="Avalanche"
                width={32}
                height={32}
                className="rounded-md"
              />
            )}
            {hasLogo && logo.type === "custom" && logo.customUrl && (
              <img
                src={logo.customUrl}
                alt="Custom logo"
                width={32}
                height={32}
                className="rounded-md object-contain"
              />
            )}
            <div>
              <h2
                className={cn("text-lg font-bold", !titleColorStyle && getTextColorClass())}
                style={titleColorStyle}
              >
                {chainName || "Avalanche"} Metrics
              </h2>
              <p className={cn("text-xs", getMutedTextColorClass())}>
                {metrics.length} metric{metrics.length !== 1 ? "s" : ""} overview
              </p>
              {settings.description && (
                <p className={cn("text-xs mt-1", getMutedTextColorClass())}>
                  {settings.description}
                </p>
              )}
            </div>
          </div>

          {/* Chart Grid with Watermark */}
          <div
            className="relative"
            style={{
              padding: `${padding / 2}px ${padding}px ${padding}px`,
            }}
          >
            {/* Watermark - positioned within chart area */}
            {watermark.visible && (
              <div
                style={{
                  ...getWatermarkPositionStyles(watermark.position || "center"),
                  opacity: watermark.opacity ?? 0.15,
                  zIndex: watermarkZIndex,
                }}
              >
                <AvalancheLogo className="size-8" fill="currentColor" />
                <span style={{ fontSize: "large", fontWeight: 500 }}>Builder Hub</span>
              </div>
            )}

            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: `${chartSpacing}px`,
                zIndex: 10,
              }}
            >
            {metrics.map((metric) => (
              <div
                key={metric.config.metricKey}
                className={cn(
                  "rounded-md overflow-hidden",
                  theme === "light"
                    ? "bg-zinc-50 border border-zinc-200"
                    : theme === "rich"
                    ? "bg-zinc-800 border border-zinc-700"
                    : "bg-zinc-900 border border-zinc-800" // dark theme
                )}
                style={{ height: `${chartHeight}px` }}
              >
                <MiniChart
                  data={metric.data}
                  title={metric.config.title}
                  color={metric.config.color}
                  height={chartHeight}
                  showTitle={showIndividualTitles}
                  isLoading={metric.isLoading}
                  error={metric.error}
                  period={period}
                  theme={theme}
                  chartType={chartType}
                  showGrid={chartDisplay?.showGridLines ?? true}
                  showAverage={chartDisplay?.showAvgLine ?? true}
                  showStats={chartDisplay?.showSummaryStats ?? false}
                />
              </div>
            ))}
            </div>
          </div>

          {/* Footer (inside) - below charts within the card */}
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
                <div className="flex-1 space-y-1.5">
                  {/* Sources */}
                  {footer.showSources && (
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
                      <span className="leading-relaxed">{sourceText}</span>
                    </div>
                  )}
                  {/* URL */}
                  {footer.showUrl && pageUrl && (
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{pageUrl}</span>
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
                {footer.showQrCode && pageUrl && (
                  <div className="shrink-0 bg-white p-1 rounded">
                    <QRCodeSVG
                      value={pageUrl}
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

        {/* Footer (outside) - below the main container */}
        {showFooterOutside && (
          <div
            className={cn("text-xs mt-2", getMutedTextColorClass())}
            style={{ paddingLeft: `${footerPadding}px`, paddingRight: `${footerPadding}px` }}
          >
            <div className="flex items-start gap-3">
              {/* Text content (sources + URL + date) */}
              <div className="flex-1 space-y-1.5">
                {/* Sources */}
                {footer.showSources && (
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
                    <span className="leading-relaxed">{sourceText}</span>
                  </div>
                )}
                {/* URL */}
                {footer.showUrl && pageUrl && (
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{pageUrl}</span>
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
              {footer.showQrCode && pageUrl && (
                <div className="shrink-0 bg-white p-1 rounded">
                  <QRCodeSVG
                    value={pageUrl}
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
