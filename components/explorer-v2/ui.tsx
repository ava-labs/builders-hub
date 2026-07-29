"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { truncate } from "./format";

/* ------------------------------------------------------------------ */
/* Rise — the landing/solutions load sequence: each block fades up in   */
/* turn. Mount-only, so live repolls never re-trigger it.               */
export function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Section header — mono label + hairline rule (the v2 eyebrow motif)  */
export function SectionHeader({
  label,
  action,
  className,
}: {
  label: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    // min-h keeps headers the same height whether or not they carry an
    // action chip, so side-by-side boards always start at the same y
    <div className={cn("flex min-h-6 items-center gap-4", className)}>
      <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
        {label}
      </p>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {action}
    </div>
  );
}

/* The page's subject at headline weight — bold mono, one click to copy. */
export function SubjectHeadline({
  value,
  display,
  prefix,
  copyLabel = "Copy",
}: {
  /** what lands on the clipboard */
  value: string;
  /** what renders — defaults to value */
  display?: string;
  /** leading noun, kept outside the break-all span so it never splits */
  prefix?: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the text is selectable anyway */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copyLabel}
      className="group flex w-fit max-w-full items-baseline gap-3 text-left"
    >
      <span className="min-w-0 font-mono text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
        {prefix && <>{prefix} </>}
        <span className="break-all">{display ?? value}</span>
      </span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 self-center text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 self-center text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
      )}
    </button>
  );
}

/* A title bar INSIDE a Board — for stat strips, where a free-floating
   SectionHeader above the box stacks three full-width rules (header rule,
   board top, board bottom) and the readings float between lines. Fusing
   the label into the plate makes one contained instrument panel: title
   block on a quiet tint, readings below. */
