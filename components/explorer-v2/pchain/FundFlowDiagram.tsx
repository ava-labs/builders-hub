"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TxTypePill, feeInk, idInk, txToneText } from "@/components/explorer-v2/ui";
import { formatAvax, truncate } from "@/components/explorer-v2/format";
import { fadeUpStyle, useReveal, wipeStyle } from "@/components/explorer-v2/motion";
import { chainDisplayName, txTypeLabel, type AssetAmount, type ImportedFrom, type Utxo } from "@/lib/pchain-explorer";
import { chainOfId, crossChainTxUrl } from "@/lib/crosschain-links";
import { assetAmount, crossOf, homeChain, sumBig } from "./utxo";

/* A tx's UTXOs as a flow, in the ledger's own type: what it consumed on
   the left, what it produced on the right, each ribbon as wide as its
   amount, all meeting at the tx in the middle. A ribbon wears its family's
   tone, the one the type chips wear: a stake green, a reward amber, a
   move to or from another chain teal, an L1 balance blue, the fee red;
   plain value stays gray. Hover a ribbon or its label and the rest steps
   back. The ribbons wipe in once, the first time the flow comes into
   view. Shared by the P-Chain, the X-Chain and the C-Chain's atomic txs. */

const ROW_PX = 48;
const MAX_ROWS = 7;
const MINW = 2;
const MAXW = 14;
const GAP = 3;
/* the conduit's edges, in the ribbon column's 0..100 space */
const C_L = 43;
const C_R = 57;

type Kind = "input" | "transfer" | "stake" | "reward" | "cross" | "balance" | "fee";

const GRAY = "text-zinc-400 dark:text-zinc-500";
const TONE: Record<Kind, string> = {
  input: GRAY,
  transfer: GRAY,
  stake: txToneText("stake"),
  reward: txToneText("reward"),
  cross: txToneText("export"),
  balance: txToneText("subnet"),
  fee: feeInk,
};
const KEY: Partial<Record<Kind, string>> = { stake: "Stake", reward: "Reward", cross: "Cross-chain", balance: "L1 balance", fee: "Fee" };

interface Node {
  key: string;
  amount: number;
  kind: Kind;
  /** the amount, as read */
  label: string;
  /** an owner or a note under the amount */
  sub?: string;
  href?: string;
}

/* Whether a tx moves any UTXOs or value. Shared by the diagram and the
   table view, so both fall back to the same empty state. */
export function hasFundMovement({
  consumed,
  emitted,
  burned,
  importedFrom,
  sourceChain,
  destinationChain,
}: {
  consumed: Utxo[];
  emitted: Utxo[];
  burned: AssetAmount[];
  importedFrom?: ImportedFrom;
  sourceChain?: string;
  destinationChain?: string;
}): boolean {
  return consumed.length > 0 || emitted.length > 0 || burned.some((a) => Number(a.amount || 0) > 0) || !!importedFrom || !!sourceChain || !!destinationChain;
}

/* what a tx that moves no UTXOs did, in plain words */
function explainNoMovement(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("rewardautorenew"))
    return "It closes an auto-renewed staking cycle: the reward compounds into the validator's stake, and any share not compounded is minted into state as a reward UTXO. Nothing flows through the transaction itself.";
  if (t.includes("reward"))
    return "It ends a validation period and pays its staking reward: the payout is minted into state as reward UTXOs, not moved through the transaction. An aborted vote mints nothing.";
  if (t.includes("setautorenew") || t.includes("config"))
    return "It updates a validator's auto-renew configuration, its staking period and compounding. It changes state only and moves no funds.";
  if (t.includes("advancetime"))
    return "It advances the P-Chain's clock so scheduled staking events, validators starting and ending, can run. It carries no funds.";
  if (t.includes("disable")) return "It disables an L1 validator. It changes validator state, and its refund is handled separately, so this record moves no UTXOs.";
  return "It records a change of state and creates or spends no UTXOs.";
}

