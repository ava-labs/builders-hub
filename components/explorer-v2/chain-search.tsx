"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowRight, Box, Coins, Hash, Server, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import { ICM_STATUS_LABEL, type IcmMessage } from "@/lib/icm-message";
import type { L1Chain } from "@/types/stats";
import { hasRealChainLogo, pchainApiPath, type SearchResult } from "@/lib/pchain-explorer";
import { lookupTransactionAcrossChains } from "@/lib/cross-chain-lookup";
import { readIndexedChainIds } from "@/components/explorer-v2/validator-stats";
import { toStatsChainId } from "@/lib/dedicated-stats";
import { buildTxUrl, buildAddressUrl, buildBlockUrl } from "@/utils/eip3091";
import { SOFT_READ, isOk } from "@/lib/explorer-soft-status";

/* ------------------------------------------------------------------ */
/* The one chain-suggestion engine behind every explorer search bar    */
/* (portal + chain pages): a builder can look a chain up by whatever   */
/* they have in hand — name, slug, EVM chain ID, subnet ID, or         */
/* blockchain ID — and the row says which of those matched.            */
/* ------------------------------------------------------------------ */

export interface ChainHit {
  slug: string;
  name: string;
  logo?: string;
  subnetId?: string;
  blockchainId?: string;
  evmChainId?: string;
  isTestnet: boolean;
  hasExplorer: boolean;
  href: string;
  aliases: string[];
}

export interface ChainMatch {
  chain: ChainHit;
  /** the attribute that earned the row its seat, for the detail line */
  matched: { field: "name" | "chain id" | "subnet id" | "blockchain id"; value: string };
}

export const CHAIN_INDEX: ChainHit[] = [
  {
    slug: "p-chain",
    name: "P-Chain",
    logo: "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg",
    subnetId: "11111111111111111111111111111111LpoYY",
    isTestnet: false,
    hasExplorer: true,
    href: "/explorer/mainnet/p-chain",
    aliases: ["p-chain", "pchain", "platform chain", "platform", "primary network"],
  },
  ...(l1ChainsData as L1Chain[]).filter((c) => c.isActive !== false).map((c) => {
    // No testnet EVM chain is indexed right now (Fuji C-Chain indexing is
    // down; the other fuji deployments were never indexed), so an rpcUrl
    // alone doesn't make a testnet entry explorable — matchChains then drops
    // those rows instead of routing users to empty /explorer/fuji pages.
    const hasExplorer = !!c.rpcUrl && c.isTestnet !== true;
    // testnet deployments live under the fuji network segment — the chain
    // layout resolves same-slug pairs by that segment
    const net = c.isTestnet === true ? "fuji" : "mainnet";
    return {
      slug: c.slug,
      // the Primary Network chain goes by its short name everywhere in the explorer
      name: c.slug === "c-chain" ? "C-Chain" : c.chainName || c.slug,
      logo: hasRealChainLogo(c.chainLogoURI) ? c.chainLogoURI : undefined,
      subnetId: c.subnetId || undefined,
      blockchainId: c.blockchainId || undefined,
      evmChainId: c.chainId,
      isTestnet: c.isTestnet === true,
      hasExplorer,
      // no RPC → no explorer to drive; the accounts page still knows the chain
      href: hasExplorer ? `/explorer/${net}/${c.slug}` : `/explorer/${net}/${c.slug}/accounts`,
      aliases: [
        (c.chainName || "").toLowerCase(),
        c.slug.toLowerCase(),
        ...(c.slug === "c-chain" ? ["contract chain", "cchain", "avax"] : []),
      ].filter(Boolean),
    };
  }),
];

const truncMiddle = (id: string, max = 24) =>
  id.length <= max ? id : `${id.slice(0, max - 8)}…${id.slice(-6)}`;

/* Score one chain against the query across every attribute; the best-
   scoring attribute becomes the row's "matched by" detail. Identifier
   fields outrank name substrings — a pasted subnet ID is a far stronger
   signal than a two-letter name fragment. */
