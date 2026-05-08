"use client";
import { Button } from "@/components/ui/button";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import ICMFlowChart from "@/components/stats/ICMFlowChart";
import l1ChainsData from "@/constants/l1-chains.json";
import { TopChainCard } from "./TopChainCard";
import type { ICMFlowResponse, TopChainSummary, TopPeer } from "./types";

interface TopChainsSectionProps {
  topChains: TopChainSummary[];
  totalICMMessages: number;
  filteredIcmFlowData: ICMFlowResponse | null;
  flowLoading: boolean;
  flowError: string | null;
  onRetryFlow: () => void;
  getTopPeers: (chainName: string) => TopPeer[];
}

export function TopChainsSection({
  topChains,
  totalICMMessages,
  filteredIcmFlowData,
  flowLoading,
  flowError,
  onRetryFlow,
  getTopPeers,
}: TopChainsSectionProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <LinkableHeading
          as="h2"
          id="top-chains"
          className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white"
        >
          Top Chains by ICM Activity
        </LinkableHeading>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Leading L1s by message volume over the past 365 days
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl overflow-hidden h-[500px]">
          {flowLoading ? (
            <div className="h-full w-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-xl">
              <div className="animate-pulse text-zinc-500">
                Loading ICM flows...
              </div>
            </div>
          ) : flowError ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-900/40 p-6 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">
                Couldn't load ICM flow data: {flowError}
              </p>
              <Button variant="outline" size="sm" onClick={onRetryFlow}>
                Retry
              </Button>
            </div>
          ) : (
            <ICMFlowChart
              data={filteredIcmFlowData}
              height={520}
              maxFlows={30}
            />
          )}
        </div>

        <div
          className="flex flex-col gap-4 h-[520px] overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {topChains.map((chain, index) => {
            const chainData = l1ChainsData.find(
              (c) => c.chainName === chain.chainName
            );
            const slug = chainData?.slug || null;
            const category = chainData?.category || "General";
            const percentage =
              totalICMMessages > 0
                ? ((chain.count / totalICMMessages) * 100).toFixed(1)
                : "0";
            const topPeers = getTopPeers(chain.chainName);

            return (
              <TopChainCard
                key={chain.chainName}
                chain={chain}
                rank={index}
                slug={slug}
                category={category}
                percentage={percentage}
                topPeers={topPeers}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
