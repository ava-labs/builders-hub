"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SolutionsShell from "@/components/landing-v2/SolutionsShell";
import StickyStage from "@/components/landing-v2/StickyStage";
import Image from "next/image";
import { pillarPlate } from "@/components/landing-v2/PillarPlate";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { COMPARISON, PILLARS, type Pillar } from "@/components/landing-v2/pillars";
import { EASE, MaskText, Reveal } from "@/components/landing-v2/SpecKit";

/* ------------------------------------------------------------------ */
/* /solutions: the four pillars, stated in one line                    */
/* ------------------------------------------------------------------ */

// the headline names the pillars in the order the sections below read them
const PILLAR_WORDS = PILLARS.map((p) => p.label.charAt(0) + p.label.slice(1).toLowerCase());

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
            <div className="max-w-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                <span className="text-zinc-400 dark:text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
                <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-[#E6212F]">{pillar.label}</span>
              </p>
              <h2 className="v2-heading mt-5 text-4xl leading-[1.05] text-zinc-900 md:text-5xl xl:text-[3.5rem] dark:text-zinc-50">
                {pillar.title}.
              </h2>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-zinc-600 dark:text-zinc-400">{pillar.tagline}</p>
              {/* the claim as three spec rows; the full mechanisms live on the pillar's page */}
              <dl className="mt-12 border-t border-zinc-200 dark:border-zinc-800">
                {pillar.proofs.map((proof) => (
                  <div
                    key={proof.label}
                    className="flex items-baseline justify-between gap-6 border-b border-zinc-200 py-3.5 font-mono uppercase dark:border-zinc-800"
                  >
                    <dt className="text-[11px] tracking-[0.16em] text-zinc-500">{proof.label}</dt>
                    <dd className="text-right text-[13px] tracking-[0.08em] text-zinc-900 dark:text-zinc-100">{proof.value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href={`/solutions/${pillar.slug}`}
                className="group mt-10 inline-flex items-center gap-2 text-[15px] font-medium text-zinc-900 dark:text-zinc-50"
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
   a row where both agree stays quiet. The pillar names run down a rail
   beside their rows, so at 1440 x 900 the whole table fits in one view. */
function Comparison() {
  const reducedMotion = useReducedMotion();
  const headingId = useId();
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
          <h2 id={headingId} className="v2-heading text-3xl text-zinc-900 md:text-[2.5rem] dark:text-zinc-50">
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

        {/* Columns on the 12-column grid: rail 2, label 2, C-Chain 3, L1 5;
            below xl the values split 4 and 4, so the C-Chain button keeps
            one line. Below lg each row is a two-column grid: its label on
            top, the two values side by side, the right half tinted as the
            L1 column. The roles keep the table semantics through the
            display change. */}
        <table
          role="table"
          aria-labelledby={headingId}
          className="mt-10 block w-full border-collapse text-left lg:mt-12 lg:table lg:table-fixed"
        >
          <thead role="rowgroup" className="block lg:table-header-group">
            <tr role="row" className="grid grid-cols-2 items-start lg:table-row">
              <td className="hidden lg:table-cell lg:w-[16.667%]" />
              <th
                role="columnheader"
                scope="col"
                className="pb-4 align-bottom font-mono text-[10px] font-normal tracking-[0.2em] text-zinc-500 max-lg:sr-only lg:w-[16.667%] dark:text-zinc-400"
              >
                DECISION
              </th>
              <th
                role="columnheader"
                scope="col"
                className="pb-3 pr-3 pt-4 align-bottom lg:w-[33.333%] lg:px-4 lg:pb-4 lg:pt-0 xl:w-[25%] xl:px-6"
              >
                <span className="block text-[15px] font-medium text-zinc-900 lg:text-lg dark:text-zinc-50">C-Chain</span>
                <span className="mt-0.5 block text-[12px] font-normal text-zinc-500 lg:mt-1 lg:text-[13px] dark:text-zinc-400">
                  Shared, public, EVM
                </span>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="relative bg-zinc-50 px-3 pb-3 pt-4 align-bottom lg:w-[33.333%] lg:px-4 lg:pb-4 lg:pt-5 xl:w-[41.667%] xl:px-6 dark:bg-zinc-900/60"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[#E6212F]" />
                <span className="block text-[15px] font-medium text-zinc-900 lg:text-lg dark:text-zinc-50">
                  Your own L1
                </span>
                <span className="mt-0.5 block text-[12px] font-normal text-zinc-500 lg:mt-1 lg:text-[13px] dark:text-zinc-400">
                  Dedicated, configurable, any VM
                </span>
              </th>
            </tr>
          </thead>
          {groups.map(({ pillar, rows }) => (
            <tbody key={pillar.slug} role="rowgroup" className="block lg:table-row-group">
              {/* below lg: the pillar name as its own row above the group */}
              <tr role="row" className="grid grid-cols-2 lg:hidden">
                <th role="rowheader" scope="rowgroup" colSpan={3} className="relative col-span-2 pb-1.5 pt-4">
                  <span aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-zinc-50 dark:bg-zinc-900/60" />
                  <PillarTag pillar={pillar} className="relative" />
                </th>
              </tr>
              {rows.map((row, i) => {
                const differs = row.cChain !== row.l1;
                const delay = (rowIndex++ % 4) * 0.05;
                return (
                  <motion.tr
                    key={row.label}
                    role="row"
                    className={`grid grid-cols-2 border-t lg:table-row ${
                      i === 0 ? "border-zinc-300 dark:border-zinc-600" : "border-zinc-200 dark:border-zinc-800"
                    }`}
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay, ease: EASE }}
                  >
                    {/* lg and up: the pillar name in the rail, beside its first row */}
                    {i === 0 && (
                      <th
                        role="rowheader"
                        scope="rowgroup"
                        rowSpan={rows.length}
                        className="hidden py-2 pr-2 align-baseline lg:table-cell xl:pr-4"
                      >
                        <PillarTag pillar={pillar} className="whitespace-nowrap" />
                      </th>
                    )}
                    <th
                      role="rowheader"
                      scope="row"
                      className="relative col-span-2 pb-0.5 pt-2.5 text-[13px] font-normal leading-snug text-zinc-500 lg:py-2 lg:pr-2 lg:align-baseline lg:text-[14px] lg:leading-normal xl:pr-4 xl:text-[15px] dark:text-zinc-400"
                    >
                      <span aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-zinc-50 lg:hidden dark:bg-zinc-900/60" />
                      <span className="relative">{row.label}</span>
                    </th>
                    <td
                      role="cell"
                      className="pb-2.5 pr-3 text-[14px] leading-snug text-zinc-700 lg:px-4 lg:py-2 lg:align-baseline lg:text-[15px] lg:leading-normal xl:px-6 dark:text-zinc-300"
                    >
                      {row.cChain}
                    </td>
                    <td
                      role="cell"
                      className={`bg-zinc-50 px-3 pb-2.5 text-[14px] leading-snug lg:px-4 lg:py-2 lg:align-baseline lg:text-[15px] lg:leading-normal xl:px-6 dark:bg-zinc-900/60 ${
                        differs ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {row.l1}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          ))}
          <tbody role="rowgroup" className="block lg:table-row-group">
            <tr role="row" className="grid gap-2 pt-6 sm:grid-cols-2 sm:gap-0 sm:pt-0 lg:table-row">
              <td className="hidden lg:table-cell" />
              <td className="max-lg:sr-only" />
              <td role="cell" className="sm:pr-3 sm:pt-6 lg:px-4 lg:py-4 lg:align-top xl:px-6">
                <BrandButton href="/docs/primary-network" variant="light" className="w-full lg:w-auto">
                  Build on the C-Chain
                </BrandButton>
              </td>
              <td
                role="cell"
                className="sm:bg-zinc-50 sm:px-3 sm:pb-3 sm:pt-6 lg:px-4 lg:py-4 lg:align-top xl:px-6 sm:dark:bg-zinc-900/60"
              >
                <BrandButton href="/console/create-l1" className="w-full lg:w-auto">
                  Create an L1
                </BrandButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* A pillar's name as a link to its page, in the mono eyebrow style; the
   arrow is decoration, so the link reads as the pillar's name alone. */
function PillarTag({ pillar, className = "" }: { pillar: Pillar; className?: string }) {
  return (
    <Link
      href={`/solutions/${pillar.slug}`}
      className={`font-mono text-[11px] font-normal tracking-[0.16em] text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-100 ${className}`}
    >
      {pillar.label} <span aria-hidden>→</span>
    </Link>
  );
}
