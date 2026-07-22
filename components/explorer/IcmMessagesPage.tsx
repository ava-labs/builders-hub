"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";
import {
  LiveTag,
  formatTimeAgo,
  getChainFromBlockchainId,
} from "@/components/explorer/L1ExplorerPage";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { ChainChip } from "@/components/stats/ChainChip";
import { buildTxUrl } from "@/utils/eip3091";
import { formatTokenValue } from "@/utils/formatTokenValue";

/* The chain's ICM tab: every cross-chain message the explorer can see in
   the recent block window, full width — the overview board's third column
   grown into its own surface. */

interface IcmTx {
  hash: string;
  value: string;
  timestamp: string;
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

const POLL_MS = 15_000;

export function IcmMessagesPage({
  chainId,
  chainSlug,
  tokenSymbol,
}: {
  chainId: string;
  chainSlug: string;
  tokenSymbol?: string;
}) {
  const router = useRouter();
  const network = useExplorerNetwork();
  const { buildApiUrl } = useExplorer();
  const [messages, setMessages] = useState<IcmTx[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(buildApiUrl(`/api/explorer/${chainId}`, { initialLoad: "true" }));
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMessages(data.icmMessages ?? []);
      } catch {
        /* stale list stands */
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, buildApiUrl]);

  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
      <section className="flex flex-col gap-4">
        <SectionHeader label="ICM Messages" action={<LiveTag />} />

        {messages === null && (
          <Board>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="h-3 w-48 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-3 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              </div>
            ))}
          </Board>
        )}

        {messages !== null && messages.length === 0 && (
          <Board divide={false} className="px-6 py-14 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
              No ICM messages in the recent block window
            </p>
          </Board>
        )}

        {messages !== null && messages.length > 0 && (
          <Board>
            {messages.map((tx, index) => {
              const sourceChain = tx.sourceBlockchainId
                ? getChainFromBlockchainId(tx.sourceBlockchainId)
                : null;
              const destChain = tx.destinationBlockchainId
                ? getChainFromBlockchainId(tx.destinationBlockchainId)
                : null;
              return (
                <div
                  key={`${tx.hash}-${index}`}
                  onClick={() => router.push(buildTxUrl(`/explorer/${network}/${chainSlug}`, tx.hash))}
                  className="cursor-pointer px-5 py-3.5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                      {tx.hash.slice(0, 22)}…
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTokenValue(tx.value)} {tokenSymbol ?? ""}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {sourceChain ? (
                        <ChainChip
                          chain={sourceChain}
                          size="xs"
                          onClick={() => router.push(`/explorer/${network}/${sourceChain.chainSlug}`)}
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-zinc-400">unknown</span>
                      )}
                      <span className="text-zinc-400">→</span>
                      {destChain ? (
                        <ChainChip
                          chain={destChain}
                          size="xs"
                          onClick={() => router.push(`/explorer/${network}/${destChain.chainSlug}`)}
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-zinc-400">unknown</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {formatTimeAgo(tx.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </Board>
        )}

        <Link
          href="/stats/icm"
          className="group inline-flex items-center gap-1.5 self-end font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          Network-wide ICM observatory
          <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
        </Link>
      </section>
    </div>
  );
}
