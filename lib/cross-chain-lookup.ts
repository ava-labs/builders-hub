import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* Races every chain's RPC for a transaction hash and reports whichever chain
   claims it. Used by the explorer portal and the all-chains directory: paste
   any 0x hash, land on the right chain's tx page. */
export async function lookupTransactionAcrossChains(
  txHash: string,
): Promise<{ found: boolean; chain?: L1Chain }> {
  const chainsWithRpc = (l1ChainsData as L1Chain[]).filter((chain) => chain.rpcUrl);

  const lookupPromises = chainsWithRpc.map(async (chain) => {
    try {
      const response = await fetch(chain.rpcUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout per chain
      });

      const data = await response.json();
      if (data.result && data.result.hash) {
        return { found: true as const, chain };
      }
      return { found: false as const };
    } catch {
      // Chain lookup failed, continue with others
      return { found: false as const };
    }
  });

  const results = await Promise.all(lookupPromises);
  return results.find((r) => r.found) || { found: false };
}
