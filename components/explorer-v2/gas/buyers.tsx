"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GasProtocol } from "@/lib/explorer-clickhouse";
import { TAIL_TONE } from "@/components/explorer-v2/ShareMap";
import { truncate } from "@/components/explorer-v2/format";

/* The gas market's buyers: the contracts that bought the window's gas,
   grouped by protocol where the registry knows them, as share-map parts
   for the Gas tab and as the demand sheet's full table. */

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

/* display name: registry protocol, else sourcify name, else short addr */
function protocolLabel(p: GasProtocol, names: Map<string, string>): string {
  if (!p.address) return p.name;
  return names.get(p.address.toLowerCase()) ?? shortAddr(p.address);
}

/* a protocol opens on its busiest contract in the window */
function protocolHref(p: GasProtocol, base: string): string | null {
  const a = p.address ?? p.topContract;
  return a ? `${base}/address/${a}` : null;
}

/* the treemap's table twin — every figure the tiles can't fit */
export function ProtocolTable({
  protocols,
  names,
  base,
  symbol,
}: {
  protocols: GasProtocol[];
  names: Map<string, string>;
  base: string;
  symbol: string;
}) {
  return (
    <table className="w-full min-w-[46rem] table-fixed border-collapse">
      <thead>
        {/* proportional widths: table-fixed would otherwise hand every
            spare pixel to the one unsized column and strand the numbers
            against the right edge */}
        <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
          <th className={cn(PTH, "w-[30%]")}>Buyer</th>
          <th className={cn(PTH, "w-[14%]")}>Category</th>
          <th className={cn(PTH, "w-[10%] text-right")}>Gas Share</th>
          <th className={cn(PTH, "w-[12%] text-right")}>Txs</th>
          <th className={cn(PTH, "w-[10%] text-right")}>Senders</th>
          <th className={cn(PTH, "w-[12%] text-right")}>Fees ({symbol})</th>
          <th className={cn(PTH, "w-[12%] text-right")}>Δ prev</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {protocols.map((p) => {
          const label = protocolLabel(p, names);
          const href = protocolHref(p, base);
          return (
            <tr key={p.key}>
              <td className={cn(PTD, "truncate")}>
                {href ? (
                  <Link
                    href={href}
                    className="font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                )}
              </td>
              <td className={cn(PTD, "font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400")}>
                {p.category ?? "—"}
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300")}>
                {p.sharePct.toFixed(1)}%
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400")}>
                {p.txs.toLocaleString()}
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400")}>
                {p.senders.toLocaleString()}
              </td>
              <td className={cn(PTD, "text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400")}>
                {p.feesAvax.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td
                className={cn(
                  PTD,
                  "text-right font-mono tabular-nums",
                  p.deltaPct === null
                    ? "text-zinc-400 dark:text-zinc-500"
                    : p.deltaPct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[#E6212F]",
                )}
              >
                {p.deltaPct === null
                  ? "—"
                  : `${p.deltaPct >= 0 ? "+" : ""}${p.deltaPct.toFixed(0)}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const PTH =
  "px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
export const PTD = "px-5 py-3 text-[13px] md:px-6";

/** the buyers as share-map parts; the long-tail group is a remainder, so it closes the strip */
export function protocolShareParts(protocols: GasProtocol[], names: Map<string, string>, base: string) {
  return [...protocols].sort((a, b) => Number(/long tail/i.test(a.name) && !a.address) - Number(/long tail/i.test(b.name) && !b.address)).map((p) => {
    const tail = !p.address && /long tail/i.test(p.name);
    const named = p.address ? names.get(p.address.toLowerCase()) : p.name;
    return {
      key: p.key,
      label: named ?? (p.address ? truncate(p.address, 10) : p.name),
      value: p.gas,
      mono: !named,
      href: protocolHref(p, base) ?? undefined,
      sub: [p.category, `${p.txs.toLocaleString("en-US")} txs`, `${p.senders.toLocaleString("en-US")} sender${p.senders === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
      detail: p.address ?? undefined,
      tone: tail ? TAIL_TONE : undefined,
    };
  });
}
