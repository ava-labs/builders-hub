"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type QuoteView = "rows" | "table" | "cards";
const VIEWS: { value: QuoteView; label: string }[] = [
  { value: "rows", label: "Rows" },
  { value: "table", label: "Table" },
  { value: "cards", label: "Cards" },
];

/**
 * Per-user quote-view preference in localStorage (decision: no schema change
 * for a display preference). Cards are forced below 900px; the stored
 * preference is kept for wider screens.
 */
export function useQuoteViewPreference(userId: string): {
  view: QuoteView;
  setView: (view: QuoteView) => void;
  forcedCards: boolean;
} {
  const [view, setViewState] = useState<QuoteView>("rows");
  const [forcedCards, setForcedCards] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(`audits:view:${userId}`);
    if (stored === "rows" || stored === "table" || stored === "cards") setViewState(stored);

    const media = window.matchMedia("(max-width: 899px)");
    const update = () => setForcedCards(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [userId]);

  const setView = (next: QuoteView) => {
    setViewState(next);
    window.localStorage.setItem(`audits:view:${userId}`, next);
  };

  return { view: forcedCards ? "cards" : view, setView, forcedCards };
}

interface ViewSwitcherProps {
  value: QuoteView;
  onChange: (view: QuoteView) => void;
  disabled?: boolean;
  className?: string;
}

export function ViewSwitcher({ value, onChange, disabled, className }: ViewSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Quote view"
      className={cn(
        "inline-flex items-center rounded-lg border border-zinc-300 p-0.5 dark:border-white/15",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {VIEWS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
