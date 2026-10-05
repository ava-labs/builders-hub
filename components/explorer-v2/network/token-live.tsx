"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Board, INK, LiveDot, MUTED, ROW, SectionHeader, feeInk } from "@/components/explorer-v2/ui";
import { Belt, MotionRow, useFreeze } from "@/components/explorer-v2/evm/LiveBoards";
import { ageShort, formatNumber } from "@/components/explorer-v2/format";
import { AX, FACE, Instrument, Tip, XTicks, robustTop, useWidth } from "@/components/explorer-v2/gas/instruments";
import { riseStyle, EASE_CSS } from "@/components/explorer-v2/motion";

/* The C-Chain's burn this second. One feed, polled every few seconds,
   drives three things on the AVAX page: the embers that rise into the
   burned slab on the supply solid, the odometer of what has burned since
   the reader opened the page, and the belt of the latest blocks, each a
   cuboid as tall as its burn. The blocks on screen at load are context;
   only the blocks that arrive after it count as burned since opening. */

export interface LiveBurn {
  number: number;
  burned: number;
  /** ms */
  timestamp: number;
  /** arrived after the page opened */
  fresh: boolean;
  /** its place among the blocks of the poll that brought it, oldest first */
  lane: number;
}

export interface LiveBurns {
  /** newest first */
  blocks: LiveBurn[];
  /** AVAX burned by the blocks that arrived after the page opened */
  sum: number;
  count: number;
  failed: boolean;
}

interface ExplorerBlock {
  number: string;
  gasUsed: string;
  baseFeePerGas?: string;
  burnedFee?: string;
  timestampMilliseconds?: number;
  timestamp: string;
}

const POLL_MS = 2500;
const KEEP = 48;

/** the burn: the API's receipt sum when present, else the header
 *  estimate (block gasUsed × base fee) */
function burnOf(b: ExplorerBlock): number {
  if (b.burnedFee) return parseFloat(b.burnedFee);
  if (!b.baseFeePerGas) return 0;
  return (parseInt(b.gasUsed.replace(/,/g, ""), 10) * parseFloat(b.baseFeePerGas)) / 1e9;
}

export function fmtBurn(v: number): string {
  if (v === 0) return "0";
  if (v < 0.00001) return v.toExponential(2);
  return v.toFixed(8).replace(/\.?0+$/, "");
}

interface State {
  blocks: LiveBurn[];
  sum: number;
  count: number;
  /** the newest block at load: every later block is fresh */
  floor: number | null;
}

