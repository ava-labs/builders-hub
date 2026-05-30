"use client";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";

// Full-page skeleton shown while the initial ICM stats are loading. Mirrors
// the layout of the loaded view so the page doesn't reflow on hydration.
export function ICMLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background:
              "linear-gradient(to left, rgba(232, 65, 66, 0.2) 0%, rgba(232, 65, 66, 0.12) 40%, rgba(232, 65, 66, 0.04) 70%, transparent 100%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-red-200 dark:bg-red-900/30 rounded animate-pulse" />
                  <div className="h-3 sm:h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="h-8 sm:h-10 md:h-12 w-64 sm:w-80 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
                <div className="h-4 sm:h-5 w-full max-w-2xl bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-14 z-40 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800">
        <div className="w-full">
          <div className="flex items-center gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 sm:h-8 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">
        <section className="space-y-6">
          <div className="space-y-2">
            <div className="h-6 sm:h-8 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    <div>
                      <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-1" />
                      <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div
                        key={j}
                        className="h-7 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 pt-6 pb-6">
                <div className="mb-4 flex items-baseline gap-2">
                  <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="h-[350px] bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                <div className="mt-4 h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <div className="h-6 sm:h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[400px] bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <div className="h-6 sm:h-8 w-56 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-72 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg"
              >
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm mb-2">
                  <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse mb-1" />
                <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </section>
      </div>
      <StatsBubbleNav />
    </div>
  );
}
