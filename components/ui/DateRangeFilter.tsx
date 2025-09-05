"use client";
import { useState, useEffect } from "react";

interface DateRangeFilterProps {
  onRangeChange?: (range: string) => void;
  defaultRange?: string;
}

export default function DateRangeFilter({
  onRangeChange,
  defaultRange = "30d",
}: DateRangeFilterProps) {
  const [activeRange, setActiveRange] = useState(defaultRange);

  useEffect(() => {
    setActiveRange(defaultRange);
  }, [defaultRange]);

  const ranges = [
    { label: "7d", value: "7d" },
    { label: "30d", value: "30d" },
    { label: "90d", value: "90d" },
    { label: "ALL", value: "all" },
  ];

  const handleRangeClick = (range: string) => {
    setActiveRange(range);
    onRangeChange?.(range);
  };

  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => handleRangeClick(range.value)}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
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