export function NoFundMovement({ txType }: { txType: string }) {
  return (
    <div className="flex flex-col gap-2 py-2">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">No UTXOs consumed or produced</p>
      <p className="max-w-2xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{explainNoMovement(txType)}</p>
    </div>
  );
}

function ribbon(sx: number, sy: number, dx: number, dy: number, w: number): string {
  const h = w / 2;
  const mx = (sx + dx) / 2;
  return `M ${sx},${sy - h} C ${mx},${sy - h} ${mx},${dy - h} ${dx},${dy - h} L ${dx},${dy + h} C ${mx},${dy + h} ${mx},${sy + h} ${sx},${sy + h} Z`;
}

/** the biggest rows, and the rest summed into one */
function capped(nodes: Node[], side: string): Node[] {
  const sorted = [...nodes].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MAX_ROWS) return sorted;
  const tail = sorted.slice(MAX_ROWS - 1);
  const amt = tail.reduce((t, n) => t + n.amount, 0);
  return [...sorted.slice(0, MAX_ROWS - 1), { key: `${side}-more`, amount: amt, kind: side === "in" ? "input" : "transfer", label: `+${tail.length} more`, sub: formatAvax(amt) }];
}

export function FundFlowDiagram({
  consumed,
  emitted,
  burned,
  txType,
  base,
  importedFrom,
  sourceChain,
  destinationChain,
  balance = 0,
}: {
  consumed: Utxo[];
  emitted: Utxo[];
  burned: AssetAmount[];
  txType: string;
  base: string;
  importedFrom?: ImportedFrom;
  sourceChain?: string;
  destinationChain?: string;
  /** nAVAX the tx moved into an L1 validator's balance: it leaves the burn for its own ribbon */
  balance?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [seen, shown] = useReveal<HTMLDivElement>();
  const movement = hasFundMovement({ consumed, emitted, burned, importedFrom, sourceChain, destinationChain });

  const model = useMemo(() => {
    const network = base.split("/")[2];
    const home = homeChain(base);
    const reward = txType.startsWith("Reward");
    const owner = (u: Utxo) => (u.addresses[0] ? `${truncate(u.addresses[0], 10)}${u.addresses.length > 1 ? ` +${u.addresses.length - 1}` : ""}` : undefined);
    const addressHref = (u: Utxo) => (u.addresses.length === 1 ? `${base}/address/${u.addresses[0]}` : undefined);

    const ins: Node[] = consumed.map((u, i) => {
      const from = crossOf(u, "in", home) ?? (sourceChain && !u.addresses.length ? chainOfId(sourceChain) : undefined);
      // an atomic input's key embeds the export that made it: the label goes there
      return {
        // the index rides along: the indexer can list a utxoId twice
        key: `in-${u.utxoId || "u"}-${i}`,
        amount: Number(u.amount || 0),
        kind: from ? "cross" : "input",
        label: assetAmount(u),
        sub: from ? `from ${from}${u.addresses.length ? "" : ` · ${truncate(u.txHash, 8)}`}` : owner(u),
        href: from && u.txHash ? crossChainTxUrl(network, u.createdOnChainId || sourceChain, u.txHash) : addressHref(u),
      };
    });
    const exported = (u: Utxo) => !!destinationChain && (u.consumedOnChainId === destinationChain || !!crossOf(u, "out", home));
    const outs: Node[] = emitted.map((u, i) => {
      const to = exported(u) ? (crossOf(u, "out", home) ?? chainOfId(destinationChain)) : undefined;
      const claim = to && u.consumingTxHash ? crossChainTxUrl(network, u.consumedOnChainId || destinationChain, u.consumingTxHash) : undefined;
      return {
        key: `out-${u.utxoId || "u"}-${i}`,
        amount: Number(u.amount || 0),
        kind: u.staked ? "stake" : reward ? "reward" : to ? "cross" : "transfer",
        label: assetAmount(u),
        sub: to ? `to ${to}${u.consumingTxHash ? ` · claimed ${truncate(u.consumingTxHash, 6)}` : ""}` : owner(u),
        href: claim ?? addressHref(u),
      };
    });
    const left = capped(ins, "in");
    const right = capped(outs, "out");
    const burnt = Number(sumBig(burned));
    const toBalance = Math.min(balance, burnt);
    if (toBalance > 0) right.push({ key: "balance", amount: toBalance, kind: "balance", label: formatAvax(toBalance), sub: "L1 balance" });
    if (burnt - toBalance > 0) right.push({ key: "fee", amount: burnt - toBalance, kind: "fee", label: formatAvax(burnt - toBalance), sub: "fee · burned" });

    // an import with no inputs of its own: one source ribbon from the chain it came from
    if ((importedFrom || sourceChain) && left.length === 0) {
      const exp = importedFrom?.exports?.[0];
      const amt = importedFrom?.exports?.reduce((t, e) => t + Number(e.amount || 0), 0) || outs.reduce((t, n) => t + n.amount, 0);
      left.push({
        key: "xc-src",
        amount: amt,
        kind: "cross",
        label: importedFrom?.chainName ?? chainDisplayName(sourceChain) ?? "Cross-chain",
        sub: exp?.txHash ? `exported in ${truncate(exp.txHash, 8)}` : exp?.evmSenders?.[0] ? truncate(exp.evmSenders[0], 10) : "imported",
        href: exp?.txHash ? crossChainTxUrl(network, sourceChain, exp.txHash) : undefined,
      });
    } else if (left.length === 0) {
      left.push({ key: "src", amount: outs.reduce((t, n) => t + n.amount, 0), kind: "input", label: "P-Chain", sub: reward ? "minted" : "state" });
    }

    const rows = Math.max(left.length, right.length, 1);
    const height = rows * ROW_PX;
    const max = Math.max(1, ...left.map((n) => n.amount), ...right.map((n) => n.amount));
    const w = (a: number) => Math.max(MINW, Math.min(MAXW, (a / max) * MAXW));
    const slot = (i: number, n: number) => (height - n * ROW_PX) / 2 + ROW_PX * (i + 0.5);
    // where each ribbon meets the conduit: stacked, centered on the middle
    const stack = (nodes: Node[]) => {
      const total = nodes.reduce((t, n) => t + w(n.amount), 0) + (nodes.length - 1) * GAP;
      let at = height / 2 - total / 2;
      return nodes.map((n) => {
        const c = at + w(n.amount) / 2;
        at += w(n.amount) + GAP;
        return c;
      });
    };
    const inAt = stack(left);
    const outAt = stack(right);
    const top = Math.min(inAt[0] - w(left[0].amount) / 2, (outAt[0] ?? height / 2) - w(right[0]?.amount ?? 0) / 2) - 8;
    const bottom =
      Math.max(inAt[inAt.length - 1] + w(left[left.length - 1].amount) / 2, (outAt[outAt.length - 1] ?? height / 2) + w(right[right.length - 1]?.amount ?? 0) / 2) + 8;
    const kinds = new Set([...left, ...right].map((n) => n.kind));
    return { left, right, height, w, slot, inAt, outAt, top, bottom, kinds };
  }, [consumed, emitted, burned, txType, base, importedFrom, sourceChain, destinationChain, balance]);

  if (!movement) return <NoFundMovement txType={txType} />;

  const fill = (key: string) => (hover === key ? 0.85 : hover ? 0.12 : 0.45);
  const dim = (key: string) => (hover && hover !== key ? 0.35 : 1);
  // the labels keep their room on a phone; from md the ribbons get theirs
  const grid = "grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[minmax(0,1fr)_minmax(8rem,1.3fr)_minmax(0,1fr)] md:gap-x-3";

  const label = (n: Node, i: number, side: "in" | "out") => {
    // a phone drops the marker for the label's room: the ribbon carries the tone
    const mark = <span className={cn("hidden size-1.5 shrink-0 bg-current md:block", TONE[n.kind])} aria-hidden />;
    // the row fades up once; the hover dims an inner layer, which the fade's last frame does not hold
    const body = (
      <span className={cn("flex min-w-0 items-center gap-2.5 transition-opacity duration-200", side === "in" && "justify-end")} style={{ opacity: dim(n.key) }}>
        {side === "out" && mark}
        <span className={cn("flex min-w-0 flex-col gap-0.5", side === "in" && "items-end text-right")}>
          <span className="max-w-full truncate font-mono text-[12px] tabular-nums text-zinc-900 md:text-[12.5px] dark:text-zinc-50">{n.label}</span>
          {n.sub && <span className={cn("max-w-full truncate font-mono text-[11px] transition-colors", n.href ? cn(idInk, "group-hover:text-[#E6212F]") : "text-zinc-400 dark:text-zinc-500")}>{n.sub}</span>}
        </span>
        {side === "in" && mark}
      </span>
    );
    const cls = cn("group flex h-12 min-w-0 items-center", side === "in" ? "justify-end" : "justify-start");
    const events = { onMouseEnter: () => setHover(n.key), onMouseLeave: () => setHover(null), style: fadeUpStyle(shown, 120 + i * 40) };
    return n.href ? (
      <Link key={n.key} href={n.href} className={cls} {...events}>
        {body}
      </Link>
    ) : (
      <div key={n.key} className={cls} {...events}>
        {body}
      </div>
    );
  };

  return (
    <div ref={seen} className="flex flex-col gap-3">
      <div className={cn(grid, "items-end font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500")}>
        <span className="text-right">Consumed · {consumed.length}</span>
        {/* a phone has no room for the type between the columns: the page head names it */}
        <span className="hidden justify-center md:flex">
          <TxTypePill type={txType} label={txTypeLabel(txType)} />
        </span>
        <span className="md:hidden" aria-hidden />
        <span>Produced · {emitted.length}</span>
      </div>
      <div className={grid} style={{ height: model.height }}>
        <div className="flex min-w-0 flex-col justify-center">{model.left.map((n, i) => label(n, i, "in"))}</div>
        <div className="relative">
          <svg viewBox={`0 0 100 ${model.height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={wipeStyle(shown)} aria-hidden>
            {model.left.map((n, i) => (
              <path
                key={n.key}
                d={ribbon(0, model.slot(i, model.left.length), C_L, model.inAt[i], model.w(n.amount))}
                className={cn("fill-current transition-[fill-opacity] duration-200", TONE[n.kind])}
                fillOpacity={fill(n.key)}
                onMouseEnter={() => setHover(n.key)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
            {model.right.map((n, i) => (
              <path
                key={n.key}
                d={ribbon(C_R, model.outAt[i], 100, model.slot(i, model.right.length), model.w(n.amount))}
                className={cn("fill-current transition-[fill-opacity] duration-200", TONE[n.kind])}
                fillOpacity={fill(n.key)}
                onMouseEnter={() => setHover(n.key)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {/* the tx: a block the ribbons pass through, in the tape's projection */}
          <span
            aria-hidden
            className="absolute"
            style={{ left: `${C_L}%`, width: `${C_R - C_L}%`, top: model.top, height: model.bottom - model.top }}
          >
            <span className="absolute -top-1.5 left-0 h-1.5 w-full origin-bottom-left skew-x-[-45deg] border border-b-0 border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
            <span className="absolute -right-1.5 top-0 h-full w-1.5 origin-top-left skew-y-[-45deg] border border-l-0 border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900" />
            <span className="absolute inset-0 border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
              <span className={cn("absolute inset-x-0 top-0 h-[3px] bg-current", txToneText(txType))} />
            </span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col justify-center">{model.right.map((n, i) => label(n, i, "out"))}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-zinc-200 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {(Object.keys(KEY) as Kind[])
          .filter((k) => model.kinds.has(k))
          .map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("size-2 bg-current", TONE[k])} aria-hidden />
              {KEY[k]}
            </span>
          ))}
        <span className="ml-auto text-zinc-400 dark:text-zinc-500">width by amount</span>
      </div>
    </div>
  );
}
