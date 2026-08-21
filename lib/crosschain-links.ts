// Cross-chain tx link resolution. The explorer APIs now return lineage on
// exported/imported UTXOs (claimedBy / origin / consumingTxHash +
// consumedOnChainId). A claim's tx lives on ANOTHER chain, so its link must
// route to that chain's tx page — C-chain cross-chain txs are atomic txs
// (CB58 ids, not 0x hashes) with their own detail route.

const C_CHAIN_IDS = new Set([
  "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5", // mainnet
  "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp", // fuji
  "2CpuZMeuT19nECGuqUo1oZveNFvsjXV7xbVapiaaqSPnTKuWzH", // devnet
]);
const X_CHAIN_IDS = new Set([
  "2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM", // mainnet
  "2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm", // fuji
]);
const P_CHAIN_ID = "11111111111111111111111111111111LpoYY";

export type CrossChain = "P-Chain" | "X-Chain" | "C-Chain";

export function chainOfId(cb58OrName?: string): CrossChain | undefined {
  if (!cb58OrName) return undefined;
  if (cb58OrName === "P-Chain" || cb58OrName === P_CHAIN_ID) return "P-Chain";
  if (cb58OrName === "X-Chain" || X_CHAIN_IDS.has(cb58OrName)) return "X-Chain";
  if (cb58OrName === "C-Chain" || C_CHAIN_IDS.has(cb58OrName)) return "C-Chain";
  return undefined;
}

/** URL of a tx page on any chain. `chain` may be a display name ("C-Chain",
 *  as the lineage APIs return) or a blockchain id (as consumedOnChainId is). */
export function crossChainTxUrl(network: string, chain: string | undefined, txHash: string): string | undefined {
  switch (chainOfId(chain)) {
    case "P-Chain":
      return `/explorer/${network}/p-chain/tx/${txHash}`;
    case "X-Chain":
      return `/explorer/${network}/x-chain/tx/${txHash}`;
    case "C-Chain":
      return `/explorer/${network}/c-chain/atomic-tx/${txHash}`;
  }
  return undefined;
}

/** URL of an address page on any chain (C addresses are 0x, P/X bech32). */
export function crossChainAddressUrl(network: string, chain: string | undefined, addr: string): string | undefined {
  switch (chainOfId(chain)) {
    case "P-Chain":
      return `/explorer/${network}/p-chain/address/${addr}`;
    case "X-Chain":
      return `/explorer/${network}/x-chain/address/${addr}`;
    case "C-Chain":
      return `/explorer/${network}/c-chain/address/${addr}`;
  }
  return undefined;
}
