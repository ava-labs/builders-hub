"use client";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";

// Page-level skeleton shown while the initial /api/dapps fetch is in flight.
export function DappsLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <div className="animate-pulse space-y-8 sm:space-y-12">
          <div className="space-y-4">
            <div className="h-8 sm:h-12 w-48 sm:w-96 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 sm:h-6 w-32 sm:w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 sm:h-4 w-16 sm:w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-8 sm:h-10 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
          <div className="h-[300px] sm:h-[400px] bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
      <StatsBubbleNav />
    </div>
  );
}
