"use client";
import { useState, useEffect } from "react";

interface DateRangeFilterProps {
  onRangeChange?: (range: string) => void;
  defaultRange?: string;
  compact?: boolean;
}

export default function DateRangeFilter({
  onRangeChange,
  defaultRange = "1y",
  compact = false,
}: DateRangeFilterProps) {
  const [activeRange, setActiveRange] = useState(defaultRange);

  useEffect(() => {
    setActiveRange(defaultRange);
  }, [defaultRange]);

  const ranges = [
    { label: "30d", value: "30d" },
    { label: "90d", value: "90d" },
    { label: "1y", value: "1y" },
    { label: "ALL", value: "all" },
  ];

  const handleRangeClick = (range: string) => {
    setActiveRange(range);
    onRangeChange?.(range);
  };

  return (
    <div
      className={`flex items-center ${compact ? "gap-0.5 sm:gap-1" : "gap-1 sm:gap-2"} ${compact ? "p-0.5 sm:p-1" : "p-1"} bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-fit max-w-full overflow-x-auto`}
    >
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => handleRangeClick(range.value)}
          className={`
            ${compact ? "px-1.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm" : "px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"} rounded-md font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0
            ${
              activeRange === range.value
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-600"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            }
          `}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