function scoreChain(c: ChainHit, q: string, qLower: string): { score: number; matched: ChainMatch["matched"] } | null {
  let score = 0;
  let matched: ChainMatch["matched"] | null = null;
  const consider = (s: number, field: ChainMatch["matched"]["field"], value: string) => {
    if (s > score) {
      score = s;
      matched = { field, value };
    }
  };

  if (qLower.length >= 2) {
    for (const a of c.aliases) {
      if (a === qLower) consider(40, "name", c.name);
      else if (a.startsWith(qLower)) consider(30, "name", c.name);
      else if (a.includes(qLower)) consider(20, "name", c.name);
    }
  }
  if (c.evmChainId && /^\d+$/.test(q)) {
    if (c.evmChainId === q) consider(45, "chain id", c.evmChainId);
    else if (q.length >= 3 && c.evmChainId.startsWith(q)) consider(15, "chain id", c.evmChainId);
  }
  // CB58 is case-sensitive, so pasted prefixes compare exactly
  if (c.subnetId && q.length >= 4 && c.subnetId.startsWith(q)) {
    consider(c.subnetId === q ? 50 : 35, "subnet id", c.subnetId);
  }
  if (c.blockchainId) {
    const isHex = c.blockchainId.startsWith("0x");
    if (isHex && qLower.startsWith("0x") && qLower.length >= 6 && c.blockchainId.toLowerCase().startsWith(qLower)) {
      consider(c.blockchainId.length === qLower.length ? 50 : 35, "blockchain id", c.blockchainId);
    } else if (!isHex && q.length >= 4 && c.blockchainId.startsWith(q)) {
      consider(c.blockchainId === q ? 50 : 35, "blockchain id", c.blockchainId);
    }
  }

  return matched ? { score, matched } : null;
}

/** Query → chains, scored: identifiers (chain/subnet/blockchain IDs) beat
 *  name prefixes beat substrings; mainnet beats testnet; live P-Chain
 *  validator weight breaks ties. */
export function matchChains(query: string, live: Map<string, number> | null): ChainMatch[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const qLower = q.toLowerCase();
  return CHAIN_INDEX.map((c) => ({ c, hit: scoreChain(c, q, qLower) }))
    .filter((s): s is { c: ChainHit; hit: NonNullable<ReturnType<typeof scoreChain>> } => s.hit !== null)
    .sort((a, b) => {
      if (a.hit.score !== b.hit.score) return b.hit.score - a.hit.score;
      if (a.c.isTestnet !== b.c.isTestnet) return a.c.isTestnet ? 1 : -1;
      const av = live?.get(a.c.subnetId ?? "") ?? 0;
      const bv = live?.get(b.c.subnetId ?? "") ?? 0;
      if (av !== bv) return bv - av;
      return a.c.name.localeCompare(b.c.name);
    })
    // testnet entries earn a seat only when they can actually be explored
    .filter((s) => !s.c.isTestnet || s.c.hasExplorer)
    // the catalog holds same-slug pairs (mainnet + testnet deployments) that
    // route to the same page — one row per destination, best score wins
    .filter((s, i, arr) => arr.findIndex((o) => o.c.href === s.c.href) === i)
    .slice(0, 7)
    .map((s) => ({ chain: s.c, matched: s.hit.matched }));
}

/* identifiers stay identifiers on Enter: these shapes never auto-navigate
   to a chain-name hit — the dropdown offers chains, Enter searches */
export const looksLikeIdentifier = (q: string) =>
  /^\d+$/.test(q) || /^0x[a-fA-F0-9]+$/.test(q) || /^NodeID-/.test(q) ||
  /^([XP]-)?(avax|fuji|custom)1[02-9ac-hj-np-z]{30,}$/i.test(q) ||
  /^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(q);

