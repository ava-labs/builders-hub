"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, useInView } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { truncate } from "./format";

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
    <div className={cn("flex items-center gap-4", className)}>
      <p className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
        {label}
      </p>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
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
    <div
      className={cn(
        "flex justify-between gap-6 py-2.5",
        align === "baseline" ? "items-baseline" : "items-start",
      )}
    >
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="min-w-0 text-right font-mono text-[11px] tracking-[0.08em] text-zinc-900 dark:text-zinc-50">
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
  const [display, setDisplay] = useState(animateIn ? 0 : value);
  useEffect(() => {
    if (!animateIn) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, animateIn]);
  return { ref, display };
}

export function StatFigure({
  value,
  animateIn = true,
  suffix,
}: {
  value: number;
  animateIn?: boolean;
  suffix?: string;
}) {
  const { ref, display } = useCountUp(value, animateIn);
  return (
    <span
      ref={ref}
      className="font-mono text-2xl tabular-nums tracking-tight text-zinc-900 md:text-[1.75rem] dark:text-zinc-50"
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
  children,
}: {
  label: string;
  live?: boolean;
  href?: string;
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
  const textCls = cn(mono && "font-mono", "text-[12px] tracking-tight");
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {href ? (
        <Link
          href={href}
          className={cn(textCls, "text-zinc-900 underline-offset-4 hover:text-[#E6212F] hover:underline dark:text-zinc-100")}
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
        className="text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
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

export function TxTypePill({ type, className }: { type: string; className?: string }) {
  const tone = pillTone(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        PILL_TONES[tone],
        className,
      )}
    >
      <span className="size-1 shrink-0 bg-current opacity-80" aria-hidden />
      {type}
    </span>
  );
}
