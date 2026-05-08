"use client";
import type { SectionDefinition } from "./types";

interface ICMStickyNavProps {
  sections: readonly SectionDefinition[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

export function ICMStickyNav({
  sections,
  activeSection,
  onSectionClick,
}: ICMStickyNavProps) {
  return (
    <div className="sticky top-14 z-30 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
      <div className="w-full">
        <div
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                activeSection === section.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
