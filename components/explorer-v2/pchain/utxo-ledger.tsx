"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Board, CellLabel, EmptyRow, HashChip, HEAD, ROW, INK, MUTED, TxTypePill, idInk } from "@/components/explorer-v2/ui";
import { formatTime, truncate } from "@/components/explorer-v2/format";
import { crossChainAddressUrl, crossChainTxUrl } from "@/lib/crosschain-links";
import type { Utxo } from "@/lib/pchain-explorer";
import { assetAmount, crossOf, homeChain, lockAhead } from "./utxo";

/* One side of a tx's UTXOs as a ledger table: each UTXO's exact amount,
   its owners, what holds it (a stake, a time lock, a multisig threshold,
   another chain) and where it came from or went. Shared by the P-Chain,
   the X-Chain and the C-Chain's atomic txs. */

const COLS = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,7.5rem)]";

/** what holds a UTXO, as chips in the type pills' voice */
function UtxoFlags({ u, side, home }: { u: Utxo; side: "in" | "out"; home: ReturnType<typeof homeChain> }) {
  const lock = lockAhead(u);
  const cross = crossOf(u, side, home);
  const flags: { type: string; label: string; title?: string }[] = [];
  // a consumed stake output is the principal its stake gave back
  if (u.staked) flags.push(side === "out" ? { type: "stake", label: "staked" } : { type: "stake", label: "returned stake" });
  if (lock) flags.push({ type: "locked", label: `locked to ${formatTime(lock).slice(0, 10)}`, title: `time-locked until ${formatTime(lock)}` });
  if (u.addresses.length > 1) flags.push({ type: "owners", label: `${u.threshold} of ${u.addresses.length}`, title: "multisig: signatures needed of owners" });
  if (cross) flags.push({ type: "export", label: side === "in" ? `from ${cross}` : `to ${cross}` });
  if (u.utxoType && !/^transfer$/i.test(u.utxoType)) flags.push({ type: u.utxoType, label: u.utxoType.toLowerCase().replace(/[_-]/g, " ") });
  if (!flags.length) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
      {flags.map((f) => (
        <span key={f.label} title={f.title}>
          <TxTypePill type={f.type} label={f.label} />
        </span>
      ))}
    </span>
  );
}

/** a UTXO's first owner, and every owner of a multisig in a card that opens on hover or tap */
function Owners({ owners, threshold, hrefOf }: { owners: string[]; threshold: number; hrefOf: (a: string) => string }) {
  const [open, setOpen] = useState(false);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closing.current), []);
  // a mouse may cross the gap between the chip and the card without closing it; a touch opens it with a tap
  const hover = (on: boolean) => {
    clearTimeout(closing.current);
    if (on) setOpen(true);
    else closing.current = setTimeout(() => setOpen(false), 150);
  };
  if (owners.length === 1) return <HashChip value={owners[0]} href={hrefOf(owners[0])} />;
  return (
    <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <Link href={hrefOf(owners[0])} className={cn(idInk, "min-w-0 truncate hover:text-[#E6212F]")} title={owners[0]}>
        {truncate(owners[0], 10)}
      </Link>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`All ${owners.length} owners`}
            onPointerEnter={(e) => e.pointerType === "mouse" && hover(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && hover(false)}
            // a click keeps a hover-opened card open instead of toggling it shut
            onClick={(e) => {
              e.preventDefault();
              hover(true);
            }}
            className="shrink-0 border border-zinc-200 px-1.5 font-mono text-[11px] leading-[18px] text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 data-[state=open]:border-zinc-400 data-[state=open]:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100 dark:data-[state=open]:border-zinc-600 dark:data-[state=open]:text-zinc-100"
          >
            +{owners.length - 1}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={8}
          aria-label="Owners"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={(e) => e.pointerType === "mouse" && hover(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && hover(false)}
          className="w-auto max-w-[95vw] rounded-none border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="border-b border-zinc-200 px-3 py-2 font-mono text-[10px] uppercase md:px-4 tracking-[0.14em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            {threshold} of {owners.length} to sign
          </p>
          <ul className="flex flex-col gap-1.5 px-3 py-3 md:px-4">
            {owners.map((a) => (
              <li key={a} className="flex max-md:[&_a]:text-[11px]">
                <HashChip value={a} href={hrefOf(a)} len={66} />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}

export function UtxoColumn({ base, title, utxos, side }: { base: string; title: string; utxos: Utxo[]; side: "in" | "out" }) {
  const network = base.split("/")[2];
  const home = homeChain(base);
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{title}</p>
      <Board divide={false}>
        <div className={cn(HEAD, COLS, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>Amount</span>
          <span>Owner</span>
          <span>Held By</span>
          <span className="text-right">{side === "in" ? "Made In" : "Spent In"}</span>
        </div>
        {utxos.length === 0 && <EmptyRow>none</EmptyRow>}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {utxos.map((u, i) => {
            const cross = crossOf(u, side, home);
            // an input made on another chain links to its export there; an
            // output claimed on another chain links to the claim there
            const lineage =
              side === "in"
                ? u.txHash && { href: (cross && crossChainTxUrl(network, u.createdOnChainId, u.txHash)) || `${base}/tx/${u.txHash}`, hash: u.txHash }
                : u.consumingTxHash && {
                    href: (cross && crossChainTxUrl(network, u.consumedOnChainId, u.consumingTxHash)) || `${base}/tx/${u.consumingTxHash}`,
                    hash: u.consumingTxHash,
                  };
            const link = lineage ? (
              <Link href={lineage.href} className={cn(idInk, "hover:text-[#E6212F]")} title={lineage.hash}>
                {truncate(lineage.hash, 6)}
              </Link>
            ) : (
              <span className={MUTED}>{side === "out" ? "unspent" : "—"}</span>
            );
            return (
              <div key={`${u.utxoId}-${i}`} className={cn(ROW, COLS, "hover:bg-transparent dark:hover:bg-transparent")}>
                <span className={cn(INK, "truncate")} title={`${u.amount} in the smallest unit`}>
                  {assetAmount(u, true)}
                </span>
                {/* a phone sets the lineage beside the amount, the owners and holds under them */}
                <span className="truncate text-right font-mono text-[12px] md:hidden">
                  <CellLabel>{side === "in" ? "Made In" : "Spent In"}</CellLabel>
                  {link}
                </span>
                <span className="col-span-2 min-w-0 font-mono text-[12px] md:col-span-1">
                  <CellLabel>Owner</CellLabel>
                  {u.addresses.length === 0 ? (
                    <span className={MUTED}>{cross ? `on the ${cross}` : "—"}</span>
                  ) : (
                    <Owners
                      owners={u.addresses}
                      threshold={u.threshold}
                      hrefOf={(a) => (side === "in" && cross && crossChainAddressUrl(network, u.createdOnChainId, a)) || `${base}/address/${a}`}
                    />
                  )}
                </span>
                <span className="col-span-2 min-w-0 overflow-hidden md:col-span-1">
                  <CellLabel>Held By</CellLabel>
                  <UtxoFlags u={u} side={side} home={home} />
                </span>
                <span className="hidden truncate text-right font-mono text-[12px] md:block">{link}</span>
              </div>
            );
          })}
        </div>
      </Board>
    </section>
  );
}
