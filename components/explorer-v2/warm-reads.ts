import { evmApiPath } from "@/lib/evm-explorer";
import { pchainApiPath } from "@/lib/pchain-explorer";
import { resolveCatalogChain } from "@/lib/explorer-catalog";
import { readJson, recall } from "./page-data";
import { RANGE_DAYS, currentExplorerRange, type ExplorerRange } from "./time-range";
import {
  BURN_HISTORY_URL,
  DAPPS_URL,
  FEES_URL,
  ICM_FEES_URL,
  STAKE_HISTORY_URL,
  SUPPLY_URL,
  boardReads,
  networkSeriesUrl,
  overviewStatsUrl,
  overviewWindow,
  priceHistoryUrl,
  type RosterRow,
} from "./network/network-reads";

/* The first reads of the explorer's pages, by the page's path. A link the
   pointer rests on has its page's reads fetched into memory (page-data.ts),
   so the page opens on them. Each URL is the one its page asks for first
   and must stay in step with that page: a URL that drifts only costs a
   wasted read, the page still loads. A path not listed here warms its
   route alone. */

const EVM_PAGES: Record<string, (id: string, arg: string | undefined) => string[]> = {
  // EvmHome: a board of ten and the row under its clip (LiveBoards ROWS + 1)
  "": (id) => [evmApiPath(id, "stats"), evmApiPath(id, "txs", { limit: 11 }), evmApiPath(id, "blocks", { limit: 20 }), priceOf(id)],
  txs: (id) => [evmApiPath(id, "txs", { limit: 25 })],
  blocks: (id) => [evmApiPath(id, "blocks", { limit: 25 })],
  tx: (id, hash) => (hash ? [evmApiPath(id, `tx/${hash}`), priceOf(id)] : []),
  block: (id, n) => (n ? [evmApiPath(id, `block/${n}`), priceOf(id)] : []),
  address: (id, a) =>
    a ? [evmApiPath(id, `address/${a}`), evmApiPath(id, `address/${a}/txs`, { limit: 50 }), evmApiPath(id, `address/${a}/transfers`, { limit: 50 }), priceOf(id)] : [],
};

const PCHAIN_PAGES: Record<string, (network: string, arg: string | undefined) => string[]> = {
  "": (n) => [pchainApiPath(n, "stats"), pchainApiPath(n, "txs", { limit: 8 }), pchainApiPath(n, "blocks", { limit: 20 })],
  txs: (n) => [pchainApiPath(n, "txs", { limit: 50 })],
  tx: (n, id) => (id ? [pchainApiPath(n, `tx/${id}`)] : []),
  block: (n, id) => (id ? [pchainApiPath(n, `block/${id}`)] : []),
  address: (n, a) => (a ? [pchainApiPath(n, `address/${a}`), pchainApiPath(n, `address/${a}/txs`, { limit: 50 })] : []),
};

const XCHAIN_PAGES: Record<string, (network: string) => string[]> = {
  "": (n) => [`/api/xchain/${n}/stats`, `/api/xchain/${n}/txs?limit=8`, `/api/xchain/${n}/blocks?limit=20`],
  txs: (n) => [`/api/xchain/${n}/txs?limit=50`],
  blocks: (n) => [`/api/xchain/${n}/blocks?limit=50`],
};

/* the network scope, mainnet only: its pages read on the page clock */
const NETWORK_PAGES: Record<string, (range: ExplorerRange) => string[]> = {
  // NetworkOverview: the figures and their pasts; the boards follow (warmReads)
  "": (r) => [overviewStatsUrl(r), SUPPLY_URL, DAPPS_URL, networkSeriesUrl(RANGE_DAYS[overviewWindow(r)]), STAKE_HISTORY_URL, BURN_HISTORY_URL],
  // NetworkToken: the figures, the supply model, the fee history and the price trace
  token: (r) => [SUPPLY_URL, FEES_URL, ICM_FEES_URL, priceHistoryUrl(RANGE_DAYS[r]), STAKE_HISTORY_URL, BURN_HISTORY_URL],
};

function priceOf(chainId: string): string {
  return `/api/explorer/${chainId}?priceOnly=true`;
}

/** the reads an explorer page opens with, from its path; none for a page
 *  not listed. The network scope's pages read on `range`, by default the
 *  page clock's. */
export function readsOf(href: string, range?: ExplorerRange): string[] {
  const [path] = href.split(/[?#]/);
  const [, root, network, chain = "", page = "", arg] = path.split("/");
  if (root !== "explorer" || !network) return [];
  if (network === "mainnet" && !page && Object.hasOwn(NETWORK_PAGES, chain)) return NETWORK_PAGES[chain](range ?? currentExplorerRange());
  if (!chain) return [];
  const own = <F>(table: Record<string, F>) => (Object.hasOwn(table, page) ? table[page] : undefined);
  if (chain === "p-chain") return own(PCHAIN_PAGES)?.(network, arg) ?? [];
  if (chain === "x-chain") return own(XCHAIN_PAGES)?.(network) ?? [];
  const reads = own(EVM_PAGES);
  const id = reads ? resolveCatalogChain(network, chain)?.chainId : undefined;
  return reads && id ? reads(String(id), arg) : [];
}

/** fetch the page's first reads into memory ahead of its click. They go
 *  at low priority: where the browser queues requests (HTTP/1.1, six to a
 *  host), the click's own requests for the route and its scripts go first. */
export function warmReads(href: string): void {
  const range = currentExplorerRange();
  const reads = readsOf(href, range);
  for (const url of reads) void readJson(url, "low");
  // the overview's boards read the chains its figures name: the page
  // takes its roster from the figures in memory when it holds them
  const stats = overviewStatsUrl(range);
  if (!reads.includes(stats)) return;
  const known = recall<{ chains?: RosterRow[] }>(stats, false)?.data;
  void (known ? Promise.resolve(known) : readJson<{ chains?: RosterRow[] }>(stats)).then((d) => {
    for (const url of boardReads(d?.chains ?? [])) void readJson(url, "low");
  });
}
