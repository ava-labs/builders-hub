"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Block tape — the digital-blocks pattern doing real work, drawn in the
   drafting sheet's axonometric projection: every block is an extruded
   cuboid (lit top face, shaded right face). The live block wears the red
   ramp (#FF394A top / #E6212F front / #B20F2A side); data-carrying blocks
   fill with the brand block gray; empty blocks stay bare sheet. Newest
   enters left and pushes the cascade rightward; the right edge fades off
   the sheet instead of hard-clipping. Shared by the P-Chain and every
   EVM chain explorer so the tape reads identically across the app.      */

export interface TapeBlock {
  key: string;
  /** display block number, already formatted */
  number: string;
  txCount: number;
  /** small third line: block kind (COMMIT) or gas figure */
  label?: string;
  /** merged tapes: the chain that sealed the block. Takes over the header
   *  row (logo + name) and pushes the block number down to the label line —
   *  on a cross-chain cascade the chain is the identity, not the height */
  chain?: { name: string; logo: string };
  /** tone class for the label (defaults to quiet zinc) */
  labelClass?: string;
  /** preformatted age ("1m ago") */
  ago?: string;
  /** 0..1 gas utilization — EVM blocks fill from the bottom like vessels;
   *  omit (P-Chain) and the block renders as before */
  fill?: number;
  href: string;
}

const DEPTH = "0.5rem"; // extrusion depth — keep in sync with the -top/-right offsets

export function BlockTape({ blocks }: { blocks: TapeBlock[] }) {
  return (
    <div className="relative overflow-hidden">
      <div className="flex gap-2 pr-2 pt-3">
        {blocks.map((b, i) => {
          const live = i === 0;
          const hasFill = typeof b.fill === "number";
          // with a fill level the level IS the tint — a flat carries-tint
          // underneath would double-shade the face
          const carries = !hasFill && b.txCount > 0;
          // the liquid wraps the solid: same level on front and right faces
          // (right a shade deeper, matching the face shading); the top face
          // only tints once the block is effectively sealed
          const fillPct = hasFill
            ? Math.min(100, Math.max(b.fill! > 0 ? 4 : 0, Math.round(b.fill! * 100)))
            : 0;
          const sealed = hasFill && fillPct >= 98;
          return (
            <motion.div
              key={b.key}
              layout="position"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              // momentum curve: sharp attack, long decay — stretched so a
              // single arriving block glides rather than snaps
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              // hover lifts the whole cuboid off the sheet: all three faces
              // ride the same group-hover translate so it moves as one solid
              className="group relative w-[96px] shrink-0"
            >
              {/* top face — tints only when the block is sealed full */}
              <span
                aria-hidden
                className={cn(
                  "absolute -top-2 left-0 w-full origin-bottom-left skew-x-[-45deg] transition-transform duration-200 ease-out group-hover:-translate-y-1",
                  live
                    ? "bg-[color-mix(in_srgb,var(--chain-accent,#E6212F)_75%,white)]"
                    : sealed
                      ? "border border-b-0 border-zinc-200 bg-[#A2AFB2]/60 dark:border-zinc-800 dark:bg-[#A2AFB2]/40"
                      : carries
                        ? "border border-b-0 border-zinc-200 bg-[#A2AFB2]/35 dark:border-zinc-800 dark:bg-[#A2AFB2]/25"
                        : "border border-b-0 border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800",
                )}
                style={{ height: DEPTH }}
              />
              {/* right face — carries the same liquid level, a shade deeper */}
              <span
                aria-hidden
                className={cn(
                  "absolute -right-2 top-0 h-full origin-top-left skew-y-[-45deg] overflow-hidden transition-transform duration-200 ease-out group-hover:-translate-y-1",
                  live
                    ? "bg-[color-mix(in_srgb,var(--chain-accent,#E6212F)_70%,black)]"
                    : carries
                      ? "border border-l-0 border-zinc-200 bg-[#A2AFB2]/50 dark:border-zinc-800 dark:bg-[#A2AFB2]/15"
                      : "border border-l-0 border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900",
                )}
                style={{ width: DEPTH }}
              >
                {hasFill && (
                  <span
                    aria-hidden
                    // inherits the parent's skew, so the level stays a clean
                    // parallelogram slice meeting the front face's waterline
                    className={cn(
                      "absolute inset-x-0 bottom-0 block",
                      live ? "bg-black/30" : "bg-[#A2AFB2]/60 dark:bg-[#A2AFB2]/40",
                    )}
                    style={{ height: `${fillPct}%` }}
                  />
                )}
              </span>
              <Link
                href={b.href}
                className={cn(
                  "relative flex h-full flex-col gap-1 overflow-hidden px-3 py-2.5 backdrop-blur-sm transition-[background-color,translate] duration-200 ease-out group-hover:-translate-y-1",
                  live
                    ? "bg-[var(--chain-accent,#E6212F)] hover:bg-[color-mix(in_srgb,var(--chain-accent,#E6212F)_80%,black)]"
                    : carries
                      ? "border border-zinc-200 bg-[#A2AFB2]/15 hover:bg-[#A2AFB2]/30 dark:border-zinc-800 dark:bg-[#A2AFB2]/10 dark:hover:bg-[#A2AFB2]/20"
                      : "border border-zinc-200 bg-white/80 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:bg-zinc-900",
                )}
              >
                {/* gas level — the block as a vessel, filling bottom-up.
                    Text spans are positioned so they paint above the level. */}
                {hasFill && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 bottom-0",
                      live ? "bg-black/20" : "bg-[#A2AFB2]/40 dark:bg-[#A2AFB2]/25",
                    )}
                    style={{ height: `${fillPct}%` }}
                  />
                )}
                <span
                  className={cn(
                    "relative flex min-w-0 items-center gap-1.5 font-mono text-[10px] tabular-nums tracking-tight",
                    live ? "text-white/80" : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  {live && (
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                  )}
                  {b.chain ? (
                    <>
                      <img
                        src={b.chain.logo}
                        alt=""
                        className="h-3.5 w-3.5 shrink-0 rounded-full object-contain"
                      />
                      <span
                        className={cn(
                          "truncate font-medium",
                          live ? "text-white" : "text-zinc-700 dark:text-zinc-300",
                        )}
                      >
                        {b.chain.name}
                      </span>
                    </>
                  ) : (
                    b.number
                  )}
                </span>
                <span
                  className={cn(
                    "relative font-mono text-[15px] tabular-nums",
                    live ? "text-white" : "text-zinc-900 dark:text-zinc-100",
                  )}
                >
                  {b.txCount}
                  <span className={cn("ml-1 text-[10px]", live ? "text-white/70" : "text-zinc-400 dark:text-zinc-500")}>
                    tx
                  </span>
                </span>
                <span
                  className={cn(
                    "relative flex min-w-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                    live ? "text-white/90" : (b.labelClass ?? "text-zinc-500 dark:text-zinc-400"),
                  )}
                >
                  <span className={cn("truncate", b.chain && "tabular-nums")}>
                    {b.chain ? b.number : (b.label ?? " ")}
                  </span>
                </span>
                <span
                  className={cn(
                    "relative font-mono text-[9px] tabular-nums",
                    live ? "text-white/60" : "text-zinc-400 dark:text-zinc-600",
                  )}
                >
                  {b.ago ?? " "}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
      {/* the tape runs off the sheet — fade instead of a hard clip */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-white dark:to-zinc-950"
        aria-hidden
      />
    </div>
  );
}

export function BlockTapeSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden pr-2 pt-3">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="flex w-[96px] shrink-0 flex-col gap-2 border border-zinc-200 px-3 py-3 dark:border-zinc-800"
        >
          <div className="h-2 w-14 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-8 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-2 w-12 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </div>
  );
}
