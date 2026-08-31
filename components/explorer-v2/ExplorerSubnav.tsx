"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useLiveValidatorCounts } from "@/components/explorer-v2/validator-stats";
import { isUnindexedChain } from "@/lib/explorer-catalog";
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
const XCHAIN_LOGO =
  "https://images.ctfassets.net/gcj8jwzm6086/5xiGm7IBR6G44eeVlaWrxi/1b253c4744a3ad21a278091e3119feba/xchain-square.svg";

const cChain = (l1ChainsData as L1Chain[]).find((c) => c.slug === "c-chain");

function systemChainLogo(slug?: string): string | undefined {
  if (slug === "p-chain") return PCHAIN_LOGO;
  if (slug === "x-chain") return XCHAIN_LOGO;
  return undefined;
}

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
    {
      slug: "x-chain",
      name: "Exchange Chain",
      logo: XCHAIN_LOGO,
      href: `/explorer/${pchainNetwork}/x-chain`,
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
          (systemChainLogo(chainSlug) ?? chainLogoURI) && (
            <img
              src={systemChainLogo(chainSlug) ?? chainLogoURI}
              alt=""
              className="h-5 w-5 shrink-0 rounded-full object-contain"
            />
          )
        )}
        {/* below sm the name would starve the section tabs — the mark and
            chevron carry the switcher, the page header names the surface */}
        <span className="hidden truncate font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 sm:block sm:max-w-40 md:max-w-56 dark:text-zinc-100">
          {(chainSlug === "c-chain" ? "C-Chain" : chainName) ?? "All Networks"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100" />
      </button>

      {open && (
        // z-50 within the subnav's own stacking context (the z-[35] rail):
        // only needs to clear siblings inside the rail, not the page
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
        label: "Stablecoins",
        href: `${NETWORK_HOME}/stablecoins`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/stablecoins`),
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
    // the staking + L1-economy feeds are mainnet-only AND P-chain-only —
    // the X-chain shares this kind (Overview/Blocks/Transactions) but has
    // no staking surfaces
    if (network === "mainnet" && chainSlug === "p-chain") {
      tabs.push(
        {
          label: "Staking",
          href: `${base}/staking`,
          isActive: (p) => p.startsWith(`${base}/staking`),
        },
        // the OTHER validator economy: ACP-77 seats burn where staking
        // mints — different money, different tab
        {
          label: "L1s",
          href: `${base}/l1s`,
          isActive: (p) => p.startsWith(`${base}/l1s`),
        },
      );
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
        { label: "Transactions", href: `${base}/txs`, isActive: (p) => p.startsWith(`${base}/tx`) && !p.startsWith(`${base}/atomic`) },
        // the gas market: live half is pure RPC, so any chain with an RPC
        // earns the tab; history fills in where ClickHouse ingests the chain
        { label: "Gas", href: `${base}/gas`, isActive: (p) => p.startsWith(`${base}/gas`) },
      );
      // cross-chain (shared-memory) txs exist only on the C-Chain — they ride
      // in blockExtraData, invisible to eth_*, hence their own tab
      if (chainSlug === "c-chain") {
        tabs.push({
          label: "Atomic",
          href: `${base}/atomic`,
          isActive: (p) => p.startsWith(`${base}/atomic`),
        });
      }
    }
    // who's on the chain: population charts for every catalog chain,
    // leaderboards where ClickHouse ingests it
    tabs.push({
      label: "Accounts",
      href: `${base}/accounts`,
      isActive: (p) => p.startsWith(`${base}/accounts`),
    });
    if (catalogChain.blockchainId) {
      tabs.push({
        label: "Details",
        href: `${base}/details`,
        isActive: (p) => p.startsWith(`${base}/details`),
      });
    }
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
  // Intentionally empty: every previous pair pointed at a chain the explorer
  // doesn't index, so the toggle only led to empty pages. (Fuji P-chain is
  // unaffected — the P-chain switcher is a separate code path.) Re-add pairs
  // here as their testnet indexing comes online:
  //   "c-chain": "avalanche-c-chain", // 43114 ↔ 43113 — Fuji EVM indexer stopped
  //   beam: "beam-l1",                // 4337 ↔ 13337 — Fuji side not indexed
  //   dexalot: "dexalot-l1",          // 432204 ↔ 432201 — neither side indexed
};
const MAINNET_COUNTERPART: Record<string, string> = Object.fromEntries(
  Object.entries(TESTNET_COUNTERPART).map(([m, t]) => [t, m]),
);

/* Counterparts that exist but aren't explorable yet: the toggle stays
   visible so the network is discoverable, but the segment is disabled and
   says why. Move an entry up into TESTNET_COUNTERPART when its indexing
   comes online. */
const UNAVAILABLE_TESTNET: Record<string, string> = {
  "c-chain":
    "We're having trouble indexing the Fuji C-Chain right now — it'll be available later.",
};

/* Crossing networks keeps the section when the counterpart has it: an
   accounts page lands on the counterpart's accounts, everything else
   lands on its explorer overview. */
function counterpartTarget(slug: string, pathname: string): string {
  if (pathname.endsWith("/accounts")) return `/explorer/mainnet/${slug}/accounts`;
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
                "px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-2.5",
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
              "px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-2.5",
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

  // Counterpart exists but isn't indexed yet: Mainnet stays live, Fuji shows
  // as a disabled segment that explains itself instead of vanishing.
  const unavailableNote = UNAVAILABLE_TESTNET[chainSlug];
  if (unavailableNote) {
    return (
      <div className="inline-flex self-center border border-zinc-200 dark:border-zinc-800">
        <span className="bg-zinc-900 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-50 sm:px-2.5 dark:bg-zinc-50 dark:text-zinc-900">
          Mainnet
        </span>
        <span
          role="link"
          aria-disabled="true"
          title={unavailableNote}
          className="inline-flex cursor-not-allowed items-center gap-1.5 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 sm:px-2.5 dark:text-zinc-600"
        >
          Fuji
          <span className="font-medium normal-case tracking-normal text-zinc-400 dark:text-zinc-500">soon</span>
        </span>
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
  const inert = useMemo(() => isUnindexedChain(network, chainSlug), [network, chainSlug]);

  // the tab rail scrolls when the inventory outgrows the row — the edge
  // fades say so (a hard clip reads as "there is no ICM tab"). The mask
  // tracks scroll position, so each side only fades while more tabs
  // actually sit beyond it.
  const railRef = useRef<HTMLElement>(null);
  const [rail, setRail] = useState({ left: false, right: false });
  const measureRail = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setRail((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => {
    measureRail();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measureRail);
    ro.observe(el);
    window.addEventListener("resize", measureRail);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureRail);
    };
  }, [measureRail, tabs]);
  const onRailScroll = measureRail;
  const railMask = useMemo(() => {
    if (!rail.left && !rail.right) return undefined;
    const mask = `linear-gradient(to right, ${
      rail.left ? "transparent 0, black 28px" : "black 0"
    }, ${rail.right ? "black calc(100% - 28px), transparent 100%" : "black 100%"})`;
    return { WebkitMaskImage: mask, maskImage: mask } as React.CSSProperties;
  }, [rail]);

  return (
    // sticky just below the global navbar (h-14 + banner), riding every
    // shell: only this rail pins — the page header below scrolls away.
    // Negative margins bleed the surface across the shells' px-5/px-6 so
    // content never peeks past its edges; z-[35] clears the page-level
    // sticky bars (z-30) but stays UNDER the global navbar (#nd-nav, z-40)
    // so its dropdown menus paint over this rail, not behind it.
    <div
      className={cn(
        "sticky top-[calc(var(--fd-banner-height,0px)+3.5rem)] z-[35] -mx-5 flex items-stretch justify-between gap-x-4 border-b border-zinc-200 bg-white/85 px-5 backdrop-blur-[12px] md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/85",
        className,
      )}
    >
      <div className="flex min-w-0 items-stretch gap-x-3 sm:gap-x-4 md:gap-x-5">
        <ChainSwitcher network={network} chainSlug={chainSlug} chainName={chainName} chainLogoURI={chainLogoURI} />
        {tabs.length > 0 && <div className="my-3.5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />}
        {tabs.length > 0 && (
          <nav
            ref={railRef}
            aria-label="Explorer sections"
            onScroll={onRailScroll}
            style={railMask}
            className="scrollbar-hide flex items-stretch gap-x-3 overflow-x-auto sm:gap-x-4 md:gap-x-5"
          >
            {tabs.map((tab) => {
              const active = tab.isActive(pathname);
              const cls = cn(
                "relative flex shrink-0 items-center py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
                active
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100",
              );
              const bar = active && (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--chain-accent,#E6212F)]" />
              );

              if (inert) {
                return (
                  <span
                    key={tab.label}
                    aria-disabled
                    title="This chain isn't indexed yet"
                    className={cn(cls, "cursor-not-allowed text-zinc-300 dark:text-zinc-700")}
                  >
                    {tab.label}
                  </span>
                );
              }

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cls}
                >
                  {tab.label}
                  {bar}
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
