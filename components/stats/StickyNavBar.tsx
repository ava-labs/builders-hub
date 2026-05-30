"use client";

import { cn } from "@/lib/utils";

interface StickyNavBarProps {
  categories: Array<{ id: string; label: string }>;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function StickyNavBar({
  categories,
  activeSection,
  onNavigate,
  className,
  children,
}: StickyNavBarProps) {
  return (
    <div
      className={cn(
        "sticky top-14 z-30 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800",
        className
      )}
    >
      <div className="w-full">
        <div className="flex items-center justify-between py-3 px-4 sm:px-6 max-w-7xl mx-auto">
          {/* Navigation buttons - scrollable */}
          <div
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto"
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
                className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                  activeSection === category.id
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Right slot for additional content */}
          {children && (
            <div className="flex-shrink-0 ml-4 pl-4 border-l border-zinc-200 dark:border-zinc-700">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
