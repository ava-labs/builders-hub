"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, Copy, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { Logo, mixTotal, pctInk } from "@/components/explorer-v2/network/icm-map";
import { districtLabel, type District } from "@/components/explorer-v2/network/districts";
import { isPrivateChain, PRIVATE_NOTE } from "@/components/explorer-v2/network/private";
import { ValidatorList, blockchainIdOf } from "@/components/explorer-v2/network/chain-quick-info";
import { useClock, type LiveTip } from "@/components/explorer-v2/network/chain-live";
import { PCHAIN_LOGO } from "@/components/explorer-v2/network/city-model";
import type { PchainPulse } from "@/components/explorer-v2/network/pchain-pulse";
import type { Row } from "@/components/explorer-v2/network/city-app";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import type { L1Chain } from "@/types/stats";

/* A chain, opened in the Chains app (city-app.tsx): its view in the app's
   panel and its phone sheet, the P-Chain's view in the same grammar, and
   the small parts that the app's lists share with them. */

export const REQUEST_LISTING_URL = "https://forms.gle/N4QkRo9UR45xeTTp9";

/* ------------------------------------------------------------------ */
/* small parts                                                         */
/* ------------------------------------------------------------------ */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400", className)}>{children}</p>;
}

export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
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
export function BigLogo({ uri, name, size = 44 }: { uri: string; name: string; size?: number }) {
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

export function NewBadge() {
  return <span className="shrink-0 border border-[#A2AFB2] px-1 py-px font-mono text-[8px] font-bold tracking-[0.1em] text-[#5F6B7A] dark:border-[#5F6B7A] dark:text-[#A2AFB2]">NEW</span>;
}

/* a private L1 (private.ts), in the badge grammar NEW wears: its data is not public, which is why its panel is short */
export function PrivateBadge() {
  return (
    <span title="A private, permissioned L1: its RPC, blocks and node versions are not public" className="shrink-0 border border-[#A2AFB2] px-1 py-px font-mono text-[8px] font-bold tracking-[0.1em] text-[#5F6B7A] dark:border-[#5F6B7A] dark:text-[#A2AFB2]">
      PRIVATE
    </span>
  );
}

/* the share on target, in the fleet's ink */
export function Pct({ row, className }: { row: Row; className?: string }) {
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
/* a chain, opened                                                     */
/* ------------------------------------------------------------------ */

export function ChainView({
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
  headOnly = false,
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
  /** the head alone (the logo, the name, the district): a pick's first frame, while the rest renders a frame later */
  headOnly?: boolean;
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
  const figure = (label: string, value: ReactNode, sub?: ReactNode, wide = false) => (
    <div className={cn("flex min-w-0 flex-col gap-0.5 bg-white px-3 py-2.5 dark:bg-zinc-950", wide && "col-span-2")}>
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
  const head = (
    <>
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
            {isPrivateChain(c) && <PrivateBadge />}
            {row.newAt !== null && <NewBadge />}
          </p>
        </div>
      </div>
    </>
  );
  // a pick's first frame: the head at once, the rest with the deferred render
  if (headOnly) return <div className="px-4 pb-6 pt-3">{head}</div>;
  return (
    <div className="px-4 pb-6 pt-3">
      {head}
      {c?.description && <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{c.description}</p>}
      {isPrivateChain(c) && <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{PRIVATE_NOTE}</p>}

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
          {figure(`On ${target}+`, row.pct === null ? "—" : <span className={pctInk(row.mix, row.pct)}>{row.pct}%</span>, row.mix && !isPrivateChain(c) ? `${row.mix.on} of ${mixTotal(row.mix)} nodes` : isPrivateChain(c) ? "private" : "not reported")}
          {/* a chain with no ICM in the window shows no counts: its tx figure takes the row */}
          {figure(`Tx · ${windowShort}`, row.tx === null ? "—" : fmtCompact(row.tx), undefined, row.out + row.in === 0)}
          {row.out + row.in > 0 && figure(`ICM · ${windowShort}`, fmtCompact(row.out + row.in), `${fmtCompact(row.out)} out · ${fmtCompact(row.in)} in`)}
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
          !isPrivateChain(c) &&
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

/* the P-Chain's view, in the chain view's grammar. It has no EVM network
   to add, so its first door is Core, the wallet that holds P-Chain AVAX and
   stakes it; then its explorer, its figures and its facts. Its validators
   are the Primary Network's, the set that runs the C-Chain too */
const CORE_DOWNLOAD = "https://core.app/download";
const PCHAIN_RPC = "https://api.avax.network/ext/bc/P";

export function PChainView({
  primary,
  pulse,
  target,
  onBack,
  backLabel,
}: {
  /** the Primary Network's row: its validators and their versions */
  primary: Row | null;
  pulse: PchainPulse;
  target: string;
  onBack?: () => void;
  backLabel: string;
}) {
  const s = pulse.stats;
  const head = pulse.txs[0] ?? null;
  // the stats' tip when it is newer, else the newest tx's block, as the P wing's card reads it
  const height = Math.max(s?.tipHeight ?? 0, head?.height ?? 0) || null;
  const at = s && s.tipHeight >= (head?.height ?? 0) ? s.tipTimestamp : (head?.ts ?? null);
  const pBase = "/explorer/mainnet/p-chain";
  const behind = primary?.mix ? primary.mix.near + primary.mix.stale : 0;
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
  return (
    <div className="px-4 pb-6 pt-3">
      {onBack && <BackButton onClick={onBack}>{backLabel}</BackButton>}
      <div className="mt-3 flex items-center gap-3">
        <BigLogo uri={PCHAIN_LOGO} name="P-Chain" />
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">P-Chain</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            <span>Downtown · Primary Network</span>
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
        The P-Chain keeps the validator sets of Avalanche. It runs staking on the Primary Network, and it creates L1s and manages their validators.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={CORE_DOWNLOAD}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Download className="h-4 w-4" />
          Download Core
        </a>
        <Link
          href={pBase}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-[13px] font-semibold text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Explorer
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        {figure("Validators", primary ? primary.validators.toLocaleString("en-US") : "—", behind > 0 ? `${behind} behind ${target}` : undefined)}
        {figure(
          `On ${target}+`,
          !primary || primary.pct === null ? "—" : <span className={pctInk(primary.mix, primary.pct)}>{primary.pct}%</span>,
          primary?.mix ? `${primary.mix.on} of ${mixTotal(primary.mix)} nodes` : "not reported",
        )}
        {figure("Tx · 24H", s ? fmtCompact(s.txCount24h) : "—")}
        {figure("Block", height === null ? "—" : height.toLocaleString("en-US"))}
      </dl>

      <dl className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-900">
        {/* the P-Chain's ID is the empty ID, which is the Primary Network's subnet ID too */}
        {fact("Blockchain ID", <CopyValue value={PRIMARY_SUBNET_ID} shown={truncate(PRIMARY_SUBNET_ID, 8)} href={pBase} />)}
        {fact("Token", <span className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">AVAX</span>)}
        {fact("Public RPC", <CopyValue value={PCHAIN_RPC} shown={PCHAIN_RPC.replace(/^https?:\/\//, "")} />)}
        {at !== null && fact("Last block", <LastBlock live={null} pulseAt={at * 1000} />)}
        {fact(
          "Validators",
          <Link href={`${pBase}/validators`} className="inline-flex items-center gap-1 font-mono text-[11.5px] text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50">
            Stake and uptime
            <ArrowRight className="h-3 w-3" />
          </Link>,
        )}
      </dl>
    </div>
  );
}
