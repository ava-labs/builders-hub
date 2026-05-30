import { parseDateString } from "@/components/stats/chart-axis-utils";
import type { Period, CustomAspectRatio } from "../types";

// Format X axis labels based on the currently-selected period.
export function formatXAxis(value: string, period: Period | undefined): string {
  if (!value) return "";
  const date = parseDateString(value);
  if (isNaN(date.getTime())) return value;

  switch (period) {
    case "Y":
      return date.getFullYear().toString();
    case "Q": {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} '${date.getFullYear().toString().slice(-2)}`;
    }
    case "M":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    case "W":
    case "D":
    default:
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
  }
}

// Compact Y axis formatter (K/M/B/T).
export function formatYAxis(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

// Compact data-label formatter (slightly different rounding from formatYAxis;
// kept separate to preserve legacy behavior).
export function formatDataLabel(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

// Maps the current aspect ratio (or custom dimensions) to a Tailwind
// max-width class so the preview doesn't overflow the dialog.
export function getPreviewMaxWidth(
  aspectRatio: string,
  customAspectRatio: CustomAspectRatio
): string {
  if (aspectRatio === "custom") {
    const ratio = customAspectRatio.width / customAspectRatio.height;
    if (ratio < 0.75) return "max-w-[280px]";
    if (ratio < 1) return "max-w-[350px]";
    if (ratio < 1.2) return "max-w-[450px]";
    if (ratio < 1.6) return "max-w-[650px]";
    if (ratio < 2) return "max-w-[700px]";
    return "max-w-[900px]";
  }

  switch (aspectRatio) {
    case "portrait":
      return "max-w-[280px]";
    case "instagram":
      return "max-w-[350px]";
    case "square":
      return "max-w-[450px]";
    case "landscape":
      return "max-w-[700px]";
    case "collage":
      return "max-w-[1400px]";
    case "social-card":
    default:
      return "max-w-[650px]";
  }
}
