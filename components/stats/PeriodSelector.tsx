"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export type Period = "D" | "W" | "M" | "Q" | "Y";

const PERIOD_LABELS: Record<Period, string> = {
  D: "Daily",
  W: "Weekly",
  M: "Monthly",
  Q: "Quarterly",
  Y: "Yearly",
};

interface PeriodSelectorProps {
  periods?: Period[];
  selected: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({
  periods = ["D", "W", "M", "Q", "Y"],
  selected,
  onChange,
}: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-1">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => onChange(period)}
            className={`relative px-3 py-1 text-sm font-medium cursor-pointer transition-colors ${
              selected === period
                ? "text-zinc-900 dark:text-white"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
            }`}
          >
            {PERIOD_LABELS[period]}
            {selected === period && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Mobile - Dropdown */}
      <div className="flex sm:hidden items-center relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-white cursor-pointer transition-colors"
        >
          <span className="relative">
            {PERIOD_LABELS[selected]}
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full" />
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 min-w-[80px] z-50">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => {
                  onChange(period);
                  setIsOpen(false);
                }}
                className={`relative w-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors text-center ${
                  selected === period
                    ? "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {PERIOD_LABELS[period]}
                {selected === period && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
