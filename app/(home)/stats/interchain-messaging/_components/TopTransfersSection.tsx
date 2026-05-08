"use client";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import { ICTTTransfersTable } from "@/components/stats/ICTTDashboard";
import type { ICTTStats } from "./types";

interface TopTransfersSectionProps {
  data: ICTTStats | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function TopTransfersSection({
  data,
  loadingMore,
  onLoadMore,
}: TopTransfersSectionProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <LinkableHeading
          as="h2"
          id="transfers"
          className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white"
        >
          Top Transfers
        </LinkableHeading>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Recent ICTT transfer activity details
        </p>
      </div>

      <ICTTTransfersTable
        data={data}
        onLoadMore={onLoadMore}
        loadingMore={loadingMore}
      />
    </section>
  );
}
