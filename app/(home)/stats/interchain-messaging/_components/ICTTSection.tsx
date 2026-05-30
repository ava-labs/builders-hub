"use client";
import { Button } from "@/components/ui/button";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import { ICTTDashboard } from "@/components/stats/ICTTDashboard";
import type { ICTTStats } from "./types";

interface ICTTSectionProps {
  data: ICTTStats | null;
  totalICMMessages: number;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function ICTTSection({
  data,
  totalICMMessages,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
}: ICTTSectionProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <LinkableHeading
          as="h2"
          id="ictt"
          className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white"
        >
          Interchain Token Transfer (ICTT) Analytics
        </LinkableHeading>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Token transfer metrics across Avalanche L1s
        </p>
      </div>

      {error && !data ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-zinc-50 dark:bg-zinc-900 p-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn't load ICTT analytics: {error}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : (
        <ICTTDashboard
          data={data}
          onLoadMore={onLoadMore}
          loadingMore={loadingMore}
          totalICMMessages={totalICMMessages}
          showTitle={false}
        />
      )}
    </section>
  );
}
