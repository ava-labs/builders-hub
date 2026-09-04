"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Box, Hash, Server, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { hasRealChainLogo, pchainApiPath, type SearchResult } from "@/lib/pchain-explorer";
import { lookupTransactionAcrossChains } from "@/lib/cross-chain-lookup";
import { buildTxUrl, buildAddressUrl, buildBlockUrl } from "@/utils/eip3091";

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
    name: "Platform Chain",
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
      name: c.chainName || c.slug,
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
  /^(P-)?(avax|fuji|custom)1[02-9ac-hj-np-z]{30,}$/i.test(q) ||
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
/* Unambiguous shapes (heights, NodeIDs, addresses) resolve instantly; */
/* tx hashes race every chain's RPC and CB58 IDs ask the P-Chain       */
/* search API, both debounced and cached per query so a pasted hash    */
/* costs one lookup total — the Enter key reuses the same cache.       */
/* ------------------------------------------------------------------ */

export interface EntityHit {
  icon: "tx" | "block" | "address" | "node";
  label: string;
  id: string;
  /** null while searching or when nothing claimed the identifier */
  href: string | null;
  /** right-hand side: the chain that claimed it, or a status line */
  detail: string;
  logo?: string;
  status: "ready" | "searching" | "notfound";
}

const txRaceCache = new Map<string, Promise<{ found: boolean; chain?: L1Chain }>>();
/** lookupTransactionAcrossChains, one race per hash per session — the
 *  dropdown resolves it and the Enter key gets the answer for free. */
export function lookupTxAcrossChainsCached(hash: string) {
  const key = hash.toLowerCase();
  let p = txRaceCache.get(key);
  if (!p) {
    p = lookupTransactionAcrossChains(hash);
    txRaceCache.set(key, p);
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
}

const ENTITY_DEBOUNCE_MS = 350;

export function useSearchEntity(query: string, targets: EntityTargets): EntityHit | null {
  const q = query.trim();
  const [resolved, setResolved] = useState<{ q: string; hit: EntityHit } | null>(null);

  const isTxHash = /^0x[a-fA-F0-9]{64}$/.test(q);
  // bech32 addresses share most of the CB58 alphabet — they resolve
  // instantly below and must not trigger a P-Chain search here
  const isCb58 = /^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(q) && !/^(P-)?(avax|fuji|custom)1/i.test(q);

  useEffect(() => {
    if (!isTxHash && !isCb58) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (isTxHash) {
        const race = await lookupTxAcrossChainsCached(q);
        if (cancelled) return;
        if (race.found && race.chain) {
          setResolved({
            q,
            hit: {
              icon: "tx", label: "Transaction", id: q,
              href: buildTxUrl(`/explorer/mainnet/${race.chain.slug}`, q),
              detail: race.chain.chainName,
              logo: hasRealChainLogo(race.chain.chainLogoURI) ? race.chain.chainLogoURI : undefined,
              status: "ready",
            },
          });
          return;
        }
        // no EVM chain claimed it — a hex P-Chain tx id is still possible
        const r = await pchainSearchCached(targets.network, q);
        if (cancelled) return;
        setResolved({
          q,
          hit: r.type !== "none"
            ? { icon: "tx", label: r.type === "block" ? "Block" : "Transaction", id: q, href: `/explorer/${targets.network}/p-chain/${r.type}/${r.id}`, detail: "P-Chain", status: "ready" }
            : { icon: "tx", label: "Transaction", id: q, href: null, detail: "No chain claims this hash", status: "notfound" },
        });
      } else {
        const r = await pchainSearchCached(targets.network, q);
        if (cancelled) return;
        setResolved({
          q,
          hit: r.type !== "none"
            ? { icon: r.type === "block" ? "block" : "tx", label: r.type === "block" ? "Block" : r.type === "tx" ? "Transaction" : r.type, id: q, href: `/explorer/${targets.network}/p-chain/${r.type}/${r.id}`, detail: "P-Chain", status: "ready" }
            : { icon: "tx", label: "P-Chain ID", id: q, href: null, detail: "Nothing matched", status: "notfound" },
        });
      }
    }, ENTITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, isTxHash, isCb58, targets.network]);

  if (!q) return null;

  // instant shapes — no network round-trip, mirrors Enter exactly
  if (/^\d+$/.test(q)) {
    return { icon: "block", label: "Block", id: q, href: buildBlockUrl(targets.blockBase, q), detail: targets.blockChainName, status: "ready" };
  }
  if (/^NodeID-[1-9A-HJ-NP-Za-km-z]{30,}$/.test(q)) {
    return { icon: "node", label: "Validator node", id: q, href: `/explorer/${targets.network}/p-chain/node/${q}`, detail: "P-Chain", status: "ready" };
  }
  if (/^(P-)?(avax|fuji|custom)1[02-9ac-hj-np-z]{30,}$/i.test(q)) {
    return { icon: "address", label: "Address", id: q, href: `/explorer/${targets.network}/p-chain/address/${q}`, detail: "P-Chain", status: "ready" };
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    return { icon: "address", label: "Address", id: q, href: buildAddressUrl(targets.evmAddressBase, q), detail: targets.evmAddressChainName, status: "ready" };
  }

  // async shapes — the resolved answer when it's in, a searching row until
  if (isTxHash || isCb58) {
    if (resolved && resolved.q === q) return resolved.hit;
    return {
      icon: "tx",
      label: isTxHash ? "Transaction" : "P-Chain ID",
      id: q,
      href: null,
      detail: isTxHash ? "Searching every chain…" : "Searching the P-Chain…",
      status: "searching",
    };
  }
  return null;
}

const ENTITY_ICONS = { tx: Hash, block: Box, address: Wallet, node: Server } as const;

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
