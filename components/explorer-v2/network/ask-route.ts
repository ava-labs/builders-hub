/* Where a question asked in the city goes, and which of the city's towers
   its answer names. No React here, so the routing rules and the tower
   mapping are pinned by tests (tests/unit/explorer/ask-route.test.ts);
   ask-window.tsx draws the window around them. */

import { FILTER_MARK } from "@/components/explorer-v2/evm/query-client";
import { PCHAIN_LOGO } from "@/components/explorer-v2/network/city-model";
import { askHref } from "@/lib/explorer-query/board-links";
import { toHexBytes } from "@/lib/explorer-query/pchain-ids";
import { queryTarget } from "@/lib/explorer-query/target";
import type { Node } from "@/components/explorer-v2/network/icm-map";
import type { L1Chain } from "@/types/stats";

/** one row of an answer */
type Row = Record<string, unknown>;

/** a chain the window can ask: the chain_id its rows carry, and how the city names it */
export interface AskChain {
  chainId: number;
  slug: string;
  label: string;
  logo: string;
  kind: "evm" | "pchain";
  symbol: string;
  /** an L1's subnet, which a P-Chain question can be about; null for the C-Chain and the P-Chain */
  subnetId: string | null;
}

/** a thread as the URL keeps it: the question, its follow-ups, the chain asked, and the L1 a P-Chain question is for, by slug */
export interface AskThread {
  q: string;
  then: string[];
  on: string;
  for?: string | null;
}

/** every chain the window can ask: the C-Chain, the P-Chain, and each catalog L1 a Query tab exists for */
export function askChainsOf(catalog: L1Chain[]): AskChain[] {
  const main = catalog.filter((c) => c.isTestnet !== true);
  const cchain = main.find((c) => c.slug === "c-chain");
  const l1s = main.flatMap((c) => {
    const t = c.slug !== "c-chain" && c.rpcUrl ? queryTarget("mainnet", c.slug) : null;
    return t ? [{ chainId: t.chainId, slug: c.slug, label: c.chainName, logo: c.chainLogoURI ?? "", kind: "evm" as const, symbol: c.networkToken?.symbol ?? "", subnetId: c.subnetId ?? null }] : [];
  });
  return [
    { chainId: 43114, slug: "c-chain", label: "C-Chain", logo: cchain?.chainLogoURI ?? "", kind: "evm", symbol: "AVAX", subnetId: null },
    { chainId: 1, slug: "p-chain", label: "P-Chain", logo: PCHAIN_LOGO, kind: "pchain", symbol: "AVAX", subnetId: null },
    ...l1s,
  ];
}

/* what the P-Chain holds, as the Query engine routes it: validators,
   staking and delegation, uptime, L1s and subnets, an L1's fee balance,
   AVAX supply. A bare "fees" or "balance" names no P-Chain topic: gas fees
   and token balances are the C-Chain's ("Fees burned per 5 minutes") */
