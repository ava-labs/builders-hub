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

/** tables our server builds and sends with the query (sources.ts); the
    ClickHouse box does not hold them. The Data API counts the AVAX
    supply on mainnet only, so Fuji has no p_avax_supply */
export const PCHAIN_REFS = ["p_validator_versions", "p_avax_supply"] as const;
const FUJI_REFS = PCHAIN_REFS.filter((r) => r !== "p_avax_supply");

/** tables our server builds for the C-Chain's DEXs (protocols.ts): its
    pool factories and token decimals; and for its lending protocols
    (lending.ts): Benqi's markets and the lent tokens' decimals and price
    kinds. Mainnet only, so Fuji has none */
export const CCHAIN_REFS = ["dex_factories", "dex_tokens", "lending_markets", "lending_tokens"] as const;

/** the network: the C-Chain and every mainnet L1 the database indexes, asked as one target. No chain uses id 0, and
    the server reads each table as those chains' rows alone (sources.ts), so a network query reads no Fuji, testnet
    or unlisted chain */
export const NETWORK_ID = 0;
/** the slug the network's Query page and its links name it by; no catalog chain has it */
export const NETWORK_SLUG = "all";
/** the network's reference table, built by our server: each chain's id, name and native token */
export const NETWORK_REFS = ["chain_names"] as const;


/** P-Chain tables that hold rows a re-ingest wrote twice, never merged:
    every read of them goes through FINAL (sources.ts). Counted on
    2026-09-27; the data fix belongs to the box */
export const PCHAIN_FINAL = ["decoded_p_txs", "p_utxos_created", "p_utxos_spent"] as const;

/** P-Chain table chain_id per network */
export const PCHAIN_IDS: Record<string, number> = { mainnet: 1, fuji: 5 };

/** the C-Chain on mainnet and Fuji; every other EVM id is an L1 */
export const CCHAIN_IDS = [43114, 43113];

export function isCChain(chainId: number | string): boolean {
  return CCHAIN_IDS.includes(Number(chainId));
}

/** Fuji's C-Chain and P-Chain, whose Query stays as it was: every fix is for mainnet */
export function isFuji(chainId: number): boolean {
  return chainId === CCHAIN_IDS[1] || chainId === PCHAIN_IDS.fuji;
}

export interface Target {
  kind: TargetKind;
  /** the chain_id the tables carry */
  chainId: number;
  tables: readonly string[];
  /** reference tables: readable like tables, built by our server */
  refs: readonly string[];
  /** tables read through FINAL, for their duplicate rows */
  final: readonly string[];
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
      refs: chainId === PCHAIN_IDS.fuji ? FUJI_REFS : PCHAIN_REFS,
      final: PCHAIN_FINAL,
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
    refs: chainId === 43114 ? CCHAIN_REFS : chainId === NETWORK_ID ? NETWORK_REFS : [],
    final: [],
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
