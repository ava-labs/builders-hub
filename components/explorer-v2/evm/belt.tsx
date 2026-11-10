"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { INK } from "@/components/explorer-v2/ui";
import { formatNumber } from "@/components/explorer-v2/format";

/* The live boards' motion and their light parts, apart from the boards
   themselves: a page that sets a belt of rows loads this, not the C-Chain
   boards' reads. LiveBoards exports all of it as before. */

/** A height, every digit in the same ink: the belt's motion already
 *  says which row is new, so the number itself stays quiet and even. */
export function Height({ value }: { value: number }) {
  return <span className={INK}>{formatNumber(value)}</span>;
}

/* Motion: the board is a belt. It shows ROWS rows in a clip window one
   row taller than it looks; a newcomer slides in from above and pushes
   every row down together, the last one slides out under the clip line
   and is dropped once hidden. One curve everywhere, the tape's: sharp
   attack, long decay. */

const EASE = [0.22, 1, 0.36, 1] as const;
/** the rows a board shows; its belt holds one more for the slide-out */
export const ROWS = 10;
/** a phone row is two or three lines, so the boards stop short there:
 *  "View all" is one tap away and the page is not a feed */
export const PHONE_ROWS = 6;
/** row pitch: the 44 px row plus its 1 px rule */
export const ROW_H = 45;

export function Belt({ children, rows = ROWS }: { children: React.ReactNode; rows?: number }) {
  return (
    // one row past the window exists for the slide-out; on small screens
    // rows are two lines tall and the window cannot be fixed, so the
    // caller hides the extra row itself. The clip stays on phones: a
    // newcomer slides in from above and must not cross the header
    <div className="relative overflow-hidden" style={{ ["--belt-h" as string]: `${rows * ROW_H}px` }}>
      <div className="md:h-(--belt-h)">{children}</div>
    </div>
  );
}

const NONE: ReadonlySet<string> = new Set();

/** the keys of a list's first paint: those rows stand still, and a row
 *  that comes after them slides in */
export function useOpening<T>(rows: readonly T[], key: (row: T) => string): ReadonlySet<string> {
  const first = useRef<ReadonlySet<string> | null>(null);
  if (first.current === null && rows.length > 0) first.current = new Set(rows.map(key));
  return first.current ?? NONE;
}

export function MotionRow({
  children,
  animateIn,
  overflow = false,
}: {
  children: React.ReactNode;
  animateIn: boolean;
  /** the row past the window: present for the slide-out on desktop,
   *  hidden on small screens where the window is not fixed */
  overflow?: boolean;
}) {
  return (
    <motion.div
      layout="position"
      initial={animateIn ? { y: -ROW_H, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("border-b border-zinc-200 dark:border-zinc-800", overflow && "max-md:hidden")}
    >
      {children}
    </motion.div>
  );
}

/** the last value seen before `frozen` went true, until it goes false */
export function useFreeze<T>(value: T, frozen: boolean): T {
  const held = useRef(value);
  if (!frozen) held.current = value;
  return frozen ? held.current : value;
}

export function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
    >
      View all →
    </Link>
  );
}
