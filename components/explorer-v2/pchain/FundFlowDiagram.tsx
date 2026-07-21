"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatAvax, truncate } from "@/components/explorer-v2/format";
import { chainDisplayName, type AssetAmount, type ImportedFrom, type Utxo } from "@/lib/pchain-explorer";

/**
 * Fund flow as a hand-rolled Sankey in the landing-v2 drafting-sheet idiom.
 * Inputs (left) and outputs (right) sit on an even row grid with aligned label
 * columns; thin filled ribbons (width ∝ nAVAX, tightly clamped) fan through a
 * central TX conduit. Semantic colors: staked = steel, reward = good, burn/fee
 * = red, cross-chain (import source / export destination) = brand blue; plain
 * value transfers stay neutral. Deterministic (SSR-safe), framer-motion
 * draw-in, hover-to-isolate, "+N more" grouping.
 */

const VBW = 1000;
const IN_X = 300;
const OUT_X = 700;
const LABEL_IN = 286;
const LABEL_OUT = 714;
const CEN_L = 462;
const CEN_R = 538;
const ROWH = 48;
const REGION_TOP = 84;
const MINW = 1.5;
const MAXW = 9;
const MAX_ROWS = 7;

const STEEL = "#A2AFB2";
const GOOD = "#4e9a52";
const RED = "#E6212F";
const BLUE = "#0061E2";

type Kind = "input" | "transfer" | "staked" | "reward" | "burn" | "crosschain";
interface Flow {
  key: string;
  amount: number;
  addresses: string[];
  kind: Kind;
  overflow?: number;
  label: string;
  sub?: string; // explicit sub-label (cross-chain / burn); else derived from address
}

function build(utxos: Utxo[], side: "in" | "out", reward: boolean): Flow[] {
  const flows: Flow[] = utxos.map((u, i) => ({
    key: `${side}-${u.utxoId || i}`,
    amount: Number(u.amount || 0),
    addresses: u.addresses ?? [],
    kind: side === "in" ? "input" : u.staked ? "staked" : reward ? "reward" : "transfer",
    label: formatAvax(u.amount),
  }));
  flows.sort((a, b) => b.amount - a.amount);
  if (flows.length <= MAX_ROWS) return flows;
  const head = flows.slice(0, MAX_ROWS - 1);
  const tail = flows.slice(MAX_ROWS - 1);
  const amt = tail.reduce((t, f) => t + f.amount, 0);
  head.push({
    key: `${side}-more`,
    amount: amt,
    addresses: [],
    kind: side === "in" ? "input" : "transfer",
    overflow: tail.length,
    label: `+${tail.length} more`,
    sub: formatAvax(amt),
  });
  return head;
}

const KIND_COLOR: Record<Kind, { cls?: string; hex?: string }> = {
  input: { cls: "fill-zinc-400 dark:fill-zinc-600" },
  transfer: { cls: "fill-zinc-400 dark:fill-zinc-600" },
  staked: { hex: STEEL },
  reward: { hex: GOOD },
  burn: { hex: RED },
  crosschain: { hex: BLUE },
};
const KIND_LABEL: Partial<Record<Kind, string>> = { staked: "Staked", reward: "Reward", burn: "Burn / fee", crosschain: "Cross-chain" };

/* Whether a tx actually moves any UTXOs / value. Shared by the diagram and the
   table view so both fall back to the same explanatory empty state. */
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
  return (
    consumed.length > 0 ||
    emitted.length > 0 ||
    burned.some((a) => Number(a.amount || 0) > 0) ||
    !!importedFrom ||
    !!sourceChain ||
    !!destinationChain
  );
}

