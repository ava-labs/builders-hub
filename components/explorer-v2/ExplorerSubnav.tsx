"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useLiveValidatorCounts } from "@/components/explorer-v2/validator-stats";
import { ExplorerRangeControl } from "@/components/explorer-v2/time-range";
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
  /** current chain slug; omit for the network scope (All Networks pages) */
  chainSlug?: string;
  chainName?: string;
  chainLogoURI?: string;
  className?: string;
}

/* The network scope's home — every ecosystem-wide facet hangs off it. */
const NETWORK_HOME = "/explorer/mainnet";

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
  const rootRef = useRef<HTMLDivElement>(null);

  // validate lazily, on first open (the shared feed dedupes the request)
  const { live: liveValidators, failed: feedFailed } = useLiveValidatorCounts("mainnet", open);

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
    {
      slug: "all-networks",
      name: "All Networks",
      href: NETWORK_HOME,
    },
    {
      slug: "c-chain",
      name: "Contract Chain",
      logo: cChain?.chainLogoURI,
      href: "/explorer/mainnet/c-chain",
    },
    { slug: "p-chain", name: "Platform Chain", logo: PCHAIN_LOGO, href: `/explorer/${pchainNetwork}/p-chain` },
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
    // no chain slug = the network scope, whose row is "All Networks"
    const current = entry.slug === (chainSlug ?? "all-networks");
    return (
      <Link
        key={entry.slug}
        href={entry.href}
        onClick={() => setOpen(false)}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        {entry.slug === "all-networks" ? (
          /* the mark rides the theme, not the brand red — CSS fill beats the
             SVG's hardcoded presentation attributes */
          <AvalancheLogo className="h-5 w-5 shrink-0 text-zinc-900 dark:text-zinc-100 [&_path]:fill-current" />
        ) : entry.logo ? (
          <img src={entry.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
          {entry.name}
        </span>
        {current ? (
          <span aria-label="Current chain" className="h-1.5 w-1.5 shrink-0 bg-[var(--chain-accent,#E6212F)]" />
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
        {!chainSlug ? (
          <AvalancheLogo className="h-5 w-5 shrink-0 text-zinc-900 dark:text-zinc-100 [&_path]:fill-current" />
        ) : (
          (chainSlug === "p-chain" ? PCHAIN_LOGO : chainLogoURI) && (
            <img
              src={chainSlug === "p-chain" ? PCHAIN_LOGO : chainLogoURI}
              alt=""
              className="h-5 w-5 shrink-0 rounded-full object-contain"
            />
          )
        )}
        <span className="max-w-28 truncate font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 sm:max-w-40 md:max-w-56 dark:text-zinc-100">
          {(chainSlug === "c-chain" ? "C-Chain" : chainName) ?? "All Networks"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100" />
      </button>

      {open && (
        // z-50: must clear the stats pages' sticky section bar (z-40)
        <div className="absolute left-0 top-full z-50 w-[min(20rem,calc(100vw-2.5rem))] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
                ["All L1 chains", `${NETWORK_HOME}/chains`],
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
   are first-class sections of the same chain, so they ride here too.
   No chain at all is the widest lens — the network scope, where every
   ecosystem-wide facet (chains, ICM, validators, apps, the token) lives. */
function buildTabs(network: string, chainSlug: string | undefined): Tab[] {
  if (!chainSlug) {
    return [
      {
        label: "Overview",
        href: NETWORK_HOME,
        isActive: (p) => p === NETWORK_HOME || p.startsWith("/stats/overview"),
      },
      {
        label: "Chains",
        href: `${NETWORK_HOME}/chains`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/chains`) || p.startsWith("/explorer/chains"),
      },
      {
        label: "Stats",
        href: "/stats/network-metrics",
        isActive: (p) => p.startsWith("/stats/network-metrics"),
      },
      {
        label: "ICM",
        href: `${NETWORK_HOME}/icm`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/icm`),
      },
      {
        label: "Validators",
        href: `${NETWORK_HOME}/validators`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/validators`),
      },
      {
        label: "Apps",
        href: `${NETWORK_HOME}/apps`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/apps`) || p.startsWith("/stats/dapps"),
      },
      {
        label: "Token",
        href: `${NETWORK_HOME}/token`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/token`),
      },
    ];
  }

  if (getExplorerChain(chainSlug)?.kind === "pchain") {
    const base = `/explorer/${network}/${chainSlug}`;
    const tabs: Tab[] = [
      {
        label: "Overview",
        href: base,
        isActive: (p) => p === base || p.startsWith(`${base}/address`),
      },
      { label: "Blocks", href: `${base}/blocks`, isActive: (p) => p.startsWith(`${base}/block`) },
      { label: "Transactions", href: `${base}/txs`, isActive: (p) => p.startsWith(`${base}/tx`) },
    ];
    // the staking observatory's feeds are mainnet-only
    if (network === "mainnet") {
      tabs.push({
        label: "Staking",
        href: `${base}/staking`,
        isActive: (p) => p.startsWith(`${base}/staking`),
      });
    }
    tabs.push({
      label: "Validators",
      href: `${base}/validators`,
      isActive: (p) => p.startsWith(`${base}/validators`) || p.startsWith(`${base}/node`),
    });
    return tabs;
  }

  const base = `/explorer/${network}/${chainSlug}`;
  const tabs: Tab[] = [
    {
      label: "Overview",
      href: base,
      isActive: (p) => p === base || p.startsWith(`${base}/address`),
    },
  ];

  // custom chains (localStorage imports) have no stats surfaces
  const catalogChain = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);
  if (catalogChain) {
    if (catalogChain.rpcUrl) {
      // list tabs mirror the P-Chain's; detail pages light their list
      tabs.push(
        { label: "Blocks", href: `${base}/blocks`, isActive: (p) => p.startsWith(`${base}/block`) },
        { label: "Transactions", href: `${base}/txs`, isActive: (p) => p.startsWith(`${base}/tx`) },
        // the gas market: live half is pure RPC, so any chain with an RPC
        // earns the tab; history fills in where ClickHouse ingests the chain
        { label: "Gas", href: `${base}/gas`, isActive: (p) => p.startsWith(`${base}/gas`) },
      );
    }
    if (catalogChain.blockchainId) {
      tabs.push({
        label: "Details",
        href: `${base}/details`,
        isActive: (p) => p.startsWith(`${base}/details`),
      });
    }
    tabs.push({
      label: "Stats",
      href: `${base}/stats`,
      isActive: (p) => p.startsWith(`${base}/stats`),
    });
    if (catalogChain.isTestnet !== true) {
      // the C-Chain's validators ARE the Primary Network's, so it alone
      // also carries the staking-economics instrument as a sibling tab
      if (chainSlug === "c-chain") {
        tabs.push({
          label: "Staking",
          href: `${base}/staking`,
          isActive: (p) => p.startsWith(`${base}/staking`),
        });
      }
      tabs.push({
        label: "Validators",
        // every chain's set lives in its own chrome — the C-Chain mounts
        // the Primary Network roster, L1s their own weight table
        href: `${base}/validators`,
        isActive: (p) => p.startsWith(`${base}/validators`),
      });
    }
    // ICM activity needs an RPC to derive cross-chain txs from
    if (catalogChain.rpcUrl) {
      tabs.push({
        label: "ICM",
        href: `${base}/icm`,
        isActive: (p) => p.startsWith(`${base}/icm`),
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
  if (pathname.endsWith("/stats")) return `/explorer/mainnet/${slug}/stats`;
  return `/explorer/mainnet/${slug}`;
}

/* Switching P-Chain networks keeps the section you're on. Entity pages
   fall back to their parent list — a block height or tx hash means
   nothing on the other network. */
function pchainNetworkTarget(network: string, chainSlug: string, pathname: string): string {
  const base = `/explorer/${network}/${chainSlug}`;
  const section = pathname.split("/").filter(Boolean)[3];
  const list =
    section === "blocks" || section === "block"
      ? "blocks"
      : section === "txs" || section === "tx"
        ? "txs"
        : section === "validators" || section === "node"
          ? "validators"
          : "";
  return list ? `${base}/${list}` : base;
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
  if (chainSlug && c && c.kind === "pchain") {
    return (
      <div className="inline-flex self-center border border-zinc-200 dark:border-zinc-800">
        {c.networks.map((n) => {
          const active = n === network;
          return (
            <Link
              key={n}
              href={pchainNetworkTarget(n, chainSlug, pathname)}
              className={cn(
                "px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-3",
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
  if (!chainSlug) {
    // the network scope aggregates mainnet only — a static label, no toggle
    return (
      <span className="hidden self-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 sm:block dark:text-zinc-500">
        Mainnet
      </span>
    );
  }

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
              "px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-3",
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
    // sticky just below the global navbar (h-14 + banner), riding every
    // shell: only this rail pins — the page header below scrolls away.
    // Negative margins bleed the surface across the shells' px-5/px-6 so
    // content never peeks past its edges; z-[45] keeps it (and the chain
    // switcher's dropdown) above the stats pages' sticky bars (z-40).
    <div
      className={cn(
        "sticky top-[calc(var(--fd-banner-height,0px)+3.5rem)] z-[45] -mx-5 flex items-stretch justify-between gap-x-6 border-b border-zinc-200 bg-white/85 px-5 backdrop-blur-[12px] md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/85",
        className,
      )}
    >
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
                  {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--chain-accent,#E6212F)]" />}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <div className="flex shrink-0 items-stretch gap-x-2 sm:gap-x-3">
        {/* the page clock: appears only when something below actually
            listens to it, and then drives every stat on the page at once */}
        <ExplorerRangeControl />
        <NetworkControl network={network} chainSlug={chainSlug} pathname={pathname} />
      </div>
    </div>
  );
}
