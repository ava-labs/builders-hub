"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import { toStatsChainId } from "@/lib/dedicated-stats";
import { L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useLiveValidatorCounts, useIndexedChainIds } from "@/components/explorer-v2/validator-stats";
import { MAINNET_COUNTERPART, TESTNET_COUNTERPART, isUnindexedChain, resolveCatalogChain, wantsTestnet } from "@/lib/explorer-catalog";
import { isPrivateChain } from "@/components/explorer-v2/network/private";
import { ExplorerRangeControl, useRangeConsumersPresent } from "@/components/explorer-v2/time-range";
import { NavbarSlot } from "@/components/explorer-v2/navbar-slot";
import { QueryTab } from "@/components/explorer-v2/evm/QueryTab";
import { VIEW_SWITCH } from "@/components/explorer-v2/view-switch";
import { buildTabs, type Tab } from "@/components/explorer-v2/subnav-tabs";
import { chainSwitchTarget, switchTarget } from "@/components/explorer-v2/network-switch";
import {
  NETWORK_LABEL,
  getExplorerChain,
  hasRealChainLogo,
  type PchainNetwork,
} from "@/lib/pchain-explorer";

/* ------------------------------------------------------------------ */
/* The explorer's subnav rail, shared by every shell (P-Chain, per-L1,  */
/* directory): a chain switcher on the left, section tabs with a red    */
/* active bar in the middle, the network at the right edge. Below 640   */
/* px the switcher moves into the site navbar (NavbarSlot), with the    */
/* network in its menu, and the rail keeps the tabs and the clock. This is */
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
};

interface ExplorerSubnavProps {
  /** route network segment; defaults to mainnet */
  network?: string;
  /** current chain slug; omit for the network scope (All Networks pages) */
  chainSlug?: string;
  chainName?: string;
  chainLogoURI?: string;
  /** the page switches networks itself, as the Chains app's list does */
  hideNetwork?: boolean;
  /** classes for the page clock, such as hiding it where the page draws its own */
  rangeClassName?: string;
  className?: string;
}

/* Chain switcher: the dropdown that holds the whole ecosystem. The two
   system chains are pinned; the L1 list is validated against the P-Chain
   (a chain appears only if its subnet has stake-backed validators right
   now), fetched lazily the first time the menu opens. A row keeps the
   reader's tab where its chain has it (chainSwitchTarget). In the phone
   navbar (inNavbar) the button names the chain with the network under it,
   and the menu leads with the network control (networkRow). */
function ChainSwitcher({
  network,
  chainSlug,
  chainName,
  chainLogoURI,
  pathname,
  inNavbar = false,
  caption,
  networkRow,
  className,
}: {
  network: string;
  chainSlug?: string;
  chainName?: string;
  chainLogoURI?: string;
  pathname: string;
  inNavbar?: boolean;
  /** the network, under the chain name in the phone navbar */
  caption?: string;
  /** the network control, at the top of the menu in the phone navbar */
  networkRow?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const label = (chainSlug === "c-chain" ? "C-Chain" : chainName) ?? "All Networks";
  const captionId = useId();

  // a network switch in the menu changes the page: close the menu with it
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // validate lazily, on first open (the shared feed dedupes the request)
  const { live: liveValidators, failed: feedFailed } = useLiveValidatorCounts("mainnet", open);
  const indexedChainIds = useIndexedChainIds(open);

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

  const pinned: SwitcherEntry[] = [
    { slug: "all-networks", name: "All Networks" },
    { slug: "c-chain", name: "C-Chain", logo: cChain?.chainLogoURI },
    { slug: "p-chain", name: "P-Chain", logo: PCHAIN_LOGO },
    { slug: "x-chain", name: "X-Chain", logo: XCHAIN_LOGO },
  ];

  const l1s = useMemo<SwitcherEntry[] | null>(() => {
    const mainnet = (l1ChainsData as L1Chain[]).filter(
      (c) => c.isTestnet !== true && c.slug !== "c-chain",
    );

    if (indexedChainIds) {
      const picked = mainnet
        .filter((c) => indexedChainIds.has(toStatsChainId(String(c.chainId))))
        .sort(
          (a, b) =>
            ((a.subnetId && liveValidators?.get(a.subnetId)) ?? 0) <
            ((b.subnetId && liveValidators?.get(b.subnetId)) ?? 0)
              ? 1
              : -1,
        );
      return picked.map((c) => ({
        slug: c.slug,
        name: c.chainName,
        logo: c.chainLogoURI,
      }));
    }

    const all = mainnet.filter((c) => c.rpcUrl && hasRealChainLogo(c.chainLogoURI));
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
    }));
  }, [liveValidators, feedFailed, indexedChainIds]);

  const q = filter.trim().toLowerCase();
  const matches = (e: SwitcherEntry) => !q || e.name.toLowerCase().includes(q) || e.slug.includes(q);
  const pinnedShown = pinned.filter(matches);
  const l1sShown = l1s?.filter(matches);

  const row = (entry: SwitcherEntry) => {
    const href = chainSwitchTarget(pathname, chainSlug, network, entry.slug === "all-networks" ? undefined : entry.slug);
    // the row of the chain on screen (on Fuji, Beam's row too) links to this page; a tap keeps the
    // page as it is, query string included, and only closes the menu
    const current = href === pathname;
    return (
      <Link
        key={entry.slug}
        href={href}
        aria-current={current ? "page" : undefined}
        onClick={(e) => {
          if (current) e.preventDefault();
          setOpen(false);
        }}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        {entry.slug === "all-networks" ? (
          /* the mark rides the theme, not the brand red: CSS fill beats the
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
    <div ref={rootRef} className={cn("relative flex shrink-0 items-stretch", inNavbar && "min-w-0 shrink", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={inNavbar && caption ? captionId : undefined}
        onClick={() => {
          setOpen((v) => !v);
          setFilter("");
        }}
        className={cn("group flex items-center text-left", inNavbar ? "min-w-0 gap-1.5 py-2 pr-0.5" : "gap-2.5 pr-1")}
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
        {inNavbar ? (
          // the network rides under the name: it describes the button rather than naming it, so the button's
          // name stays the chain and assistive tech still reads the network
          <span className="flex min-w-0 flex-col leading-tight">
            {/* tighter than the rail's label, so ALL NETWORKS fits beside the logo from a 320 px phone */}
            <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-900 max-[359px]:text-[9px] max-[359px]:tracking-normal dark:text-zinc-100">
              {label}
            </span>
            {caption && (
              <span id={captionId} aria-hidden className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                {caption}
              </span>
            )}
          </span>
        ) : (
          <span className="block truncate font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 sm:max-w-40 md:max-w-56 dark:text-zinc-100">
            {label}
          </span>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100" />
      </button>

      {open && (
        // z-50 within the subnav's own stacking context (the z-[35] rail):
        // only needs to clear siblings inside the rail, not the page
        <div
          role="dialog"
          aria-label="Switch chain"
          className="absolute left-0 top-full z-50 w-[min(20rem,calc(100vw-2.5rem))] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {networkRow && (
            // a tap on either network closes the menu, the current one too, which changes no page
            <div
              onClick={(e) => {
                if ((e.target as Element).closest("a")) setOpen(false);
              }}
              className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Network
              </span>
              {networkRow}
            </div>
          )}
          <div className="relative border-b border-zinc-100 dark:border-zinc-900">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter chains"
              spellCheck={false}
              // on a phone the keyboard would cover the list the reader came to tap
              autoFocus={!inNavbar}
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
        </div>
      )}
    </div>
  );
}

