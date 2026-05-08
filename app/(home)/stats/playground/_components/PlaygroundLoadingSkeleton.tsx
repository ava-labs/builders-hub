"use client";

// Page-level skeleton shown while the requested playground is being fetched.
// Mirrors the loaded layout (header + controls + first chart card) so the
// page doesn't reflow on hydration.
export function PlaygroundLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
      <div className="container mx-auto px-6 py-10 pb-24 space-y-8">
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="h-10 w-64 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mt-2" />
              <div className="h-3 w-64 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mt-2" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-9 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-9 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-9 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 max-w-sm bg-gray-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-12">
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
              <div className="h-6 w-48 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
              <div className="h-80 bg-gray-100 dark:bg-neutral-900 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
