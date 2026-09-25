"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { ageShort } from "@/components/explorer-v2/format";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { BLOCK_GRAY, ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { GroundKey, IcmNetworkMap, Logo, TONE, Tower, mixTotal, pctInk, type CityData, type Inset, type Node, type SizeBy, type VersionMix } from "@/components/explorer-v2/network/icm-map";
import { DISTRICTS, districtAbout, districtLabel, type District } from "@/components/explorer-v2/network/districts";
import { toStatsChainId } from "@/lib/dedicated-stats";
import type { L1Chain } from "@/types/stats";

/* The Chains page as one app: the city is the canvas, and everything a
   builder needs from a list of chains lives in it. A panel at the left
   holds the search and the directory, a district when the camera is in
   one, and a chain when one is open: its figures, its links, and one
   click into a wallet. The figures stand in a strip at the foot of the
   city, each a light on the sets it counts. Phones get the same city as
   a district browser, with the chain in a sheet: no canvas to load.
   The open chain and district ride the URL, so a link opens them. */

const REQUEST_LISTING_URL = "https://forms.gle/N4QkRo9UR45xeTTp9";

type Net = "mainnet" | "testnet";
/** what a figure in the strip lights */
type Cut = "talking" | "behind" | "active" | null;
type Sort = "district" | "validators" | "tx" | "icm" | "name";

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
}

const SORTS: { v: Sort; label: string }[] = [
  { v: "district", label: "By district" },
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

/* a set's building in miniature, painted as the city paints it */
function MiniBuilding({ validators, max, mix, hub }: { validators: number; max: number; mix: VersionMix | null; hub: boolean }) {
  const w = 7;
  const box = 30;
  const d = w * 0.5;
  const h = validators > 0 ? 4 + 20 * Math.pow(validators / Math.max(1, max), 0.4) : 2;
  return (
    <svg width={18} height={box} viewBox={`0 0 18 ${box}`} className="shrink-0 overflow-visible" aria-hidden>
      <Tower x={9} y={box - d - 1} w={w} h={h} tone={hub ? "red" : "gray"} mix={mix && mix.on + mix.near + mix.stale > 0 ? mix : null} />
    </svg>
  );
}

function CopyValue({ value, shown }: { value: string; shown?: string }) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const done = copiedId === value;
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(value, value)}
      title={value}
      className="group/copy inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-[11.5px] text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
    >
      <span className="truncate">{shown ?? value}</span>
      {done ? <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover/copy:text-zinc-500 dark:text-zinc-600" />}
    </button>
  );
}

function NewBadge() {
  return <span className="shrink-0 bg-[#5400FF] px-1 py-px font-mono text-[8px] font-bold tracking-[0.1em] text-white dark:bg-[#8B6CFF]">NEW</span>;
}

