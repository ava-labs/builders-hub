"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import {
  NETWORK_LABEL,
  getExplorerChain,
  hasRealChainLogo,
  isPchainNetwork,
  type PchainNetwork,
} from "@/lib/pchain-explorer";

/* ------------------------------------------------------------------ */
/* The explorer's subnav rail, shared by every shell (P-Chain, per-L1,  */
/* directory): a chain switcher on the left, section tabs with a red    */
/* active bar in the middle, the network at the right edge. This is     */
/* the one element that makes the explorer navigable as a single app    */
/* rather than a set of pages that happen to share a URL prefix.        */
/* ------------------------------------------------------------------ */

const PCHAIN_LOGO =
  "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg";

const cChain = (l1ChainsData as L1Chain[]).find((c) => c.slug === "c-chain");

type SwitcherEntry = {
  slug: string;
  name: string;
  logo?: string;
  href: string;
};

interface ExplorerSubnavProps {
  /** route network segment; defaults to mainnet */
  network?: string;
  /** current chain slug; omit on chain-agnostic pages like the directory */
  chainSlug?: string;
  chainName?: string;
  chainLogoURI?: string;
  className?: string;
}

/* Chain switcher — the dropdown that holds the whole ecosystem. The two
   system chains are pinned; the L1 list is validated against the P-Chain
   (a chain appears only if its subnet has stake-backed validators right
   now), fetched lazily the first time the menu opens. */
