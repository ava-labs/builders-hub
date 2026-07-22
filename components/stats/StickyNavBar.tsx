"use client";

import { cn } from "@/lib/utils";

interface StickyNavBarProps {
  categories: Array<{ id: string; label: string }>;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  className?: string;
  children?: React.ReactNode;
  /** false when the bar already sits inside a padded sheet column —
   *  full-width pages keep the default contained row */
  inset?: boolean;
}

/* The section rail, in the explorer subnav's grammar: quiet mono tabs on a
   hairline, the active one carried by a red underline — not a band of
   bordered chips. Sticks under the navbar so long chart pages stay
   navigable without adding visual weight. */
export function StickyNavBar({
  categories,
  activeSection,
  onNavigate,
  className,
  children,
  inset = true,
}: StickyNavBarProps) {
  return (
    <div
      className={cn(
        "sticky top-14 z-30 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95",
        className
      )}
    >
      <div
        className={cn(
          "flex items-stretch justify-between gap-x-6",
          inset && "mx-auto w-full max-w-[90rem] px-5 md:px-6"
        )}
      >
        {/* Navigation tabs - scrollable */}
        <div
          className="scrollbar-hide flex items-stretch gap-x-5 overflow-x-auto md:gap-x-6"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onNavigate(category.id)}
              className={`relative flex shrink-0 items-center py-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] whitespace-nowrap transition-colors ${
                activeSection === category.id
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              }`}
            >
              {category.label}
              {activeSection === category.id && (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E6212F]" />
              )}
            </button>
          ))}
        </div>

        {/* Right slot for additional content */}
        {children && <div className="flex shrink-0 items-center pl-4">{children}</div>}
      </div>
    </div>
  );
}
