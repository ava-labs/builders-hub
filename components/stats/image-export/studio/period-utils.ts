import type { Period } from "../types";
import type { ChartDataPoint } from "./types";

// Period hierarchy for comparison (higher number = coarser granularity).
const PERIOD_ORDER: Record<Period, number> = { D: 1, W: 2, M: 3, Q: 4, Y: 5 };

// Detect the period/granularity of the data based on its date format.
// "2024-Q1" → Q, "2024-11" → M, "2024-11-15" → D (or W, same format), "2024" → Y.
export function detectDataPeriod(data: ChartDataPoint[]): Period {
  if (data.length === 0) return "D";

  const firstDate = data[0]?.date || "";
  if (firstDate.includes("Q")) return "Q";

  const parts = firstDate.split("-");
  if (parts.length === 1) return "Y";
  if (parts.length === 2) return "M";
  return "D";
}

// Parse a date string (any of the supported period formats) into year/month/day
// components. Returns null on malformed input.
function parseDateComponents(
  dateStr: string
): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;

  if (dateStr.includes("Q")) {
    const [yearStr, q] = dateStr.split("-Q");
    const year = parseInt(yearStr);
    const quarter = parseInt(q);
    if (isNaN(year) || isNaN(quarter)) return null;
    const month = (quarter - 1) * 3 + 1;
    return { year, month, day: 1 };
  }

  const parts = dateStr.split("-");
  if (parts.length === 1) {
    const year = parseInt(parts[0]);
    if (isNaN(year)) return null;
    return { year, month: 1, day: 1 };
  }
  if (parts.length === 2) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (isNaN(year) || isNaN(month)) return null;
    return { year, month, day: 1 };
  }
  if (parts.length === 3) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { year, month, day };
  }
  return null;
}

// Aggregate a daily/weekly data series into a coarser period (W/M/Q/Y).
// Cumulative metrics use max-of-period; everything else is summed.
// Mirrors the logic in ConfigurableChart.tsx.
export function aggregateDataByPeriod(
  data: ChartDataPoint[],
  targetPeriod: Period
): ChartDataPoint[] {
  if (targetPeriod === "D" || data.length === 0) return data;

  // Skip if data is already at or coarser than the target period.
  const currentPeriod = detectDataPeriod(data);
  if (PERIOD_ORDER[currentPeriod] >= PERIOD_ORDER[targetPeriod]) {
    return data;
  }

  const grouped = new Map<
    string,
    { sum: Record<string, number>; count: number; date: string }
  >();

  data.forEach((point) => {
    const dateStr = point.date;
    if (!dateStr) return;

    const parsed = parseDateComponents(dateStr);
    if (!parsed) return;
    const { year, month, day } = parsed;

    let key: string;
    if (targetPeriod === "W") {
      // Compute Sunday-anchored week start in local time.
      const date = new Date(year, month - 1, day);
      const weekStartDay = day - date.getDay();
      const weekStart = new Date(year, month - 1, weekStartDay);
      const wy = weekStart.getFullYear();
      const wm = String(weekStart.getMonth() + 1).padStart(2, "0");
      const wd = String(weekStart.getDate()).padStart(2, "0");
      key = `${wy}-${wm}-${wd}`;
    } else if (targetPeriod === "M") {
      key = `${year}-${String(month).padStart(2, "0")}`;
    } else if (targetPeriod === "Q") {
      const quarter = Math.floor((month - 1) / 3) + 1;
      key = `${year}-Q${quarter}`;
    } else {
      key = String(year);
    }

    if (!grouped.has(key)) {
      grouped.set(key, { sum: {}, count: 0, date: key });
    }
    const group = grouped.get(key)!;

    Object.keys(point).forEach((k) => {
      if (k === "date" || k === "day") return;
      if (!group.sum[k]) group.sum[k] = 0;
      const value = typeof point[k] === "number" ? point[k] : 0;
      // Cumulative metrics shouldn't be summed across the bucket.
      if (k.includes("cumulative") || k.includes("Cumulative")) {
        group.sum[k] = Math.max(group.sum[k], value);
      } else {
        group.sum[k] += value;
      }
    });
    group.count += 1;
  });

  return Array.from(grouped.values())
    .map((group) => ({ date: group.date, ...group.sum }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Convert a date string in any supported period format to a millisecond
// timestamp. Used when filtering each playground chart by its own end date.
export function parseDateToTimestamp(dateStr: string | undefined): number | null {
  if (!dateStr) return null;

  if (dateStr.includes("Q")) {
    const [year, q] = dateStr.split("-Q");
    const quarter = parseInt(q);
    if (isNaN(parseInt(year)) || isNaN(quarter)) return null;
    const month = (quarter - 1) * 3;
    return new Date(parseInt(year), month, 1).getTime();
  }

  const parts = dateStr.split("-");
  if (parts.length === 1) {
    const year = parseInt(parts[0]);
    if (isNaN(year)) return null;
    return new Date(year, 0, 1).getTime();
  }
  if (parts.length === 2) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (isNaN(year) || isNaN(month)) return null;
    return new Date(year, month - 1, 1).getTime();
  }
  if (parts.length === 3) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month - 1, day).getTime();
  }
  return null;
}

// Translate a date-range preset's day count into "data points to show" given
// the current period. Used to set the brush window.
export function calculateDataPointsForPreset(
  days: number | null,
  currentPeriod: Period | undefined
): number | null {
  if (!days) return null;

  const p = currentPeriod || "D";
  switch (p) {
    case "D":
      return days;
    case "W":
      return Math.ceil(days / 7);
    case "M":
      return Math.ceil(days / 30);
    case "Q":
      return Math.ceil(days / 90);
    case "Y":
      return Math.ceil(days / 365);
    default:
      return days;
  }
}

// Default brush window: last 3 months (90 days), translated to the current
// period's data-point count.
export function getDefaultBrushRange(
  dataLength: number,
  currentPeriod: Period | undefined
): { startIndex: number; endIndex: number } {
  const endIndex = dataLength - 1;
  const dataPoints = calculateDataPointsForPreset(90, currentPeriod) ?? 90;
  const startIndex = Math.max(0, endIndex - dataPoints + 1);
  return { startIndex, endIndex };
}
