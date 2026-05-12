import { L1BubbleNav } from "@/components/stats/l1-bubble.config";

export default function AvaxTokenSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
      <div className="container mx-auto px-6 pt-6 pb-24 max-w-7xl">
        <div className="mb-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="flex-1">
              <div className="h-10 bg-muted rounded w-64 mb-3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-32 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700"
            >
              <div className="animate-pulse space-y-2 sm:space-y-3">
                <div className="h-4 bg-muted rounded w-24 mx-auto" />
                <div className="h-8 bg-muted rounded w-32 mx-auto" />
                <div className="h-3 bg-muted rounded w-28 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <L1BubbleNav chainSlug="c-chain" rpcUrl="https://api.avax.network/ext/bc/C/rpc" />
    </div>
  );
}
