"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Component, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpDown, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, PanelLeftOpen, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { EntityHitRow, looksLikeIdentifier, useSearchEntity, type EntityTargets } from "@/components/explorer-v2/chain-search";
import { canAskPhrase, looksLikeQuestion } from "@/lib/explorer-query/ask";
import { classifyLocally } from "@/lib/pchain-explorer";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { DISTRICT_GLASS, GroundKey, Logo, TONE, Tower, mixTotal, pctInk, type CameraHandle, type CityData, type Inset, type Node, type VersionMix } from "@/components/explorer-v2/network/icm-map";
import { DISTRICTS, districtAbout, districtLabel, type District } from "@/components/explorer-v2/network/districts";
import { NEW_DAYS } from "@/components/explorer-v2/network/newcomers";
import { RANGE_DAYS, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { useChainPulse } from "@/components/explorer-v2/network/chain-pulse";
import { ValidatorList, blockchainIdOf } from "@/components/explorer-v2/network/chain-quick-info";
import { ChainLive, useClock, type LiveTarget, type LiveTip } from "@/components/explorer-v2/network/chain-live";
import { PChainLive } from "@/components/explorer-v2/network/pchain-live";
import { PCHAIN_PICK } from "@/components/explorer-v2/network/city-model";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { toStatsChainId } from "@/lib/dedicated-stats";
import type { L1Chain } from "@/types/stats";

/* The Chains page as one app, and the explorer's front door: the city is
   the canvas, and everything a builder needs from a list of chains lives
   in it. The explorer's search stands over the city's top, its chips
   under it cutting the city to what they name. A panel at the left holds
   the directory, a district when the camera is in one, and a chain when
   one is open: its figures, its links, and one click into a wallet; it
   stays shut until one of those is asked for, so the city opens whole.
   The figures stand in a strip at the city's foot, and a key in the top
   corner names what the heights, the windows, the lights and the streets
   show.
   Phones get the same city as a district browser, with the chain in a
   sheet: no canvas to load. The open chain and district ride the URL, so
   a link opens them. */

const REQUEST_LISTING_URL = "https://forms.gle/N4QkRo9UR45xeTTp9";

/* the city in 3D: WebGL, loaded only when the view is asked for */
const City3D = dynamic(() => import("@/components/explorer-v2/network/city3d/City3D"), { ssr: false });

/* where the box sends an identifier: the pages the network search sends it to */
const SEARCH_TARGETS: EntityTargets = {
  network: "mainnet",
  blockBase: "/explorer/mainnet/p-chain",
  blockChainName: "P-Chain",
  evmAddressBase: "/explorer/mainnet/c-chain",
  evmAddressChainName: "C-Chain",
};
/* a question opens the network's Query page, which answers from the chain it names */
const ASK_AT = "/explorer/mainnet/query";

type Net = "mainnet" | "testnet";
/** what a chip, or a figure in the strip, cuts the list to */
type Cut = "talking" | "live" | "behind" | "new" | null;
type Sort = "district" | "validators" | "tx" | "icm" | "name";
/** what the windows show: each district's glass, or the validators' client versions */
type Lens = "districts" | "versions";
/** what a building's height counts */
export type Height = "validators" | "messages";
/** AVAX in the market: its price, its day's change in percent, and its market cap, all in USD */
export interface Market {
  price: number;
  change24h: number | null;
  marketCap: number | null;
}
/** AVAX's supply cap, for the fully diluted value */
const AVAX_CAP = 720_000_000;

/** one chain in the app's lists: its building when the city stands it, its catalog entry when there is one */
export interface Row {
  id: string;
  name: string;
  logo: string;
  /** null for downtown, and for a chain the city does not stand */
  district: District | null;
  node: Node | null;
  chain: L1Chain | null;
  validators: number;
  mix: VersionMix | null;
  pct: number | null;
  tx: number | null;
  out: number;
  in: number;
  newAt: number | null;
  /** when it last made a block, ms, read from its public RPC; null when it has none that answers */
  lastBlockAt: number | null;
}

const SORTS: { v: Sort; label: string }[] = [
  { v: "district", label: "District" },
  { v: "validators", label: "Validators" },
  { v: "tx", label: "Transactions" },
  { v: "icm", label: "ICM messages" },
  { v: "name", label: "Name" },
];

const districtRank = (d: District | null) => (d === null ? -1 : DISTRICTS.findIndex((x) => x.key === d));
const pctOf = (m: VersionMix | null) => {
  const known = m ? m.on + m.near + m.stale : 0;
  return m && known > 0 ? Math.round((m.on / mixTotal(m)) * 100) : null;
};

/* ------------------------------------------------------------------ */
/* small parts                                                         */
/* ------------------------------------------------------------------ */

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400", className)}>{children}</p>;
}

function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/* a chain's logo at any size, with its initial when it has none */
function BigLogo({ uri, name, size = 44 }: { uri: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size };
  if (!uri || broken) {
    return (
      <span style={box} className="flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 font-mono text-[15px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        {name.charAt(0)}
      </span>
    );
  }
  return <img src={uri} alt="" style={box} onError={() => setBroken(true)} className="shrink-0 rounded-full bg-white object-contain ring-1 ring-zinc-200 dark:ring-zinc-800" />;
}

