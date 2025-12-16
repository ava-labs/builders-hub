"use client";

export type Period = "D" | "W" | "M" | "Q" | "Y";

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
            {period}
            {selected === period && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Mobile */}
      <div className="flex sm:hidden items-center gap-1">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => onChange(period)}
            className={`relative px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
              selected === period
                ? "text-zinc-900 dark:text-white"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
            }`}
          >
            {period}
            {selected === period && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