function ChainLogo({ uri, name }: { uri?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[10px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img src={uri} alt="" onError={() => setBroken(true)} className="h-6 w-6 shrink-0 rounded-full object-contain" />
  );
}

/* ------------------------------------------------------------------ */
/* Entity suggestions — the dropdown's answer to "what will Enter do?" */
/* Unambiguous shapes (heights, NodeIDs, 0x addresses) resolve         */
/* instantly; tx hashes race every chain's RPC, CB58 IDs ask the       */
/* P-Chain search API then the X-Chain's tx/asset probes, and a bech32 */
/* address asks each UTXO chain whether it holds the account — all     */
/* debounced and cached per query so a pasted id costs one lookup      */
/* total and the Enter key reuses the same cache.                      */
/* ------------------------------------------------------------------ */

/* How a P-Chain search result renders. "chain" comes from a CreateChainTx
   id, whose page is the L1's own detail view rather than the creating tx. */
const PCHAIN_HIT: Record<string, { icon: EntityHit["icon"]; label: string }> = {
  block: { icon: "block", label: "Block" },
  chain: { icon: "block", label: "Blockchain" },
  node: { icon: "node", label: "Validator node" },
  address: { icon: "address", label: "Address" },
  tx: { icon: "tx", label: "Transaction" },
};

export interface EntityHit {
  icon: "tx" | "block" | "address" | "node" | "icm" | "asset";
  label: string;
  id: string;
  /** null while searching or when nothing claimed the identifier */
  href: string | null;
  /** right-hand side: the chain that claimed it, or a status line */
  detail: string;
  logo?: string;
  status: "ready" | "searching" | "notfound";
}

/* The chains a pasted tx hash is raced across: the mainnet chains the
   explorer indexes. A hit opens /explorer/mainnet/{slug}/tx, and an
   unindexed chain has no tx page there; several of their RPCs refuse a
   browser's read as well. Without the indexed set, the catalog's flag
   stands in. */
export function raceChains(indexed: Set<string> | null, chains: L1Chain[] = l1ChainsData as L1Chain[]): L1Chain[] {
  return chains.filter((c) => !c.isTestnet && (indexed ? indexed.has(toStatsChainId(c.chainId)) : c.isIndexed !== false));
}

const txRaceCache = new Map<string, Promise<{ found: boolean; chain?: L1Chain }>>();
/** lookupTransactionAcrossChains over the indexed mainnet chains, one race
 *  per hash per session: the dropdown resolves it and the Enter key gets
 *  the answer for free. */
export function lookupTxAcrossChainsCached(hash: string) {
  const key = hash.toLowerCase();
  let p = txRaceCache.get(key);
  if (!p) {
    p = readIndexedChainIds().then((indexed) => lookupTransactionAcrossChains(hash, raceChains(indexed)));
    txRaceCache.set(key, p);
  }
  return p;
}

/* What the X-Chain API can tell a CB58 id is: tx or genesis asset. There is
   no x-api "search" resource, so the id is probed as a tx first and an
   asset second — a CreateAssetTx id names an asset that has no tx page. */
export interface XchainHit {
  type: "tx" | "asset" | "none";
  id: string;
}

const XCHAIN_HIT: Record<"tx" | "asset", { icon: EntityHit["icon"]; label: string }> = {
  tx: { icon: "tx", label: "Transaction" },
  asset: { icon: "asset", label: "Asset" },
};

const xchainSearchCache = new Map<string, Promise<XchainHit>>();
/** One probe pair per id per session, shared by the dropdown row and Enter. */
export function xchainSearchCached(network: string, q: string): Promise<XchainHit> {
  const key = `${network}:${q}`;
  let p = xchainSearchCache.get(key);
  if (!p) {
    const has = (resource: "tx" | "asset") =>
      fetch(`/api/xchain/${network}/${resource}/${encodeURIComponent(q)}`, SOFT_READ).then((res) => isOk(res));
    p = has("tx")
      .then(async (tx): Promise<XchainHit> => (tx ? { type: "tx", id: q } : { type: (await has("asset")) ? "asset" : "none", id: q }))
      .catch(() => ({ type: "none" as const, id: q }));
    xchainSearchCache.set(key, p);
  }
  return p;
}

/** The X-Chain's answer to a CB58 id as an entity row. */
export function xchainHit(q: string, network: string, found: XchainHit): EntityHit {
  return found.type === "none"
    ? { icon: "tx", label: "Chain ID", id: q, href: null, detail: "Nothing matched", status: "notfound" }
    : {
        ...XCHAIN_HIT[found.type],
        id: q,
        href: `/explorer/${network}/x-chain/${found.type}/${found.id}`,
        detail: "X-Chain",
        status: "ready",
      };
}

/* A bech32 address is one account seen from two chains — `X-`/`P-` are
   prefixes on the same `avax1…` payload, not different addresses. An
   explicit prefix is a chain selector and skips the probes; a bare address
   asks each chain whether it holds the account (balance, UTXOs, atomic
   memory, tx history) and earns a row per claimant, so an address with
   activity on both chains offers both pages. An address no chain has
   touched still lands on the P-Chain page, whose empty state is the
   honest answer. */
export interface Bech32Hit {
  chain: "p-chain" | "x-chain";
  /** the address as the target page's API knows it: bare on P, X- prefixed on X */
  id: string;
}

/** a string balance/amount that is present and nonzero */
const nz = (v?: string) => v !== undefined && v !== "0";

function pchainAddressHas(network: string, bare: string): Promise<boolean> {
  return fetch(pchainApiPath(network, `address/${encodeURIComponent(bare)}`), SOFT_READ)
    .then(async (res) => {
      if (!isOk(res)) return false;
      const d = await res.json();
      return (
        (d.utxoCount ?? 0) > 0 ||
        (d.utxos?.length ?? 0) > 0 ||
        !!d.fundedBy ||
        nz(d.balance?.total) ||
        nz(d.breakdown?.atomicMemoryUnlocked) ||
        nz(d.breakdown?.atomicMemoryLocked)
      );
    })
    .catch(() => false);
}

function xchainAddressHas(network: string, bare: string): Promise<boolean> {
  return fetch(`/api/xchain/${network}/address/${encodeURIComponent(bare)}`, SOFT_READ)
    .then(async (res) => {
      if (!isOk(res)) return false;
      const d = await res.json();
      return (
        (d.transactions?.length ?? 0) > 0 ||
        (d.balances ?? []).some((b: { balance?: string; utxoCount?: number }) => nz(b.balance) || (b.utxoCount ?? 0) > 0)
      );
    })
    .catch(() => false);
}

const bech32AddressCache = new Map<string, Promise<Bech32Hit[]>>();
/** One probe pair per address per session, shared by the dropdown and Enter.
 *  P-Chain first in the array, so Enter keeps its long-standing default when
 *  both chains claim the address. */
export function bech32AddressCached(network: string, q: string): Promise<Bech32Hit[]> {
  const key = `${network}:${q}`;
  let p = bech32AddressCache.get(key);
  if (!p) {
    const bare = q.replace(/^[xp]-/i, "");
    const prefix = /^([xp])-/i.exec(q)?.[1].toLowerCase();
    if (prefix === "x") {
      p = Promise.resolve([{ chain: "x-chain" as const, id: `X-${bare}` }]);
    } else if (prefix === "p") {
      p = Promise.resolve([{ chain: "p-chain" as const, id: bare }]);
    } else {
      p = Promise.all([pchainAddressHas(network, bare), xchainAddressHas(network, bare)])
        .then(([onP, onX]) => {
          const hits: Bech32Hit[] = [];
          if (onP) hits.push({ chain: "p-chain", id: bare });
          if (onX) hits.push({ chain: "x-chain", id: `X-${bare}` });
          if (hits.length === 0) hits.push({ chain: "p-chain", id: bare });
          return hits;
        })
        .catch(() => [{ chain: "p-chain" as const, id: bare }]);
    }
    bech32AddressCache.set(key, p);
  }
  return p;
}

const pchainSearchCache = new Map<string, Promise<SearchResult>>();
function pchainSearchCached(network: string, q: string): Promise<SearchResult> {
  const key = `${network}:${q}`;
  let p = pchainSearchCache.get(key);
  if (!p) {
    p = fetch(pchainApiPath(network, "search", { q }))
      .then((res) => (res.ok ? res.json() : { type: "none", id: q }))
      .catch(() => ({ type: "none" as const, id: q }));
    pchainSearchCache.set(key, p);
  }
  return p;
}

const icmLookupCache = new Map<string, Promise<IcmMessage | null>>();
/** One lookup per message ID per session. Only ever reached after both the EVM
 *  race and the P-Chain search came back empty, so the ordinary path, a hash
 *  that is a transaction, never pays for it. */
function icmLookupCached(hash: string): Promise<IcmMessage | null> {
  const key = hash.toLowerCase();
  let p = icmLookupCache.get(key);
  if (!p) {
    p = fetch(`/api/icm/message/${key}`, SOFT_READ)
      .then((res) => (isOk(res) ? res.json() : null))
      .then((body) => (body && !body.error ? (body as IcmMessage) : null))
      .catch(() => null);
    icmLookupCache.set(key, p);
  }
  return p;
}

/** Where this search bar's Enter key sends each shape — the entity row
 *  must point at the same place. */
export interface EntityTargets {
  network: string;
  /** base + display name for plain block heights */
  blockBase: string;
  blockChainName: string;
  /** base + display name for 0x addresses */
  evmAddressBase: string;
  evmAddressChainName: string;
  /** base + display name for a plain height the P-Chain does not have; when
   *  set, a height waits on the P-Chain search (the network search) */
  heightFallback?: { base: string; chainName: string };
}

/** A plain height's row. With a fallback chain, a height opens on blockBase
 *  only when the P-Chain search found that block; any other height opens on
 *  the fallback chain, whose heights run far past the P-Chain tip. */
export function heightHit(q: string, targets: EntityTargets, found?: SearchResult): EntityHit {
  const other = targets.heightFallback && found?.type !== "block" ? targets.heightFallback : null;
  return {
    icon: "block", label: "Block", id: q,
    href: buildBlockUrl(other?.base ?? targets.blockBase, q),
    detail: other?.chainName ?? targets.blockChainName,
    status: "ready",
  };
}

/** heightHit after the P-Chain search, one lookup per height per session:
 *  the dropdown's row and the Enter key share it. */
export function heightHitCached(q: string, targets: EntityTargets): Promise<EntityHit> {
  return pchainSearchCached(targets.network, q).then((found) => heightHit(q, targets, found));
}

const ENTITY_DEBOUNCE_MS = 350;

/* One entity resolution can be two rows: a bare bech32 address that both
   the P-Chain and X-Chain claim gets an "Address" row per chain. */
export function useSearchEntity(query: string, targets: EntityTargets): EntityHit[] {
  const q = query.trim();
  const [resolved, setResolved] = useState<{ q: string; hits: EntityHit[] } | null>(null);

  const isTxHash = /^0x[a-fA-F0-9]{64}$/.test(q);
  // bech32 asks each UTXO chain whether it holds the account (below) —
  // a bare avax1… is also CB58-shaped, so it must not reach the CB58 probes
  const isBech32 = /^([XP]-)?(avax|fuji|custom)1[02-9ac-hj-np-z]{30,}$/i.test(q);
  const isCb58 = /^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(q) && !isBech32;
  // with a fallback chain, a plain height asks the P-Chain whether it has it
  const isAskedHeight = !!targets.heightFallback && /^\d+$/.test(q);

  useEffect(() => {
    if (!isTxHash && !isCb58 && !isAskedHeight && !isBech32) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (isAskedHeight) {
        const hit = await heightHitCached(q, targets);
        if (!cancelled) setResolved({ q, hits: [hit] });
      } else if (isTxHash) {
        const race = await lookupTxAcrossChainsCached(q);
        if (cancelled) return;
        if (race.found && race.chain) {
          setResolved({
            q,
            hits: [{
              icon: "tx", label: "Transaction", id: q,
              href: buildTxUrl(`/explorer/mainnet/${race.chain.slug}`, q),
              detail: race.chain.chainName,
              logo: hasRealChainLogo(race.chain.chainLogoURI) ? race.chain.chainLogoURI : undefined,
              status: "ready",
            }],
          });
          return;
        }
        // no EVM chain claimed it — a hex P-Chain tx id is still possible
        const r = await pchainSearchCached(targets.network, q);
        if (cancelled) return;
        if (r.type !== "none") {
          setResolved({
            q,
            hits: [{ ...(PCHAIN_HIT[r.type] ?? PCHAIN_HIT.tx), id: q, href: `/explorer/${targets.network}/p-chain/${r.type}/${r.id}`, detail: "P-Chain", status: "ready" }],
          });
          return;
        }

        const icm = await icmLookupCached(q);
        if (cancelled) return;
        setResolved({
          q,
          hits: [icm
            ? { icon: "icm", label: "Interchain message", id: q, href: `/explorer/${targets.network}/icm/${icm.messageId}`, detail: ICM_STATUS_LABEL[icm.status] ?? "Interchain message", status: "ready" }
            : { icon: "tx", label: "Transaction", id: q, href: null, detail: "No chain claims this hash", status: "notfound" }],
        });
      } else if (isBech32) {
        const found = await bech32AddressCached(targets.network, q);
        if (cancelled) return;
        setResolved({
          q,
          hits: found.map((h) => ({
            icon: "address" as const,
            label: "Address",
            id: q,
            href: `/explorer/${targets.network}/${h.chain}/address/${h.id}`,
            detail: h.chain === "x-chain" ? "X-Chain" : "P-Chain",
            status: "ready" as const,
          })),
        });
      } else {
        // CB58 — a P-Chain or X-Chain id: the search API answers for the
        // P-Chain; on a miss the X-Chain's tx/asset probes take over
        const r = await pchainSearchCached(targets.network, q);
        if (cancelled) return;
        if (r.type !== "none") {
          setResolved({
            q,
            hits: [{ ...(PCHAIN_HIT[r.type] ?? PCHAIN_HIT.tx), id: q, href: `/explorer/${targets.network}/p-chain/${r.type}/${r.id}`, detail: "P-Chain", status: "ready" }],
          });
          return;
        }
        const x = await xchainSearchCached(targets.network, q);
        if (cancelled) return;
        setResolved({ q, hits: [xchainHit(q, targets.network, x)] });
      }
    }, ENTITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, isTxHash, isCb58, isBech32, isAskedHeight, targets.network]);

  if (!q) return [];

  // instant shapes — no network round-trip, mirrors Enter exactly
  if (/^\d+$/.test(q) && !isAskedHeight) return [heightHit(q, targets)];
  if (/^NodeID-[1-9A-HJ-NP-Za-km-z]{30,}$/.test(q)) {
    return [{ icon: "node", label: "Validator node", id: q, href: `/explorer/${targets.network}/p-chain/node/${q}`, detail: "P-Chain", status: "ready" }];
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    return [{ icon: "address", label: "Address", id: q, href: buildAddressUrl(targets.evmAddressBase, q), detail: targets.evmAddressChainName, status: "ready" }];
  }

  // async shapes — the resolved answer when it's in, a searching row until
  if (isTxHash || isCb58 || isBech32 || isAskedHeight) {
    if (resolved && resolved.q === q) return resolved.hits;
    return [{
      icon: isAskedHeight ? "block" : isBech32 ? "address" : "tx",
      label: isTxHash ? "Transaction" : isAskedHeight ? "Block" : isBech32 ? "Address" : "Chain ID",
      id: q,
      href: null,
      detail: isTxHash ? "Searching every chain…" : isAskedHeight ? "Searching the P-Chain…" : "Searching the P-Chain and X-Chain…",
      status: "searching",
    }];
  }
  return [];
}

