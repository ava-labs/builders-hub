"use client";
import { MessageCircleMore } from "lucide-react";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import { ChartCard } from "./ChartCard";
import { formatNumber } from "./helpers";
import type {
  ChartConfig,
  ChartDataPoint,
  ChartPeriod,
  ICMStats,
} from "./types";

const ICM_CHART_CONFIG: ChartConfig = {
  title: "ICM Count",
  icon: MessageCircleMore,
  metricKey: "dailyMessageVolume",
  description: "Total Interchain Messaging volume",
  color: "#E84142",
  chartType: "bar",
};

interface ICMOverviewSectionProps {
  metrics: ICMStats | null;
  chartData: ChartDataPoint[];
  chartPeriod: ChartPeriod;
  onChartPeriodChange: (period: ChartPeriod) => void;
}

export function ICMOverviewSection({
  metrics,
  chartData,
  chartPeriod,
  onChartPeriodChange,
}: ICMOverviewSectionProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <LinkableHeading
          as="h2"
          id="overview"
          className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white"
        >
          ICM Overview
        </LinkableHeading>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Historical messaging trends across the network
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {chartData.length > 0 && (
          <ChartCard
            config={ICM_CHART_CONFIG}
            rawData={chartData}
            period={chartPeriod}
            currentValue={metrics?.dailyMessageVolume?.current_value || 0}
            onPeriodChange={onChartPeriodChange}
            formatTooltipValue={(value) => formatNumber(Math.round(value))}
            formatYAxisValue={formatNumber}
          />
        )}
      </div>
    </section>
  );
}
