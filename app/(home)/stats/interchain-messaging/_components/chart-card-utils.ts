import type { ChartDataPoint, ChartPeriod } from "./types";

// Buckets daily data points into the requested period (week / month / quarter
// / year). Daily passes through unchanged. Bucket keys are the start-of-period
// in ISO-ish form so they sort lexicographically.
export function aggregateByPeriod(
  rawData: ChartDataPoint[],
  period: ChartPeriod
): ChartDataPoint[] {
  if (period === "D") return rawData;

  const grouped = new Map<
    string,
    {
      sum: number;
      count: number;
      date: string;
      chainBreakdown: Record<string, number>;
    }
  >();

  rawData.forEach((point) => {
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
      grouped.set(key, { sum: 0, count: 0, date: key, chainBreakdown: {} });
    }

    const group = grouped.get(key)!;
    group.sum += point.value;
    group.count += 1;

    if (point.chainBreakdown) {
      Object.entries(point.chainBreakdown).forEach(([chain, count]) => {
        group.chainBreakdown[chain] =
          (group.chainBreakdown[chain] || 0) + (count as number);
      });
    }
  });

  return Array.from(grouped.values())
    .map((group) => ({
      day: group.date,
      value: group.sum,
      chainBreakdown: group.chainBreakdown,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

// Renders a tooltip-friendly date label that varies by aggregation period
// (e.g. "Q1 2025", "January 2025", "Jan 6-12, 2025", "2025").
export function formatTooltipDate(value: string, period: ChartPeriod): string {
  if (period === "Y") return value;

  if (period === "Q") {
    const parts = value.split("-");
    if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
    return value;
  }

  const date = new Date(value);

  if (period === "M") {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  if (period === "W") {
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);
    const startMonth = date.toLocaleDateString("en-US", { month: "long" });
    const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
    const startDay = date.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const PERIOD_LABEL: Record<ChartPeriod, string> = {
  D: "Daily",
  W: "Weekly",
  M: "Monthly",
  Q: "Quarterly",
  Y: "Yearly",
};

export function periodLabel(period: ChartPeriod): string {
  return PERIOD_LABEL[period];
}