const ENTITY_ICONS = { tx: Hash, block: Box, address: Wallet, node: Server, icm: ArrowLeftRight, asset: Coins } as const;

/** The entity row: what the identifier in the box resolves to, and where
 *  Enter (or a click) lands. Sits above the chain suggestions. */
export function EntityHitRow({ hit, onSelect }: { hit: EntityHit; onSelect: (href: string) => void }) {
  const Icon = ENTITY_ICONS[hit.icon];
  return (
    <button
      type="button"
      disabled={hit.href === null}
      onMouseDown={(e) => {
        e.preventDefault();
        if (hit.href) onSelect(hit.href);
      }}
      className={cn(
        "group/entity flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors dark:border-zinc-900",
        hit.href ? "hover:bg-zinc-50 dark:hover:bg-zinc-900" : "cursor-default",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {hit.label}
        </span>
        <span className="block truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
          {truncMiddle(hit.id, 40)}
        </span>
      </span>
      {hit.status === "searching" ? (
        <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-500" />
          {hit.detail}
        </span>
      ) : hit.status === "notfound" ? (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">
          {hit.detail}
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-2">
          {hit.logo && <img src={hit.logo} alt="" className="h-4 w-4 rounded-full object-contain" />}
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 dark:text-zinc-100">
            {hit.detail}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-[#E6212F] transition-transform group-hover/entity:translate-x-0.5" />
        </span>
      )}
    </button>
  );
}

/** One suggestion row, shared by every explorer search dropdown: logo,
 *  name, which attribute matched, network tag, live validators, and where
 *  the row leads. mousedown beats blur so rows stay clickable. */
export function ChainHitRow({
  match,
  selected,
  validators,
  onSelect,
  onHover,
}: {
  match: ChainMatch;
  selected: boolean;
  validators?: number;
  onSelect: () => void;
  onHover?: () => void;
}) {
  const { chain, matched } = match;
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHover}
      className={cn(
        "group/hit flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        selected ? "bg-zinc-50 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
      )}
    >
      <ChainLogo uri={chain.logo} name={chain.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {chain.name}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
          {matched.field} · {truncMiddle(matched.value)}
        </span>
      </span>
      {chain.isTestnet && (
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          Testnet
        </span>
      )}
      {typeof validators === "number" && (
        <span className="hidden shrink-0 font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-zinc-400 sm:block dark:text-zinc-500">
          {validators} validators
        </span>
      )}
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
          chain.hasExplorer ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500",
        )}
      >
        {chain.hasExplorer ? "Explorer" : "No explorer · stats"}
        <ArrowRight
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            selected && "translate-x-0.5",
            chain.hasExplorer ? "text-[#E6212F]" : "text-zinc-300 dark:text-zinc-600",
          )}
        />
      </span>
    </button>
  );
}