export function BoardHeader({
  label,
  action,
  display = false,
}: {
  label: string;
  action?: React.ReactNode;
  /** the lead-board treatment: the SectionHeader's full-ink mono voice,
   *  a step up from the quiet gray label — for the one or two boards that
   *  headline a page, not every strip */
  display?: boolean;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p
        className={cn(
          "min-w-0 truncate font-mono font-bold uppercase tracking-[0.22em]",
          display
            ? "text-[11px] text-zinc-900 dark:text-zinc-100"
            : "text-[10px] text-zinc-500 dark:text-zinc-400",
        )}
      >
        {label}
      </p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board — the translucent hairline content surface                    */
export function Board({
  children,
  className,
  divide = true,
}: {
  children: React.ReactNode;
  className?: string;
  divide?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80",
        divide && "divide-y divide-zinc-200 dark:divide-zinc-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ChartBoard — a fully-outlined chart card: mono title bar fused       */
/* inside the border, the instrument below. Give it an href and the     */
/* whole card becomes a door to that stat's detail sheet — border       */
/* darkens, title bar tints, the red arrow slides in. The one chart     */
/* container every explorer surface should reach for.                   */
export function ChartBoard({
  label,
  action,
  href,
  children,
  className,
  bodyClassName,
}: {
  label: string;
  action?: React.ReactNode;
  /** the stat's detail sheet — makes the whole card clickable */
  href?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const inner = (
    <>
      <div
        className={cn(
          "flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 transition-colors md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40",
          href && "group-hover/chart:bg-zinc-100 dark:group-hover/chart:bg-zinc-900",
        )}
      >
        <p className="flex min-w-0 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
          <span className="truncate">{label}</span>
          {href && (
            <ArrowRight className="h-3 w-3 shrink-0 -translate-x-0.5 text-[#E6212F] opacity-0 transition-all group-hover/chart:translate-x-0 group-hover/chart:opacity-100" />
          )}
        </p>
        {action}
      </div>
      <div className={cn("px-5 py-5 md:px-6", bodyClassName)}>{children}</div>
    </>
  );
  const frame =
    "border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80";
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          frame,
          "group/chart block transition-colors hover:border-zinc-400 dark:hover:border-zinc-600",
          className,
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cn(frame, className)}>{inner}</div>;
}

/* ------------------------------------------------------------------ */
/* Spec plate — key/value hairline rows (tx/block/address detail)      */
export function SpecPlate({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-zinc-200 dark:divide-zinc-800", className)}>{children}</dl>;
}

export function SpecRow({
  label,
  children,
  align = "baseline",
}: {
  label: string;
  children: React.ReactNode;
  align?: "baseline" | "start";
}) {
  return (
    // hierarchy over volume: quiet mono label, sans value. Mono in the value
    // column is reserved for identifiers (HashChip carries its own font-mono),
    // so hashes read as data while types, dates, and amounts read as language.
    <div
      className={cn(
        "flex justify-between gap-6 py-3.5",
        align === "baseline" ? "items-baseline" : "items-start",
      )}
    >
      <dt className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[13.5px] font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
        {children}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tiles — count-up figures with optional red live dot            */
function useCountUp(value: number, animateIn: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  // live figures re-render with fresh values (polling); tween from wherever
  // the counter currently sits instead of replaying the 0→value entrance.
  const current = useRef(animateIn ? 0 : value);
  const [display, setDisplay] = useState(current.current);
  useEffect(() => {
    if (!animateIn) {
      current.current = value;
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(current.current, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        current.current = v;
        setDisplay(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, value, animateIn]);
  return { ref, display };
}

export function StatFigure({
  value,
  animateIn = true,
  suffix,
  className,
}: {
  value: number;
  animateIn?: boolean;
  suffix?: string;
  className?: string;
}) {
  const { ref, display } = useCountUp(value, animateIn);
  return (
    <span
      ref={ref}
      className={cn(
        "font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50",
        className,
      )}
    >
      {display.toLocaleString("en-US")}
      {suffix && <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">{suffix}</span>}
    </span>
  );
}

export function StatDash() {
  return <span className="font-mono text-2xl text-zinc-300 dark:text-zinc-700">—</span>;
}

export function StatCell({
  label,
  live = false,
  href,
  sub,
  children,
}: {
  label: string;
  live?: boolean;
  href?: string;
  /** Optional muted line under the figure — a qualifier or an affordance hint. */
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls = "flex flex-col gap-1.5 px-5 py-5 md:px-6";
  const inner = (
    <>
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 lg:whitespace-nowrap">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
          </span>
        )}
        {label}
      </span>
      {children}
      {sub != null && (
        <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
          {sub}
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function StatStrip({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const gridCols =
    cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <Board divide={false}>
      <div className={cn("grid grid-cols-1 divide-y divide-zinc-200 sm:divide-y-0 sm:divide-x dark:divide-zinc-800", gridCols)}>
        {children}
      </div>
    </Board>
  );
}

/* ------------------------------------------------------------------ */
/* Detail-page skeleton — the page's real chrome lands instantly (the
   section header and board frames); only the data slots shimmer. The
   sweep runs left→right with the avalanche ease (sharp attack, long
   decay), cascading row by row down the plate.                        */

function Bone({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span className={cn("relative block overflow-hidden bg-zinc-100 dark:bg-zinc-900", className)}>
      <span
        data-bone-sweep
        className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-zinc-700/40"
        style={{
          animation: `v2-bone-sweep 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s infinite`,
          transform: "translateX(-100%)",
        }}
      />
    </span>
  );
}

const SKELETON_ROW_WIDTHS = ["w-3/5", "w-28", "w-44", "w-56", "w-36"];

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="flex flex-col gap-10">
      <style>{`
        @keyframes v2-bone-sweep { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
        @media (prefers-reduced-motion: reduce) { [data-bone-sweep] { animation: none !important; } }
      `}</style>

      {/* section header: real label + the red "alive" pulse while we fetch */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <p className="flex shrink-0 items-center gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
            </span>
            {label}
          </p>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <Bone className="h-5 w-24" delay={0.1} />
        </div>

        {/* two rails of spec-plate row shapes, like the loaded page */}
        <div className="grid items-start gap-8 lg:grid-cols-2">
          {[0, 1].map((col) => (
            <Board key={col} divide={false} className="px-5 py-2 md:px-6">
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {SKELETON_ROW_WIDTHS.map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-6 py-3.5">
                    <Bone className="h-2.5 w-20 shrink-0" delay={col * 0.2 + i * 0.08} />
                    <Bone className={cn("h-2.5", w)} delay={col * 0.2 + i * 0.08} />
                  </div>
                ))}
              </div>
            </Board>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CellLabel — inline column label for list-board cells on mobile,
   where the md:grid header row is hidden and a bare grid-cols-2 of
   values would be unreadable. Renders nothing at md and up.           */
export function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 md:hidden dark:text-zinc-500">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* DarkToggle — segmented control in the dark statement panels' voice
   (#1F1F1F boards: the staking calculator, the gas cost panel).        */
export function DarkToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex shrink-0 flex-wrap border border-white/15">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            o.value === value
              ? "bg-[#EBF0FA] text-zinc-900"
              : "text-[#A2AFB2] hover:bg-white/10 hover:text-[#EBF0FA]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Identifier ink — the one blue every clickable identifier wears,
   whether it's a standalone HashChip link or the lead cell of a row-
   Link (where a nested <a> is invalid and the row itself navigates).
   Blue = "this ID takes you to its page", everywhere, no exceptions. */
export const idInk = "text-[#0061E2] dark:text-[#5f9dff]";

/* ------------------------------------------------------------------ */
/* HashChip — mono truncated hash/address with copy                    */
export function HashChip({
  value,
  href,
  len = 10,
  className,
  mono = true,
}: {
  value: string;
  href?: string;
  len?: number;
  className?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  const text = truncate(value, len);
  // break-all lets a full-length hash wrap on narrow viewports instead of
  // dragging the whole row past the sheet edge — char-count truncation is
  // not width-aware, so the chip must be able to shrink on its own.
  const textCls = cn(mono && "font-mono", "min-w-0 break-all text-[13px] font-medium tracking-tight");
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      {href ? (
        <Link
          href={href}
          className={cn(textCls, idInk, "underline-offset-4 hover:text-[#E6212F] hover:underline")}
          title={value}
        >
          {text}
        </Link>
      ) : (
        <span className={cn(textCls, "text-zinc-700 dark:text-zinc-300")} title={value}>
          {text}
        </span>
      )}
      <button
        onClick={copy}
        className="-m-1.5 shrink-0 p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* TxTypePill — squared badge, tinted by tx/block-type family          */

/* Full static class strings (so Tailwind's scanner keeps the arbitrary
   hex utilities) — one tone per functional family. */
const PILL_TONES = {
  stake:
    "border-[#4e9a52]/40 bg-[#4e9a52]/10 text-[#3f7d43] dark:border-[#4e9a52]/45 dark:text-[#77c47b]",
  reward:
    "border-[#C7911B]/40 bg-[#C7911B]/12 text-[#9c7112] dark:border-[#C7911B]/45 dark:text-[#e2b953]",
  subnet:
    "border-[#0061E2]/35 bg-[#0061E2]/10 text-[#0052bd] dark:border-[#0061E2]/50 dark:text-[#5f9dff]",
  crosschain:
    "border-[#0891B2]/40 bg-[#0891B2]/10 text-[#0c7590] dark:border-[#0891B2]/50 dark:text-[#3fc1dc]",
  danger:
    "border-[#E6212F]/40 bg-[#E6212F]/10 text-[#c11824] dark:border-[#E6212F]/50 dark:text-[#ff6b73]",
  neutral:
    "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
} as const;

function pillTone(type: string): keyof typeof PILL_TONES {
  const t = type.toLowerCase();
  if (t.includes("abort") || t.includes("disable") || t.includes("remove")) return "danger";
  if (t.includes("reward")) return "reward";
  if (t.includes("import") || t.includes("export")) return "crosschain";
  if (
    t.includes("validator") ||
    t.includes("delegator") ||
    t.includes("stake") ||
    t.includes("commit")
  )
    return "stake";
  if (
    t.includes("subnet") ||
    t.includes("chain") ||
    t.includes("l1") ||
    t.includes("convert") ||
    t.includes("proposal") ||
    t.includes("weight") ||
    t.includes("balance")
  )
    return "subnet";
  return "neutral";
}

export function TxTypePill({
  type,
  label,
  className,
}: {
  /** the raw type: what the tone is derived from */
  type: string;
  /** friendly display text; defaults to `type`. Kept separate because
   *  `pillTone` matches on substrings of the raw type, so rendering a label
   *  through `type` would silently retone some pills (a "Auto-Renew Config"
   *  label loses the "validator" that puts it in the stake family). */
  label?: string;
  className?: string;
}) {
  const tone = pillTone(type);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        PILL_TONES[tone],
        className,
      )}
    >
      <span className="size-1 shrink-0 bg-current opacity-80" aria-hidden />
      <span className="truncate">{label ?? type}</span>
    </span>
  );
}

/* Text-only variant of the pill tones, for surfaces (like the block tape)
   where a bordered badge is too heavy but the family color still reads. */
const TONE_TEXT = {
  stake: "text-[#3f7d43] dark:text-[#77c47b]",
  reward: "text-[#9c7112] dark:text-[#e2b953]",
  subnet: "text-[#0052bd] dark:text-[#5f9dff]",
  crosschain: "text-[#0c7590] dark:text-[#3fc1dc]",
  danger: "text-[#c11824] dark:text-[#ff6b73]",
  neutral: "text-zinc-500 dark:text-zinc-400",
} as const;

export function txToneText(type: string): string {
  return TONE_TEXT[pillTone(type)];
}

/* TypeFilterRail — squared toggle chips in the segmented-control idiom.
   Each type chip carries its family tone square, the same tone its pills
   wear in the table below, so the filter and the results visibly speak
   the same language. Shared by the tx and block list pages. */
export function TypeFilterRail({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        Filter
      </span>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              active
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
            )}
          >
            {o.value && (
              <span
                className={cn("size-1 shrink-0 bg-current", !active && txToneText(o.value))}
                aria-hidden
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