function ChainSwitcher({
  network,
  chainSlug,
  chainName,
  chainLogoURI,
}: {
  network: string;
  chainSlug?: string;
  chainName?: string;
  chainLogoURI?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [liveValidators, setLiveValidators] = useState<Map<string, number> | null>(null);
  const [feedFailed, setFeedFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // validate lazily, once, on first open
  useEffect(() => {
    if (!open || liveValidators || feedFailed) return;
    let cancelled = false;
    fetch("/api/validator-stats?network=mainnet")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((subnets: { id: string; byClientVersion?: Record<string, { nodes: number }> }[]) => {
        if (cancelled) return;
        const live = new Map<string, number>();
        for (const s of subnets) {
          const nodes = Object.values(s.byClientVersion ?? {}).reduce((sum, v) => sum + v.nodes, 0);
          if (nodes > 0) live.set(s.id, nodes);
        }
        setLiveValidators(live);
      })
      .catch(() => {
        if (!cancelled) setFeedFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, liveValidators, feedFailed]);

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pchainNetwork = isPchainNetwork(network) ? network : "mainnet";
  const pinned: SwitcherEntry[] = [
    { slug: "p-chain", name: "Platform Chain", logo: PCHAIN_LOGO, href: `/explorer/${pchainNetwork}/p-chain` },
    {
      slug: "c-chain",
      name: cChain?.chainName ?? "Avalanche C-Chain",
      logo: cChain?.chainLogoURI,
      href: "/explorer/mainnet/c-chain",
    },
  ];

  const l1s = useMemo<SwitcherEntry[] | null>(() => {
    const all = (l1ChainsData as L1Chain[]).filter(
      (c) => c.isTestnet !== true && c.rpcUrl && hasRealChainLogo(c.chainLogoURI) && c.slug !== "c-chain",
    );
    let picked: L1Chain[];
    if (liveValidators) {
      picked = all
        .filter((c) => c.subnetId && liveValidators.has(c.subnetId))
        .sort((a, b) => (liveValidators.get(b.subnetId!) ?? 0) - (liveValidators.get(a.subnetId!) ?? 0));
    } else if (feedFailed) {
      picked = all; // feed down: the catalog beats an empty menu
    } else {
      return null; // still validating: skeleton rows
    }
    return picked.map((c) => ({
      slug: c.slug,
      name: c.chainName,
      logo: c.chainLogoURI,
      href: `/explorer/mainnet/${c.slug}`,
    }));
  }, [liveValidators, feedFailed]);

  const q = filter.trim().toLowerCase();
  const matches = (e: SwitcherEntry) => !q || e.name.toLowerCase().includes(q) || e.slug.includes(q);
  const pinnedShown = pinned.filter(matches);
  const l1sShown = l1s?.filter(matches);

  const row = (entry: SwitcherEntry) => {
    const current = entry.slug === chainSlug;
    return (
      <Link
        key={entry.slug}
        href={entry.href}
        onClick={() => setOpen(false)}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        {entry.logo ? (
          <img src={entry.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
          {entry.name}
        </span>
        {current ? (
          <span aria-label="Current chain" className="h-1.5 w-1.5 shrink-0 bg-[#E6212F]" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[#E6212F] dark:text-zinc-600" />
        )}
      </Link>
    );
  };

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-stretch">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setFilter("");
        }}
        className="group flex items-center gap-2.5 pr-1 text-left"
      >
        {(chainSlug === "p-chain" ? PCHAIN_LOGO : chainLogoURI) && (
          <img
            src={chainSlug === "p-chain" ? PCHAIN_LOGO : chainLogoURI}
            alt=""
            className="h-5 w-5 shrink-0 rounded-full object-contain"
          />
        )}
        <span className="max-w-40 truncate font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 md:max-w-56 dark:text-zinc-100">
          {chainName ?? "All chains"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 w-80 border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="relative border-b border-zinc-100 dark:border-zinc-900">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter chains"
              spellCheck={false}
              autoFocus
              className="w-full bg-transparent py-2.5 pl-10 pr-4 font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pinnedShown.map(row)}
            {pinnedShown.length > 0 && (!l1sShown || l1sShown.length > 0) && (
              <div className="mx-4 my-1 h-px bg-zinc-100 dark:bg-zinc-900" />
            )}
            {l1sShown
              ? l1sShown.map(row)
              : Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="h-5 w-5 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
                    <span className="h-3 w-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  </div>
                ))}
            {l1sShown && pinnedShown.length + l1sShown.length === 0 && (
              <p className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                No chains match
              </p>
            )}
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-900">
            {(
              [
                ["All L1 chains", "/explorer/chains"],
                ["Explorer home", "/explorer"],
              ] as const
            ).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="group flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                  {label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] dark:text-zinc-600" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = { label: string; href: string; isActive: (path: string) => boolean };

/* Section tabs per chain kind. Detail pages light up their list's tab
   (a block detail is still "Blocks"); on EVM chains the stats surfaces
   are first-class sections of the same chain, so they ride here too. */
function buildTabs(network: string, chainSlug: string | undefined): Tab[] {
  if (!chainSlug) return [];

  if (getExplorerChain(chainSlug)?.kind === "pchain") {
    const base = `/explorer/${network}/${chainSlug}`;
    return [
      {
        label: "Overview",
        href: base,
        isActive: (p) => p === base || p.startsWith(`${base}/address`),
      },
      { label: "Blocks", href: `${base}/blocks`, isActive: (p) => p.startsWith(`${base}/block`) },
      { label: "Transactions", href: `${base}/txs`, isActive: (p) => p.startsWith(`${base}/tx`) },
      {
        label: "Validators",
        href: `${base}/validators`,
        isActive: (p) => p.startsWith(`${base}/validators`) || p.startsWith(`${base}/node`),
      },
    ];
  }

  const base = `/explorer/${network}/${chainSlug}`;
  const tabs: Tab[] = [{ label: "Overview", href: base, isActive: (p) => p.startsWith(base) }];

  // custom chains (localStorage imports) have no stats surfaces
  const catalogChain = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);
  if (catalogChain) {
    tabs.push({
      label: "Stats",
      href: `/stats/l1/${chainSlug}`,
      isActive: (p) => p.startsWith(`/stats/l1/${chainSlug}`),
    });
    if (catalogChain.isTestnet !== true) {
      tabs.push({
        label: "Validators",
        href: `/stats/validators/${chainSlug}`,
        isActive: (p) => p.startsWith(`/stats/validators/${chainSlug}`),
      });
    }
    if (chainSlug === "c-chain") {
      tabs.push({
        label: "Token",
        href: "/stats/avax-token",
        isActive: (p) => p.startsWith("/stats/avax-token"),
      });
    }
  }
  return tabs;
}

/* Verified mainnet ↔ Fuji counterparts (paired by EVM chain ID; the catalog's
   testnet slugs are too inconsistent to derive). Chains without a pair keep
   the static network label. */
const TESTNET_COUNTERPART: Record<string, string> = {
  "c-chain": "avalanche-c-chain", // 43114 ↔ 43113
  beam: "beam-l1", // 4337 ↔ 13337
  dexalot: "dexalot-l1", // 432204 ↔ 432201
};
const MAINNET_COUNTERPART: Record<string, string> = Object.fromEntries(
  Object.entries(TESTNET_COUNTERPART).map(([m, t]) => [t, m]),
);

/* Crossing networks keeps the section when the counterpart has it: a stats
   page lands on the counterpart's stats, everything else lands on its
   explorer overview. */
function counterpartTarget(slug: string, pathname: string): string {
  if (pathname.startsWith("/stats/l1/")) return `/stats/l1/${slug}`;
  return `/explorer/mainnet/${slug}`;
}

/* Network control: the P-Chain spans networks, so it gets the segmented
   switcher; EVM chains get a Mainnet/Fuji toggle when a verified
   counterpart chain exists, and a static label otherwise. */
function NetworkControl({
  network,
  chainSlug,
  pathname,
}: {
  network: string;
  chainSlug?: string;
  pathname: string;
}) {
  const c = chainSlug ? getExplorerChain(chainSlug) : undefined;
  if (c && c.kind === "pchain") {
    return (
      <div className="inline-flex self-center border border-zinc-200 dark:border-zinc-800">
        {c.networks.map((n) => {
          const active = n === network;
          return (
            <Link
              key={n}
              href={`/explorer/${n}/${chainSlug}`}
              className={cn(
                "px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                active
                  ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {NETWORK_LABEL[n as PchainNetwork] ?? n}
            </Link>
          );
        })}
      </div>
    );
  }
  if (!chainSlug) return null;

  // EVM chain with a verified Fuji counterpart: a real toggle
  const isTestnetChain = chainSlug in MAINNET_COUNTERPART;
  const other = TESTNET_COUNTERPART[chainSlug] ?? MAINNET_COUNTERPART[chainSlug];
  if (other) {
    const mainnetSlug = isTestnetChain ? other : chainSlug;
    const testnetSlug = isTestnetChain ? chainSlug : other;
    const segments = [
      { label: "Mainnet", slug: mainnetSlug, active: !isTestnetChain },
      { label: "Fuji", slug: testnetSlug, active: isTestnetChain },
    ];
    return (
      <div className="inline-flex self-center border border-zinc-200 dark:border-zinc-800">
        {segments.map((seg) => (
          <Link
            key={seg.label}
            href={counterpartTarget(seg.slug, pathname)}
            className={cn(
              "px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
              seg.active
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {seg.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <span className="hidden self-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 sm:block dark:text-zinc-500">
      {NETWORK_LABEL[network as PchainNetwork] ?? network}
    </span>
  );
}

export function ExplorerSubnav({
  network = "mainnet",
  chainSlug,
  chainName,
  chainLogoURI,
  className,
}: ExplorerSubnavProps) {
  const pathname = usePathname();
  const tabs = useMemo(() => buildTabs(network, chainSlug), [network, chainSlug]);

  return (
    <div className={cn("flex items-stretch justify-between gap-x-6 border-b border-zinc-200 dark:border-zinc-800", className)}>
      <div className="flex min-w-0 items-stretch gap-x-5 md:gap-x-6">
        <ChainSwitcher network={network} chainSlug={chainSlug} chainName={chainName} chainLogoURI={chainLogoURI} />
        {tabs.length > 0 && <div className="my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />}
        {tabs.length > 0 && (
          <nav aria-label="Explorer sections" className="scrollbar-hide flex items-stretch gap-x-5 overflow-x-auto md:gap-x-6">
            {tabs.map((tab) => {
              const active = tab.isActive(pathname);
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100",
                  )}
                >
                  {tab.label}
                  {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#E6212F]" />}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <NetworkControl network={network} chainSlug={chainSlug} pathname={pathname} />
    </div>
  );
}