/* Explanatory empty state — teaches what the tx did instead of a blank panel. */
export function NoFundMovement({ txType }: { txType: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="inline-flex items-center gap-1.5 border border-zinc-200 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        <span className="size-1 bg-[#4e9a52]" aria-hidden />
        {txType.replace(/Tx$/, "")}
      </span>
      <p className="max-w-md font-mono text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {explainNoMovement(txType)}
      </p>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-600">
        No UTXOs created or spent
      </span>
    </div>
  );
}

/* Plain-language explanation for tx types that move no UTXOs, so the fund-flow
   panel teaches instead of showing an empty diagram. */
function explainNoMovement(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("rewardautorenew"))
    return "Settles an auto-renewed staking cycle: the earned reward is compounded back into the validator's stake (or the cycle is closed out) as on-chain state. No UTXOs are created or spent.";
  if (t.includes("reward"))
    return "Marks the end of a validation period and settles its staking reward. When the reward is compounded or the period is aborted, the outcome is recorded as state and no UTXOs move.";
  if (t.includes("setautorenew") || t.includes("config"))
    return "Updates a validator's auto-renew configuration — staking period and compounding. It changes on-chain state only and moves no funds.";
  if (t.includes("advancetime"))
    return "Advances the P-Chain timestamp so scheduled staking events (validators starting/ending) can be processed. It carries no funds.";
  if (t.includes("disable"))
    return "Disables an L1 validator. It updates validator state and refunds are handled separately, so this record itself moves no UTXOs.";
  return "This transaction records on-chain state and does not create or spend any UTXOs.";
}

