"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import ConsoleBar from "@/components/landing-v2/ConsoleBar";
import PillarDiagram from "@/components/landing-v2/PillarDiagrams";
import PrivacyModelDiagram from "@/components/landing-v2/PrivacyModelDiagrams";
import { PILLARS, type Pillar } from "@/components/landing-v2/pillars";

/* ------------------------------------------------------------------ */
/* Solution splash page — one pillar, sold in the drafting-sheet voice */
/* ------------------------------------------------------------------ */

export default function PillarPage({ pillar }: { pillar: Pillar }) {
  const reducedMotion = useReducedMotion();
  // the pillars read in PILLARS order as one continuous argument; the
  // footer hands off to the next one, with the remaining two as asides
  const index = PILLARS.findIndex((p) => p.slug === pillar.slug);
  const next = PILLARS[(index + 1) % PILLARS.length];
  const rest = PILLARS.filter((p) => p.slug !== pillar.slug && p.slug !== next.slug);

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
      <SheetBackdrop snowOnly />
      <div className="relative">
        <div className="mx-auto w-full max-w-7xl px-5 pt-14 md:px-6">
          <motion.div className="flex items-center gap-4" {...rise(0)}>
            <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              <Link
                href="/solutions"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                SOLUTIONS
              </Link>{" "}
              · <span className="text-zinc-900 dark:text-zinc-100">{pillar.label}</span>
            </p>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </motion.div>

          {/* statement + proof ledger */}
          <div className="grid gap-12 py-14 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-20 lg:py-20">
            <motion.div {...rise(0.08)}>
              {/* the same two-tone stacked statement the homepage panel
                  made — the click-through lands on the promise it left on */}
              <h1 className="v2-display text-3xl text-zinc-900 dark:text-zinc-50 md:text-5xl xl:text-[3.5rem]">
                {pillar.display.lead.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                <span className="block text-[#E6212F]">{pillar.display.punch}</span>
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300 md:text-lg">
                {pillar.intro}
              </p>
              <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <BrandButton href="/console" className="w-full sm:w-auto">
                  Build in the Console
                </BrandButton>
                <Link
                  href={pillar.resources[0].links[0].href}
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  READ THE DOCS →
                </Link>
              </div>
            </motion.div>

            <motion.div className="flex flex-col items-center gap-8" {...rise(0.16)}>
              <PillarDiagram slug={pillar.slug} />
              {/* the drawing's title block: the guarantee as a spec plate,
                  annotating the instrument instead of shouting on its own */}
              <dl className="w-full max-w-md">
                {pillar.proofs.map((proof) => (
                  <div
                    key={proof.label}
                    className="flex items-baseline justify-between gap-6 border-t border-zinc-200 py-2.5 last:border-b dark:border-zinc-800"
                  >
                    <dt className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      {proof.label}
                    </dt>
                    <dd className="font-mono text-[11px] tracking-[0.08em] text-zinc-900 dark:text-zinc-50">
                      {proof.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          </div>

          {/* mechanisms — one named primitive per cell, dense three-across */}
          <motion.div className="pb-20 lg:pb-28" {...rise(0.26)}>
            <div className="mb-10 flex items-center gap-4">
              <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                MECHANISMS
              </p>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-1 divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
              {pillar.capabilities.map((capability, i) => (
                <div key={capability.title} className="px-5 py-8 md:px-8 md:py-10">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    {`0${i + 1}`}
                  </span>
                  <h2 className="v2-display mt-4 text-xl text-zinc-900 dark:text-zinc-50 md:text-2xl">
                    {capability.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {capability.body}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* architecture models — the shapes the primitives compose into */}
          {pillar.models && pillar.models.length > 0 && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.3)}>
              <div className="mb-10 flex items-center gap-4">
                <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                  ARCHITECTURES
                </p>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
                {pillar.models.map((model) => (
                  <div
                    key={model.name}
                    className="grid gap-8 px-5 py-10 md:px-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-14"
                  >
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                        {model.label}
                      </p>
                      <h3 className="mt-3 text-2xl font-light tracking-[-0.01em] text-zinc-900 dark:text-zinc-50">
                        {model.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{model.tagline}</p>
                      <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {model.description}
                      </p>
                      <p className="mt-5 font-mono text-[10px] tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        BEST FOR
                      </p>
                      <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{model.bestFor}</p>
                    </div>
                    {model.diagram && (
                      <div className="flex justify-center lg:justify-end">
                        <PrivacyModelDiagram id={model.diagram} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* use cases — problem, then the Avalanche shape that solves it */}
          {pillar.useCases && pillar.useCases.length > 0 && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.34)}>
              <div className="mb-10 flex items-center gap-4">
                <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                  USE CASES
                </p>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
              {/* problem|solution diptych: the muted left cell states the
                  problem, the red-ruled right cell answers it — the pivot is
                  structural, not an inline label */}
              <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
                {pillar.useCases.map((useCase) => (
                  <div
                    key={useCase.title}
                    className="grid gap-6 px-5 py-8 md:grid-cols-[minmax(0,15rem)_1fr_1fr] md:gap-10 md:px-6 md:py-9"
                  >
                    <div>
                      <h3 className="v2-display text-xl text-zinc-900 dark:text-zinc-50 md:text-2xl">
                        {useCase.title}
                      </h3>
                      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        {useCase.model}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                        THE PROBLEM
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {useCase.problem}
                      </p>
                    </div>
                    <div className="border-l-2 border-[#E6212F] pl-6">
                      <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                        ON AVALANCHE
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                        {useCase.solution}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* resources */}
          <motion.div className="pb-20 lg:pb-28" {...rise(0.38)}>
            <div className="mb-10 flex items-center gap-4">
              <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                RESOURCES
              </p>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-1 divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
              {pillar.resources.map((group) => (
                <div key={group.heading} className="px-5 py-8 md:px-8 md:py-10">
                  <h3 className="v2-display text-xl text-zinc-900 dark:text-zinc-50 md:text-2xl">
                    {group.heading}
                  </h3>
                  <ul className="mt-6 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="group flex items-center justify-between gap-4 py-3.5 text-[15px] font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                        >
                          {link.text}
                          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#E6212F] dark:text-zinc-600" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>

          {/* hand-off to the next pillar; the remaining two as asides */}
          <div className="pb-16 lg:pb-20">
            <div className="mb-10 flex items-center gap-4">
              <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
                UP NEXT
              </p>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <Link href={`/solutions/${next.slug}`} className="group block">
              <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {next.label}
              </span>
              <span className="v2-display mt-4 flex items-center gap-5 text-2xl text-zinc-900 md:text-4xl dark:text-zinc-50">
                <span>
                  {next.title}
                  <span className="text-[#E6212F]">.</span>
                </span>
                <ArrowRight className="h-6 w-6 shrink-0 text-zinc-400 transition-all duration-300 group-hover:translate-x-2 group-hover:text-[#E6212F] md:h-8 md:w-8 dark:text-zinc-500" />
              </span>
            </Link>
            <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-3">
              <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                ALSO ON AVALANCHE
              </span>
              {rest.map((other) => (
                <Link
                  key={other.slug}
                  href={`/solutions/${other.slug}`}
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {other.label} →
                </Link>
              ))}
            </div>
          </div>
        </div>

        <ConsoleBar />
      </div>
    </main>
  );
}
