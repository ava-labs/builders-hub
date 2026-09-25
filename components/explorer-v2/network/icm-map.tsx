"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, SectionHeader } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { BLOCK_GRAY, PICK_BLUE, ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The network as a drafting sheet on the ICM tab: every validator set a
   square cuboid, 30 days of ICM traffic as ink arcs. The C-Chain sits at
   the hub, chains that sent or got messages ride the inner ring, quiet
   sets the outer one. Hover a chain to light its routes; click it and the
   page's tables are cut to it. Phones get the same traffic as a ranked
   list. It fetches its own data, so the page only mounts it. */

interface MapChain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  validatorCount: number | string;
}
interface FlowRoute {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}

interface Node {
  id: string;
  name: string;
  logo: string;
  validators: number;
  out: number;
  in: number;
  href: string | null;
  x: number;
  y: number;
  side: number;
  ring: "hub" | "inner" | "outer";
}
interface Route {
  key: string;
  from: string;
  to: string;
  messages: number;
  d: string;
  width: number;
  mid: [number, number];
}

type SizeBy = "validators" | "messages";

const W = 1200;
const H = 560;
const CX = W / 2;
const CY = H / 2 + 6;
const MIN_SIDE = 8;
const MAX_SIDE = 56;
const HUB_ID = "43114";
const GRAY_TOP = "#C9D1D3";
const GRAY_SIDE = "#7E8C8F";
const BLUE_TOP = "#5C9BF0";
const BLUE_SIDE = "#0049AA";

const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

