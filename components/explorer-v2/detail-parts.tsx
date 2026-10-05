"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, LiveDot } from "./ui";

/* Two small parts the detail pages share: a reading in a page's rail and
   the not-found panel. They sit apart from the tx pages, so a page that
   sets one does not load a tx page's module graph with it. */

/** one reading in a detail page's rail: label, figure, qualifier */
export function RailRow({
  label,
  children,
  sub,
  href,
  live = false,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  live?: boolean;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {live && <LiveDot />}
        {label}
      </span>
      <span className="font-mono text-[17px] tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{children}</span>
      {sub != null && <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">{sub}</span>}
    </>
  );
  const cls = "flex flex-1 flex-col justify-center gap-1 border-b border-zinc-200 px-5 py-3.5 last:border-b-0 dark:border-zinc-800";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** the detail pages' 404 panel */
export function NotFound({ label, id }: { label: string; id?: string }) {
  return (
    <Board divide={false} className="px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</p>
      {id && <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{id}</p>}
    </Board>
  );
}
