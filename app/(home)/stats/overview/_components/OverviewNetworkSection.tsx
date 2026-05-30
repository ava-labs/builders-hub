"use client";
import NetworkDiagram, {
  type ChainCosmosData,
  type ICMFlowRoute,
} from "@/components/stats/NetworkDiagram";

interface OverviewNetworkSectionProps {
  cosmosData: ChainCosmosData[];
  icmFlows: ICMFlowRoute[];
  failedChainIds: string[];
}

export function OverviewNetworkSection({
  cosmosData,
  icmFlows,
  failedChainIds,
}: OverviewNetworkSectionProps) {
  return (
    <div className="bg-zinc-900 dark:bg-black">
      <div className="h-[400px] sm:h-[500px] md:h-[560px]">
        {cosmosData.length > 0 ? (
          <NetworkDiagram
            data={cosmosData}
            icmFlows={icmFlows}
            failedChainIds={failedChainIds}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs sm:text-sm">
            No network data
          </div>
        )}
      </div>
    </div>
  );
}
