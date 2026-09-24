"use client";

/* The subnav's Query tab. On a desk it opens under the pointer or the
   keyboard into a small sheet: the last questions this device asked,
   its boards, and the way in. On a phone it is a plain link. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ArrowRight, ArrowUpRight, History, LayoutGrid } from "lucide-react";
import { useRecentQuestions } from "@/lib/explorer-query/recent";
import { askHref, boardHref, boardScope, boardsHref, useBoards } from "@/lib/explorer-query/board";
import { BoardThumb, Label } from "./query-board-bits";

const OPEN_MS = 120;
const CLOSE_MS = 180;

function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

export function QueryTab({
  network,
  chainSlug,
  href,
  label,
  className,
  bar,
  active,
}: {
  network: string;
  chainSlug: string;
  href: string;
  label: string;
  /** the subnav's own tab classes */
  className: string;
  /** the red active bar, when active */
  bar: React.ReactNode;
  active: boolean;
}) {
  const fine = useFinePointer();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const recent = useRecentQuestions(chainSlug).slice(0, 5);
  const { boards } = useBoards(boardScope(network, chainSlug));

  const later = (next: boolean, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), ms);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const link = (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {label}
      {bar}
    </Link>
  );
  if (!fine) return link;

  const hover = { onPointerEnter: () => later(true, OPEN_MS), onPointerLeave: () => later(false, CLOSE_MS) };
  const row = "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={className}
          onClick={() => setOpen(false)}
          onFocus={() => later(true, 0)}
          onBlur={(e) => {
            if (!contentRef.current?.contains(e.relatedTarget as Node)) later(false, CLOSE_MS);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown" && open) {
              e.preventDefault();
              contentRef.current?.querySelector<HTMLElement>("a,button")?.focus();
            }
          }}
          {...hover}
        >
          {label}
          {bar}
        </Link>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={contentRef}
          side="bottom"
          align="start"
          sideOffset={2}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onBlur={(e) => {
            if (!contentRef.current?.contains(e.relatedTarget as Node)) later(false, CLOSE_MS);
          }}
          {...hover}
          className="z-[45] w-[20rem] overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-[0_24px_48px_-20px_rgba(24,24,27,0.4)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 dark:border-zinc-800 dark:bg-zinc-950/95"
        >
          {recent.length > 0 && (
            <div className="flex flex-col">
              <Label className="flex items-center gap-1.5 px-2.5 pb-1 pt-2">
                <History className="h-3 w-3" /> Recent
              </Label>
              {recent.map((q) => (
                <Link key={q} href={askHref(network, chainSlug, q)} onClick={() => setOpen(false)} className={row}>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-50">{q}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
                </Link>
              ))}
            </div>
          )}
          {boards.length > 0 && (
            <div className="flex flex-col">
              {recent.length > 0 && <div className="mx-2 my-1 h-px bg-zinc-100 dark:bg-zinc-900" />}
              <Label className="flex items-center gap-1.5 px-2.5 pb-1 pt-2">
                <LayoutGrid className="h-3 w-3" /> Boards
              </Label>
              {boards.slice(0, 3).map((b) => (
                <Link key={b.id} href={boardHref(network, chainSlug, b.id)} onClick={() => setOpen(false)} className={row}>
                  <span className="h-6 w-9 shrink-0 overflow-hidden rounded bg-zinc-50 p-[3px] dark:bg-zinc-900">
                    <BoardThumb board={b} className="auto-rows-[0.25rem] gap-[1.5px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-50">{b.name}</span>
                </Link>
              ))}
            </div>
          )}
          {recent.length === 0 && boards.length === 0 && (
            <p className="px-2.5 pb-1 pt-2.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Ask the chain a question in plain words. The answer is a chart with its SQL.</p>
          )}
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-zinc-100 px-1 pt-1.5 dark:border-zinc-900">
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 dark:text-zinc-50"
            >
              Open Query <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={boardsHref(network, chainSlug)}
              onClick={() => setOpen(false)}
              className="rounded-lg px-1.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              All boards
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
