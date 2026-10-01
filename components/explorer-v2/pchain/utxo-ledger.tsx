"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, HEAD, ROW, INK, MUTED, TxTypePill, idInk } from "@/components/explorer-v2/ui";
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
                <span className="truncate text-right font-mono text-[12px] md:hidden">{link}</span>
                <span className="col-span-2 min-w-0 truncate font-mono text-[12px] md:col-span-1">
                  {u.addresses.length === 0 ? (
                    <span className={MUTED}>{cross ? `on the ${cross}` : "—"}</span>
                  ) : (
                    u.addresses.map((a, j) => (
                      <Link
                        key={a}
                        href={(side === "in" && cross && crossChainAddressUrl(network, u.createdOnChainId, a)) || `${base}/address/${a}`}
                        className={cn(idInk, "hover:text-[#E6212F]")}
                        title={a}
                      >
                        {j > 0 && <span className="text-zinc-300 dark:text-zinc-700">, </span>}
                        {truncate(a, 10)}
                      </Link>
                    ))
                  )}
                </span>
                <span className="col-span-2 min-w-0 overflow-hidden md:col-span-1">
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
