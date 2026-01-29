/**
 * Shared utilities for chart x-axis formatting and tick generation.
 * Used across ConfigurableChart, ChainMetricsPage, and MiniChart.
 */

export function parseDateString(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Handle quarterly format: YYYY-Q#
  if (dateStr.includes("-Q")) {
    const [year, quarter] = dateStr.split("-Q");
    const month = (parseInt(quarter, 10) - 1) * 3;
    return new Date(parseInt(year, 10), month, 1);
  }

  // Handle weekly format: YYYY-W##
  if (dateStr.includes("-W")) {
    const [year, weekPart] = dateStr.split("-W");
    const weekNum = parseInt(weekPart);
    const jan4 = new Date(parseInt(year), 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - dayOfWeek + 1);
    const weekDate = new Date(week1Start);
    weekDate.setDate(week1Start.getDate() + (weekNum - 1) * 7);
    return weekDate;
  }

  // Standard date parsing: YYYY-MM-DD, YYYY-MM, or YYYY
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  return new Date(year, month, day);
}

export function calculateDateRangeDays<T extends Record<string, unknown>>(
  data: T[],
  dateKey?: string
): number {
  if (data.length < 2) return 0;

  const key = dateKey || (data[0]?.date !== undefined ? "date" : "day");
  const startDate = data[0]?.[key] as string;
  const endDate = data[data.length - 1]?.[key] as string;

  if (!startDate || !endDate) return data.length;

  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatXAxisLabel(value: string, rangeDays: number): string {
  if (!value) return "";

  // Handle quarterly format
  if (value.includes("-Q")) {
    const parts = value.split("-");
    if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
    return value;
  }

  // Handle year-only format
  if (/^\d{4}$/.test(value)) return value;

  const date = parseDateString(value);
  if (isNaN(date.getTime())) return value;

  if (rangeDays > 730) {
    return date.getFullYear().toString();
  } else if (rangeDays > 120) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

// Generate custom x-axis tick positions
export function generateXAxisTicks<T extends Record<string, unknown>>(
  data: T[],
  rangeDays: number,
  dateKey?: string
): string[] | undefined {
  if (data.length === 0) return undefined;

  const key = dateKey || (data[0]?.date !== undefined ? "date" : "day");
  const ticks: string[] = [];

  if (rangeDays > 730) {
    const seenYears = new Set<number>();

    data.forEach((point) => {
      const dateValue = point[key] as string;
      const date = parseDateString(dateValue);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!seenYears.has(year) && month === 0) {
        seenYears.add(year);
        ticks.push(dateValue);
      } else if (!seenYears.has(year)) {
        seenYears.add(year);
      }
    });
  } else if (rangeDays > 120) {
    const seenMonths = new Set<string>();
    data.forEach((point) => {
      const dateValue = point[key] as string;
      const date = parseDateString(dateValue);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        ticks.push(dateValue);
      }
    });
    if (ticks.length > 6) {
      const step = Math.ceil(ticks.length / 5);
      return ticks.filter((_, i) => i % step === 0);
    }
  } else {
    const desiredTicks = 5;
    if (data.length <= desiredTicks) {
      return data.map((p) => p[key] as string);
    }
    const step = Math.floor(data.length / desiredTicks);
    for (let i = 0; i < data.length; i += step) {
      ticks.push(data[i][key] as string);
    }
    const lastDate = data[data.length - 1][key] as string;
    if (ticks[ticks.length - 1] !== lastDate) {
      ticks.push(lastDate);
    }
  }

  return ticks.length > 0 ? ticks : undefined;
}