function ribbon(sx: number, sy: number, dx: number, dy: number, w: number): string {
  const h = w / 2;
  const mx = (sx + dx) / 2;
  return `M ${sx},${sy - h} C ${mx},${sy - h} ${mx},${dy - h} ${dx},${dy - h} L ${dx},${dy + h} C ${mx},${dy + h} ${mx},${sy + h} ${sx},${sy + h} Z`;
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
}: {
  consumed: Utxo[];
  emitted: Utxo[];
  burned: AssetAmount[];
  txType: string;
  base: string;
  importedFrom?: ImportedFrom;
  sourceChain?: string;
  destinationChain?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const reward = txType.startsWith("Reward");

  // Some tx types (reward / auto-renew settlements, state-only records) move no
  // UTXOs at all — a Sankey of nothing looks broken, so show a tidy empty state.
  const movement = hasFundMovement({ consumed, emitted, burned, importedFrom, sourceChain, destinationChain });

  const model = useMemo(() => {
    const burnedAmt = burned.reduce((t, a) => t + Number(a.amount || 0), 0);
    const emittedTotal = emitted.reduce((t, u) => t + Number(u.amount || 0), 0);

    const ins = build(consumed, "in", reward);
    const outs = build(emitted, "out", reward);
    if (burnedAmt > 0) outs.push({ key: "burn", amount: burnedAmt, addresses: [], kind: "burn", label: formatAvax(burnedAmt), sub: "burn · fee" });

    // Cross-chain: imports get a source node (origin chain + EVM sender);
    // exports get a destination node. (Import origin is resolvable because the
    // source export id is embedded in the consumed UTXO; an export's counterpart
    // import isn't discoverable, so we show the destination chain only.)
    const isImport = !!importedFrom || !!sourceChain;
    if (ins.length === 0) {
      if (isImport) {
        const exp = importedFrom?.exports?.[0];
        const amt = importedFrom?.exports?.reduce((t, e) => t + Number(e.amount || 0), 0) || emittedTotal;
        ins.push({
          key: "xc-src",
          amount: amt,
          addresses: [],
          kind: "crosschain",
          label: importedFrom?.chainName ?? chainDisplayName(sourceChain) ?? "Cross-chain",
          sub: exp?.evmSenders?.[0] ? truncate(exp.evmSenders[0], 12) : "imported →",
        });
      } else {
        ins.push({ key: "src", amount: emittedTotal, addresses: [], kind: "input", label: "P-Chain", sub: "funds" });
      }
    }
    if (destinationChain) {
      outs.push({
        key: "xc-dst",
        amount: emittedTotal || 1,
        addresses: [],
        kind: "crosschain",
        label: chainDisplayName(destinationChain) ?? "Destination",
        sub: "destination →",
      });
    }

    const rows = Math.max(ins.length, outs.length, 1);
    const regionH = rows * ROWH;
    const H = REGION_TOP + regionH + 8;
    const centerY = REGION_TOP + regionH / 2;
    const maxAmt = Math.max(1, ...ins.map((f) => f.amount), ...outs.map((f) => f.amount));
    const w = (a: number) => Math.max(MINW, Math.min(MAXW, (a / maxAmt) * MAXW));
    const rowY = (i: number, n: number) => REGION_TOP + (regionH - n * ROWH) / 2 + ROWH * (i + 0.5);
    const stackCenters = (flows: Flow[]) => {
      const total = flows.reduce((t, f) => t + w(f.amount), 0) + (flows.length - 1) * 2;
      let acc = centerY - total / 2;
      return flows.map((f) => {
        const bw = w(f.amount);
        const cy = acc + bw / 2;
        acc += bw + 2;
        return cy;
      });
    };
    const inSeg = stackCenters(ins);
    const outSeg = stackCenters(outs);
    const inputs = ins.map((f, i) => ({ f, w: w(f.amount), slotCy: rowY(i, ins.length), segCy: inSeg[i] }));
    const outputs = outs.map((f, i) => ({ f, w: w(f.amount), slotCy: rowY(i, outs.length), segCy: outSeg[i] }));
    const stackTop = Math.min(inSeg[0], outSeg[0]) - MAXW / 2;
    const stackBot = Math.max(inSeg[inSeg.length - 1], outSeg[outSeg.length - 1]) + MAXW / 2;

    const kinds = new Set<Kind>([...inputs, ...outputs].map((n) => n.f.kind));
    return { inputs, outputs, H, centerY, cenTop: stackTop - 8, cenBot: stackBot + 8, nIn: consumed.length, nOut: emitted.length, kinds };
  }, [consumed, emitted, burned, reward, importedFrom, sourceChain, destinationChain]);

  const fillOp = (key: string, b: number) => (hover === key ? Math.min(0.9, b + 0.3) : hover ? b * 0.12 : b);
  const op = (key: string) => (hover && hover !== key ? 0.25 : 1);

  if (!movement) return <NoFundMovement txType={txType} />;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${VBW} ${model.H}`} preserveAspectRatio="xMidYMid meet" className="w-full min-w-[760px] select-none" role="img" aria-label="Transaction fund flow">
        <ColHeader x={LABEL_IN} anchor="end" label={`Inputs · ${model.nIn}`} rule={[24, IN_X]} />
        <ColHeader x={LABEL_OUT} anchor="start" label={`Outputs · ${model.nOut}`} rule={[OUT_X, VBW - 24]} />
        <line x1={IN_X} y1={REGION_TOP} x2={IN_X} y2={model.H - 8} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
        <line x1={OUT_X} y1={REGION_TOP} x2={OUT_X} y2={model.H - 8} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />

        {model.inputs.map(({ f, w, slotCy, segCy }) => {
          const { cls, hex } = KIND_COLOR[f.kind];
          return (
            <motion.path key={f.key} d={ribbon(IN_X, slotCy, CEN_L, segCy, w)} className={cls} fill={hex}
              stroke={hex ?? "currentColor"} strokeOpacity={hover === f.key ? 0.7 : 0.35} strokeWidth={0.6}
              initial={{ opacity: 0 }} animate={{ opacity: 1, fillOpacity: fillOp(f.key, 0.6) }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setHover(f.key)} onMouseLeave={() => setHover(null)} />
          );
        })}
        {model.outputs.map(({ f, w, slotCy, segCy }) => {
          const { cls, hex } = KIND_COLOR[f.kind];
          return (
            <motion.path key={f.key} d={ribbon(CEN_R, segCy, OUT_X, slotCy, w)} className={cls} fill={hex}
              stroke={hex ?? "currentColor"} strokeOpacity={hover === f.key ? 0.7 : 0.35} strokeWidth={0.6}
              initial={{ opacity: 0 }} animate={{ opacity: 1, fillOpacity: fillOp(f.key, 0.6) }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setHover(f.key)} onMouseLeave={() => setHover(null)} />
          );
        })}

        <rect x={CEN_L} y={model.cenTop} width={CEN_R - CEN_L} height={model.cenBot - model.cenTop}
          className="fill-white stroke-zinc-900 dark:fill-zinc-950 dark:stroke-zinc-100" strokeWidth={1.25} />
        <rect x={CEN_L} y={model.cenTop} width={CEN_R - CEN_L} height={3} fill={RED} />
        <circle cx={(CEN_L + CEN_R) / 2} cy={model.centerY} r={3} fill={RED}>
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x={(CEN_L + CEN_R) / 2} y={model.cenTop - 12} textAnchor="middle" className="fill-zinc-900 dark:fill-zinc-50"
          fontSize={11} fontWeight={700} fontFamily="var(--font-mono)" style={{ letterSpacing: "0.08em" }}>
          {txType.replace(/Tx$/, "").toUpperCase()}
        </text>

        {model.inputs.map(({ f, slotCy }) => (
          <NodeLabel key={f.key} f={f} mx={IN_X} labelX={LABEL_IN} y={slotCy} side="in" base={base} opacity={op(f.key)}
            onEnter={() => setHover(f.key)} onLeave={() => setHover(null)} />
        ))}
        {model.outputs.map(({ f, slotCy }) => (
          <NodeLabel key={f.key} f={f} mx={OUT_X} labelX={LABEL_OUT} y={slotCy} side="out" base={base} opacity={op(f.key)}
            onEnter={() => setHover(f.key)} onLeave={() => setHover(null)} />
        ))}
      </svg>

      {/* legend — only the meaningful semantic colors; neutral transfers are implicit */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {(["staked", "reward", "burn", "crosschain"] as const)
          .filter((k) => model.kinds.has(k))
          .map((k) => (
            <LegendChip key={k} label={KIND_LABEL[k]!} style={{ background: KIND_COLOR[k].hex }} />
          ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-600">ribbon width ∝ amount</span>
      </div>
    </div>
  );
}

function NodeLabel({
  f, mx, labelX, y, side, base, opacity, onEnter, onLeave,
}: {
  f: Flow; mx: number; labelX: number; y: number; side: "in" | "out"; base: string; opacity: number; onEnter: () => void; onLeave: () => void;
}) {
  const { cls, hex } = KIND_COLOR[f.kind];
  const anchor = side === "in" ? "end" : "start";
  const addr = f.addresses[0];
  const sub = f.sub ?? (addr ? truncate(addr, 14) : "");
  const g = (
    <g opacity={opacity} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ transition: "opacity 0.2s" }}>
      <rect x={mx - 3.5} y={y - 3.5} width={7} height={7} className={cls} fill={hex} />
      <text x={labelX} y={sub ? y - 3 : y + 4} textAnchor={anchor} className="fill-zinc-900 dark:fill-zinc-50" fontSize={13} fontFamily="var(--font-mono)" style={{ letterSpacing: "-0.01em" }}>
        {f.label}
      </text>
      {sub && (
        <text x={labelX} y={y + 12} textAnchor={anchor} className="fill-zinc-400 dark:fill-zinc-500" fontSize={10.5} fontFamily="var(--font-mono)">
          {sub}
        </text>
      )}
    </g>
  );
  return addr && !f.overflow ? <a href={`${base}/address/${addr}`}>{g}</a> : g;
}

function ColHeader({ x, anchor, label, rule }: { x: number; anchor: "start" | "end"; label: string; rule: [number, number] }) {
  return (
    <g>
      <text x={x} y={44} textAnchor={anchor} className="fill-zinc-500 dark:fill-zinc-400" fontSize={11} fontWeight={700} fontFamily="var(--font-mono)" style={{ letterSpacing: "0.18em" }}>
        {label.toUpperCase()}
      </text>
      <line x1={rule[0]} y1={56} x2={rule[1]} y2={56} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
    </g>
  );
}

function LegendChip({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-4" style={style} />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{label}</span>
    </span>
  );
}