export function useLiveBurns(): LiveBurns {
  const [st, setSt] = useState<State>({ blocks: [], sum: 0, count: 0, floor: null });
  const [failed, setFailed] = useState(false);
  const last = useRef<number | undefined>(undefined);
  const busy = useRef(false);

  const poll = useCallback(async (): Promise<void> => {
    // a hidden tab burns nothing on the reader's screen
    if (busy.current || document.visibilityState === "hidden") return;
    busy.current = true;
    try {
      const q = last.current !== undefined ? `lastFetchedBlock=${last.current}` : "initialLoad=true";
      const res = await fetch(`/api/explorer/43114?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { stats?: { latestBlock?: number }; blocks?: ExplorerBlock[] } = await res.json();
      if (data.stats?.latestBlock) last.current = data.stats.latestBlock;
      if (data.blocks?.length) {
        const got = data.blocks
          .map((b) => ({ number: parseInt(b.number, 10), burned: burnOf(b), timestamp: b.timestampMilliseconds || new Date(b.timestamp).getTime() }))
          .sort((a, b) => a.number - b.number);
        setSt((prev) => {
          const floor = prev.floor ?? Math.max(...got.map((b) => b.number));
          const by = new Map(prev.blocks.map((b) => [b.number, b]));
          let sum = prev.sum;
          let count = prev.count;
          let lane = 0;
          for (const b of got) {
            if (by.has(b.number)) continue;
            const fresh = prev.floor !== null && b.number > floor;
            by.set(b.number, { ...b, fresh, lane: fresh ? lane++ : 0 });
            if (fresh) {
              sum += b.burned;
              count += 1;
            }
          }
          return { blocks: [...by.values()].sort((a, b) => b.number - a.number).slice(0, KEEP), sum, count, floor };
        });
      }
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const loop = async () => {
      await poll();
      if (alive) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  return { blocks: st.blocks, sum: st.sum, count: st.count, failed };
}

/* ------------------------------------------------------------------ */
/* the odometer: each digit a wheel that rolls to its new value        */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Odometer({ value, decimals = 6, className }: { value: number; decimals?: number; className?: string }) {
  const text = value.toFixed(decimals);
  const chars = text.split("");
  return (
    <span className={cn("inline-flex tabular-nums", className)} role="img" aria-label={text}>
      {chars.map((ch, i) => {
        // keyed from the right, so a wheel keeps its place as the figure grows
        const key = chars.length - i;
        if (!/\d/.test(ch)) return <span key={key}>{ch}</span>;
        return (
          <span key={key} aria-hidden className="relative inline-block h-[1em] overflow-hidden leading-none">
            <span
              className="flex flex-col"
              style={{ transform: `translateY(-${Number(ch)}em)`, transition: `transform 900ms ${EASE_CSS}` }}
            >
              {DIGITS.map((d) => (
                <span key={d} className="h-[1em] leading-none">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* the belt: the latest blocks as cuboids, as tall as their burn;      */
/* each arrival slides the belt one slot left                           */

const SLOTS = 40;
const BELT_PX = 132;
/* the burn's faces: front, lit top, shaded side */
const EMBER = ["fill-[#F07A83] dark:fill-[#B8232F]", "fill-[#F8B4B9] dark:fill-[#D9434E]", "fill-[#CB3440] dark:fill-[#7A1119]"] as const;

/** the belt's scale: one spike cannot flatten the rest */
function beltScale(strip: LiveBurn[]) {
  const robust = robustTop(strip.map((b) => b.burned));
  return { top: robust.top * 1.15 || 1, clipped: robust.clipped };
}

/** a burn's height on the belt, lids and all */
const beltH = (v: number, top: number, room: number) => (v <= 0 ? 1 : Math.max(2, (Math.min(v, top) / top) * room));

function BurnBelt({ strip }: { strip: LiveBurn[] }) {
  const router = useRouter();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const robust = beltScale(strip);
  const top = robust.top;
  const slot = w / SLOTS;
  const gap = Math.max(1.5, slot * 0.24);
  const d = Math.min(7, Math.max(2, slot * 0.3));
  const fw = Math.max(1, slot - gap - d);
  const room = BELT_PX - d - 1;
  const hOf = (v: number) => beltH(v, top, room);
  const newest = strip[strip.length - 1];
  const idx = (i: number) => SLOTS - (strip.length - i);
  const hb = hover !== null ? strip.find((b) => b.number === hover) : null;
  const hi = hb ? strip.indexOf(hb) : -1;

  return (
    // the svg clips the block sliding out; the box itself leaves room for the scale's name
    <div ref={ref} className="relative" style={{ height: BELT_PX }} onMouseLeave={() => setHover(null)}>
      {strip.length > 0 && (
        <span className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-zinc-200 dark:border-zinc-800" style={{ top: BELT_PX - room }}>
          <span className="absolute -top-[15px] right-3 bg-white/85 px-1 font-mono text-[9px] tabular-nums text-zinc-500 md:right-4 dark:bg-zinc-950/85 dark:text-zinc-400">
            {robust.clipped ? `scale to ${fmtBurn(top)} AVAX · red lids run past it` : `top ${fmtBurn(top)} AVAX`}
          </span>
        </span>
      )}
      {w > 0 && (
        <svg width={w} height={BELT_PX} viewBox={`0 0 ${w} ${BELT_PX}`} className="absolute inset-0" aria-hidden>
          {/* the tray: every slot's footprint, so the belt reads as filling while it waits */}
          {Array.from({ length: SLOTS }, (_, i) => {
            const x = i * slot + gap / 2;
            return <polygon key={`t${i}`} points={`${x},${BELT_PX} ${x + d},${BELT_PX - d} ${x + fw + d},${BELT_PX - d} ${x + fw},${BELT_PX}`} className="fill-zinc-100 dark:fill-zinc-900" />;
          })}
          {strip.map((b, i) => {
            const h = hOf(b.burned);
            const yt = BELT_PX - h;
            const faces = hover === b.number ? FACE.focus : b === newest ? FACE.live : EMBER;
            const over = b.burned > top;
            return (
              // the belt slides as blocks arrive; each block rises as it lands
              <g key={b.number} style={{ transform: `translateX(${idx(i) * slot + gap / 2}px)`, transition: `transform 800ms ${EASE_CSS}` }}>
                <g
                  style={riseStyle(true, 0, 620)}
                  onMouseEnter={() => setHover(b.number)}
                  onClick={() => router.push(`/explorer/mainnet/c-chain/block/${b.number}`)}
                  className="cursor-pointer"
                >
                  {/* the hit area is the whole slot, so a short block is still easy to point at */}
                  <rect x={0} y={0} width={fw + d} height={BELT_PX} fill="transparent" />
                  <rect x={0} y={yt} width={fw} height={h} className={faces[0]} />
                  <polygon points={`0,${yt} ${d},${yt - d} ${fw + d},${yt - d} ${fw},${yt}`} className={over ? FACE.live[1] : faces[1]} />
                  <polygon points={`${fw},${yt} ${fw + d},${yt - d} ${fw + d},${BELT_PX - d} ${fw},${BELT_PX}`} className={faces[2]} />
                </g>
              </g>
            );
          })}
        </svg>
      )}
      {hb && hi >= 0 && (
        <Tip at={(idx(hi) + 0.5) / SLOTS}>
          <p className="font-mono text-[10px] text-zinc-500">
            Block {formatNumber(hb.number)} · {ageShort(Math.floor(hb.timestamp / 1000))} ago
          </p>
          <p className="font-mono text-[11px] font-semibold tabular-nums text-[#E6212F]">{fmtBurn(hb.burned)} AVAX burned</p>
        </Tip>
      )}
    </div>
  );
}

const ROWS = 5;
const COLS = "grid-cols-[minmax(0,1fr)_auto_2.5rem]";

/** the burn this second: the odometer since opening, the belt, the last rows */
export function LiveBurnPanel({ live, price }: { live: LiveBurns; price: number }) {
  const [hover, setHover] = useState(false);
  const rows = useFreeze(live.blocks.slice(0, ROWS + 1), hover);
  // oldest left, newest right; one extra slot slides out on the left
  const strip = useMemo(() => live.blocks.slice(0, SLOTS + 1).reverse(), [live.blocks]);
  const newest = strip[strip.length - 1];
  const usd = price > 0 && live.sum > 0 ? ` · $${(live.sum * price).toFixed(live.sum * price < 1 ? 4 : 2)}` : "";
  // the right face carries the newest block's burn at the belt's scale
  const side = newest ? (
    <span className="absolute inset-x-0" style={{ bottom: AX, height: BELT_PX }}>
      <span
        className="absolute inset-x-0 bottom-0 border-t border-[#B20F2A] bg-[#E6212F]/70 transition-[height] duration-700"
        style={{ height: beltH(newest.burned, beltScale(strip).top, BELT_PX - 8) }}
      />
    </span>
  ) : null;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        label="Live Block Burns"
        action={
          <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            <LiveDot />
            C-Chain
          </span>
        }
      />
      <Instrument
        label="Burned since you opened this page"
        figure={<Odometer value={live.sum} decimals={6} />}
        unit="AVAX"
        sub={live.count ? `${live.count} block${live.count === 1 ? "" : "s"}${usd}` : live.failed ? "block feed unavailable" : "waiting for the next block"}
        side={side}
      >
        <BurnBelt strip={strip} />
        <XTicks items={[{ at: 0.02, label: `${SLOTS} blocks ago` }, { at: 0.98, label: "latest" }]} />
      </Instrument>
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <Belt rows={ROWS}>
          {rows.map((b, i) => (
            <MotionRow key={b.number} animateIn overflow={i >= ROWS}>
              <Link href={`/explorer/mainnet/c-chain/block/${b.number}`} className={cn(ROW, COLS)}>
                <span className={INK}>{formatNumber(b.number)}</span>
                <span className={cn("text-right font-mono text-[12.5px] tabular-nums", feeInk)}>{fmtBurn(b.burned)} AVAX</span>
                <span className={cn(MUTED, "text-right")}>{ageShort(Math.floor(b.timestamp / 1000))}</span>
              </Link>
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}