/* the share on target, in the fleet's ink */
function Pct({ row, className }: { row: Row; className?: string }) {
  return <span className={cn("font-mono text-[10.5px] tabular-nums", pctInk(row.mix, row.pct), className)}>{row.pct === null ? "—" : `${row.pct}%`}</span>;
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
        <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "text-[#0061E2] dark:text-[#5f9dff]" : row.newAt !== null ? "text-[#5400FF] dark:text-[#A48CFF]" : "text-zinc-800 dark:text-zinc-200")}>
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
                <button type="button" onClick={() => onDistrict(row.district!)} className="text-[#5400FF] transition-opacity hover:opacity-70 dark:text-[#A48CFF]">
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
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#5400FF]/30 px-3 text-[13px] font-semibold text-[#5400FF] transition-colors hover:bg-[#5400FF]/5 dark:border-[#8B6CFF]/40 dark:text-[#A48CFF]"
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
        {c && fact("Chain ID", <CopyValue value={String(c.chainId)} shown={/^\d+$/.test(String(c.chainId)) ? String(c.chainId) : `${String(c.chainId).slice(0, 8)}…${String(c.chainId).slice(-4)}`} />)}
        {c?.networkToken?.symbol && fact("Token", <span className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">{c.networkToken.symbol}</span>)}
        {c?.rpcUrl && fact("Public RPC", <CopyValue value={c.rpcUrl} shown={c.rpcUrl.replace(/^https?:\/\//, "")} />)}
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

export function CityApp({
  data,
  sizeBy,
  onSizeBy,
  versions,
  target,
  targets,
  onTarget,
  windowLabel,
  windowShort,
  txShort,
  txOf,
  catalog,
  indexedChainIds,
  wide,
}: {
  data: CityData;
  sizeBy: SizeBy;
  onSizeBy: (v: SizeBy) => void;
  versions: Map<string, VersionMix> | null;
  target: string;
  targets: string[];
  onTarget: (t: string) => void;
  /** the window spelled out, "30 days", and short, "1M" */
  windowLabel: string;
  windowShort: string;
  /** the activity aggregate stops at a year, so its label can differ */
  txShort: string;
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [rowHover, setRowHover] = useState<string | null>(null);
  const [mapHover, setMapHover] = useState<string | null>(null);
  // where a chain was opened from, for its back button
  const [openedFrom, setOpenedFrom] = useState<"list" | "district">("list");
  const searchRef = useRef<HTMLInputElement>(null);
  const painted = sizeBy === "versions" && !!versions;

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
        };
      }),
    // txOf reads the activity feed the page passes down
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.nodes, versions, mainnetById, bySubnet, txOf],
  );
  const quietRows = useMemo<Row[]>(() => {
    const standing = new Set(data.nodes.map((n) => n.id));
    return catalog
      .filter((c) => c.isTestnet !== true && !standing.has(String(c.chainId)))
      .map((c) => ({ id: String(c.chainId), name: c.chainName, logo: c.chainLogoURI ?? "", district: null, node: null, chain: c, validators: 0, mix: null, pct: null, tx: txOf(String(c.chainId)), out: 0, in: 0, newAt: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, data.nodes, txOf]);
  const fujiRows = useMemo<Row[]>(
    () =>
      catalog
        .filter((c) => c.isTestnet === true && (inactive || Boolean(c.rpcUrl)))
        .map((c) => ({ id: `fuji:${c.chainId}`, name: c.chainName, logo: c.chainLogoURI ?? "", district: null, node: null, chain: c, validators: 0, mix: null, pct: null, tx: null, out: 0, in: 0, newAt: null })),
    [catalog, inactive],
  );
  const allRows = useMemo(() => [...cityRows, ...quietRows, ...fujiRows], [cityRows, quietRows, fujiRows]);
  const rowById = useMemo(() => new Map(allRows.map((r) => [r.id, r])), [allRows]);

  /* the list the panel shows: the network, the search, and the lit figure */
  const q = query.trim().toLowerCase();
  const matches = (r: Row) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    String(r.chain?.chainId ?? r.id).toLowerCase().includes(q) ||
    (r.chain?.slug ?? "").includes(q) ||
    (r.chain?.category ?? "").toLowerCase().includes(q) ||
    (r.district ? districtLabel(r.district).toLowerCase().includes(q) : false) ||
    (r.node?.role === "hub" && "c-chain".includes(q));
  const cutOk = (r: Row) =>
    !cut || (cut === "talking" ? r.out + r.in > 0 : cut === "active" ? (r.tx ?? 0) > 0 : r.mix ? r.mix.near + r.mix.stale > 0 : false);
  const rows = useMemo(() => {
    const base = net === "testnet" ? fujiRows : inactive ? [...cityRows, ...quietRows] : cityRows;
    const value = (r: Row) => (sort === "tx" ? r.tx ?? -1 : sort === "icm" ? r.out + r.in : r.validators);
    return base
      .filter((r) => matches(r) && (net === "testnet" || cutOk(r)))
      .sort((a, b) =>
        sort === "name" || net === "testnet"
          ? a.name.localeCompare(b.name)
          : sort === "district"
            ? Number(a.district === "frontier") - Number(b.district === "frontier") ||
              districtRank(a.district) - districtRank(b.district) ||
              Number(a.newAt !== null) - Number(b.newAt !== null) ||
              b.validators - a.validators ||
              a.name.localeCompare(b.name)
            : value(b) - value(a) || a.name.localeCompare(b.name),
      );
    // matches and cutOk read the query and the cut, both listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, fujiRows, cityRows, quietRows, inactive, sort, q, cut]);

  // the city lights what the search or a figure points at
  const lit = useMemo(() => (net === "mainnet" && (q || cut) ? new Set(rows.filter((r) => r.node).map((r) => r.id)) : null), [net, q, cut, rows]);

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
      talking: data.summary.talking,
      tx: withTx.length ? withTx.reduce((a, r) => a + (r.tx ?? 0), 0) : null,
      active: cityRows.filter((r) => (r.tx ?? 0) > 0).length,
    };
  }, [cityRows, data.summary]);

  /* opening and closing */
  const open = (r: Row, from: "list" | "district" = focus ? "district" : "list") => {
    setSelected(r.id);
    setOpenedFrom(from);
    setPanelOpen(true);
    // the camera flies to the chain's district; downtown and chains the city does not stand keep the camera where it is
    if (r.node && r.district) setFocus(r.district);
  };
  const back = () => {
    if (selected) {
      setSelected(null);
      if (openedFrom === "list") setFocus(null);
    } else if (focus) setFocus(null);
    else if (query) setQuery("");
  };
  const selectedRow = selected ? rowById.get(selected) ?? null : null;

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
    else p.delete("chain");
    if (focus) p.set("district", focus);
    else p.delete("district");
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
        else back();
      } else if (e.key === "/" && !typing && wide) {
        e.preventDefault();
        setPanelOpen(true);
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

  /* the search field and the network switch, over the list */
  const searchField = (
    <div className="flex items-center gap-2">
      <label className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPanelOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && rows[0]) open(rows[0], "list");
          }}
          placeholder="Find a chain, a district or a chain ID"
          aria-label="Find a chain"
          className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-9 text-[13.5px] text-zinc-900 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 focus:border-zinc-400 focus:shadow-[0_0_0_4px_rgba(24,24,27,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear the search" className="absolute right-2.5 rounded-md p-0.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          wide && <kbd className="pointer-events-none absolute right-3 rounded border border-zinc-200 px-1.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-800">/</kbd>
        )}
      </label>
    </div>
  );
  const netSwitch = (
    <ViewSwitch
      id={wide ? "city-net" : "city-net-phone"}
      value={net}
      onChange={(v) => {
        setNet(v);
        setSelected(null);
        setCut(null);
      }}
      options={[
        { v: "mainnet", label: "Mainnet" },
        { v: "testnet", label: "Fuji" },
      ]}
    />
  );

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
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {rows.length} {rows.length === 1 ? "chain" : "chains"}
          {net === "testnet" ? " on Fuji" : q || cut ? " match" : ""}
        </span>
        {net === "mainnet" && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Order the list"
            className="rounded-md border-0 bg-transparent py-0.5 pr-6 text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-600 outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-300 dark:focus:ring-zinc-800"
          >
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
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
        <label className="flex cursor-pointer items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100" />
          Include inactive
        </label>
        <a href={REQUEST_LISTING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Request a listing
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
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
          <BackButton onClick={() => setFocus(null)}>All chains</BackButton>
          <Eyebrow className="mt-3 text-[#5400FF] dark:text-[#A48CFF]">District</Eyebrow>
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
    />
  );

  /* the figures, each a light on the sets it counts */
  const hudFigure = (key: Cut, label: string, value: string, sub: string, phone = false) => {
    const on = key !== null && cut === key;
    return (
      <button
        key={label}
        type="button"
        onClick={() => {
          // a figure lists what it counts: the panel goes back to the list, cut to those sets
          setCut(key === null || on ? null : key);
          setSelected(null);
          setFocus(null);
          setPanelOpen(true);
        }}
        aria-pressed={on}
        className={cn(
          "flex min-w-0 flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors",
          phone ? "rounded-xl border border-zinc-200 dark:border-zinc-800" : "first:rounded-l-2xl last:rounded-r-2xl",
          on ? "bg-[#0061E2]/[0.07] dark:bg-[#5b9bff]/10" : "hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70",
        )}
      >
        <span className={cn("font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]", on ? "text-[#0061E2] dark:text-[#5f9dff]" : "text-zinc-400 dark:text-zinc-500")}>{label}</span>
        <span className="font-mono text-[17px] font-semibold tabular-nums leading-tight text-zinc-900 dark:text-zinc-50">{value}</span>
        <span className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{sub}</span>
      </button>
    );
  };
  const hud = (phone = false) => [
    hudFigure(null, "Chains", figures.chains.toLocaleString("en-US"), `${figures.districts} districts`, phone),
    hudFigure("behind", "Validators", fmtCompact(figures.validators), figures.onShare === null ? "versions unknown" : `${figures.onShare.toFixed(0)}% on ${target}+`, phone),
    hudFigure("talking", `ICM · ${windowShort}`, fmtCompact(figures.icm), `${figures.talking} chains talking`, phone),
    hudFigure("active", `Tx · ${txShort}`, figures.tx === null ? "—" : fmtCompact(figures.tx), `${figures.active} chains active`, phone),
  ];

  /* the legend for the view in paint */
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
  const legend = (
    <div className="flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
      {painted ? (
        <>
          {swatch(TONE.on.left, `${target}+`)}
          {swatch(TONE.near.left, prevMinor)}
          {swatch(TONE.stale.left, "older")}
          {swatch(TONE.unknown.left, "unknown")}
        </>
      ) : (
        swatch(BLOCK_GRAY, `height · ${sizeBy}`)
      )}
      <span className="flex items-center gap-1.5">
        <span className="relative flex w-5 items-center">
          <span className="w-full border-t border-[#2A1F66]/40 dark:border-[#E9E4FF]/50" />
          <span className="absolute left-1.5 h-1.5 w-1.5 rounded-full bg-[#2A1F66] dark:bg-[#F4F1FF]" />
        </span>
        traffic · ICM
      </span>
    </div>
  );
  const viewSwitch = (
    <ViewSwitch
      id={wide ? "city-size" : "city-size-phone"}
      value={sizeBy}
      onChange={onSizeBy}
      options={[...(versions ? [{ v: "versions" as const, label: "Versions" }] : []), { v: "validators" as const, label: "Validators" }, { v: "messages" as const, label: "Messages" }]}
    />
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
          <div className="flex items-center justify-between gap-2">
            {netSwitch}
            {net === "mainnet" && (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Order the list"
                className="rounded-md border-0 bg-transparent py-0.5 pr-6 text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-600 outline-none dark:text-zinc-300"
              >
                {SORTS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {chips.length > 0 && grouped && (
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
                      {r.node && <MiniBuilding validators={r.validators} max={maxValidators} mix={painted ? r.mix : null} hub={r.node.role === "hub"} />}
                    </span>
                    <span className={cn("line-clamp-2 text-[13px] font-medium leading-snug", r.newAt !== null ? "text-[#5400FF] dark:text-[#A48CFF]" : "text-zinc-900 dark:text-zinc-100")}>
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
        {rows.length === 0 && <p className="py-6 text-center text-[13px] text-zinc-500">No chain matches.</p>}

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
  const inset: Inset = { left: panelOpen ? PANEL_W + 28 : 20, right: 20, top: 56, bottom: 92 };
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_58%,#FBFAFF_0%,#FFFFFF_62%)] dark:bg-[radial-gradient(ellipse_at_50%_58%,#110F1C_0%,#09090B_65%)]">
      <IcmNetworkMap
        data={data}
        versions={versions}
        target={target}
        sizeBy={sizeBy}
        windowLabel={windowLabel}
        selected={net === "mainnet" ? selected : null}
        onSelect={(id) => {
          const r = id ? rowById.get(id) : null;
          if (r) open(r, focus ? "district" : "list");
          else setSelected(null);
        }}
        focus={focus}
        onFocus={(d) => {
          setFocus(d);
          setSelected(null);
          if (d) setPanelOpen(true);
        }}
        lit={lit}
        hovered={rowHover}
        onHover={setMapHover}
        inset={inset}
      />

      {/* the panel: the search, and under it the directory, a district or a chain */}
      <aside
        className={cn(
          "absolute left-4 top-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/[0.94] shadow-[0_24px_60px_-28px_rgba(30,27,58,0.35)] backdrop-blur-xl transition-[bottom] duration-300 dark:border-zinc-800/90 dark:bg-zinc-950/[0.9]",
          panelOpen ? "bottom-4" : "bottom-auto",
        )}
        style={{ width: PANEL_W }}
      >
        <div className="flex flex-col gap-2 border-b border-zinc-100 p-3 dark:border-zinc-900">
          {searchField}
          <div className="flex items-center justify-between gap-2">
            {netSwitch}
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              aria-expanded={panelOpen}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {panelOpen ? (
                <>
                  <ChevronLeft className="h-3.5 w-3.5" /> Hide list
                </>
              ) : (
                <>
                  List <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
        {panelOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {selectedRow ? chainView(selectedRow) : focus && net === "mainnet" ? districtView(focus) : directory}
          </div>
        )}
      </aside>

      {/* the view and its key */}
      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {painted && targets.length > 1 && <ViewSwitch id="city-target" value={target} onChange={onTarget} options={targets.slice(0, 3).map((t) => ({ v: t, label: t }))} />}
          {viewSwitch}
        </div>
        {legend}
      </div>

      {/* the figures, and the ground's pulse; the right edge keeps clear of the site's chat button */}
      <div className="absolute bottom-4 right-[5.5rem] z-10 flex items-end justify-between gap-3" style={{ left: inset.left }}>
        <div className="flex divide-x divide-zinc-200/80 rounded-2xl border border-zinc-200/90 bg-white/[0.92] shadow-[0_12px_32px_-20px_rgba(30,27,58,0.35)] backdrop-blur-xl dark:divide-zinc-800 dark:border-zinc-800/90 dark:bg-zinc-950/[0.88]">
          {hud()}
        </div>
        <GroundCard data={data} />
      </div>
    </div>
  );
}

/* the ground's pulse in one card: the P-Chain's tip, its day, the week's new L1s, and its explorer */
function GroundCard({ data }: { data: CityData }) {
  const tip = data.pulse.txs[0] ?? null;
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex min-w-0 max-w-[26rem] flex-col gap-1 rounded-2xl border border-[#5400FF]/15 bg-white/[0.92] px-4 py-2.5 shadow-[0_12px_32px_-20px_rgba(30,27,58,0.35)] backdrop-blur-xl dark:border-[#8B6CFF]/25 dark:bg-zinc-950/[0.88]">
      <span className="flex min-w-0 items-center justify-between gap-3 font-mono text-[10px]">
        <span className="flex min-w-0 items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-[#5400FF] dark:text-[#A48CFF]">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5400FF] opacity-50 dark:bg-[#8B6CFF]" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5400FF] dark:bg-[#8B6CFF]" />
          </span>
          <span className="truncate">The ground · P-Chain</span>
        </span>
        <Link href="/explorer/mainnet/p-chain" className="inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-[0.14em] text-[#5400FF] transition-opacity hover:opacity-70 dark:text-[#A48CFF]">
          Explorer
          <ArrowRight className="h-3 w-3" />
        </Link>
      </span>
      <span className="truncate font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {tip ? `block ${tip.height.toLocaleString("en-US")} · ${ageShort(tip.ts)} ago` : "reading the P-Chain"}
        {data.pulse.stats ? ` · ${data.pulse.stats.txCount24h.toLocaleString("en-US")} txs in 24h` : ""}
      </span>
      {data.newcomers.length > 0 && (
        <span className="flex min-w-0 items-center gap-2 font-mono text-[10.5px]">
          <NewBadge />
          <span className="truncate text-zinc-600 dark:text-zinc-300">
            {data.newcomers
              .slice(0, 4)
              .map((a) => `${a.name} ${ageShort(a.joinedAt)}`)
              .join(" · ")}
          </span>
        </span>
      )}
    </div>
  );
}
