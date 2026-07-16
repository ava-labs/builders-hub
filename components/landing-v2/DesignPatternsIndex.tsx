"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import { PATTERNS } from "@/components/landing-v2/patterns";

/* ------------------------------------------------------------------ */
/* /solutions/design-patterns — the catalog of real-world builds       */
/* ------------------------------------------------------------------ */

export default function DesignPatternsIndex() {
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
            <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              <Link href="/solutions" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                SOLUTIONS
              </Link>{" "}
              · <span className="text-zinc-900 dark:text-zinc-100">DESIGN PATTERNS</span>
            </p>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </motion.div>

          <motion.div className="py-16 lg:py-24" {...rise(0.08)}>
            <h1 className="max-w-4xl text-4xl font-extralight leading-[1.12] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 md:text-6xl xl:text-[4.25rem]">
              Design patterns<span className="text-[#E84142]">.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300 md:text-lg">
              Real-world institutional builds — each composes several of the four guarantees into one
              shippable architecture, drawn from deployments running today.
            </p>
          </motion.div>

          <motion.div
            className="mb-24 divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm lg:mb-32 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80"
            {...rise(0.16)}
          >
            {PATTERNS.map((pattern) => {
              const live = pattern.status === "live";
              const body = (
                <>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {pattern.label}
                  </span>
                  <span>
                    <span className="block text-2xl font-light leading-snug tracking-[-0.02em] text-zinc-900 dark:text-zinc-50 md:text-[2rem]">
                      {pattern.title}.
                    </span>
                    <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {pattern.tagline}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 justify-self-start lg:justify-self-end">
                    {live ? (
                      <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-50" />
                    ) : (
                      <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                        COMING SOON
                      </span>
                    )}
                  </span>
                </>
              );

              const grid =
                "relative grid grid-cols-1 items-center gap-x-10 gap-y-3 px-5 py-9 md:px-6 lg:grid-cols-[13rem_1fr_auto]";

              return live ? (
                <Link
                  key={pattern.slug}
                  href={`/solutions/design-patterns/${pattern.slug}`}
                  className={`group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${grid}`}
                >
                  <span className="absolute bottom-0 left-0 top-0 w-px bg-transparent transition-colors duration-300 group-hover:bg-[#E84142]" />
                  {body}
                </Link>
              ) : (
                <div key={pattern.slug} className={`${grid} opacity-60`}>
                  {body}
                </div>
              );
            })}
          </motion.div>
        </div>

        <Link
          href="https://www.avax.network/contact"
          className="group flex items-center justify-between bg-zinc-900 py-5 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:hover:bg-zinc-300"
        >
          <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
            <span className="text-sm font-medium text-zinc-50 dark:text-zinc-900">
              Building one of these? Talk to our team
            </span>
            <ArrowRight className="h-4 w-4 text-zinc-50 transition-transform group-hover:translate-x-1 dark:text-zinc-900" />
          </span>
        </Link>
      </div>
    </main>
  );
}
