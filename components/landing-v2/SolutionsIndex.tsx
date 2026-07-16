"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import { PillarRows } from "@/components/landing-v2/PillarsChapter";

/* ------------------------------------------------------------------ */
/* /solutions — the four pillars, stated in one line                   */
/* ------------------------------------------------------------------ */

const PILLAR_WORDS = ["Performance", "Interoperability", "Privacy", "Compliance"];

export default function SolutionsIndex() {
  const reducedMotion = useReducedMotion();

  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main className="relative bg-white dark:bg-zinc-950">
      <SheetBackdrop />
      <div className="relative">
        <div className="mx-auto w-full max-w-7xl px-5 pt-14 md:px-6">
          <motion.div className="flex items-baseline gap-4" {...rise(0)}>
            <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              SOLUTIONS
            </p>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </motion.div>

          <motion.div className="py-16 lg:py-24" {...rise(0.08)}>
            {/* the four words are the headline; the red period closes the set */}
            <h1 className="max-w-5xl text-4xl font-extralight leading-[1.12] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 md:text-6xl xl:text-[4.25rem]">
              {PILLAR_WORDS.map((word, i) => (
                <span key={word} className="whitespace-nowrap">
                  {word}
                  {i < PILLAR_WORDS.length - 1 ? (
                    <span className="text-zinc-300 dark:text-zinc-700">. </span>
                  ) : (
                    <span className="text-[#E84142]">.</span>
                  )}
                </span>
              ))}
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300 md:text-lg">
              Four guarantees an institution can underwrite, each enforced by the
              protocol rather than promised by an operator.
            </p>
          </motion.div>

          <motion.div className="pb-16 lg:pb-24" {...rise(0.16)}>
            <PillarRows reducedMotion={!!reducedMotion} />
          </motion.div>

          <motion.div className="pb-24 lg:pb-32" {...rise(0.24)}>
            <div className="mb-8 flex items-baseline gap-4">
              <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                DESIGN PATTERNS
              </p>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <p className="mb-8 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Real-world institutional builds that compose these guarantees into one architecture —
              interbank clearing, supply-chain provenance, and more.
            </p>
            <Link
              href="/solutions/design-patterns"
              className="group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.18em] text-zinc-900 transition-colors hover:text-[#E84142] dark:text-zinc-100"
            >
              BROWSE DESIGN PATTERNS
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        <Link
          href="/console"
          className="group flex items-center justify-between bg-zinc-900 py-5 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:hover:bg-zinc-300"
        >
          <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
            <span className="text-sm font-medium text-zinc-50 dark:text-zinc-900">
              Launch yours in the Console
            </span>
            <ArrowRight className="h-4 w-4 text-zinc-50 transition-transform group-hover:translate-x-1 dark:text-zinc-900" />
          </span>
        </Link>
      </div>
    </main>
  );
}
