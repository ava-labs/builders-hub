"use client";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";

// Full-page skeleton shown while initial overview data is loading.
export function OverviewPageSkeleton() {
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
          <div className="h-[300px] sm:h-[400px] md:h-[500px] bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
      <StatsBubbleNav />
    </div>
  );
}

// Inline skeleton rows for the chains/validators table while a refetch is in flight.
// Renders 8 placeholder rows with 8 column cells each.
export function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-center gap-1">
              <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
              <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
              <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