/* A tab names what it opens: its page switches form at 1024 px (NetworkChains
   draws the city from min-width 1024px, the chains list below it), so the label
   switches at the same width, in CSS, and never names the other form. */
function tabText(tab: Tab): React.ReactNode {
  if (!tab.phone) return tab.label;
  return (
    <>
      <span className="lg:hidden">{tab.phone}</span>
      <span className="hidden lg:inline">{tab.label}</span>
    </>
  );
}

/* Counterparts that exist but aren't explorable yet: the toggle stays
   visible so the network is discoverable, but the segment is disabled and
   says why. Move an entry up into TESTNET_COUNTERPART when its indexing
   comes online. */
const UNAVAILABLE_TESTNET: Record<string, string> = {};

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
              href={switchTarget(pathname, chainSlug, n, chainSlug)}
              // the current network is named to assistive tech too, not by colour alone
              aria-current={active ? "page" : undefined}
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
    // A label, not a toggle: the network-scope aggregates are mainnet-only, so
    // there is nowhere to switch to. It still has to name the network actually
    // being viewed: a single message is network-agnostic and can be a Fuji one.
    return (
      <span className="self-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        {NETWORK_LABEL[network as PchainNetwork] ?? network}
      </span>
    );
  }

  // EVM chain with a verified Fuji counterpart: a real toggle.
  // Which network we are on comes from the route, not the slug: a pair shares
  // one slug, so `chainSlug in MAINNET_COUNTERPART` is true on both sides.
  const isTestnetChain = wantsTestnet(network);
  const other = TESTNET_COUNTERPART[chainSlug] ?? MAINNET_COUNTERPART[chainSlug];
  if (other) {
    const slugIsTestnet =
      chainSlug in TESTNET_COUNTERPART && chainSlug in MAINNET_COUNTERPART
        ? isTestnetChain
        : chainSlug in MAINNET_COUNTERPART;
    const mainnetSlug = slugIsTestnet ? other : chainSlug;
    const testnetSlug = slugIsTestnet ? chainSlug : other;
    const segments = [
      { label: "Mainnet", network: "mainnet", slug: mainnetSlug, active: !isTestnetChain },
      { label: "Fuji", network: "fuji", slug: testnetSlug, active: isTestnetChain },
    ];
    return (
      <div className="inline-flex self-center border border-zinc-200 dark:border-zinc-800">
        {segments.map((seg) => (
          <Link
            key={seg.label}
            href={switchTarget(pathname, chainSlug, seg.network, seg.slug)}
            aria-current={seg.active ? "page" : undefined}
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
    <span className="self-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
      {NETWORK_LABEL[network as PchainNetwork] ?? network}
    </span>
  );
}

export function ExplorerSubnav({
  network = "mainnet",
  chainSlug,
  chainName,
  chainLogoURI,
  hideNetwork = false,
  rangeClassName,
  className,
}: ExplorerSubnavProps) {
  const pathname = usePathname();
  const tabs = useMemo(() => buildTabs(network, chainSlug), [network, chainSlug]);
  const inert = useMemo(() => isUnindexedChain(network, chainSlug), [network, chainSlug]);
  const shut = useMemo(() => isPrivateChain(resolveCatalogChain(network, chainSlug)), [network, chainSlug]);

  // the tab rail scrolls when the inventory outgrows the row: the edge
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
  // phones: with no clock the right group holds nothing, so it leaves the rail and takes no gap from the tabs
  const clock = useRangeConsumersPresent();
  const railMask = useMemo(() => {
    if (!rail.left && !rail.right) return undefined;
    const mask = `linear-gradient(to right, ${
      rail.left ? "transparent 0, black 28px" : "black 0"
    }, ${rail.right ? "black calc(100% - 28px), transparent 100%" : "black 100%"})`;
    return { WebkitMaskImage: mask, maskImage: mask } as React.CSSProperties;
  }, [rail]);

  return (
    // sticky just below the global navbar (h-14 + banner), riding every
    // shell: only this rail pins; the page header below scrolls away.
    // Negative margins bleed the surface across the shells' px-5/px-6 so
    // content never peeks past its edges; z-[35] clears the page-level
    // sticky bars (z-30) but stays UNDER the global navbar (#nd-nav, z-40)
    // so its dropdown menus paint over this rail, not behind it.
    // Below sm the chain switcher sits in the site navbar, with the network
    // in its menu: the rail keeps the tabs, which scroll, and the clock,
    // which stays at the right edge.
    <>
    <NavbarSlot>
      <ChainSwitcher
        inNavbar
        network={network}
        chainSlug={chainSlug}
        chainName={chainName}
        chainLogoURI={chainLogoURI}
        pathname={pathname}
        caption={hideNetwork ? undefined : (NETWORK_LABEL[network as PchainNetwork] ?? network)}
        networkRow={hideNetwork ? undefined : <NetworkControl network={network} chainSlug={chainSlug} pathname={pathname} />}
      />
    </NavbarSlot>
    <div data-explorer-subnav
      className={cn(
        "sticky top-[calc(var(--fd-banner-height,0px)+3.5rem)] z-[35] -mx-5 flex flex-wrap items-stretch justify-between gap-x-4 border-b border-zinc-200 bg-white/85 px-5 backdrop-blur-[12px] max-sm:flex-nowrap md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/85",
        className,
      )}
    >
      <div className="flex min-w-0 items-stretch gap-x-2.5 max-sm:flex-1 sm:gap-x-4 md:gap-x-5">
        <ChainSwitcher
          className="max-sm:hidden"
          network={network}
          chainSlug={chainSlug}
          chainName={chainName}
          chainLogoURI={chainLogoURI}
          pathname={pathname}
        />
        {tabs.length > 0 && <div className="my-3.5 w-px shrink-0 bg-zinc-200 max-sm:hidden dark:bg-zinc-800" />}
        {tabs.length > 0 && (
          <nav
            ref={railRef}
            aria-label="Explorer sections"
            onScroll={onRailScroll}
            style={railMask}
            className="scrollbar-hide flex items-stretch gap-x-2 overflow-x-auto sm:gap-x-4 md:gap-x-5"
          >
            {tabs.map((tab) => {
              const active = tab.isActive(pathname);
              const cls = cn(
                "relative flex shrink-0 items-center py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors sm:tracking-[0.12em]",
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
                    title={shut ? "A private L1: its data is not public" : "This chain isn't indexed yet"}
                    className={cn(cls, "cursor-not-allowed text-zinc-300 dark:text-zinc-700")}
                  >
                    {tabText(tab)}
                  </span>
                );
              }

              if (tab.query && chainSlug) {
                return (
                  <QueryTab
                    key={tab.label}
                    network={network}
                    chainSlug={chainSlug}
                    href={tab.href}
                    label={tab.label}
                    className={cls}
                    bar={bar}
                    active={active}
                  />
                );
              }

              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  transitionTypes={tab.view ? VIEW_SWITCH : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cls}
                >
                  {tabText(tab)}
                  {bar}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <div className={cn("flex shrink-0 items-stretch gap-x-3", !clock && "max-sm:hidden")}>
        {/* the page clock: appears only when something below actually
            listens to it, and then drives every stat on the page at once */}
        <ExplorerRangeControl className={rangeClassName} />
        {!hideNetwork && (
          <div className="flex max-sm:hidden">
            <NetworkControl network={network} chainSlug={chainSlug} pathname={pathname} />
          </div>
        )}
      </div>
    </div>
    </>
  );
}
