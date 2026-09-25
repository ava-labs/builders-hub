/* What a question is asked of. The EVM chains share four raw tables; the
   P-Chain has its own decoded, UTXO and snapshot tables. Every table keys
   its rows by chain_id, and the P-Chain's are 1 (mainnet) and 5 (Fuji),
   which no EVM chain in the catalog uses, so the id alone names the
   target. */

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