/* a hex color mixed toward another, by t */
const mixHex = (a: string, b: string, t: number) => {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t).toString(16).padStart(2, "0")).join("")}`;
};
/* a district's glass as a miniature's faces, lit from the left */
const districtPaint = (glass: string) => ({ top: mixHex(glass, "#ffffff", 0.45), left: glass, right: mixHex(glass, "#000000", 0.2), edge: mixHex(glass, "#000000", 0.45) });

/* a set's building in miniature, painted as the city paints it: its district's glass, or its versions under the Versions lens */
function MiniBuilding({ validators, max, mix, hub, district }: { validators: number; max: number; mix: VersionMix | null; hub: boolean; district: District | null }) {
  const w = 7;
  const box = 30;
  const d = w * 0.5;
  const h = validators > 0 ? 4 + 20 * Math.pow(validators / Math.max(1, max), 0.4) : 2;
  const paint = hub ? null : districtPaint(DISTRICT_GLASS[district ?? "frontier"]);
  return (
    <svg width={18} height={box} viewBox={`0 0 18 ${box}`} className="shrink-0 overflow-visible" aria-hidden>
      <Tower x={9} y={box - d - 1} w={w} h={h} tone={hub ? "red" : "gray"} mix={mix && mix.on + mix.near + mix.stale > 0 ? mix : null} paint={paint} />
    </svg>
  );
}

/* a value to copy; one with a P-Chain page links to it in the P-Chain's ink, and copies from its icon */
function CopyValue({ value, shown, href }: { value: string; shown?: string; href?: string }) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const done = copiedId === value;
  const icon = done ? <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover/copy:text-zinc-500 dark:text-zinc-600" />;
  if (href) {
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
        <Link href={href} title={value} className="truncate font-mono text-[11.5px] text-[#0061E2] hover:underline dark:text-[#5f9dff]">
          {shown ?? value}
        </Link>
        <button type="button" onClick={() => copyToClipboard(value, value)} aria-label={`Copy ${value}`} title="Copy" className="group/copy -m-1 shrink-0 rounded p-1">
          {icon}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(value, value)}
      title={value}
      className="group/copy inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-[11.5px] text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
    >
      <span className="truncate">{shown ?? value}</span>
      {icon}
    </button>
  );
}

function NewBadge() {
  return <span className="shrink-0 border border-[#A2AFB2] px-1 py-px font-mono text-[8px] font-bold tracking-[0.1em] text-[#5F6B7A] dark:border-[#5F6B7A] dark:text-[#A2AFB2]">NEW</span>;
}

/* the share on target, in the fleet's ink */
function Pct({ row, className }: { row: Row; className?: string }) {
  return <span className={cn("font-mono text-[10.5px] tabular-nums", pctInk(row.mix, row.pct), className)}>{row.pct === null ? "—" : `${row.pct}%`}</span>;
}

/* the open chain's newest block, its age ticking: the live pane's tip while
   the pane streams, else the chain pulse's reading, which can be minutes
   old, so past 90 s it says it is stale rather than pass for fresh */
const STALE_MS = 90_000;
function LastBlock({ live, pulseAt }: { live: LiveTip | null; pulseAt: number | null }) {
  const now = useClock();
  const at = live && (pulseAt === null || live.timestamp >= pulseAt) ? live.timestamp : pulseAt;
  if (at === null) return null;
  const fromLive = live !== null && at === live.timestamp;
  const stale = !fromLive && now - at > STALE_MS;
  return (
    <span
      className={cn("inline-flex items-baseline gap-1.5 font-mono text-[11.5px] tabular-nums", stale ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300")}
      title={
        fromLive
          ? `Block ${live.number.toLocaleString("en-US")}, read live`
          : "From the last reading of every chain's RPC, taken up to a few minutes ago; the chain may have made blocks since"
      }
    >
      {ageShort(at / 1000)} ago
      {stale && <span className="text-[9px] font-bold uppercase tracking-[0.14em]">stale</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* the lists                                                           */
/* ------------------------------------------------------------------ */

function RowButton({ row, metric, painted, on, onOpen, onHover }: { row: Row; metric: string; painted: boolean; on: boolean; onOpen: () => void; onHover?: (id: string | null) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={() => onHover?.(row.node ? row.id : null)}
        onMouseLeave={() => onHover?.(null)}
        aria-pressed={on}
        className={cn(
          "flex w-full items-center gap-2.5 px-4 py-[6px] text-left transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-900",
          on && "bg-[#0061E2]/[0.07] dark:bg-[#5b9bff]/10",
        )}
      >
        <Logo uri={row.logo} name={row.name} />
        <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "text-[#0061E2] dark:text-[#5f9dff]" : "text-zinc-800 dark:text-zinc-200")}>
          {row.node?.role === "hub" ? "C-Chain" : row.name}
        </span>
        {row.newAt !== null && <NewBadge />}
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-zinc-400 dark:text-zinc-500">{metric}</span>
        {painted && <Pct row={row} className="w-8 shrink-0 text-right" />}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* a chain, opened                                                     */
/* ------------------------------------------------------------------ */

function ChainView({
  row,
  target,
  windowShort,
  explorerOf,
  partner,
  onBack,
  backLabel,
  onDistrict,
  onPartner,
  liveTip,
}: {
  row: Row;
  target: string;
  windowShort: string;
  explorerOf: (c: L1Chain) => string | null;
  partner: { row: Row; messages: number } | null;
  onBack?: () => void;
  backLabel: string;
  onDistrict?: (d: District) => void;
  onPartner: (row: Row) => void;
  /** the chain's newest block from its live pane, while the pane streams */
  liveTip: LiveTip | null;
}) {
  const c = row.chain;
  const hub = row.node?.role === "hub";
  const guest = row.node?.guest ?? false;
  const explorer = c ? explorerOf(c) : null;
  const evmId = c && /^\d+$/.test(String(c.chainId)) ? Number(c.chainId) : undefined;
  // the wallet asks the RPC for its chain ID when the catalog has none; a chain the catalog marks non-EVM has no wallet
  const canAdd = Boolean(c?.rpcUrl) && (c as { isEvm?: boolean } | null)?.isEvm !== false;
  const net = c?.isTestnet ? "fuji" : "mainnet";
  const pchain = c?.blockchainId ? null : row.node?.href ?? null;
  // the P-Chain's IDs as it spells them, CB58: the catalog's, else the registry's
  const subnetId = c?.subnetId || row.node?.subnetId || null;
  const blockchainId = (c ? blockchainIdOf(c) : null) ?? row.node?.blockchainId ?? null;
  // the Primary Network has no creating tx, and its set is the whole network: its door is the P-Chain's validators page
  const primary = subnetId === PRIMARY_SUBNET_ID;
  const pBase = `/explorer/${net}/p-chain`;
  const figure = (label: string, value: ReactNode, sub?: ReactNode) => (
    <div className="flex min-w-0 flex-col gap-0.5 bg-white px-3 py-2.5 dark:bg-zinc-950">
      <dt className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="truncate font-mono text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
      {sub && <dd className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{sub}</dd>}
    </div>
  );
  const fact = (label: string, value: ReactNode) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="flex min-w-0 justify-end">{value}</dd>
    </div>
  );
  const behind = row.mix ? row.mix.near + row.mix.stale : 0;
  return (
    <div className="px-4 pb-6 pt-3">
      {onBack && <BackButton onClick={onBack}>{backLabel}</BackButton>}
      <div className="mt-3 flex items-center gap-3">
        <BigLogo uri={row.logo} name={row.name} />
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">{hub ? "C-Chain" : row.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            {hub ? (
              <span>Downtown · Primary Network</span>
            ) : row.district ? (
              onDistrict ? (
                <button type="button" onClick={() => onDistrict(row.district!)} className="text-[#0061E2] transition-opacity hover:opacity-70 dark:text-[#5f9dff]">
                  {districtLabel(row.district)}
                </button>
              ) : (
                <span>{districtLabel(row.district)}</span>
              )
            ) : (
              <span>{c?.isTestnet ? "Fuji" : "Not in the city"}</span>
            )}
            {c?.category && !hub && c.category.toLowerCase() !== (row.district ? districtLabel(row.district).toLowerCase() : "") && <span>· {c.category}</span>}
            {row.newAt !== null && <NewBadge />}
          </p>
        </div>
      </div>
      {c?.description && <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{c.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {canAdd && c?.rpcUrl && (
          <AddToWalletButton rpcUrl={c.rpcUrl} chainName={c.chainName} chainId={evmId} tokenSymbol={c.networkToken?.symbol} className="h-9 flex-1 rounded-xl! px-3! text-[13px]!" />
        )}
        {explorer && (
          <Link
            href={explorer}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-[13px] font-semibold text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Explorer
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {!explorer && guest && pchain && (
          <Link
            href={pchain}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#0061E2]/30 px-3 text-[13px] font-semibold text-[#0061E2] transition-colors hover:bg-[#0061E2]/5 dark:border-[#5f9dff]/40 dark:text-[#5f9dff]"
          >
            Open on the P-Chain
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {(row.node || row.validators > 0) && (
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          {figure("Validators", row.validators.toLocaleString("en-US"), behind > 0 ? `${behind} behind ${target}` : undefined)}
          {figure(`On ${target}+`, row.pct === null ? "—" : <span className={pctInk(row.mix, row.pct)}>{row.pct}%</span>, row.mix ? `${row.mix.on} of ${mixTotal(row.mix)} nodes` : "not reported")}
          {figure(`Tx · ${windowShort}`, row.tx === null ? "—" : fmtCompact(row.tx))}
          {figure(`ICM · ${windowShort}`, row.out + row.in > 0 ? fmtCompact(row.out + row.in) : "0", row.out + row.in > 0 ? `${fmtCompact(row.out)} out · ${fmtCompact(row.in)} in` : undefined)}
        </dl>
      )}
      {partner && (
        <button
          type="button"
          onClick={() => onPartner(partner.row)}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Most with</span>
          <Logo uri={partner.row.logo} name={partner.row.name} />
          <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-800 dark:text-zinc-100">{partner.row.node?.role === "hub" ? "C-Chain" : partner.row.name}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{fmtCompact(partner.messages)} msgs</span>
        </button>
      )}

      <dl className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-900">
        {subnetId && fact("Subnet ID", <CopyValue value={subnetId} shown={truncate(subnetId, 8)} href={primary ? `${pBase}/validators` : `${pBase}/tx/${subnetId}`} />)}
        {blockchainId && fact("Blockchain ID", <CopyValue value={blockchainId} shown={truncate(blockchainId, 8)} href={`${pBase}/chain/${blockchainId}`} />)}
        {evmId !== undefined && fact("EVM Chain ID", <CopyValue value={String(evmId)} />)}
        {c?.networkToken?.symbol && fact("Token", <span className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">{c.networkToken.symbol}</span>)}
        {c?.rpcUrl && fact("Public RPC", <CopyValue value={c.rpcUrl} shown={c.rpcUrl.replace(/^https?:\/\//, "")} />)}
        {(liveTip !== null || row.lastBlockAt !== null) && fact("Last block", <LastBlock live={liveTip} pulseAt={row.lastBlockAt} />)}
        {c?.website &&
          fact(
            "Website",
            <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-[11.5px] text-[#0061E2] hover:underline dark:text-[#5f9dff]">
              <span className="truncate">{c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </a>,
          )}
        {c?.slug &&
          fact(
            "Accounts",
            <Link href={`/explorer/${net}/${c.slug}/accounts`} className="inline-flex items-center gap-1 font-mono text-[11.5px] text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50">
              Holders and activity
              <ArrowRight className="h-3 w-3" />
            </Link>,
          )}
        {row.newAt !== null && fact("Joined the P-Chain", <span className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">{ageShort(row.newAt)} ago</span>)}
      </dl>

      {subnetId && !primary && (
        <ValidatorList
          key={`${net}:${subnetId}`}
          network={net}
          subnetId={subnetId}
          expected={row.validators}
          allHref={explorer ? `${explorer}/validators` : blockchainId ? `${pBase}/chain/${blockchainId}` : null}
        />
      )}

      {(row.district === "frontier" || !c) && !hub && (
        <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          The directory does not describe this L1 yet, so it stands on the Frontier.{" "}
          <a href={REQUEST_LISTING_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]">
            Request a listing
          </a>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the app                                                             */
/* ------------------------------------------------------------------ */

/* the 3D city needs WebGL 2; a browser without it gets a note and the list. The probe's context is let go at once */
function hasWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/* the 3D city, fenced: if its scene throws (a GPU its shaders do not suit, a chunk that does not load), a note takes its
   room and the rest of the app stands: the search, the list, the figures. React tries the scene again after the next
   edit in development */
class SceneFence extends Component<{ inset: Inset; children: ReactNode }, { fell: boolean }> {
  state = { fell: false };
  static getDerivedStateFromError() {
    return { fell: true };
  }
  render() {
    if (!this.state.fell) return this.props.children;
    const { inset } = this.props;
    return (
      <div role="status" className="absolute inset-y-0 flex flex-col items-center justify-center gap-3 p-6" style={{ left: inset.left, right: inset.right }}>
        <p className="max-w-xs text-center text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">The 3D city stopped. The chains are in the list.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          Reload
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }
}

export function CityApp({
  data,
  height,
  onHeight,
  versions,
  target,
  targets,
  onTarget,
  range,
  windowLabel,
  windowShort,
  market,
  txOf,
  catalog,
  indexedChainIds,
  wide,
}: {
  data: CityData;
  /** what the buildings' heights count */
  height: Height;
  onHeight: (h: Height) => void;
  versions: Map<string, VersionMix> | null;
  target: string;
  targets: string[];
  onTarget: (t: string) => void;
  /** the window the city reads, the day */
  range: ExplorerRange;
  /** the window spelled out, "24 hours", and short, "24H" */
  windowLabel: string;
  windowShort: string;
  /** AVAX's price and market cap, for the strip; null until they load */
  market: Market | null;
  txOf: (chainId: string) => number | null;
  catalog: L1Chain[];
  indexedChainIds: string[] | null;
  /** a large screen: the canvas; else the district browser */
  wide: boolean;
}) {
  const [net, setNet] = useState<Net>("mainnet");
  const [query, setQuery] = useState("");
  const [cut, setCut] = useState<Cut>(null);
  const [sort, setSort] = useState<Sort>("district");
  const [inactive, setInactive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<District | null>(null);
  // the list stays shut until it is asked for: the city opens whole, and a chain or a district opens the panel by itself
  const [panelOpen, setPanelOpen] = useState(false);
  const [rowHover, setRowHover] = useState<string | null>(null);
  // the open chain's live view, shut by its close until another chain opens
  const [liveShut, setLiveShut] = useState(false);
  // the city stands in 3D; a browser without WebGL 2 gets a note in its place, with the list open
  const [webgl] = useState(hasWebGL2);
  useEffect(() => setLiveShut(false), [selected]);
  // the open chain's newest block, as its live pane streams it, by chain: a new pick starts without one
  const [liveTip, setLiveTip] = useState<(LiveTip & { id: string }) | null>(null);
  useEffect(() => setLiveTip(null), [selected]);
  const tipOf = (id: string) => (tip: LiveTip | null) => setLiveTip(tip ? { ...tip, id } : null);
  const [mapHover, setMapHover] = useState<string | null>(null);
  // where a chain was opened from, for its back button
  const [openedFrom, setOpenedFrom] = useState<"list" | "district">("list");
  const searchRef = useRef<HTMLInputElement>(null);
  /* the page scrolls on to its footer, so the app's top can pass under the
     site's sticky navbar: the chrome on the app's top edge (the search, the
     panel, the key, the live view) keeps clear of it by --under, set on the
     app without a render */
  const appRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fd-banner-height")) || 0;
      const r = el.getBoundingClientRect();
      const under = Math.max(0, Math.min(banner + 57 - r.top, r.height - 240));
      el.style.setProperty("--under", `${Math.round(under)}px`);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [wide]);
  // the map's camera, as the reader moved it: Escape takes it home before it shuts the list
  const camera = useRef<CameraHandle>(null);
  const router = useRouter();
  // a tx hash Enter is waiting on while it races every chain
  const [pending, setPending] = useState<string | null>(null);
  // the search's picks show while the box has the focus; the arrow keys walk them
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(-1);
  // the windows wear their districts' glass; the Versions lens, or the Behind cut, lights them by client version
  const [lens, setLens] = useState<Lens>("districts");
  const versionLens = lens === "versions" || cut === "behind";
  const painted = versionLens && !!versions;

  // every public chain's newest block, from its own RPC: it says which chains are live, and how busy
  const livePulse = useChainPulse();
  const lastBlockOf = (id: string) => {
    const p = livePulse?.get(id);
    return p?.ok && p.lastBlockAt ? p.lastBlockAt : null;
  };
  const indexedSet = useMemo(() => (indexedChainIds ? new Set(indexedChainIds) : null), [indexedChainIds]);
  const explorerOf = (c: L1Chain) => {
    const on = indexedSet ? indexedSet.has(toStatsChainId(String(c.chainId))) : c.isIndexed !== false;
    return on ? `/explorer/${c.isTestnet ? "fuji" : "mainnet"}/${c.slug}` : null;
  };
  const mainnetById = useMemo(() => new Map(catalog.filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c])), [catalog]);
  const bySubnet = useMemo(() => new Map(catalog.filter((c) => c.isTestnet !== true && c.subnetId).map((c) => [String(c.subnetId), c])), [catalog]);

  /* every chain the app lists: the city's sets, then the catalog's quiet mainnet chains, and Fuji's */
  const cityRows = useMemo<Row[]>(
    () =>
      data.nodes.map((n) => {
        const chain = n.guest ? bySubnet.get(n.id.slice(2)) ?? null : mainnetById.get(n.id) ?? null;
        const mix = versions?.get(n.id) ?? null;
        return {
          id: n.id,
          name: n.name,
          logo: n.logo,
          district: n.district,
          node: n,
          chain,
          validators: n.validators,
          mix,
          pct: pctOf(mix),
          tx: txOf(n.id),
          out: n.out,
          in: n.in,
          newAt: n.newAt,
          lastBlockAt: lastBlockOf(n.id),
        };
      }),
    // txOf and lastBlockOf read the feeds the page and the pulse pass in
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.nodes, versions, mainnetById, bySubnet, txOf, livePulse],
  );
  const quietRows = useMemo<Row[]>(() => {
    const standing = new Set(data.nodes.map((n) => n.id));
    return catalog
      .filter((c) => c.isTestnet !== true && !standing.has(String(c.chainId)))
      .map((c) => ({ id: String(c.chainId), name: c.chainName, logo: c.chainLogoURI ?? "", district: null, node: null, chain: c, validators: 0, mix: null, pct: null, tx: txOf(String(c.chainId)), out: 0, in: 0, newAt: null, lastBlockAt: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, data.nodes, txOf]);
  const fujiRows = useMemo<Row[]>(
    () =>
      catalog
        .filter((c) => c.isTestnet === true)
        .map((c) => ({ id: `fuji:${c.chainId}`, name: c.chainName, logo: c.chainLogoURI ?? "", district: null, node: null, chain: c, validators: 0, mix: null, pct: null, tx: null, out: 0, in: 0, newAt: null, lastBlockAt: null })),
    [catalog],
  );
  const allRows = useMemo(() => [...cityRows, ...quietRows, ...fujiRows], [cityRows, quietRows, fujiRows]);
  const rowById = useMemo(() => new Map(allRows.map((r) => [r.id, r])), [allRows]);

  /* the list the panel shows: the network, the search, and the cut */
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const matches = (r: Row) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    String(r.chain?.chainId ?? r.id).toLowerCase().includes(q) ||
    (r.chain?.slug ?? "").includes(q) ||
    (r.chain?.category ?? "").toLowerCase().includes(q) ||
    (r.district ? districtLabel(r.district).toLowerCase().includes(q) : false) ||
    (r.node?.role === "hub" && "c-chain".includes(q));
  // live: its RPC shows a block in the last hour
  const isLive = (r: Row) => r.lastBlockAt !== null && Date.now() - r.lastBlockAt < 3_600_000;
  const cutOk = (r: Row) =>
    !cut ||
    (cut === "talking" ? r.out + r.in > 0 : cut === "live" ? isLive(r) : cut === "new" ? r.newAt !== null : r.mix ? r.mix.near + r.mix.stale > 0 : false);
  const rows = useMemo(() => {
    // a search reaches the chains the list hides, so any chain in the directory can be found
    const base =
      net === "testnet" ? fujiRows.filter((r) => inactive || q || Boolean(r.chain?.rpcUrl)) : inactive || q ? [...cityRows, ...quietRows] : cityRows;
    const value = (r: Row) => (sort === "tx" ? r.tx ?? -1 : sort === "icm" ? r.out + r.in : r.validators);
    return base
      .filter((r) => matches(r) && (net === "testnet" || cutOk(r)))
      .sort((a, b) =>
        sort === "name" || net === "testnet"
          ? a.name.localeCompare(b.name)
          : sort === "district"
            ? // the chains the city does not stand close the list
              Number(!a.node) - Number(!b.node) ||
              Number(a.district === "frontier") - Number(b.district === "frontier") ||
              districtRank(a.district) - districtRank(b.district) ||
              Number(a.newAt !== null) - Number(b.newAt !== null) ||
              b.validators - a.validators ||
              a.name.localeCompare(b.name)
            : value(b) - value(a) || a.name.localeCompare(b.name),
      );
    // matches and cutOk read the query and the cut, both listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, fujiRows, cityRows, quietRows, inactive, sort, q, cut]);

  // the city lights what the search or a cut points at, whatever network the list shows; an address or a tx names no chain, so it dims nothing
  const idShape = looksLikeIdentifier(trimmed) || !!classifyLocally(trimmed);
  const cityHits = useMemo(
    () => (q || cut ? cityRows.filter((r) => matches(r) && cutOk(r)) : null),
    // matches and cutOk read the query and the cut, both listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityRows, q, cut],
  );
  const dimmed = !!cut || (!!q && ((cityHits?.length ?? 0) > 0 || !idShape));
  const lit = useMemo(() => (dimmed && cityHits ? new Set(cityHits.map((r) => r.id)) : null), [dimmed, cityHits]);
  // each set's transactions a minute: live from its RPC where one answers, else the window's indexed count averaged; its floors flash with them
  const activity = useMemo(() => {
    const minutes = (range === "all" ? 365 : RANGE_DAYS[range]) * 1440;
    const m = new Map<string, number>();
    for (const r of cityRows) {
      const live = livePulse?.get(r.id);
      const rate = live?.ok && live.txPerMin !== null ? live.txPerMin : r.tx !== null ? r.tx / minutes : 0;
      if (rate > 0) m.set(r.id, rate);
    }
    return m;
  }, [cityRows, livePulse, range]);

  /* the figures in the strip, from the city's own sets */
  const figures = useMemo(() => {
    const vals = cityRows.reduce((a, r) => a + r.validators, 0);
    const mixes = cityRows.map((r) => r.mix).filter((m): m is VersionMix => !!m);
    const nodes = mixes.reduce((a, m) => a + mixTotal(m), 0);
    const on = mixes.reduce((a, m) => a + m.on, 0);
    const withTx = cityRows.filter((r) => r.tx !== null);
    return {
      chains: cityRows.length,
      districts: new Set(cityRows.map((r) => r.district).filter(Boolean)).size,
      validators: vals,
      onShare: nodes ? (on / nodes) * 100 : null,
      behind: cityRows.filter((r) => r.mix && r.mix.near + r.mix.stale > 0).length,
      icm: data.summary.total,
      talking: cityRows.filter((r) => r.out + r.in > 0).length,
      tx: withTx.length ? withTx.reduce((a, r) => a + (r.tx ?? 0), 0) : null,
      active: cityRows.filter((r) => (r.tx ?? 0) > 0).length,
      live: cityRows.filter(isLive).length,
      fresh: cityRows.filter((r) => r.newAt !== null).length,
    };
  }, [cityRows, data.summary]);

  /* opening and closing */
  const open = (r: Row, from: "list" | "district" = focus ? "district" : "list") => {
    setSelected(r.id);
    setOpenedFrom(from);
    // the camera flies to the chain's district; downtown and chains the city does not stand keep the camera where it is
    if (r.node && r.district) setFocus(r.district);
  };
  // a view's back button: a chain goes back to its district or to the list, a district to the list
  const back = () => {
    if (selected) {
      setSelected(null);
      if (openedFrom === "list") {
        setFocus(null);
        setPanelOpen(true);
      }
    } else if (focus) {
      setFocus(null);
      setPanelOpen(true);
    }
  };
  // Escape steps back without opening anything: a chain, a district, the search, a moved camera, then the list
  const escape = () => {
    if (selected) {
      setSelected(null);
      if (openedFrom === "list") setFocus(null);
    } else if (focus) setFocus(null);
    else if (query) setQuery("");
    else if (camera.current?.moved) camera.current.home();
    else setPanelOpen(false);
  };
  // the panel's close: the chain, the district and the list, all at once
  const shut = () => {
    setSelected(null);
    setFocus(null);
    setPanelOpen(false);
  };
  const selectedRow = selected ? rowById.get(selected) ?? null : null;
  // a mainnet chain with a feed has a live view: the C-Chain, or an L1 with a public RPC
  const liveOf = (r: Row | null): LiveTarget | null =>
    r && net === "mainnet" && (r.node?.role === "hub" || r.chain?.rpcUrl)
      ? {
          chainId: r.id,
          name: r.node?.role === "hub" ? "C-Chain" : r.name,
          logo: r.logo,
          slug: r.chain?.slug ?? null,
          symbol: r.chain?.networkToken?.symbol ?? (r.node?.role === "hub" ? "AVAX" : ""),
          explorer: r.chain ? explorerOf(r.chain) : null,
        }
      : null;
  /* a pick's urgent render is the camera's: the flight, the URL and the
     room the panels leave. The panel's chain view and the live pane's
     content follow from a deferred copy of the pick, rendered in slices
     between the flight's frames */
  const shownId = useDeferredValue(selected);
  const shownRow = shownId ? rowById.get(shownId) ?? null : null;
  const shown = shownRow !== null && shownRow.id === selectedRow?.id;
  /* the live pane's stream starts once the camera lands, so its polls and
     their renders stay out of the flight's frames; a camera that does not
     report lands by the clock */
  const liveId = liveShut ? null : liveOf(selectedRow)?.chainId ?? null;
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    setLanded(false);
    if (!liveId) return;
    let waiting = true;
    const land = () => {
      if (waiting) setLanded(true);
    };
    const clock = setTimeout(land, 2200);
    void (camera.current?.settled() ?? Promise.resolve()).then(land);
    return () => {
      waiting = false;
      clearTimeout(clock);
    };
  }, [liveId]);

  // the city's own name and mark for an L1, by its subnet, for the P-Chain's pane
  const l1BySubnet = useMemo(() => new Map(data.nodes.filter((n) => n.subnetId).map((n) => [n.subnetId as string, { name: n.name, logo: n.logo }])), [data.nodes]);
  const l1Of = (subnetId: string) => l1BySubnet.get(subnetId) ?? null;
  // a P-Chain tx under the pointer lights the tower of the L1 it acts on
  const idBySubnet = useMemo(() => new Map(data.nodes.filter((n) => n.subnetId).map((n) => [n.subnetId as string, n.id])), [data.nodes]);

  // the most talked-with set, for the open chain
  const partner = useMemo(() => {
    if (!selectedRow?.node) return null;
    const by = new Map<string, number>();
    for (const r of data.routes) {
      if (r.from !== selectedRow.id && r.to !== selectedRow.id) continue;
      const other = r.from === selectedRow.id ? r.to : r.from;
      by.set(other, (by.get(other) ?? 0) + r.messages);
    }
    const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
    const row = top ? rowById.get(top[0]) : null;
    return row && top ? { row, messages: top[1] } : null;
  }, [selectedRow, data.routes, rowById]);

  /* the URL carries the open chain and district, so a link opens them */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !data.nodes.length) return;
    restored.current = true;
    const p = new URLSearchParams(window.location.search);
    const d = p.get("district") as District | null;
    const key = p.get("chain");
    if (key === PCHAIN_PICK) {
      setSelected(PCHAIN_PICK);
      return;
    }
    if (key) {
      const r = allRows.find((x) => x.chain?.slug === key || x.id === key);
      if (r) {
        open(r, d ? "district" : "list");
        return;
      }
    }
    if (d && DISTRICTS.some((x) => x.key === d)) setFocus(d);
    // restores once, when the city first stands
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes.length]);
  useEffect(() => {
    if (!restored.current) return;
    const p = new URLSearchParams(window.location.search);
    const r = selected ? rowById.get(selected) : null;
    if (r) p.set("chain", r.chain?.slug ?? r.id);
    else if (selected === PCHAIN_PICK) p.set("chain", PCHAIN_PICK);
    else p.delete("chain");
    if (focus) p.set("district", focus);
    else p.delete("district");
    // the one view needs no name in the URL; an old link's view=model or view=3d is let go
    p.delete("view");
    const s = p.toString();
    const next = `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  }, [selected, focus, rowById]);

  /* Escape steps back; the slash key finds a chain */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
      if (e.key === "Escape") {
        if (typing && query) setQuery("");
        else if (typing) searchRef.current?.blur();
        else escape();
      } else if (e.key === "/" && !typing && wide) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const maxValidators = Math.max(1, ...cityRows.map((r) => r.validators));
  const metricOf = (r: Row) =>
    net === "testnet"
      ? r.chain?.networkToken?.symbol ?? ""
      : sort === "tx"
        ? r.tx === null
          ? "—"
          : fmtCompact(r.tx)
        : sort === "icm"
          ? r.out + r.in > 0
            ? fmtCompact(r.out + r.in)
            : "—"
          : r.validators > 0
            ? `${r.validators}`
            : "—";

  /* the explorer's search, over the city: a name, a district or a chain
     ID picks its chains, on any network; an address, a tx, a block or a
     NodeID resolves to its page, as the network search resolves it; a
     question opens Query */
  const entity = useSearchEntity(query, SEARCH_TARGETS);
  // the chains the words name: the city's first, then the directory's quiet ones, then Fuji's
  const hits = useMemo(() => {
    if (!q) return [];
    const where = (r: Row) => (r.node ? 0 : r.chain?.isTestnet ? 2 : 1);
    const name = (r: Row) => (r.node?.role === "hub" ? "c-chain" : r.name.toLowerCase());
    return allRows
      .filter(matches)
      .sort((a, b) => Number(!name(a).startsWith(q)) - Number(!name(b).startsWith(q)) || where(a) - where(b) || b.validators - a.validators || a.name.localeCompare(b.name));
    // matches reads the query, listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, q]);
  const picks = hits.slice(0, 6);
  const question = !entity && looksLikeQuestion(trimmed, { identifier: idShape, chainHit: hits.length > 0 });
  const canAsk = !entity && canAskPhrase(trimmed, idShape);
  const askHref = `${ASK_AT}?q=${encodeURIComponent(trimmed)}`;
  const go = (href: string) => {
    setQuery("");
    setPending(null);
    router.push(href);
  };
  // Enter on a tx hash that is still racing every chain lands when the race does
  useEffect(() => {
    if (!pending || !entity || entity.id !== pending) return;
    if (entity.href) go(entity.href);
    else if (entity.status === "notfound") setPending(null);
    // go only reads the router
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, entity]);
  // a picked chain opens in the panel, and the box lets go
  const pick = (r: Row) => {
    setQuery("");
    setHi(-1);
    searchRef.current?.blur();
    if (r.chain?.isTestnet) setNet("testnet");
    open(r, "list");
  };
  // Enter: a chain ID's chain, the page an identifier resolves to, a question, then the first chain named
  const submit = () => {
    if (!trimmed) return;
    const exact = hits.find((r) => String(r.chain?.chainId ?? "") === trimmed);
    if (exact) pick(exact);
    else if (entity) {
      if (entity.href) go(entity.href);
      else if (entity.status === "searching") setPending(trimmed);
    } else if (question) go(askHref);
    else if (hits[0]) pick(hits[0]);
    else if (canAsk) go(askHref);
  };
  const searchField = (
    <label className="relative flex w-full min-w-0 items-center">
      {/* over the box: its blur makes a layer that would paint over an icon laid under it */}
      <Search className={cn("pointer-events-none absolute z-10 text-zinc-400", wide ? "left-4 h-[18px] w-[18px]" : "left-3 h-4 w-4")} />
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPending(null);
          setHi(-1);
          setSearching(true);
        }}
        onFocus={() => setSearching(true)}
        onBlur={() => setSearching(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && picks.length) {
            e.preventDefault();
            setHi((h) => (h + 1) % picks.length);
          } else if (e.key === "ArrowUp" && picks.length) {
            e.preventDefault();
            setHi((h) => (h <= 0 ? picks.length - 1 : h - 1));
          } else if (e.key === "Enter") {
            if (hi >= 0 && picks[hi]) pick(picks[hi]);
            else submit();
          }
        }}
        placeholder={wide ? "Search chains, addresses, transactions and blocks" : "Chain, address, tx or block"}
        aria-label="Search chains, addresses, transactions and blocks"
        spellCheck={false}
        className={cn(
          "w-full border text-zinc-900 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 dark:text-zinc-50",
          wide
            ? "h-11 rounded-2xl border-zinc-200/90 bg-white/[0.94] pl-11 pr-10 text-[14px] shadow-[0_12px_32px_-18px_rgba(30,27,58,0.45)] backdrop-blur-xl focus:border-zinc-300 dark:border-zinc-800/90 dark:bg-zinc-950/[0.9] dark:focus:border-zinc-700"
            : "h-10 rounded-xl border-zinc-200 bg-white pl-9 pr-9 text-[13.5px] focus:border-zinc-400 focus:shadow-[0_0_0_4px_rgba(24,24,27,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600",
        )}
      />
      {query ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            setPending(null);
            setHi(-1);
          }}
          aria-label="Clear the search"
          className="absolute right-3 z-10 rounded-md p-0.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        wide && <kbd className="pointer-events-none absolute right-3.5 z-10 rounded border border-zinc-200 px-1.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-800">/</kbd>
      )}
    </label>
  );

  /* the list's network: tabs with their counts, in the subnav's grammar */
  const netTabs = (
    <div role="tablist" aria-label="Network" className="flex items-center gap-4">
      {(["mainnet", "testnet"] as const).map((v) => {
        const on = net === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              setNet(v);
              setSelected(null);
            }}
            className={cn(
              "relative flex items-baseline gap-1.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors",
              on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100",
            )}
          >
            {v === "mainnet" ? "Mainnet" : "Fuji"}
            <span className="font-normal tabular-nums text-zinc-400 dark:text-zinc-500">{v === "mainnet" ? cityRows.length : fujiRows.filter((r) => r.chain?.rpcUrl).length}</span>
            {on && <span aria-hidden className="absolute inset-x-0 -bottom-[9px] h-[2px] bg-[#E6212F]" />}
          </button>
        );
      })}
    </div>
  );
  const sortControl = (
    <label className="relative flex items-center" title="Sort the list">
      <ArrowUpDown className="pointer-events-none absolute left-2 h-3 w-3 text-zinc-400" />
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as Sort)}
        aria-label="Sort the list"
        className="h-7 cursor-pointer appearance-none rounded-lg bg-transparent pl-6 pr-6 font-mono text-[10.5px] uppercase tracking-[0.08em] text-zinc-600 outline-none transition-colors hover:bg-zinc-100 focus:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:focus:bg-zinc-900"
      >
        {SORTS.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-zinc-400" />
    </label>
  );

  /* the cuts, as chips under the search: each lights the chains it names in the city, and cuts the list to them */
  const cuts: { key: Exclude<Cut, null>; label: string; count: number; title: string }[] = [
    { key: "talking", label: "Talking", count: figures.talking, title: `Chains that sent or received ICM messages · ${windowLabel}` },
    { key: "live", label: "Live", count: figures.live, title: "Chains that made a block in the last hour, read from their public RPC" },
    ...(versions ? [{ key: "behind" as const, label: "Behind", count: figures.behind, title: `Chains with validators behind ${target}; the windows show client versions` }] : []),
    ...(figures.fresh > 0 ? [{ key: "new" as const, label: "New", count: figures.fresh, title: `L1s that joined the P-Chain in the last ${NEW_DAYS} days` }] : []),
  ];
  const cutChips = (
    <div role="group" aria-label="Cut the city" className={cn("flex flex-wrap gap-1.5", wide && "justify-center")}>
      {cuts.map((c) => {
        const on = cut === c.key;
        return (
          <button
            key={c.key}
            type="button"
            title={c.title}
            aria-pressed={on}
            onClick={() => {
              setCut(on ? null : c.key);
              // the city shows the cut whole: an open chain or district lets go
              setSelected(null);
              setFocus(null);
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
              wide && "shadow-[0_6px_18px_-12px_rgba(30,27,58,0.45)] backdrop-blur-xl",
              on
                ? "border-[#0061E2]/35 bg-[#EEF4FE] text-[#0061E2] dark:border-[#5f9dff]/40 dark:bg-[#10213D] dark:text-[#5f9dff]"
                : cn(
                    "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-50",
                    wide ? "bg-white/[0.92] dark:bg-zinc-950/[0.88]" : "",
                  ),
            )}
          >
            {c.label}
            <span className={cn("font-mono text-[10.5px] tabular-nums", on ? "text-[#0061E2]/70 dark:text-[#5f9dff]/70" : "text-zinc-400 dark:text-zinc-500")}>{c.count}</span>
            {on && <X className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );

  // the chains the list leaves out until asked: mainnet's with no active validators, Fuji's with no public RPC
  const hiddenCount = net === "testnet" ? fujiRows.filter((r) => !r.chain?.rpcUrl).length : quietRows.length;
  const inactiveToggle =
    !q && hiddenCount > 0 ? (
      <button
        type="button"
        onClick={() => setInactive((v) => !v)}
        aria-pressed={inactive}
        title={net === "testnet" ? "Fuji chains with no public RPC" : "Chains in the directory with no active validators"}
        className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {inactive ? "Hide" : "Show"} {hiddenCount} inactive
      </button>
    ) : null;

  /* the directory: the districts in the city's order, or one list sorted */
  const grouped = net === "mainnet" && sort === "district";
  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", district: null as District | null, rows }];
    const out: { key: string; district: District | null; rows: Row[] }[] = [];
    for (const r of rows) {
      const key = r.node?.role === "hub" ? "downtown" : r.district ?? "quiet";
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, district: r.district, rows: [r] });
    }
    return out;
  }, [grouped, rows]);
  const groupHead = (g: { key: string; district: District | null; rows: Row[] }) => {
    if (!grouped) return null;
    const label = g.key === "downtown" ? "Downtown" : g.key === "quiet" ? "Not in the city" : districtLabel(g.district!);
    const about = g.key === "downtown" ? "The Primary Network. Its P-Chain registers every L1." : g.key === "quiet" ? "Chains in the directory with no active validators" : districtAbout(g.district!);
    const inner = (
      <>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-100">{label}</span>
          <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{g.rows.length}</span>
          {g.district && wide && <ChevronRight className="h-3 w-3 self-center text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500" />}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400">{about}</span>
      </>
    );
    return g.district && wide ? (
      <button type="button" onClick={() => setFocus(g.district)} className="group block w-full px-4 pb-1.5 pt-4 text-left">
        {inner}
      </button>
    ) : (
      <div className="px-4 pb-1.5 pt-4">{inner}</div>
    );
  };
  const directory = (
    <div className="pb-2">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-100 bg-white/95 py-2 pl-4 pr-12 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/95">
        {netTabs}
        <span className="flex-1" />
        {net === "mainnet" && sortControl}
      </div>
      {(q || (cut && net === "mainnet")) && (
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {rows.length} {rows.length === 1 ? "chain matches" : "chains match"}
        </span>
        {(q || cut) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCut(null);
            }}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#0061E2] transition-opacity hover:opacity-70 dark:text-[#5f9dff]"
          >
            Clear
          </button>
        )}
      </div>
      )}
      {net === "testnet" && <p className="px-4 pt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">The city stands mainnet; Fuji's chains are listed here.</p>}
      {groups.map((g) => (
        <section key={g.key}>
          {groupHead(g)}
          <ul>
            {g.rows.map((r) => (
              <RowButton key={r.id} row={r} metric={metricOf(r)} painted={painted && net === "mainnet"} on={selected === r.id || mapHover === r.id} onOpen={() => open(r, "list")} onHover={setRowHover} />
            ))}
          </ul>
        </section>
      ))}
      {rows.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-zinc-500">No chain matches.</p>}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 px-4 pt-3 dark:border-zinc-900">
        {inactiveToggle ?? <span />}
        <a href={REQUEST_LISTING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Request a listing
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );

  /* the search's picks, under the box: the page an identifier resolves to, a question to ask, then the chains the words name */
  const askRow = (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => go(askHref)}
      className={cn(
        "group flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900",
        question && "bg-zinc-50 dark:bg-zinc-900",
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#E6212F]" />
      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-900 dark:text-zinc-100">
        <span className="text-zinc-400 dark:text-zinc-500">Ask </span>
        {trimmed}
      </span>
      <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 group-hover:text-[#E6212F] dark:text-zinc-500">
        {question ? "Enter" : "Chart it"}
        <ArrowUpRight className="h-3 w-3" />
      </span>
    </button>
  );
  const whereOf = (r: Row) => (r.node?.role === "hub" ? "Downtown" : r.district ? districtLabel(r.district) : r.chain?.isTestnet ? "Fuji" : "Inactive");
  const picksPanel = searching && !!trimmed && (
    <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(26rem,55vh)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_60px_-28px_rgba(30,27,58,0.5)] dark:border-zinc-800/90 dark:bg-zinc-950">
      {entity && <EntityHitRow hit={entity} onSelect={go} />}
      {canAsk && askRow}
      {picks.map((r, i) => (
        <button
          key={r.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(r)}
          onMouseEnter={() => setHi(i)}
          className={cn("flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors", i === hi ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900")}
        >
          <Logo uri={r.logo} name={r.name} />
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", "text-zinc-900 dark:text-zinc-100")}>{r.node?.role === "hub" ? "C-Chain" : r.name}</span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">{whereOf(r)}</span>
        </button>
      ))}
      {hits.length > picks.length && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setSelected(null);
            setFocus(null);
            setPanelOpen(true);
            searchRef.current?.blur();
          }}
          className="flex w-full items-center justify-between border-t border-zinc-100 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          All {hits.length} in the list
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
      {!entity && !canAsk && hits.length === 0 && <p className="px-4 py-3 text-[13px] text-zinc-500 dark:text-zinc-400">No chain matches.</p>}
    </div>
  );

  /* a district, from the city or the list */
  const districtView = (d: District) => {
    const members = cityRows.filter((r) => r.district === d && r.node?.role !== "hub");
    const vals = members.reduce((a, r) => a + r.validators, 0);
    const msgs = members.reduce((a, r) => a + r.out + r.in, 0);
    const mixes = members.map((r) => r.mix).filter((m): m is VersionMix => !!m);
    const nodes = mixes.reduce((a, m) => a + mixTotal(m), 0);
    const onShare = nodes ? Math.round((mixes.reduce((a, m) => a + m.on, 0) / nodes) * 100) : null;
    return (
      <div className="pb-4 pt-3">
        <div className="px-4">
          <BackButton onClick={back}>All chains</BackButton>
          <Eyebrow className="mt-3">District</Eyebrow>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{districtLabel(d)}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{districtAbout(d)}</p>
          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
            {[
              ["L1s", String(members.length)],
              ["Validators", vals.toLocaleString("en-US")],
              [painted ? `On ${target}+` : `ICM · ${windowShort}`, painted ? (onShare === null ? "—" : `${onShare}%`) : fmtCompact(msgs)],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-3 py-2 dark:bg-zinc-950">
                <dt className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{k}</dt>
                <dd className="font-mono text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className="mt-2">
          {members.map((r) => (
            <RowButton key={r.id} row={r} metric={r.validators > 0 ? `${r.validators}` : "—"} painted={painted} on={selected === r.id || mapHover === r.id} onOpen={() => open(r, "district")} onHover={setRowHover} />
          ))}
        </ul>
        {d === "frontier" && (
          <p className="mx-4 mt-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            The week&apos;s new L1s rise here, and so do L1s whose purpose the directory does not know yet.{" "}
            <a href={REQUEST_LISTING_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]">
              Request a listing
            </a>
          </p>
        )}
      </div>
    );
  };

  const chainView = (r: Row, phone = false) => (
    <ChainView
      row={r}
      target={target}
      windowShort={windowShort}
      explorerOf={explorerOf}
      partner={partner}
      onBack={phone ? undefined : back}
      backLabel={openedFrom === "district" && focus ? districtLabel(focus) : "All chains"}
      onDistrict={
        wide
          ? (d) => {
              setSelected(null);
              setFocus(d);
            }
          : undefined
      }
      onPartner={(p) => open(p, openedFrom)}
      liveTip={liveTip?.id === r.id ? liveTip : null}
    />
  );

  /* the figures, a strip at the city's foot */
  const hudFigure = (label: string, value: string, sub: ReactNode, phone = false, className?: string, href?: string) => {
    const body = (
      <>
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</span>
        <span className="font-mono text-[17px] font-semibold tabular-nums leading-tight text-zinc-900 dark:text-zinc-50">{value}</span>
        <span className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{sub}</span>
      </>
    );
    const box = cn("flex min-w-0 flex-col items-start gap-0.5 px-4 py-2.5", phone && "rounded-xl border border-zinc-200 dark:border-zinc-800", className);
    return href ? (
      <Link key={label} href={href} className={cn(box, "transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60", !phone && "first:rounded-l-2xl")}>
        {body}
      </Link>
    ) : (
      <div key={label} className={box}>
        {body}
      </div>
    );
  };
  const usd = (v: number) => `$${fmtCompact(v)}`;
  const change = market?.change24h ?? null;
  // AVAX leads the strip, its price and its market cap; they open the token's page
  const marketCells = (phone: boolean, narrow: boolean) => [
    hudFigure(
      "AVAX",
      market ? `$${market.price.toFixed(2)}` : "—",
      change === null ? "price" : (
        <>
          <span className={change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F] dark:text-[#FF7F7B]"}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </span>{" "}
          · 24h
        </>
      ),
      phone,
      undefined,
      "/explorer/mainnet/token",
    ),
    hudFigure("Market cap", market?.marketCap ? usd(market.marketCap) : "—", market ? `FDV ${usd(market.price * AVAX_CAP)}` : "fully diluted —", phone, narrow ? "hidden 2xl:flex" : undefined, "/explorer/mainnet/token"),
  ];
  // beside the open panel on a narrow screen, the strip keeps AVAX and the day's traffic
  const hud = (phone = false, narrow = false) => [
    ...marketCells(phone, narrow),
    hudFigure("Chains", figures.chains.toLocaleString("en-US"), `${figures.districts} districts`, phone, narrow ? "hidden xl:flex" : undefined),
    hudFigure("Validators", fmtCompact(figures.validators), figures.onShare === null ? "versions unknown" : `${figures.onShare.toFixed(0)}% on ${target}+`, phone, narrow ? "hidden xl:flex" : undefined),
    hudFigure(`ICM · ${windowShort}`, fmtCompact(figures.icm), `${figures.talking} chains talking`, phone),
    hudFigure(`Tx · ${windowShort}`, figures.tx === null ? "—" : fmtCompact(figures.tx), `across ${figures.active} chains`, phone),
  ];

  /* the key: what the heights, the windows, the lights and the streets
     show, each picked where it is explained */
  const prevMinor = (() => {
    const m = /^(\d+)\.(\d+)/.exec(target);
    return m ? `${m[1]}.${Number(m[2]) - 1}` : "behind";
  })();
  const swatch = (paint: string, label: string) => (
    <span key={label} className="flex items-center gap-1.5">
      <span className="h-2.5 w-1.5" style={{ background: paint }} />
      {label}
    </span>
  );
  const keyRow = (label: string, body: ReactNode) => (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 pt-[3px] font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">{body}</div>
    </div>
  );
  const versionTargets = targets.filter((t) => /^\d/.test(t)).slice(0, 4);
  const mapKey = (
    <div className="flex w-[19rem] flex-col gap-2.5 rounded-2xl border border-zinc-200/90 bg-white/[0.92] px-3.5 py-3 shadow-[0_12px_32px_-20px_rgba(30,27,58,0.35)] backdrop-blur-xl dark:border-zinc-800/90 dark:bg-zinc-950/[0.88]">
      {keyRow(
        "Height",
        <ViewSwitch
          id="city-height"
          value={height}
          onChange={onHeight}
          options={[
            { v: "validators", label: "Validators" },
            { v: "messages", label: "ICM messages" },
          ]}
        />,
      )}
      {keyRow(
        "Windows",
        <>
          <ViewSwitch
            id="city-lens"
            value={versionLens ? "versions" : "districts"}
            onChange={(v: Lens) => {
              setLens(v);
              // the Behind cut is the Versions lens's: leaving the lens lets go of it
              if (v === "districts" && cut === "behind") setCut(null);
            }}
            options={[{ v: "districts" as Lens, label: "Districts" }, ...(versions ? [{ v: "versions" as Lens, label: "Versions" }] : [])]}
          />
          {painted ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-1.5" style={{ background: TONE.on.left }} />
              {versionTargets.length > 1 ? (
                <span className="relative flex items-center">
                  <select
                    value={target}
                    onChange={(e) => onTarget(e.target.value)}
                    aria-label="The version the windows are measured against"
                    title="The version the windows are measured against"
                    className="cursor-pointer appearance-none bg-transparent pr-3.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-800 outline-none dark:text-zinc-100"
                  >
                    {versionTargets.map((t) => (
                      <option key={t} value={t}>
                        {t}+
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-zinc-400" />
                </span>
              ) : (
                `${target}+`
              )}
            </span>
            {swatch(TONE.near.left, prevMinor)}
            {swatch(TONE.stale.left, "older")}
            {swatch(TONE.unknown.left, "unknown")}
          </>
          ) : (
            <span className="flex items-center gap-[3px]" title="Each district's own glass; downtown's is the Avalanche red">
              {(["downtown", ...DISTRICTS.map((d) => d.key)] as const).map((k) => (
                <span key={k} className="h-2.5 w-1.5" style={{ background: DISTRICT_GLASS[k] }} />
              ))}
            </span>
          )}
        </>,
      )}
      {keyRow(
        "Lights",
        <span className="flex items-center gap-1.5">
          {/* a pane of the city's cool glass, its storey flashing white as a tx lands */}
          <span className="relative h-2.5 w-1.5 bg-[#6E7F92] dark:bg-[#3B484B]">
            <span className="absolute inset-x-0 inset-y-[3px] animate-pulse bg-white" />
          </span>
          flash with transactions, live
        </span>,
      )}
      {keyRow(
        "Streets",
        <span className="flex items-center gap-1.5">
          {/* a pod in its lane, as the streets carry them: a steel capsule, its pale canopy, the light strip down each flank */}
          <svg viewBox="0 0 26 11" className="h-[11px] w-[26px] shrink-0" aria-hidden>
            <rect width="26" height="11" rx="1.5" className="fill-[#3B484B]/[0.12] dark:fill-white/[0.12]" />
            <line x1="1.5" x2="24.5" y1="1.9" y2="1.9" strokeWidth="0.7" strokeDasharray="2.2 1.8" className="stroke-white dark:stroke-white/45" />
            <rect x="6.5" y="3.8" width="13" height="5.6" rx="2.8" className="fill-[#A2AFB2] dark:fill-[#5F6B7A]" />
            <rect x="9.4" y="5.1" width="6.2" height="3" rx="1.5" className="fill-[#EBF0FA]" />
            <rect x="8.4" y="3.95" width="9.2" height="0.6" rx="0.3" className="fill-[#E6212F] dark:fill-[#FF394A]" />
            <rect x="8.4" y="8.65" width="9.2" height="0.6" rx="0.3" className="fill-[#E6212F] dark:fill-[#FF394A]" />
          </svg>
          ICM traffic · {windowShort}
        </span>,
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /* phones: the district browser                                      */
  /* ---------------------------------------------------------------- */
  if (!wide) {
    const phoneGroups = net === "testnet" ? [{ key: "fuji", district: null as District | null, rows }] : groups.length && grouped ? groups : [{ key: "all", district: null, rows }];
    const chips = net === "mainnet" ? DISTRICTS.filter((d) => cityRows.some((r) => r.district === d.key)) : [];
    const routes = [...data.routes].sort((a, b) => b.messages - a.messages).slice(0, 12);
    const topRoute = routes[0]?.messages ?? 1;
    return (
      <div className="flex flex-col gap-5 pb-12 pt-4">
        <div className="grid grid-cols-2 gap-2">{hud(true)}</div>
        <div className="flex flex-col gap-2.5">
          {searchField}
          {net === "mainnet" && cutChips}
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-900">
            {netTabs}
            {net === "mainnet" && sortControl}
          </div>
          {chips.length > 0 && grouped && !trimmed && (
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map((d) => (
                <a
                  key={d.key}
                  href={`#district-${d.key}`}
                  className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                >
                  {d.label}
                  <span className="ml-1.5 tabular-nums text-zinc-400">{cityRows.filter((r) => r.district === d.key).length}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {trimmed && (entity || canAsk) && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 [&>button:last-child]:border-b-0">
            {entity && <EntityHitRow hit={entity} onSelect={go} />}
            {canAsk && askRow}
          </div>
        )}
        {phoneGroups.map((g) => (
          <section key={g.key} id={g.district ? `district-${g.district}` : undefined} className="scroll-mt-28">
            {grouped && (
              <div className="mb-2">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-100">
                    {g.key === "downtown" ? "Downtown" : g.key === "quiet" ? "Not in the city" : g.district ? districtLabel(g.district) : "Chains"}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-400">{g.rows.length}</span>
                </span>
                {g.district && <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{districtAbout(g.district)}</p>}
              </div>
            )}
            <ul className="grid grid-cols-2 gap-2">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => open(r, "list")}
                    className="flex h-full w-full flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors active:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-900"
                  >
                    <span className="flex items-end justify-between">
                      <BigLogo uri={r.logo} name={r.name} size={26} />
                      {r.node && <MiniBuilding validators={r.validators} max={maxValidators} mix={painted ? r.mix : null} hub={r.node.role === "hub"} district={r.district} />}
                    </span>
                    <span className={cn("line-clamp-2 text-[13px] font-medium leading-snug", "text-zinc-900 dark:text-zinc-100")}>
                      {r.node?.role === "hub" ? "C-Chain" : r.name}
                    </span>
                    <span className="mt-auto flex items-center gap-2 font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {net === "testnet" ? r.chain?.networkToken?.symbol ?? "" : `${metricOf(r)}${sort === "tx" ? " tx" : sort === "icm" ? " msgs" : " val"}`}
                      {painted && net === "mainnet" && r.node && <Pct row={r} />}
                      {r.newAt !== null && <NewBadge />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {rows.length === 0 && !entity && !canAsk && <p className="py-6 text-center text-[13px] text-zinc-500">No chain matches.</p>}
        {inactiveToggle && <div className="flex justify-center">{inactiveToggle}</div>}

        {net === "mainnet" && routes.length > 0 && (
          <section>
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-100">Traffic</span>
              <span className="font-mono text-[10px] text-zinc-400">ICM · {windowLabel}</span>
            </span>
            <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
              {routes.map((rt) => {
                const a = rowById.get(rt.from);
                const b = rowById.get(rt.to);
                if (!a || !b) return null;
                const name = (r: Row) => (r.node?.role === "hub" ? "C-Chain" : r.name);
                return (
                  <li key={rt.key} className="px-3 py-2.5">
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-zinc-900 dark:text-zinc-100">
                        <Logo uri={a.logo} name={a.name} />
                        <span className="truncate">{name(a)}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                        <Logo uri={b.logo} name={b.name} />
                        <span className="truncate">{name(b)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmtCompact(rt.messages)}</span>
                    </span>
                    <span className="mt-1.5 block h-1 max-w-full rounded-full bg-[#2A1F66]/25 dark:bg-[#E9E4FF]/30" style={{ width: `${Math.max(2, Math.sqrt(rt.messages / topRoute) * 100)}%` }} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="-mx-5 overflow-hidden border-y border-zinc-200 dark:border-zinc-800">
          <GroundKey pulse={data.pulse} arrivals={data.newcomers} />
        </div>

        {/* the open chain, in a sheet over the browser */}
        {selectedRow && (
          <div className="fixed inset-0 z-[60]">
            <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="absolute inset-0 bg-zinc-950/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={selectedRow.name}
              className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-zinc-950"
            >
              <div className="sticky top-0 z-10 flex items-center justify-center bg-white/95 pb-1 pt-2.5 backdrop-blur dark:bg-zinc-950/95">
                <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="absolute right-3 top-2 rounded-full p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {chainView(selectedRow, true)}
              {/* its newest blocks and transactions, under its facts */}
              {(() => {
                const live = liveOf(selectedRow);
                return (
                  live && (
                    <div className="border-t border-zinc-100 pb-8 pt-4 dark:border-zinc-900">
                      <ChainLive key={live.chainId} compact chain={live} armed={landed} onTip={tipOf(live.chainId)} onClose={() => setSelected(null)} />
                    </div>
                  )
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* large screens: the city, and its panels over it                   */
  /* ---------------------------------------------------------------- */
  const PANEL_W = 372;
  const LIVE_W = 344;
  // the panel stands while the list is asked for, or while a chain or a district is open
  // without WebGL 2 the list stands open: it is the way to the chains while the city cannot
  const showPanel = panelOpen || !webgl || !!selectedRow || (!!focus && net === "mainnet");
  // an open chain with a feed shows its newest blocks and transactions at the right
  const liveTarget = liveShut ? null : liveOf(selectedRow);
  // the P-Chain picked (its wing downtown, or its caption on the rim) shows its newest txs there instead
  const pchainOpen = net === "mainnet" && selected === PCHAIN_PICK;
  const paneOpen = !!liveTarget || pchainOpen;
  // the camera keeps the city under the search and its chips, and clear of the panels
  const inset: Inset = { left: showPanel ? PANEL_W + 28 : 20, right: paneOpen ? LIVE_W + 28 : 20, top: 112, bottom: 92 };
  return (
    <div ref={appRef} className="relative h-full w-full overflow-hidden bg-[linear-gradient(to_bottom,#EBF0FA_0%,#E1E7F0_45%,#D2D9E2_100%)] dark:bg-[linear-gradient(to_bottom,#1F1F1F_0%,#161A21_45%,#0D1118_100%)]">
      {(() => {
        const mapProps = {
          data,
          versions,
          target,
          sizeBy: height,
          paint: painted,
          activity,
          windowLabel,
          selected: net === "mainnet" ? selected : null,
          onSelect: (id: string | null) => {
            if (id === PCHAIN_PICK) {
              setSelected(PCHAIN_PICK);
              return;
            }
            const r = id ? rowById.get(id) : null;
            if (r) open(r, focus ? "district" : "list");
            else setSelected(null);
          },
          focus,
          onFocus: (d: District | null) => {
            setFocus(d);
            setSelected(null);
          },
          lit,
          hovered: rowHover,
          onHover: setMapHover,
          inset,
          cameraRef: camera,
        };
        if (webgl)
          return (
            <SceneFence inset={inset}>
              <City3D {...mapProps} />
            </SceneFence>
          );
        // no WebGL 2: the city cannot stand; the note takes its room, and the list at the left names the chains
        return (
          <div role="status" className="absolute inset-y-0 flex items-center justify-center p-6" style={{ left: inset.left, right: inset.right }}>
            <p className="max-w-xs text-center text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">This browser has no WebGL 2, which the 3D city needs. The chains are in the list.</p>
          </div>
        );
      })()}

      {/* the panel: the list, a district or a chain, shut until one is asked for */}
      <aside
        inert={!showPanel || undefined}
        aria-hidden={!showPanel}
        className={cn(
          "absolute bottom-4 left-4 top-[calc(1rem+var(--under,0px))] z-20 flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/[0.94] shadow-[0_24px_60px_-28px_rgba(30,27,58,0.35)] backdrop-blur-xl transition-[transform,opacity] duration-300 ease-out dark:border-zinc-800/90 dark:bg-zinc-950/[0.9]",
          showPanel ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-6 opacity-0",
        )}
        style={{ width: PANEL_W }}
      >
        <button
          type="button"
          onClick={shut}
          aria-label="Close the panel"
          title="Close the panel"
          className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {selectedRow ? (shownRow && shown ? chainView(shownRow) : null) : focus && net === "mainnet" ? districtView(focus) : directory}
        </div>
      </aside>

      {/* the list's door while the panel is shut */}
      {!showPanel && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="absolute left-4 top-[calc(1rem+var(--under,0px))] z-30 flex h-11 items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/[0.94] pl-3.5 pr-4 text-[13px] font-medium text-zinc-800 shadow-[0_12px_32px_-18px_rgba(30,27,58,0.45)] backdrop-blur-xl transition-colors hover:text-zinc-950 dark:border-zinc-800/90 dark:bg-zinc-950/[0.9] dark:text-zinc-100 dark:hover:text-white"
        >
          <PanelLeftOpen className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          Chains
          <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{dimmed && cityHits ? `${cityHits.length} of ${cityRows.length}` : cityRows.length}</span>
        </button>
      )}

      {/* the search, fixed over the city's top and centred on what the panel leaves of it; its chips under it */}
      <div className="pointer-events-none absolute top-[calc(1rem+var(--under,0px))] z-30 flex justify-center px-4 transition-[left,right] duration-300 ease-out" style={{ left: showPanel ? PANEL_W + 16 : 0, right: paneOpen ? LIVE_W + 16 : 0 }}>
        <div className="pointer-events-auto flex w-full max-w-[34rem] flex-col items-center gap-2">
          <div className="relative w-full">
            {searchField}
            {picksPanel}
          </div>
          {cutChips}
        </div>
      </div>

      {/* the open chain's live view, at the right; the site's chat button keeps the corner under it */}
      <aside
        inert={!paneOpen || undefined}
        aria-hidden={!paneOpen}
        aria-label={liveTarget ? `${liveTarget.name}, live` : pchainOpen ? "P-Chain, live" : undefined}
        className={cn(
          "absolute bottom-[5.5rem] right-4 top-[calc(1rem+var(--under,0px))] z-20 flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/[0.94] shadow-[0_24px_60px_-28px_rgba(30,27,58,0.35)] backdrop-blur-xl transition-[transform,opacity] duration-300 ease-out dark:border-zinc-800/90 dark:bg-zinc-950/[0.9]",
          paneOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0",
        )}
        style={{ width: LIVE_W }}
      >
        {liveTarget && shown && <ChainLive key={liveTarget.chainId} chain={liveTarget} armed={landed} onTip={tipOf(liveTarget.chainId)} onClose={() => setLiveShut(true)} />}
        {pchainOpen && (
          <PChainLive pulse={data.pulse} l1Of={l1Of} onClose={() => setSelected(null)} onTarget={(subnet) => setRowHover(subnet ? (idBySubnet.get(subnet) ?? null) : null)} />
        )}
      </aside>

      {/* the key, in the corner the search leaves free; the panel's views, the live pane in that corner and a narrow window need the room */}
      <div data-city-hud className={cn("absolute right-4 top-[calc(1rem+var(--under,0px))] z-20", showPanel || paneOpen ? "hidden" : "hidden xl:block")}>{mapKey}</div>

      {/* the figures, centred at the city's foot in what the panels leave of it; both edges keep clear of the site's chat button */}
      <div className="pointer-events-none absolute bottom-4 z-10 flex items-end justify-center" style={{ left: showPanel ? inset.left : 88, right: paneOpen ? LIVE_W + 32 : 88 }}>
        <div className="pointer-events-auto flex divide-x divide-zinc-200/80 rounded-2xl border border-zinc-200/90 bg-white/[0.92] shadow-[0_12px_32px_-20px_rgba(30,27,58,0.35)] backdrop-blur-xl dark:divide-zinc-800 dark:border-zinc-800/90 dark:bg-zinc-950/[0.88]">
          {hud(false, showPanel)}
        </div>
      </div>
    </div>
  );
}
