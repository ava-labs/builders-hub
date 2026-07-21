"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import ConsoleBar from "@/components/landing-v2/ConsoleBar";
import { PillarRows } from "@/components/landing-v2/PillarsChapter";

/* ------------------------------------------------------------------ */
/* /solutions — the four pillars, stated in one line                   */
/* ------------------------------------------------------------------ */

const PILLAR_WORDS = ["Performance", "Interoperability", "Privacy", "Compliance"];

// the avalanche pass: a step every CASCADE_MS while the pulse is on a word
// (steps 0-3), then the remaining steps are the rest at the bottom before
// the next slide — the headline black again, only the final period red
const CASCADE_MS = 650;
const CASCADE_STEPS = PILLAR_WORDS.length + 12;

export default function SolutionsIndex() {
  const reducedMotion = useReducedMotion();

  // -1 = resting; 0..3 = the word the red pulse is passing through
  const [step, setStep] = useState(PILLAR_WORDS.length);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % CASCADE_STEPS), CASCADE_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  const active = step < PILLAR_WORDS.length ? step : -1;

  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main className="relative overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative">
        <div className="mx-auto w-full max-w-7xl px-5 pt-14 md:px-6">
          <motion.div className="flex items-center gap-4" {...rise(0)}>
            <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
              SOLUTIONS
            </p>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </motion.div>

          <motion.div className="py-16 lg:py-24" {...rise(0.08)}>
            {/* the deck's hero template: stacked display left, dek in the right
                column, bottom-aligned so it meets the closing line. The stack
                steps right per line (horizontal momentum) and hands off to the
                dek across a short vertical rule. Display size is bounded by
                INTEROPERABILITY (~10.2em + step) fitting its column. */}
            <div className="lg:grid lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-14">
              <h1 className="v2-display text-[clamp(1.85rem,4.5vw,4.5rem)]">
                {PILLAR_WORDS.map((word, i) => {
                  const lit = active === i;
                  const last = i === PILLAR_WORDS.length - 1;
                  return (
                    <span key={word} className="block" style={{ marginLeft: `${i * 0.6}em` }}>
                      <span className="text-zinc-900 dark:text-zinc-50">{word}</span>
                      {/* only the periods carry the pulse; the words hold still */}
                      <span
                        className={`transition-colors duration-500 ${
                          lit || last ? "text-[#E6212F]" : "text-zinc-300 dark:text-zinc-700"
                        }`}
                      >
                        .
                      </span>
                    </span>
                  );
                })}
              </h1>
              {/* the dek's compartment: a full-height 1px rule (the same
                  hairline as the row dividers below), text settling at its
                  foot beside the closing line */}
              <div className="lg:flex lg:flex-col lg:justify-end lg:border-l lg:border-zinc-200 lg:pl-10 dark:lg:border-zinc-800">
                <p className="mt-8 max-w-2xl pb-1 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 lg:mt-0 lg:max-w-none lg:text-xl lg:leading-relaxed">
                  Configurable infrastructure for regulated finance: a chain
                  tuned to how fast it settles, what it connects to, who can see
                  it, and who can transact. Each capability opens into the
                  institutional patterns it makes possible.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div className="pb-24 lg:pb-32" {...rise(0.16)}>
            <PillarRows reducedMotion={!!reducedMotion} />
          </motion.div>
        </div>

        <ConsoleBar />
      </div>
    </main>
  );
}
