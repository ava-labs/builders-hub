// EVM chain explorer config + types + client helpers.
//
// The EVM explorer API is served by our stats API. It is reached server-side via the proxy route
// (app/api/evm/[chainId]/[...path]/route.ts), which sidesteps CORS and keeps the
// upstream host out of the browser. Client code fetches the same-origin
// `/api/evm/{chainId}/...` paths via `evmApiPath()`.
//
// URL scheme (shared with P-chain, chain-family agnostic):
//   /explorer/{network}/{chain}/{resource}
//   network  = mainnet | fuji
//   chain    = an L1/C-Chain slug (resolved to a numeric chainId by the layout)
//   resource = "" (home) | blocks | block/{id} | txs | tx/{hash}
//              | address/{addr} | address/{addr}/txs | address/{addr}/transfers

export const EVM_API_BASE =
  process.env.EXPLORER_API_URL || "https://stats-api.avax.network";

// --- client fetch helper (same-origin proxy) ------------------------------

/** Builds the same-origin proxy path for an EVM explorer API call. */
export function evmApiPath(
  chainId: number | string,
  resource: string,
  query?: Record<string, string | number | undefined>,
): string {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const base = `/api/evm/${chainId}/${resource.replace(/^\//, "")}`;
  return qs ? `${base}?${qs}` : base;
}

/* Unambiguous EVM query shapes route with no API round-trip: block heights are
   digits, addresses are 0x + 40 hex, tx hashes are 0x + 64 hex. */
export function classifyEvmLocally(
  q: string,
): { type: "block" | "address" | "tx"; id: string } | null {
  const s = q.trim();
  if (/^\d+$/.test(s)) return { type: "block", id: s };
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return { type: "address", id: s.toLowerCase() };
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return { type: "tx", id: s.toLowerCase() };
  return null;
}

// --- response types (mirror stats-api/evmexplorer/handlers.go) ------------

export interface StatsResponse {
  tipHeight: number;
  tipTimestamp: number; // unix seconds
  txCount24h: number;
  gasPriceWei: string;
}

export interface TxSummary {
  hash: string;
  blockNumber: number;
  txIndex: number;
  from: string;
  to: string; // "" for contract-creation
  value: string; // wei, decimal string
  gasUsed: number;
  success: boolean;
  timestamp: number; // unix seconds
  /** 4-byte calldata selector; absent/"" for plain value transfers */
  methodId?: string;
}

export interface TxListResponse {
  transactions: TxSummary[];
  nextBefore?: number; // block number cursor for "load more"
}

export interface BlockSummary {
  number: number;
  hash: string;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  miner: string;
  timestamp: number;
}

export interface BlockListResponse {
  blocks: BlockSummary[];
  nextBefore?: number;
}

export interface BlockDetail {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: number;
  gasLimit: number;
  baseFeePerGas: string;
  txCount: number;
  transactions: TxSummary[];
}

export interface EventLog {
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
}

export interface InternalTx {
  from: string;
  to: string;
  value: string;
  callType: string;
  gasUsed: number;
}

export interface TxDetail {
  hash: string;
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  txIndex: number;
  from: string;
  to: string;
  value: string;
  nonce: number;
  gasLimit: number;
  gasUsed: number;
  gasPrice: string;
  success: boolean;
  type: number;
  input: string;
  contractAddress?: string;
  logs: EventLog[];
  internalTxns: InternalTx[];
}

export type TransferStandard = "ERC20" | "ERC721" | "ERC1155";

export interface Transfer {
  standard: TransferStandard | string;
  token: string; // contract address
  from: string;
  to: string;
  amount: string; // ERC20/1155 value
  tokenId: string; // ERC721/1155 token id
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface TransferListResponse {
  transfers: Transfer[];
  nextBefore?: number;
}

export interface AddressSummary {
  address: string;
  txCount: number;
  firstSeen?: number;
  lastSeen?: number;
}

export interface SearchResult {
  type: "block" | "tx" | "address" | "none";
  id: string;
}

export interface ChainEntry {
  chainId: number;
  chainName: string;
  network: string;
  txCount: number;
}