/* the chain's ICM feed when it has an RPC, else its accounts */
function chainHref(chainId: string): string | null {
  const c = catalogByChainId.get(chainId);
  if (!c?.slug) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}/txs/icm` : `/explorer/mainnet/${c.slug}/accounts`;
}

/* points spread evenly on an ellipse, starting at the top */
function onRing(i: number, n: number, rx: number, ry: number, turn = 0): [number, number] {
  const a = -Math.PI / 2 + turn + (i / Math.max(1, n)) * Math.PI * 2;
  return [CX + rx * Math.cos(a), CY + ry * Math.sin(a)];
}

/* one extruded square: front face, lit top, shaded right */
function Cuboid({ x, y, side, picked }: { x: number; y: number; side: number; picked: boolean }) {
  const h = side / 2;
  const d = Math.max(2, side * 0.2);
  const l = x - h;
  const t = y - h;
  const r = x + h;
  const b = y + h;
  return (
    <g strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-zinc-700/70 dark:stroke-zinc-300/70" strokeLinejoin="round">
      <polygon points={`${l},${t} ${l + d},${t - d} ${r + d},${t - d} ${r},${t}`} fill={picked ? BLUE_TOP : GRAY_TOP} />
      <polygon points={`${r},${t} ${r + d},${t - d} ${r + d},${b - d} ${r},${b}`} fill={picked ? BLUE_SIDE : GRAY_SIDE} />
      <rect x={l} y={t} width={side} height={side} fill={picked ? PICK_BLUE : BLOCK_GRAY} />
    </g>
  );
}

function Logo({ uri, name }: { uri: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[8px] font-bold uppercase text-zinc-400 dark:border-zinc-700">
        {name.charAt(0)}
      </span>
    );
  }
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-4 w-4 shrink-0 rounded-full object-contain" />;
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-6 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </p>
  );
}

export function IcmNetworkMap({ picked = null, onPick }: { picked?: string | null; onPick?: (chainName: string) => void }) {
  const [chains, setChains] = useState<MapChain[] | null>(null);
  const [flows, setFlows] = useState<FlowRoute[]>([]);
  const [failed, setFailed] = useState(false);
  const [sizeBy, setSizeBy] = useState<SizeBy>("validators");
  const [hover, setHover] = useState<string | null>(null);
  const [hoverRoute, setHoverRoute] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // the arcs are 30 days, so the chains are too
    fetch("/api/overview-stats?timeRange=month", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { chains?: MapChain[] }) => setChains(d.chains ?? []))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    // a failed flow feed is not fatal: the chains still draw, without traffic
    fetch("/api/icm-flow?days=30", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { flows?: FlowRoute[] }) => {
        if (Array.isArray(d.flows)) setFlows(d.flows);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const { nodes, routes, byName } = useMemo(() => {
    const known = new Map((chains ?? []).map((c) => [String(c.chainId), c]));
    // only routes between mainnet chains the overview knows; the feed mixes in Fuji
    const merged = new Map<string, { from: string; to: string; messages: number }>();
    for (const f of flows) {
      const from = String(f.sourceChainId);
      const to = String(f.targetChainId);
      if (from === to || !known.has(from) || !known.has(to) || !(f.messageCount > 0)) continue;
      const k = `${from}>${to}`;
      const m = merged.get(k);
      if (m) m.messages += f.messageCount;
      else merged.set(k, { from, to, messages: f.messageCount });
    }
    const out = new Map<string, number>();
    const inn = new Map<string, number>();
    for (const r of merged.values()) {
      out.set(r.from, (out.get(r.from) ?? 0) + r.messages);
      inn.set(r.to, (inn.get(r.to) ?? 0) + r.messages);
    }

    const base = [...known.values()]
      .map((c) => {
        const id = String(c.chainId);
        return {
          id,
          name: c.chainName,
          logo: c.chainLogoURI,
          validators: typeof c.validatorCount === "number" ? c.validatorCount : 0,
          out: out.get(id) ?? 0,
          in: inn.get(id) ?? 0,
          href: chainHref(id),
        };
      })
      .filter((c) => c.validators > 0 || c.out + c.in > 0);

    const size = (c: (typeof base)[number]) => (sizeBy === "validators" ? c.validators : c.out + c.in);
    const top = Math.max(1, ...base.map(size));
    const side = (c: (typeof base)[number]) => MIN_SIDE + (MAX_SIDE - MIN_SIDE) * Math.sqrt(size(c) / top);

    const hub = base.find((c) => c.id === HUB_ID);
    const talking = base.filter((c) => c.id !== HUB_ID && c.out + c.in > 0).sort((a, b) => b.out + b.in - (a.out + a.in));
    const quiet = base.filter((c) => c.id !== HUB_ID && c.out + c.in === 0).sort((a, b) => b.validators - a.validators || a.name.localeCompare(b.name));

    const placed: Node[] = [];
    if (hub) placed.push({ ...hub, x: CX, y: CY, side: side(hub), ring: "hub" });
    talking.forEach((c, i) => {
      const [x, y] = onRing(i, talking.length, 300, 170);
      placed.push({ ...c, x, y, side: side(c), ring: "inner" });
    });
    // the outer ring starts half a step round so its sets fall between the inner labels
    quiet.forEach((c, i) => {
      const [x, y] = onRing(i, quiet.length, 540, 236, Math.PI / Math.max(1, quiet.length));
      placed.push({ ...c, x, y, side: side(c), ring: "outer" });
    });

    const at = new Map(placed.map((n) => [n.id, n]));
    const maxMsgs = Math.max(1, ...[...merged.values()].map((r) => r.messages));
    const drawn: Route[] = [...merged.values()]
      .sort((a, b) => a.messages - b.messages)
      .map((r) => {
        const a = at.get(r.from)!;
        const b = at.get(r.to)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        // the arc bows to the sender's left, so the two ways of a pair part
        const cx = (a.x + b.x) / 2 + dy * 0.2;
        const cy = (a.y + b.y) / 2 - dx * 0.2;
        return {
          key: `${r.from}>${r.to}`,
          from: r.from,
          to: r.to,
          messages: r.messages,
          d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
          width: 0.75 + 5 * Math.sqrt(r.messages / maxMsgs),
          mid: [(a.x + 2 * cx + b.x) / 4, (a.y + 2 * cy + b.y) / 4] as [number, number],
        };
      });
    return { nodes: placed, routes: drawn, byName: new Map(placed.map((n) => [n.name, n])) };
  }, [chains, flows, sizeBy]);

  // hover leads; a pick holds the light when the cursor leaves
  const pickedId = picked ? byName.get(picked)?.id ?? null : null;
  const lit = hover ?? pickedId;
  const near = useMemo(() => {
    if (!lit) return null;
    const s = new Set([lit]);
    for (const r of routes) if (r.from === lit || r.to === lit) s.add(r.from).add(r.to);
    return s;
  }, [lit, routes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const tipNode = hover ? byId.get(hover) : null;
  const tipRoute = !tipNode && hoverRoute ? routes.find((r) => r.key === hoverRoute) : null;
  const partners = (id: string) =>
    routes
      .filter((r) => r.from === id || r.to === id)
      .reduce((m, r) => {
        const other = r.from === id ? r.to : r.from;
        m.set(other, (m.get(other) ?? 0) + r.messages);
        return m;
      }, new Map<string, number>());
  const topPartner = (id: string) => [...partners(id).entries()].sort((a, b) => b[1] - a[1])[0];

  const pick = (n: Node) => onPick?.(n.name);
  const pickedNode = pickedId ? byId.get(pickedId) : null;
  const talking = nodes.filter((n) => n.ring !== "outer").sort((a, b) => b.out + b.in - (a.out + a.in));
  const quietCount = nodes.length - talking.length;
  const maxTalk = Math.max(1, ...talking.map((n) => n.out + n.in));

  const legend = (
    <span className="hidden shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 lg:flex dark:text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 border border-zinc-700/70 dark:border-zinc-300/70" style={{ background: BLOCK_GRAY }} />
        size · {sizeBy}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-zinc-900/60 dark:border-zinc-100/60" />
        width · messages
      </span>
    </span>
  );

  let body: React.ReactNode;
  if (failed) body = <EmptyRow>Chain feed unavailable</EmptyRow>;
  else if (!chains) body = <div className="h-72 animate-pulse bg-zinc-100 lg:h-[560px] dark:bg-zinc-900" />;
  else if (nodes.length === 0) body = <EmptyRow>No chains to draw</EmptyRow>;
  else
    body = (
      <>
        {/* the map, from lg up */}
        <div className="relative hidden lg:block" onMouseLeave={() => {
            setHover(null);
            setHoverRoute(null);
          }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="ICM routes between Avalanche L1s over 30 days">
            {/* drafting guides for the two rings */}
            <g fill="none" strokeWidth={1} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" className="stroke-zinc-200 dark:stroke-zinc-800">
              <ellipse cx={CX} cy={CY} rx={300} ry={170} />
              <ellipse cx={CX} cy={CY} rx={540} ry={236} />
            </g>
            <g fill="none" strokeLinecap="round">
              {routes.map((r) => {
                const on = !lit || r.from === lit || r.to === lit;
                const hot = hoverRoute === r.key || (lit !== null && on);
                return (
                  <g key={r.key}>
                    <path
                      d={r.d}
                      strokeWidth={r.width}
                      className={cn("transition-[stroke-opacity] duration-200", pickedId && (r.from === pickedId || r.to === pickedId) ? "stroke-[#0061E2] dark:stroke-[#5f9dff]" : "stroke-zinc-900 dark:stroke-zinc-100")}
                      strokeOpacity={hot ? 0.85 : on ? 0.4 : 0.06}
                    />
                    {/* a wider, clear stroke to catch the cursor */}
                    <path
                      d={r.d}
                      stroke="transparent"
                      strokeWidth={Math.max(10, r.width + 6)}
                      onMouseEnter={() => setHoverRoute(r.key)}
                      onMouseLeave={() => setHoverRoute(null)}
                    />
                  </g>
                );
              })}
            </g>
            {nodes.map((n) => {
              const dim = near !== null && !near.has(n.id);
              const up = hover === n.id;
              // quiet sets go unnamed, except the big ones a reader will look for
              const labelled = n.ring !== "outer" || n.validators >= 20;
              const right = n.x >= CX;
              const below = n.y > CY;
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.name}: ${n.validators} validators, ${n.out} messages out, ${n.in} in`}
                  aria-pressed={pickedId === n.id}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => pick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(n);
                    }
                  }}
                  className="cursor-pointer outline-none transition-[opacity,transform] duration-200 ease-out"
                  style={{ opacity: dim ? 0.22 : 1, transform: up ? "translateY(-3px)" : undefined }}
                >
                  {/* a clear pad so small sets are easy to catch */}
                  <rect x={n.x - Math.max(10, n.side / 2 + 3)} y={n.y - Math.max(10, n.side / 2 + 3)} width={Math.max(20, n.side + 6)} height={Math.max(20, n.side + 6)} fill="transparent" />
                  <Cuboid x={n.x} y={n.y} side={n.side} picked={pickedId === n.id} />
                  {labelled && (
                    <text
                      x={n.ring === "hub" ? n.x : n.x + (right ? 1 : -1) * (n.side / 2 + 8)}
                      y={n.ring === "hub" ? n.y + n.side / 2 + 16 : n.y + (below ? n.side / 2 : -n.side / 2) + (below ? 10 : -4)}
                      textAnchor={n.ring === "hub" ? "middle" : right ? "start" : "end"}
                      className={cn(
                        "pointer-events-none select-none font-mono text-[11px] uppercase tracking-[0.08em] stroke-white [paint-order:stroke] [stroke-width:4px] dark:stroke-zinc-950",
                        pickedId === n.id ? "fill-[#0061E2] dark:fill-[#5f9dff]" : "fill-zinc-500 dark:fill-zinc-400",
                      )}
                    >
                      {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {tipNode && (
            <span
              className="pointer-events-none absolute z-20"
              style={{
                top: `${(tipNode.y / H) * 100}%`,
                ...(tipNode.x > CX ? { right: `calc(${100 - (tipNode.x / W) * 100}% + ${tipNode.side / 2 + 14}px)` } : { left: `calc(${(tipNode.x / W) * 100}% + ${tipNode.side / 2 + 14}px)` }),
                transform: "translateY(-50%)",
              }}
            >
              <TipPlate>
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                  <Logo uri={tipNode.logo} name={tipNode.name} />
                  {tipNode.name}
                </p>
                <TipRow label="Validators" value={tipNode.validators.toLocaleString("en-US")} />
                <TipRow label="Messages out" value={fmtCompact(tipNode.out)} />
                <TipRow label="Messages in" value={fmtCompact(tipNode.in)} />
                {(() => {
                  const p = topPartner(tipNode.id);
                  return p ? <TipRow label="Most with" value={byId.get(p[0])?.name ?? p[0]} /> : null;
                })()}
                {onPick && (
                  <p className="mt-1 font-mono text-[10px] text-zinc-400">{pickedId === tipNode.id ? "Click to clear the cut" : "Click to cut the tables"}</p>
                )}
              </TipPlate>
            </span>
          )}
          {tipRoute && (
            <span
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+8px)]"
              style={{ left: `${(tipRoute.mid[0] / W) * 100}%`, top: `${(tipRoute.mid[1] / H) * 100}%` }}
            >
              <TipPlate>
                <p className="font-mono text-[10px] text-zinc-500">
                  {byId.get(tipRoute.from)?.name} → {byId.get(tipRoute.to)?.name}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{fmtCompact(tipRoute.messages)} msgs</p>
              </TipPlate>
            </span>
          )}
          <p className="pointer-events-none absolute bottom-3 left-5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 md:left-6 dark:text-zinc-500">
            Inner ring {talking.length - (byId.has(HUB_ID) ? 1 : 0)} chains with traffic · outer ring {quietCount} quiet sets
          </p>
        </div>

        {/* phones and tablets: the same traffic, ranked */}
        <ul className="lg:hidden">
          {talking.map((n, i) => {
            const on = pickedId === n.id;
            const total = n.out + n.in;
            return (
              <li key={n.id} className={cn("border-b border-zinc-100 last:border-b-0 dark:border-zinc-900", on && "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10")}>
                <button
                  type="button"
                  onClick={() => pick(n)}
                  aria-pressed={on}
                  className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2.5 text-left"
                >
                  <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      <Logo uri={n.logo} name={n.name} />
                      <span className="truncate">{n.name}</span>
                    </span>
                    <span className="block h-1.5 max-w-full" style={{ width: `${Math.max(2, (total / maxTalk) * 100)}%`, background: on ? PICK_BLUE : BLOCK_GRAY }} />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums leading-tight text-zinc-900 dark:text-zinc-50">
                    {fmtCompact(n.out)} <span className="text-zinc-400 dark:text-zinc-500">out</span>
                    <br />
                    {fmtCompact(n.in)} <span className="text-zinc-400 dark:text-zinc-500">in</span>
                  </span>
                </button>
              </li>
            );
          })}
          <li className="px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
            {quietCount} validator sets without traffic
          </li>
        </ul>

        {/* the pick, with its door */}
        {pickedNode && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-200 px-5 py-2.5 font-mono text-[11px] md:px-6 dark:border-zinc-800">
            <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">
              <span className="text-[#0061E2] dark:text-[#5f9dff]">{pickedNode.name}</span> · {fmtCompact(pickedNode.out)} out · {fmtCompact(pickedNode.in)} in<span className="hidden sm:inline"> · cuts the tables below</span>
            </span>
            {pickedNode.href && (
              <Link
                href={pickedNode.href}
                className="inline-flex shrink-0 items-center gap-1 uppercase tracking-[0.14em] text-[10px] text-[#0061E2] transition-colors hover:text-zinc-900 dark:text-[#5f9dff] dark:hover:text-zinc-100"
              >
                Open explorer
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </>
    );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Network Map · 30 days"
        action={
          <span className="flex shrink-0 items-center gap-4">
            {legend}
            <span className="hidden lg:block">
              <ViewSwitch
                id="icm-map-size"
                value={sizeBy}
                onChange={setSizeBy}
                options={[
                  { v: "validators", label: "Validators" },
                  { v: "messages", label: "Messages" },
                ]}
              />
            </span>
          </span>
        }
      />
      <Board divide={false} className="border">
        {body}
      </Board>
    </section>
  );
}
