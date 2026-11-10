"use client";

/* The city's key: what the heights, the windows, the lights and the streets show, each picked where it is explained.
   It stands in the city's bottom left corner as a card of its own, and with the panel open it is the panel's foot:
   the same box, as wide as the panel and without an edge or a shadow of its own, so the key moves into the list and
   back out, never leaving the screen (city-app.tsx places it over the panel's bottom). */

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { DISTRICT_GLASS, TONE } from "@/components/explorer-v2/network/icm-map";
import { DISTRICTS } from "@/components/explorer-v2/network/districts";
import type { Height } from "@/components/explorer-v2/network/city-app";

/** what the windows paint: each district's own glass, or how current each chain's validators run */
export type Lens = "districts" | "versions";

/** the key's width as a card of its own; as the panel's foot it takes the panel's */
export const KEY_W = 320;

const swatch = (paint: string, label: string) => (
  <span key={label} className="flex items-center gap-1">
    <span className="h-2.5 w-1.5 rounded-[1px]" style={{ background: paint }} />
    {label}
  </span>
);
/* a label and what it names: two cells of a key grid, the label centred on its row */
const keyRow = (label: string, body: ReactNode) => (
  <>
    <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</span>
    <div className="flex min-w-0 items-center gap-1.5">{body}</div>
  </>
);
// both grids share the label column, so every label and every control stand on the same two edges; they keep the card's
// width (its 320 px, less its padding and edge) in the panel's wider foot too, so opening the panel moves nothing in the key
const keyGrid = "grid w-[18.125rem] grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2";

export function CityKey({
  height,
  onHeight,
  lens,
  onLens,
  versionsIn,
  painted,
  target,
  targets,
  onTarget,
  windowShort,
  inPanel,
  onSize,
}: {
  height: Height;
  onHeight: (h: Height) => void;
  lens: Lens;
  onLens: (v: Lens) => void;
  /** whether the validators' versions are in, which the Versions lens paints */
  versionsIn: boolean;
  /** the Versions lens is on and has its versions to paint */
  painted: boolean;
  target: string;
  targets: string[];
  onTarget: (t: string) => void;
  windowShort: string;
  /** the panel is open: the key is its foot */
  inPanel: boolean;
  /** the key's height as it changes, which the panel keeps clear at the foot of its list */
  onSize: (h: number) => void;
}) {
  const prevMinor = (() => {
    const m = /^(\d+)\.(\d+)/.exec(target);
    return m ? `${m[1]}.${Number(m[2]) - 1}` : "Behind";
  })();
  const versionTargets = targets.filter((t) => /^\d/.test(t)).slice(0, 4);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const seen = new ResizeObserver(() => onSize(el.offsetHeight));
    seen.observe(el);
    return () => seen.disconnect();
  }, [onSize]);
  return (
    <div
      ref={box}
      className={cn(
        "flex w-full flex-col gap-3.5 border bg-clip-padding p-3.5 font-mono text-[10.5px] text-zinc-500 backdrop-blur-xl transition-[border-color,border-radius,background-color,box-shadow] duration-300 ease-out dark:text-zinc-400",
        inPanel ? "rounded-b-2xl rounded-t-none border-transparent border-t-zinc-200/90 bg-white/[0.94] shadow-none dark:border-transparent dark:border-t-zinc-800/90 dark:bg-zinc-950/[0.9]" : "rounded-2xl border border-zinc-200/90 bg-white/[0.92] shadow-[0_12px_32px_-20px_rgba(30,27,58,0.35)] dark:border-zinc-800/90 dark:bg-zinc-950/[0.88]",
      )}
    >
      {/* the switches, and under Windows the key to what its lens paints */}
      <div className={keyGrid}>
        {keyRow(
          "Height",
          <ViewSwitch
            id="city-height"
            fill
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
          <ViewSwitch
            id="city-lens"
            fill
            value={lens}
            onChange={onLens}
            // the Versions option stands from the start, off until the validators' versions come in, so the row does not grow
            options={[
              { v: "districts" as Lens, label: "Districts" },
              { v: "versions" as Lens, label: "Versions", disabled: !versionsIn },
            ]}
          />,
        )}
        {/* one line of a fixed height in either lens, so a switch of lens moves nothing under it */}
        <div className="col-start-2 -mt-0.5 flex h-4 items-center gap-2.5 whitespace-nowrap">
          {painted ? (
            <>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-1.5 rounded-[1px]" style={{ background: TONE.on.left }} />
                {versionTargets.length > 1 ? (
                  <span className="relative flex items-center">
                    <select
                      value={target}
                      onChange={(e) => onTarget(e.target.value)}
                      aria-label="The version the windows are measured against"
                      title="The version the windows are measured against"
                      className="cursor-pointer appearance-none bg-transparent pr-3.5 font-mono text-[10.5px] font-medium text-zinc-800 outline-none dark:text-zinc-100"
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
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{target}+</span>
                )}
              </span>
              {swatch(TONE.near.left, prevMinor)}
              {swatch(TONE.stale.left, "Older")}
              {swatch(TONE.unknown.left, "Unknown")}
            </>
          ) : (
            <span className="flex items-center gap-[3px]" title="Each district's own glass; downtown's is the Avalanche red">
              {(["downtown", ...DISTRICTS.map((d) => d.key)] as const).map((k) => (
                <span key={k} className="h-2.5 w-1.5 rounded-[1px]" style={{ background: DISTRICT_GLASS[k] }} />
              ))}
            </span>
          )}
        </div>
      </div>
      {/* what moves in the city by itself */}
      <div className={keyGrid}>
        {keyRow(
          "Lights",
          <>
            {/* a pane of the city's cool glass, its storey flashing white as a tx lands */}
            <span className="relative h-2.5 w-1.5 shrink-0 rounded-[1px] bg-[#6E7F92] dark:bg-[#3B484B]">
              <span className="absolute inset-x-0 inset-y-[3px] animate-pulse bg-white" />
            </span>
            Flash with transactions, live
          </>,
        )}
        {keyRow(
          "Streets",
          <>
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
          </>,
        )}
      </div>
    </div>
  );
}
