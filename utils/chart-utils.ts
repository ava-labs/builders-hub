// Chart utility functions for moving averages and data transformations

export type Period = "D" | "W" | "M" | "Q" | "Y";

export interface MAConfig {
  window: number;
  label: string;
}

/**
 * Get moving average window size and label based on period
 * - D (Daily): 30-day average
 * - W (Weekly): 4-week average (~1 month)
 * - M (Monthly): 3-month average (~1 quarter)
 * - Q (Quarterly): 4-quarter average (~1 year)
 * - Y (Yearly): 3-year average
 */
export function getMAConfig(period: Period): MAConfig {
  switch (period) {
    case "D": return { window: 30, label: "30d Avg" };
    case "W": return { window: 4, label: "4w Avg" };
    case "M": return { window: 3, label: "3m Avg" };
    case "Q": return { window: 4, label: "4q Avg" };
    case "Y": return { window: 3, label: "3y Avg" };
    default: return { window: 30, label: "30d Avg" };
  }
}

export interface DataPointWithMA {
  day: string;
  value: number;
  ma: number;
  [key: string]: any;
}

/**
 * Calculate moving average for a dataset
 * @param data - Array of data points with day and value
 * @param windowSize - Number of periods for the moving average
 * @returns Array of data points with added 'ma' field
 */
export function calculateMovingAverage<T extends { day: string; value: number }>(
  data: T[],
  windowSize: number
): (T & { ma: number })[] {
  if (!data || data.length === 0) return [];
  
  return data.map((point, index) => {
    // Get up to N previous periods including current
    const startIdx = Math.max(0, index - (windowSize - 1));
    const slice = data.slice(startIdx, index + 1);
    const sum = slice.reduce((acc, p) => acc + p.value, 0);
    const ma = sum / slice.length;
    return {
      ...point,
      ma: isNaN(ma) ? 0 : ma,
    };
  });
}

/**
 * Aggregate data by period (W, M, Q, Y)
 * For cumulative metrics, takes the max value in each period
 * For regular metrics, sums the values
 */
export function aggregateDataByPeriod<T extends { day: string; value: number }>(
  data: T[],
  period: Period,
  isCumulative: boolean = false
): { day: string; value: number }[] {
  if (!data || data.length === 0) return [];
  if (period === "D") return data;

  const grouped = new Map<string, { sum: number; max: number; count: number; date: string }>();

  data.forEach((point) => {
    const date = new Date(point.day);
    let key: string;

    if (period === "W") {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split("T")[0];
    } else if (period === "M") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    } else if (period === "Q") {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      key = `${date.getFullYear()}-Q${quarter}`;
    } else {
      key = String(date.getFullYear());
    }

    if (!grouped.has(key)) {
      grouped.set(key, { sum: 0, max: 0, count: 0, date: key });
    }

    const group = grouped.get(key)!;
    group.sum += point.value;
    group.max = Math.max(group.max, point.value);
    group.count += 1;
  });

  return Array.from(grouped.values())
    .map((group) => ({
      day: group.date,
      value: isCumulative ? group.max : group.sum,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Process data with aggregation and moving average in one step
 */
export function processDataWithMA<T extends { day: string; value: number }>(
  data: T[],
  period: Period,
  isCumulative: boolean = false
): DataPointWithMA[] {
  const aggregated = aggregateDataByPeriod(data, period, isCumulative);
  const maConfig = getMAConfig(period);
  return calculateMovingAverage(aggregated, maConfig.window);
}

