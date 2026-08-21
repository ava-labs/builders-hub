"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { ArrowLeft, ArrowRight, Camera, Maximize2, Minimize2 } from "lucide-react";
import { CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { ChartWatermark } from "@/components/stats/ChartWatermark";

/* The metric detail sheets' shared chrome, extracted from the gas pilot
   so every stat family (gas, staking, …) frames its sheets identically:
   breadcrumb + title + blurb up top, the methodology colophon at the
   bottom, and instruments that carry real axes, a grid, a pan strip,
   and the fullscreen/PNG toolbar. */

export function SheetFrame({
  backHref,
  backLabel,
  title,
  blurb,
  methodology,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  blurb: string;
  methodology: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="group flex w-fit items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Link>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{blurb}</p>
      </header>

      {children}

      {/* the colophon: how this figure is measured */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          How this is measured
        </p>
        {methodology.map((para) => (
          <p
            key={para.slice(0, 32)}
            className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
          >
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

/* a full-width door to a sibling metric sheet */
export function SiblingDoor({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 border border-zinc-200 px-5 py-4 transition-colors hover:bg-zinc-50 md:px-6 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] dark:text-zinc-600" />
    </Link>
  );
}

/* ---------------------------------------------------------------- */
/* shared instruments for the sheets                                 */
/* ---------------------------------------------------------------- */

/* the detail sheets' chart chrome: every plot here gets real axes, a
   dashed grid, extra height, and the Builder Hub mark in the paper */
export const AXIS_TICK = { fontSize: 10, fill: "currentColor", opacity: 0.45 } as const;

export function SheetGrid() {
  return (
    <CartesianGrid
      strokeDasharray="3 3"
      vertical={false}
      className="stroke-zinc-200 dark:stroke-zinc-800"
    />
  );
}

/* the plate: watermark in the paper, and a hover toolbar every real
   instrument carries — fullscreen (native API) and a PNG download that
   captures the plate, watermark included */
export function ChartPlate({ children, name = "chart" }: { children: React.ReactNode; name?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onChange = () => setFs(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen();
  };

  const download = async () => {
    const el = ref.current;
    if (!el) return;
    try {
      const dark = document.documentElement.classList.contains("dark");
      const dataUrl = await toPng(el, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: dark ? "#09090b" : "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${name}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      /* capture is best-effort */
    }
  };

  const btn =
    "flex h-6 w-6 items-center justify-center border border-zinc-200 bg-white/90 text-zinc-400 transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/90 dark:hover:text-zinc-100";

  return (
    <div
      ref={ref}
      className={cn(
        "group/plate relative bg-white dark:bg-zinc-950",
        fs && "flex flex-col justify-center px-10",
      )}
    >
      <div
        className={cn(
          // z-30: ChartWatermark lifts its chart layer to z-10, and the
          // watermark itself can ride at z-20 — the toolbar tops both
          "absolute right-0 z-30 flex gap-1 opacity-0 transition-opacity group-hover/plate:opacity-100",
          fs ? "right-10 top-6" : "-top-1",
        )}
      >
        <button type="button" title="Download as image" onClick={download} className={btn}>
          <Camera className="h-3.5 w-3.5" />
        </button>
        <button type="button" title={fs ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFs} className={btn}>
          {fs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <ChartWatermark>
        <div className={cn("text-zinc-900 dark:text-zinc-100", fs ? "h-[78vh]" : "h-64")}>
          {children}
        </div>
      </ChartWatermark>
    </div>
  );
}

/* the pan strip under a time series — drag the window, drag its edges.
   Shared styling for every sheet chart's Brush. */
export const BRUSH_PROPS = {
  height: 26,
  travellerWidth: 8,
  stroke: "#A2AFB2",
  fill: "rgba(162, 175, 178, 0.06)",
  tickFormatter: () => "",
} as const;

export const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
