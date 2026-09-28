"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SolutionsShell from "@/components/landing-v2/SolutionsShell";
import StickyStage from "@/components/landing-v2/StickyStage";
import Image from "next/image";
import { pillarPlate } from "@/components/landing-v2/PillarPlate";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { COMPARISON, PILLARS } from "@/components/landing-v2/pillars";
import { EASE, MaskText, Reveal, sentenceCase } from "@/components/landing-v2/SpecKit";

/* ------------------------------------------------------------------ */
/* /solutions: the four pillars, stated in one line                    */
/* ------------------------------------------------------------------ */

const PILLAR_WORDS = ["Performance", "Interoperability", "Privacy", "Compliance"];

// the avalanche pass: a step every CASCADE_MS while the pulse is on a word
// (steps 0-3), then the remaining steps are the rest at the bottom before
// the next slide: the headline black again, only the final period red
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

  return (
    <SolutionsShell>
      <Hero active={active} />

      {/* the four pillars, read one at a time beside their drawing */}
      <StickyStage
        steps={PILLARS.map((pillar, i) => ({
          key: pillar.slug,
          plate: pillarPlate(pillar.slug),
          content: (
            <div className="max-w-2xl">
              <p className="text-[15px] font-medium text-[#E6212F]">{sentenceCase(pillar.label)}</p>
              <h2 className="v2-heading mt-4 text-4xl leading-[1.05] text-zinc-900 md:text-5xl xl:text-[3.5rem] dark:text-zinc-50">
                {pillar.title}.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">{pillar.tagline}</p>
              {/* the mechanisms, each with its one-line argument */}
              <dl className="mt-10 border-t border-zinc-200 dark:border-zinc-800">
                {pillar.capabilities.map((capability) => (
                  <div
                    key={capability.title}
                    className="grid gap-1.5 border-b border-zinc-200 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8 dark:border-zinc-800"
                  >
                    <dt className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">{capability.title}</dt>
                    <dd className="text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">{capability.body}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href={`/solutions/${pillar.slug}`}
                className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-zinc-900 dark:text-zinc-50"
              >
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                  Explore {pillar.label.toLowerCase()}
                </span>
                <ArrowRight className="h-4 w-4 text-[#E6212F] transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          ),
        }))}
      />

      <Comparison />
    </SolutionsShell>
  );
}

/* The hero: an exchange hall in ice, full-bleed across the sheet, the four
   words stacked over the colonnade on its left. On desktop the band holds
   the photograph's own aspect, so nothing crops and the glow of the red
   light at the end of the hall can be pinned to the pixel; the band zooms
   down the hall toward it as the page scrolls away. Phones get a taller
   crop anchored on the centre aisle. */
function Hero({ active }: { active: number }) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <section ref={ref} className="relative -mx-5 -mt-6 overflow-hidden bg-zinc-950 md:-mx-6">
      <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[2880/1258]">
        {/* zoom origin sits on the red light, so it holds still */}
        <motion.div className="absolute inset-0 origin-[49%_69%]" style={reducedMotion ? undefined : { scale }}>
          <motion.div
            className="absolute inset-0 origin-[49%_69%]"
            initial={reducedMotion ? false : { scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2.4, ease: EASE }}
          >
            <Image
              src="/images/solutions/exchange-hall.jpg"
              alt="A monumental exchange hall of ice columns, snow falling through the skylight, a red light at the end of the hall"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[50%_60%]"
            />
            {/* the light breathes: red is the thing that is alive */}
            <motion.span
              aria-hidden
              className="absolute left-[49.1%] top-[68.9%] hidden h-10 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E6212F] blur-2xl lg:block"
              initial={{ opacity: 0.15 }}
              animate={reducedMotion ? undefined : { opacity: [0.15, 0.45, 0.15] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>

        {/* scrims: the fog darkens under the words, the foot into the page */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/15 via-45% to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-transparent via-40% to-transparent"
        />

        <div className="absolute inset-0 flex flex-col justify-start px-5 py-12 md:px-10 lg:px-14 lg:py-16">
          <h1 className="v2-display text-[clamp(1.85rem,4.5vw,4.5rem)]">
            {PILLAR_WORDS.map((word, i) => {
              const lit = active === i;
              const last = i === PILLAR_WORDS.length - 1;
              return (
                <MaskText key={word} delay={0.3 + i * 0.09}>
                  <span style={{ marginLeft: `${i * 0.6}em` }} className="inline-block">
                    <span className="text-white">{word}</span>
                    {/* only the periods carry the pulse; the words hold still */}
                    <span
                      className={`transition-colors duration-500 ${lit || last ? "text-[#E6212F]" : "text-white/25"}`}
                    >
                      .
                    </span>
                  </span>
                </MaskText>
              );
            })}
          </h1>
          {/* the dek settles in the bottom-left corner, over the floor of
              the hall: it arrives once the words have landed, sharpening
              out of the falling snow */}
          <motion.p
            className="mt-auto max-w-[19rem] text-[15px] leading-relaxed text-white/80 md:text-base"
            initial={reducedMotion ? false : { opacity: 0, filter: "blur(10px)", y: 8 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 1.4, delay: 1.1, ease: EASE }}
          >
            A high-performance EVM, configured for regulated finance.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

/* Where to build: one decision per row, the dedicated L1 column carried
   forward. A row where the L1 differs sets its L1 value in full ink;
   a row where both agree stays quiet. */
function Comparison() {
  const reducedMotion = useReducedMotion();
  const groups = PILLARS.map((pillar) => ({
    pillar,
    rows: COMPARISON.filter((r) => r.pillar === pillar.slug),
  })).filter((g) => g.rows.length > 0);
  let rowIndex = 0;

  return (
    // the page closes dark: this section carries `dark`, so the table and
    // its type flip to their dark palette over the photograph's night
    <section className="dark relative -mx-5 -mb-24 mt-24 overflow-hidden bg-zinc-950 md:-mx-6 lg:mt-32">
      {/* the two peaks: the crowded shared summit left, your own right,
          its beacon lit. Held at the photo's 8:3, so the glow pins exactly. */}
      <div className="relative aspect-[8/3]">
        <Image
          src="/images/solutions/two-peaks.jpg"
          alt="A broad, crowded summit and a lone sharp summit with a red beacon, rising above fog"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <motion.span
          aria-hidden
          className="absolute left-[72.8%] top-[45.4%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E6212F] blur-2xl"
          initial={{ opacity: 0.15 }}
          animate={reducedMotion ? undefined : { opacity: [0.15, 0.5, 0.15] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-transparent to-zinc-950" />
      </div>

      {/* snow grain under the table, barely there */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[20%] bg-[url(/images/solutions/snow-texture.jpg)] bg-[length:640px] opacity-[0.03] mix-blend-screen"
      />

      <div className="relative px-5 pb-24 md:px-6 lg:pb-32">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <h2 className="v2-heading text-3xl text-zinc-900 md:text-[2.5rem] dark:text-zinc-50">
            <MaskText>Start on the C-Chain.</MaskText>
            <MaskText delay={0.08} className="text-zinc-400 dark:text-zinc-500">
              Graduate to your own L1.
            </MaskText>
          </h2>
          <Reveal delay={0.1} className="lg:pt-2">
            <p className="max-w-xl text-[17px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              The shared C-Chain gives an application immediate reach. A dedicated L1 keeps native messaging and
              irreversible finality, and makes the rest configurable: blockspace, gas token, who validates, who can see
              the chain, and who can use it.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[28%] pb-4 align-bottom font-mono text-[10px] font-normal tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                  DECISION
                </th>
                <th className="w-[36%] px-6 pb-4 align-bottom">
                  <span className="block text-lg font-medium text-zinc-900 dark:text-zinc-50">C-Chain</span>
                  <span className="mt-1 block text-[13px] font-normal text-zinc-500 dark:text-zinc-400">
                    Shared, public, EVM
                  </span>
                </th>
                <th className="relative w-[36%] bg-zinc-50 px-6 pb-4 pt-6 align-bottom dark:bg-zinc-900/60">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[#E6212F]" />
                  <span className="block text-lg font-medium text-zinc-900 dark:text-zinc-50">Your own L1</span>
                  <span className="mt-1 block text-[13px] font-normal text-zinc-500 dark:text-zinc-400">
                    Dedicated, configurable, any VM
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ pillar, rows }) => (
                <Fragment key={pillar.slug}>
                  <tr>
                    <th colSpan={2} className="pb-3 pt-10">
                      <Link
                        href={`/solutions/${pillar.slug}`}
                        className="font-mono text-[11px] font-normal tracking-[0.2em] text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-100"
                      >
                        {pillar.label} →
                      </Link>
                    </th>
                    <td className="bg-zinc-50 dark:bg-zinc-900/60" />
                  </tr>
                  {rows.map((row) => {
                    const differs = row.cChain !== row.l1;
                    const delay = (rowIndex++ % 4) * 0.05;
                    return (
                      <motion.tr
                        key={row.label}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 0.45, delay, ease: EASE }}
                      >
                        <th scope="row" className="py-4 pr-6 text-[15px] font-normal text-zinc-500 dark:text-zinc-400">
                          {row.label}
                        </th>
                        <td className="px-6 py-4 text-[15px] text-zinc-700 dark:text-zinc-300">{row.cChain}</td>
                        <td
                          className={`bg-zinc-50 px-6 py-4 text-[15px] dark:bg-zinc-900/60 ${
                            differs ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {row.l1}
                        </td>
                      </motion.tr>
                    );
                  })}
                </Fragment>
              ))}
              <tr>
                <td />
                <td className="px-6 pb-6 pt-8">
                  <BrandButton href="/docs/primary-network" variant="light">
                    Build on the C-Chain
                  </BrandButton>
                </td>
                <td className="bg-zinc-50 px-6 pb-6 pt-8 dark:bg-zinc-900/60">
                  <BrandButton href="/console/create-l1">Create an L1</BrandButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