const PCHAIN_WORDS = /\b(validat\w*|stak(e|es|ed|er|ers|ing)|delegat\w*|uptime|l1s?|subnets?|issuance)\b|\bavax supply\b|\bfee balances?\b|\bbalances? (left )?for fees\b|\bcontinuous fees?\b/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* a question about every chain at once: all, every or each chain or L1, across chains, per or by chain, the whole
   network, network-wide, the C-Chain and all L1s, between chains, a ranking of chains, or one that opens with "network". A P-Chain
   topic other than the word L1 wins (validators across all L1s are the P-Chain's), and the Primary Network names no
   network question */
const NETWORK_WORDS =
  /\b(?:all|every|each|across(?: all)?)\s+(?:the\s+)?(?:avalanche\s+)?(?:chains?|l1s?)\b|\b(?:per|by)\s+(?:chain|l1)\b|\b(?:whole|entire)\s+(?:avalanche\s+)?network\b|\bnetwork[- ]wide\b|\bc[- ]?chain\s*(?:and|\+|&)\s*(?:all|every|the)\s+(?:other\s+)?l1s?\b|\b(?:chains|l1s)\s+(?:ranked|by)\b|\bbetween\s+(?:the\s+)?(?:chains|l1s)\b|\b(?:top|busiest|which)\s+(?:\d+\s+)?(?:chains|l1s)\b|^\s*network\b/i;

/** whether a question is about the whole network, the C-Chain and every L1 at once */
export function networkAsked(q: string): boolean {
  return NETWORK_WORDS.test(q) && !PCHAIN_WORDS.test(q.replace(/\bl1s?\b/gi, " ")) && !/\bprimary network\b/i.test(q);
}

/** where a question asked in the city goes: the chain, and the L1 a P-Chain question is for, by slug */
export interface AskRoute {
  on: string;
  for: string | null;
}
const to = (on: string, scope: string | null = null): AskRoute => ({ on, for: scope });

/** the route of a question, in this order: the chain it names; the P-Chain
    for what the P-Chain holds, about the L1 picked in the city when one is;
    the chain picked in the city; the C-Chain. An L1 is named by its name as
    the catalog writes it, so a lowercase "even" or "space" names no chain;
    an L1 named with a P-Chain topic ("Beam validators") is asked of the
    P-Chain, about that L1, since its own tables hold no validators */
export function routeFor(q: string, picked: string | null, chains: AskChain[]): AskRoute {
  const words = ` ${q.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  if (words.includes(" c chain ")) return to("c-chain");
  if (words.includes(" p chain ")) return to("p-chain");
  const staking = PCHAIN_WORDS.test(q);
  let named: AskChain | null = null;
  for (const c of chains) {
    if (c.kind !== "evm" || c.slug === "c-chain" || c.label.length < 3) continue;
    if (new RegExp(`(^|[^A-Za-z0-9])${escapeRe(c.label)}(?![A-Za-z0-9])`).test(q) && (!named || c.label.length > named.label.length)) named = c;
  }
  if (named) return staking && named.subnetId ? to("p-chain", named.slug) : to(named.slug);
  const l1 = chains.find((c) => c.slug === picked && c.subnetId) ?? null;
  if (staking) return to("p-chain", l1?.slug ?? null);
  if (picked && chains.some((c) => c.slug === picked)) return to(picked);
  return to("c-chain");
}

/** the question as the engine reads it: about an L1, it carries that L1's
    subnet after the mark the Query page hides, so the reader sees only
    what they typed. The subnet goes as CB58 and as bytes, since the tables
    hold it as bytes */
export function sentOf(q: string, scope: AskChain | null): string {
  const hex = scope?.subnetId ? toHexBytes(scope.subnetId) : null;
  return scope?.subnetId && hex ? `${q}${FILTER_MARK}subnet_id is ${scope.subnetId}, the bytes unhex('${hex}').)` : q;
}

/** the L1 a thread's P-Chain question is for */
export function scopeOf(t: AskThread, chains: AskChain[]): AskChain | null {
  return t.on === "p-chain" && t.for ? (chains.find((c) => c.slug === t.for && c.subnetId) ?? null) : null;
}

/** a thread on the Query page, as the window asked it */
export function queryHref(t: AskThread, chains: AskChain[]): string {
  return queryHrefOf(t.on, sentOf(t.q, scopeOf(t, chains)), t.then);
}

/** the thread on the Query page, the full tool: the network page for the C-Chain and the P-Chain, an L1's own tab */
function queryHrefOf(on: string, q: string, then: string[]): string {
  if (on !== "c-chain" && on !== "p-chain") return askHref("mainnet", on, q, then);
  const qs = new URLSearchParams({ chain: on, q });
  for (const t of then) qs.append("then", t);
  return `/explorer/mainnet/query?${qs.toString().replace(/\+/g, "%20")}`;
}

/* the city's towers by what an answer's rows call a chain: a subnet ID or
   a blockchain ID, as CB58 or as hex, in any column; an EVM chain ID only
   in a column named for one, since any figure could read as one */
export interface Towers {
  byRef: Map<string, string>;
  evm: Set<string>;
}
const CHAIN_COL = /(^|_)(evm_)?chain(_?id)?$/i;

export function towersOf(nodes: Node[]): Towers {
  const byRef = new Map<string, string>();
  const evm = new Set<string>();
  for (const n of nodes) {
    if (!n.guest) evm.add(n.id);
    for (const ref of [n.subnetId, n.blockchainId]) {
      if (!ref) continue;
      byRef.set(ref, n.id);
      const hex = toHexBytes(ref);
      if (hex && hex.length === 64) byRef.set(hex, n.id);
    }
  }
  return { byRef, evm };
}

/** the tower one value names, when it names one */
export function towerOfValue(t: Towers, col: string, v: unknown): string | null {
  if (typeof v === "string") {
    const hit = t.byRef.get(v) ?? t.byRef.get(v.replace(/^0x/i, "").toLowerCase());
    if (hit) return hit;
  }
  const id = typeof v === "number" ? String(v) : typeof v === "string" && /^\d+$/.test(v) ? v : null;
  return id !== null && CHAIN_COL.test(col) && t.evm.has(id) ? id : null;
}

/** the tower a row names: the column asked for first, then any */
export function towerOfRow(t: Towers, r: Row, first?: string): string | null {
  const own = first ? towerOfValue(t, first, r[first]) : null;
  if (own) return own;
  for (const [k, v] of Object.entries(r)) {
    const hit = towerOfValue(t, k, v);
    if (hit) return hit;
  }
  return null;
}
