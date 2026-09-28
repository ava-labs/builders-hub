/* What a question is asked of. The EVM chains share four raw tables; the
   P-Chain has its own decoded, UTXO and snapshot tables. Every table keys
   its rows by chain_id, and the P-Chain's are 1 (mainnet) and 5 (Fuji),
   which no EVM chain in the catalog uses, so the id alone names the
   target. */

import l1ChainsData from "@/constants/l1-chains.json";

export type TargetKind = "evm" | "pchain";

export const EVM_TABLES = ["raw_blocks", "raw_txs", "raw_logs", "raw_traces"] as const;

export const PCHAIN_TABLES = [
  "decoded_p_txs",
  "raw_p_blocks",
  "p_utxos_created",
  "p_utxos_spent",
  "raw_p_reward_utxos",
  "p_validator_snapshots",
  "p_delegator_snapshots",
  "p_l1_validator_snapshots",
  "p_validator_observations",
  "p_node_info",
  "p_exec_state_history",
] as const;

/** P-Chain table chain_id per network */
export const PCHAIN_IDS: Record<string, number> = { mainnet: 1, fuji: 5 };

/** the C-Chain on mainnet and Fuji; every other EVM id is an L1 */
export const CCHAIN_IDS = [43114, 43113];

export function isCChain(chainId: number | string): boolean {
  return CCHAIN_IDS.includes(Number(chainId));
}

export interface Target {
  kind: TargetKind;
  /** the chain_id the tables carry */
  chainId: number;
  tables: readonly string[];
  /** a read of these tables must carry a time or height bound */
  wide: readonly string[];
  /** the column families a bound may use */
  bound: RegExp;
  /** bech32 prefix for P-Chain addresses */
  hrp?: string;
}

export function targetOf(chainId: number): Target {
  if (chainId === PCHAIN_IDS.mainnet || chainId === PCHAIN_IDS.fuji) {
    return {
      kind: "pchain",
      chainId,
      tables: PCHAIN_TABLES,
      // the snapshot and UTXO tables run to hundreds of millions of rows
      wide: PCHAIN_TABLES.filter((t) => t !== "p_exec_state_history" && t !== "p_node_info"),
      bound: /\b(block_time|block_height|snapshot_time|created_time|spent_time|created_height|spent_height|observed_at)\s*(>=|>|<=|<|=|==|BETWEEN|IN)/i,
      hrp: chainId === PCHAIN_IDS.fuji ? "fuji" : "avax",
    };
  }
  return {
    kind: "evm",
    chainId,
    tables: EVM_TABLES,
    wide: ["raw_txs", "raw_logs", "raw_traces"],
    bound: /\b(block_time|block_number)\s*(>=|>|<=|<|=|==|BETWEEN|IN)/i,
  };
}

/** the chains the Query page can ask, and the chain_id their rows carry.
    Any EVM chain in the catalog can be asked; whether its rows are
    indexed is read at run time, and the page says so when they are not. */
export function queryTarget(network: string, chainSlug: string | undefined): { chainId: number; kind: "evm" | "pchain" } | null {
  if (chainSlug === "p-chain" && (network === "mainnet" || network === "fuji")) return { chainId: network === "fuji" ? 5 : 1, kind: "pchain" };
  if (!chainSlug) return null;
  const testnet = network === "fuji" || network === "testnet";
  if (chainSlug === "c-chain") return { chainId: testnet ? 43113 : 43114, kind: "evm" };
  const chains = (l1ChainsData as { slug: string; chainId: string; isTestnet?: boolean }[]).filter((c) => c.slug === chainSlug);
  const chain = chains.find((c) => (c.isTestnet === true) === testnet) ?? chains[0];
  const id = Number(chain?.chainId);
  // an id the P-Chain's tables use would read the wrong rows
  if (!chain || !/^\d+$/.test(chain.chainId) || id === PCHAIN_IDS.mainnet || id === PCHAIN_IDS.fuji) return null;
  return { chainId: id, kind: "evm" };
}
