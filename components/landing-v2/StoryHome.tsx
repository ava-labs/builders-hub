"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useIsPresent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GlobeData } from "@/components/landing/globe";
import BuiltOnMarquee from "@/components/landing-v2/BuiltOnMarquee";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { HoverPrefetchLink } from "@/components/landing-v2/HoverPrefetchLink";
import HeroSplash from "@/components/landing-v2/HeroSplash";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import OwnChapter from "@/components/landing-v2/story/OwnChapter";
import FinalChapter from "@/components/landing-v2/story/FinalChapter";
import InteropChapter from "@/components/landing-v2/story/InteropChapter";
import InstitutionsChapter from "@/components/landing-v2/story/InstitutionsChapter";
import BuildChapter from "@/components/landing-v2/story/BuildChapter";
import { FOCUS, MONO } from "@/components/landing-v2/story/kit";
import { formatCompact, formatCompactIn, formatExact } from "@/components/landing-v2/compactFigure";
import NetworkLanes from "@/components/landing-v2/NetworkLanes";
import { rosterOf } from "@/components/explorer-v2/network/network-reads";
import l1ChainsData from "@/constants/l1-chains.json";
import { SCRUB_SPRING } from "@/components/landing-v2/scrub";
import { track } from "@/components/landing-v2/track";
import {
  BOARD_STATIC,
  BOARD_VARIANTS,
  COUNT,
  COUNT_FROM,
  HEADING_RISE,
  NOUN_ROLL,
  NOUN_WIDTH,
  ROW_STATIC,
  ROW_VARIANTS,
  STOP_DROP,
} from "@/components/landing-v2/home-motion";

/* ------------------------------------------------------------------ */
/* Ledger strip: the network's figures, set like a ledger             */
/* ------------------------------------------------------------------ */

// Compact on screen; the exact figure in the hover title and for screen
// readers. The exact copy is unselectable, so a copied figure is the one shown.
function Figure({ shown, exact, className }: { shown: string; exact: string; className?: string }) {
  return (
    <span className={className} title={exact}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only select-none">{exact}</span>
    </span>
  );
}

const FIGURE_CLASS =
  "font-mono text-2xl tabular-nums leading-none tracking-tight text-zinc-900 dark:text-zinc-50 md:text-[1.75rem] md:leading-8";
// the dominant figure takes the display face: in mono, its decimal point
// fills a whole cell at this size and splits the figure in two
const STAKE_CLASS =
  "v2-heading text-5xl tabular-nums leading-none text-zinc-900 dark:text-zinc-50 md:text-7xl xl:text-8xl";

// Board figures are compact (three significant digits), so a live tick
// would not move them. Transactions and validators refresh with the 60 s
// poll; the other figures refresh when the page revalidates.
function LedgerFigure({ value, animateIn }: { value: number; animateIn: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  // the server sends the figure itself, so it reads right before the scripts
  // run and with them off; both sides start there, so it hydrates
  const [display, setDisplay] = useState(value);
  // live refreshes count from the last shown figure
  const shownRef = useRef(value);

  // A figure still below the screen at hydration takes the count's start
  // there, unseen, and lands on its value when it comes into view. One
  // already on screen keeps its value: it never drops back to count.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!animateIn || !el || el.getBoundingClientRect().top < window.innerHeight) return;
    shownRef.current = value * COUNT_FROM;
    setDisplay(shownRef.current);
    // only at mount: a later value counts from the figure on screen
  }, []);

  useEffect(() => {
    if (!animateIn) {
      shownRef.current = value;
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(shownRef.current, value, {
      ...COUNT,
      onUpdate: (v) => {
        shownRef.current = v;
        setDisplay(v);
      },
      // land on the exact target, so the last frame is the compact figure
      onComplete: () => {
        shownRef.current = value;
        setDisplay(value);
      },
    });
    return () => controls.stop();
  }, [inView, value, animateIn]);

  return (
    // leading-none: the figure's own line sets the height, as tall as the
    // empty-figure hairline box, so a late figure shifts nothing
    <span ref={ref} className="leading-none">
      <Figure shown={formatCompactIn(display, value)} exact={formatExact(value)} className={FIGURE_CLASS} />
    </span>
  );
}

function LedgerCell({
  label,
  period,
  children,
  live = false,
  href,
  className = "",
}: {
  label: string;
  /** the window a flow figure covers ("30D"); phones set it on its own line */
  period?: string;
  children: React.ReactNode;
  live?: boolean;
  href?: string;
  className?: string;
}) {
  const cellClass = `flex flex-col gap-1.5 px-5 py-3 md:px-6 md:py-5 ${className}`;
  const content = (
    <>
      <span className={`flex items-center gap-2 text-zinc-500 dark:text-zinc-400 lg:whitespace-nowrap ${MONO}`}>
        {live && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E6212F]" />}
        <span>
          {label}
          {period && (
            <>
              <span className="max-sm:hidden"> · </span>
              <span className="max-sm:block">{period}</span>
            </>
          )}
        </span>
      </span>
      {children}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={`${cellClass} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 ${CELL_FOCUS}`}
      >
        {content}
      </Link>
    );
  }
  return <div className={cellClass}>{content}</div>;
}

const FIRST_ROW_OF_TWO = "max-lg:border-b max-lg:border-zinc-200 dark:max-lg:border-zinc-800";
// a board cell's focus: the story's red ring, drawn inside the cell (the
// cells meet edge to edge), over the same fill as hover
const CELL_FOCUS = `${FOCUS} focus-visible:-outline-offset-2! focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-900`;

function LedgerStrip({
  globeData,
  l1Count,
  animateIn,
}: {
  globeData: GlobeData;
  l1Count: number | null;
  animateIn: boolean;
}) {
  const agg = globeData?.metrics?.aggregated;
  // ICM flow sum over the same 30-day window as every other flow figure
  const icmTotal30d = (globeData?.icmFlows || []).reduce(
    (sum, f) => sum + (f.messageCount || 0),
    0,
  );

  return (
    // chrome (border/background) is owned by the parent board
    <div className="w-full">
      <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4 divide-x divide-zinc-200 dark:divide-zinc-800">
        {/* below lg the strip is two rows of two: a hairline closes the first row */}
        <LedgerCell label="TRANSACTIONS" period="30D" live href="/explorer/mainnet" className={FIRST_ROW_OF_TWO}>
          {agg ? (
            <LedgerFigure value={agg.totalTxCount} animateIn={animateIn} />
          ) : (
            <LedgerDash />
          )}
        </LedgerCell>
        {/* ends the first row of two below lg: no divider at the screen edge */}
        <LedgerCell
          label="ICM MESSAGES"
          period="30D"
          href="/explorer/mainnet/chains"
          className={`${FIRST_ROW_OF_TWO} max-lg:border-r-0`}
        >
          {icmTotal30d > 0 ? (
            <LedgerFigure value={icmTotal30d} animateIn={animateIn} />
          ) : (
            <LedgerDash />
          )}
        </LedgerCell>
        <LedgerCell label="ACTIVE L1S" href="/explorer/mainnet/chains">
          {l1Count !== null ? <LedgerFigure value={l1Count} animateIn={animateIn} /> : <LedgerDash />}
        </LedgerCell>
        <LedgerCell label="VALIDATOR SEATS" href="/explorer/mainnet/chains">
          {agg ? <LedgerFigure value={agg.totalValidators} animateIn={animateIn} /> : <LedgerDash />}
        </LedgerCell>
      </div>
    </div>
  );
}

function UsdFigure({ value }: { value: number | null }) {
  if (value === null) return <LedgerDash />;
  return <Figure shown={formatCompact(value, "usd")} exact={formatExact(value, "usd")} className={FIGURE_CLASS} />;
}

// no figure yet: a short hairline, in a box as tall as the figure's line, so
// the cell keeps its height when the figure arrives
function LedgerDash() {
  return (
    <span role="img" aria-label="No data" className="flex h-6 items-center md:h-8">
      <span className="h-px w-6 bg-zinc-300 dark:bg-zinc-700" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter 1: statement hero with the network                         */
/* ------------------------------------------------------------------ */


const HERO_NOUNS = [
  "network",
  "stablecoin",
  "market",
  "game",
  "treasury",
  "agent",
  "protocol",
  "business",
  "vault",
  "fund",
  "exchange",
  "economy",
  "marketplace",
];

// The noun on screen. It rolls in from below while the last one rolls out
// (both sit at the slot's top left, so the two cross in one place). Once it
// starts to leave it drops out of the heading's accessible name, so the
// heading never reads two nouns.
function HeroNoun({ noun }: { noun: string }) {
  const isPresent = useIsPresent();
  return (
    <motion.span
      aria-hidden={isPresent ? undefined : true}
      className="absolute left-0 top-0 whitespace-nowrap"
      {...NOUN_ROLL}
    >
      {noun}
    </motion.span>
  );
}

function ChapterOne() {
  const reducedMotion = useReducedMotion();

  // Exit dim: the hero hands off by fading as it scrolls away, so the rising
  // stats board is the only thing asking for attention. Opacity only: a y
  // parallax here could collide with the board entering below the fold.
  // Under Reduce Motion a CSS class holds it at 1: the first render is the server's.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: exit } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const smoothExit = useSpring(exit, SCRUB_SPRING);
  const exitOpacity = useTransform(smoothExit, [0.35, 0.85], [1, 0]);

  // the number of word changes so far: the noun is read from it, and the
  // full stop drops in again on each change
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setTurn((t) => t + 1);
    }, 2800);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  // modulo at read time: guards stale state (e.g. Fast Refresh keeping an
  // index from a longer, older version of the array)
  const noun = HERO_NOUNS[turn % HERO_NOUNS.length] ?? HERO_NOUNS[0];
  const article = /^[aeiou]/.test(noun) ? "an" : "a";

  // width-smoothed slot: measure the incoming word and transition the slot's
  // width so the line settles with the roll instead of snapping as words
  // change length
  const measureRef = useRef<HTMLSpanElement>(null);
  const [nounWidth, setNounWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => setNounWidth(measureRef.current?.offsetWidth ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [noun]);

  // Some phone browsers (Brave on iOS, for one) resize the page when their
  // toolbar hides, which changes svh too, so the hero would grow on the first
  // scroll. On a touch screen the hero keeps the height it loaded with, and
  // follows only a change of width (a rotation)
  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el || !window.matchMedia("(pointer: coarse)").matches) return;
    let width = window.innerWidth;
    const hold = () => el.style.setProperty("--v2-hero-h", `${window.innerHeight}px`);
    hold();
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      hold();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // top-to-bottom load sequence: each block rises in after the one above it
  // (.hero-enter in global.css). A CSS animation plays from the first frame,
  // so the copy never waits for hydration and shows with scripts off; under
  // Reduce Motion it only fades in.
  return (
    // In-flow navbar (~3.5rem) sits above; subtract it so the section is one viewport.
    // The small viewport (svh): on a phone, 100vh is the screen with the browser's
    // toolbars collapsed, so the ridge and the tape would start under them
    <section
      ref={sectionRef}
      data-chapter="hero"
      className="v2-snap-section relative flex min-h-[calc(100vh-3.5rem)] flex-col supports-[height:100svh]:min-h-[calc(var(--v2-hero-h,100svh)-3.5rem)]"
    >
      <motion.div
        className="flex flex-1 flex-col motion-reduce:opacity-100!"
        style={{ opacity: exitOpacity }}
      >
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center">
        {/* the splash ends at the ecosystem tape, so the tape never crops it */}
        <HeroSplash />
        {/* phones: as large as the widest noun ("marketplace.", 7.53em) allows */}
        <h1
          className="hero-enter [--hero-delay:50ms] v2-display text-[clamp(2.5rem,calc((100vw_-_2.75rem)/7.6),3.5rem)] text-zinc-900 dark:text-zinc-50 md:text-[4rem] xl:text-[5rem]"
        >
          Build {article}{" "}
          {/* on mobile the noun always takes its own line. Short nouns like
              "agent" would otherwise fit inline and make the headline jump
              between one and two lines as the words cycle */}
          <br className="md:hidden" />
          {/* the noun and its period wrap as one unit, so the period can
              never orphan onto its own line on narrow viewports */}
          <span className="whitespace-nowrap">
            <span
              /* pb/-mb pair: the display face's 0.95 line box crops glyph
                 bottoms inside overflow-hidden (4px at 390px); the padding
                 reserves the descent, the negative margin keeps layout. */
              className="relative inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]"
              style={{ width: nounWidth ?? undefined, transition: NOUN_WIDTH }}
            >
              {/* in flow and invisible: gives the slot its height (and its
                  width until the measure lands) and measures the next word */}
              <span ref={measureRef} aria-hidden className="invisible inline-block whitespace-nowrap">
                {noun}
              </span>
              <AnimatePresence initial={false}>
                <HeroNoun key={noun} noun={noun} />
              </AnimatePresence>
            </span>
            {/* the red full stop confirms each new word once, then holds still */}
            <motion.span
              key={turn}
              className="inline-block text-[#E6212F]"
              initial={turn === 0 ? false : STOP_DROP.initial}
              animate={STOP_DROP.animate}
              transition={STOP_DROP.transition}
            >
              .
            </motion.span>
          </span>
        </h1>


        <div className="hero-enter [--hero-delay:300ms] mt-12 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          <BrandButton
            href="/console"
            prefetchOnIntent
            onClick={() => track("home_cta_clicked", { section: "hero", label: "Build an L1", href: "/console" })}
            className="w-full sm:w-auto"
          >
            Build an L1
          </BrandButton>
          <BrandButton
            href="/docs/quick-start"
            variant="secondary"
            onClick={() => track("home_cta_clicked", { section: "hero", label: "Build on C-Chain", href: "/docs/quick-start" })}
            className="w-full sm:w-auto"
          >
            Build on C-Chain
          </BrandButton>
          </div>
          <HoverPrefetchLink
            href="/docs/avalanche-l1s"
            onClick={() => track("home_cta_clicked", { section: "hero", label: "Read the architecture", href: "/docs/avalanche-l1s" })}
            // over the splash sky, zinc-500 and zinc-400 fall below AA contrast. On a
            // phone the ridge and the plume rise behind the link, so it sits on a chip
            className="font-mono text-[11px] tracking-[0.18em] text-zinc-600 transition-colors hover:text-zinc-900 max-md:bg-white/95 max-md:px-3 max-md:py-2 dark:text-zinc-300 dark:hover:text-zinc-100 dark:max-md:bg-zinc-950/95"
          >
            READ THE ARCHITECTURE →
          </HoverPrefetchLink>
        </div>
      </div>

      {/* proof band at the fold: the ecosystem tape is part of the hero */}
      <div className="hero-enter [--hero-delay:450ms]">
        <BuiltOnMarquee embedded />
      </div>
      </motion.div>
    </section>
  );
}

function TokenStack({ srcs }: { srcs: string[] }) {
  return (
    <span className="flex -space-x-1.5">
      {srcs.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          className="h-5 w-5 rounded-full bg-white object-contain p-px ring-2 ring-white dark:ring-zinc-950"
          loading="lazy"
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter furniture: brand layout devices from the visual-narrative  */
/* guidelines: an arrowed eyebrow opening each chapter, and vertical   */
/* measurement rules in the technical-drawing grammar                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Chapter 2, proof: one dominant figure and its quiet receipts       */
/* ------------------------------------------------------------------ */

// The dominant figure: stake in USD, or in AVAX when the price is down
function StakeFigure({
  primaryStakeAvax,
  primaryStakeUsd,
  supplyStakedPct,
}: {
  primaryStakeAvax: number | null;
  primaryStakeUsd: number | null;
  supplyStakedPct: number | null;
}) {
  const avax =
    primaryStakeAvax !== null
      ? { shown: `${formatCompact(primaryStakeAvax)} AVAX`, exact: `${formatExact(primaryStakeAvax)} AVAX` }
      : null;
  return (
    <Link
      href="/explorer/mainnet/p-chain/validators"
      className={`group flex flex-col gap-2 md:gap-3 lg:items-end lg:text-right ${FOCUS}`}
    >
      {/* the same link grammar as the page's other mono links: text plus arrow */}
      <span className={`inline-flex items-center gap-1.5 text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100 ${MONO}`}>
        STAKE SECURING THE NETWORK
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
      {primaryStakeUsd !== null ? (
        <Figure shown={formatCompact(primaryStakeUsd, "usd")} exact={formatExact(primaryStakeUsd, "usd")} className={STAKE_CLASS} />
      ) : avax ? (
        <Figure shown={avax.shown} exact={avax.exact} className={STAKE_CLASS} />
      ) : (
        <LedgerDash />
      )}
      {primaryStakeUsd !== null && avax && (
        // one line on phones too, at a tighter tracking: the chapter fits one phone screen
        <span className="font-mono text-[11px] tracking-[0.06em] text-zinc-600 sm:text-xs sm:tracking-[0.16em] dark:text-zinc-300">
          <span className="whitespace-nowrap">
            <Figure shown={avax.shown} exact={avax.exact} />
            {supplyStakedPct !== null && <span> ·</span>}
          </span>
          {supplyStakedPct !== null && (
            <>
              {" "}
              <span className="whitespace-nowrap">{supplyStakedPct.toFixed(1)}% OF TOTAL SUPPLY</span>
            </>
          )}
        </span>
      )}
    </Link>
  );
}

function StatsChapter({
  globeData,
  l1Count,
  primaryStakeAvax,
  primaryStakeUsd,
  avaxUsdPrice,
  supplyStakedPct,
  defi,
  reducedMotion,
}: {
  globeData: GlobeData;
  l1Count: number | null;
  primaryStakeAvax: number | null;
  primaryStakeUsd: number | null;
  avaxUsdPrice: number | null;
  supplyStakedPct: number | null;
  defi: { tvlUsd: number | null; stablesUsd: number | null; dexVolume30dUsd: number | null };
  reducedMotion: boolean;
}) {
  const staticMode = reducedMotion;
  const rowVariants = staticMode ? ROW_STATIC : ROW_VARIANTS;
  // the lanes row is decided at first render: with no chains it stays out
  // for the visit, since a row that came with a later poll would push the board down
  const [lanesRow] = useState(() => rosterOf(globeData?.metrics?.chains ?? []).length > 0);

  return (
    // One panel: ledger, figures, and table are rows of the same board.
    // The whole board loads when the section comes into view: rows cascade
    // in; nothing is gated behind further scrolling.
    <section data-chapter="stats" className="v2-snap-section relative flex flex-col justify-center pt-8 md:py-16 lg:min-h-[calc(100vh-3.5rem)] lg:py-0">
      {/* the claim on the left, its proof on the right: the stake that
          secures the network, the figure institutions underwrite */}
      <div className="mx-auto mb-6 w-full max-w-7xl px-5 md:mb-10 md:px-6">
        {/* the server cannot read reduced motion, so both sides start hidden;
            reduced motion only shows it at once (the kit's Reveal) */}
        <motion.div
          data-reveal
          className="flex flex-col gap-5 md:gap-10 lg:flex-row lg:items-end lg:justify-between"
          initial={HEADING_RISE.initial}
          {...(staticMode
            ? { animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
            : {
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, amount: 0.4 },
                transition: HEADING_RISE.transition,
              })}
        >
          {/* staircase stack per the /solutions hero: lines step right,
              the red period closes the set. The page's largest claim after
              the hero: fluid with the width, so "TECHNOLOGY" plus the stake
              figure fit one row from lg up, and with the height, so the
              chapter fits one laptop screen */}
          <h2 className="v2-display text-[clamp(2.5rem,11.5vw,3.25rem)] text-zinc-900 dark:text-zinc-50 md:text-[clamp(3.5rem,min(0.5rem_+_6vw,10vh),6.75rem)]">
            <span className="block">Technology</span>
            <span className="block" style={{ marginLeft: "0.6em" }}>
              built for
            </span>
            <span className="block" style={{ marginLeft: "1.2em" }}>
              business<span className="text-[#E6212F]">.</span>
            </span>
          </h2>
          <StakeFigure
            primaryStakeAvax={primaryStakeAvax}
            primaryStakeUsd={primaryStakeUsd}
            supplyStakedPct={supplyStakedPct}
          />
        </motion.div>
      </div>
      {/* the board is in place at once and its rows settle in, so each row
          carries data-reveal (shown when scripts are off) */}
      <motion.div
        className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80"
        initial="hidden"
        {...(staticMode
          ? { animate: "show", variants: BOARD_STATIC }
          : { whileInView: "show", viewport: { once: true, amount: 0.35 }, variants: BOARD_VARIANTS })}
      >
        {/* the network now: every block the busiest chains make, as it lands */}
        {lanesRow && (
          <motion.div data-reveal variants={rowVariants}>
            <div className="mx-auto w-full max-w-7xl px-5 py-3 md:px-6 md:pt-4">
              <NetworkLanes
                rows={globeData?.metrics?.chains ?? []}
                reducedMotion={reducedMotion}
                renderMark={(c) => <ChainMark chain={{ chainId: c.chainId, chainName: c.name, chainLogoURI: c.logo }} />}
              />
            </div>
          </motion.div>
        )}
        <motion.div data-reveal variants={rowVariants}>
          <LedgerStrip globeData={globeData} l1Count={l1Count} animateIn={!reducedMotion} />
        </motion.div>

        {/* on-chain capital. Row wrappers stay full-width so the board's
            dividers run full-bleed; content insets to the 7xl measure. */}
        <motion.div data-reveal variants={rowVariants}>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-zinc-200 dark:lg:divide-zinc-800">
          <Link
            href="/explorer/mainnet/c-chain/defi/stablecoins"
            className={`flex flex-col justify-between gap-1 px-5 py-3 transition-colors hover:bg-zinc-100 md:gap-1.5 md:px-6 md:py-6 dark:hover:bg-zinc-900 border-zinc-200 max-lg:col-span-2 max-lg:border-b dark:border-zinc-800 ${CELL_FOCUS}`}
          >
            <span className="flex items-center justify-between">
              <span className={`text-zinc-500 dark:text-zinc-400 ${MONO}`}>
                STABLECOINS ON-CHAIN
              </span>
              <TokenStack srcs={["/logos/tokens/usdc.png", "/logos/tokens/usdt.png", "/logos/tokens/eurc.png", "/logos/tokens/jpyc.png", "/logos/tokens/xsgd.png"]} />
            </span>
            <UsdFigure value={defi.stablesUsd} />
          </Link>
          <Link
            href="/explorer/mainnet/c-chain/defi"
            className={`flex flex-col justify-between gap-1 px-5 py-3 transition-colors hover:bg-zinc-100 md:gap-1.5 md:px-6 md:py-6 dark:hover:bg-zinc-900 border-zinc-200 max-lg:border-r dark:border-zinc-800 ${CELL_FOCUS}`}
          >
            <span className="flex items-center justify-between">
              <span className={`text-zinc-500 dark:text-zinc-400 ${MONO}`}>
                DEFI TVL
              </span>
              <TokenStack srcs={["/logos/tokens/aave.png", "/logos/tokens/benqi.png", "/logos/tokens/gmx.png"]} />
            </span>
            <UsdFigure value={defi.tvlUsd} />
          </Link>
          <Link
            href="/explorer/mainnet/c-chain/defi"
            className={`flex flex-col justify-between gap-1 px-5 py-3 transition-colors hover:bg-zinc-100 md:gap-1.5 md:px-6 md:py-6 dark:hover:bg-zinc-900 ${CELL_FOCUS}`}
          >
            <span className="flex items-center justify-between">
              <span className={`flex items-center gap-2 text-zinc-500 dark:text-zinc-400 ${MONO}`}>
                <span>
                  DEX VOLUME<span className="max-sm:hidden"> · </span>
                  <span className="max-sm:block">30D</span>
                </span>
              </span>
              <TokenStack srcs={["/logos/tokens/uniswap.png", "/logos/tokens/lfj.png", "/logos/tokens/pharaoh.png"]} />
            </span>
            <UsdFigure value={defi.dexVolume30dUsd} />
          </Link>
        </div>
        </motion.div>

        {/* board footer: the full instrument lives at /stats */}
        <motion.div data-reveal variants={rowVariants}>
          <HoverPrefetchLink
            href="/explorer"
            onClick={() => track("home_cta_clicked", { section: "stats", label: "Explore the network", href: "/explorer" })}
            // the focus ring is a pseudo-element over the sweep: the bar's own
            // outline would paint under its positioned children
            className="relative flex items-center justify-between overflow-hidden bg-[#E6212F] py-4 outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0.5 focus-visible:after:z-20 focus-visible:after:border-2 focus-visible:after:border-[#1F1F1F] md:py-5"
          >
            <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
              <span className="text-sm font-medium text-white">Explore the network</span>
              <ArrowRight className="h-4 w-4 text-white" />
            </span>
            {/* the sweep: an aria-hidden copy of the hovered bar, revealed from
                the left on hover and keyboard focus (.sweep-copy in global.css),
                so the label flips where the fill passes */}
            <span aria-hidden inert className="sweep-copy bg-[#EBF0FA]">
              <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
                <span className="text-sm font-medium text-[#1F1F1F]">Explore the network</span>
                <ArrowRight className="h-4 w-4 text-[#E6212F]" />
              </span>
            </span>
          </HoverPrefetchLink>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Chain marks for the live lanes                                      */
/* ------------------------------------------------------------------ */

// Glacier serves a generic AvaCloud placeholder when a chain has no brand
// asset; fall back to the curated list, else a mono monogram in the sheet's
// hairline style.
const LOCAL_CHAIN_LOGOS: Record<string, string> = {
  "dinari financial network": "/logos/partners/dinari.png",
  kite: "/logos/partners/kite-ai.svg",
  "intain market": "/logos/partners/intain.png",
  "lynq 01": "/logos/partners/lynq.png",
};

// marks whose artwork runs to the canvas edge; the circle crop would eat
// them, so they sit inset on a white disc instead
const INSET_MARKS = new Set(["kite"]);

function resolveChainLogo(chain: { chainId?: string; chainName: string; chainLogoURI?: string }) {
  const GENERIC = "AvaCloud-512x512";
  const local = LOCAL_CHAIN_LOGOS[chain.chainName.toLowerCase()];
  if (local) return local;
  if (chain.chainLogoURI && !chain.chainLogoURI.includes(GENERIC)) return chain.chainLogoURI;
  const curated = (l1ChainsData as any[]).find(
    (c) => c.chainId === chain.chainId || c.chainName?.toLowerCase() === chain.chainName.toLowerCase(),
  );
  if (curated?.chainLogoURI && !curated.chainLogoURI.includes(GENERIC)) return curated.chainLogoURI;
  return null;
}

function ChainMark({ chain }: { chain: { chainId?: string; chainName: string; chainLogoURI?: string } }) {
  const logo = resolveChainLogo(chain);
  if (logo) {
    const inset = INSET_MARKS.has(chain.chainName.toLowerCase());
    return (
      <img
        src={logo}
        alt=""
        className={`h-5 w-5 rounded-full object-contain ${
          inset ? "bg-white p-[3px] ring-1 ring-zinc-200 dark:ring-zinc-700" : ""
        }`}
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 font-mono text-[9px] text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
      {chain.chainName.charAt(0).toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */

export default function StoryHome({
  globeData,
  academyLine,
  l1Count,
  primaryStakeAvax,
  primaryStakeUsd,
  avaxUsdPrice,
  supplyStakedPct,
  defi,
}: {
  globeData: GlobeData;
  /** "13 courses · 377 lessons · 26 hours", from the Academy's own stats */
  academyLine: string | null;
  l1Count: number | null;
  primaryStakeAvax: number | null;
  primaryStakeUsd: number | null;
  avaxUsdPrice: number | null;
  supplyStakedPct: number | null;
  defi: { tvlUsd: number | null; stablesUsd: number | null; dexVolume30dUsd: number | null };
}) {
  const reducedMotion = useReducedMotion();

  // Live refresh: repoll the overview metrics so the board ticks while the
  // page is open. A zeroed aggregate means the API cache is still warming;
  // never let that replace real figures on screen.
  const [liveMetrics, setLiveMetrics] = useState(globeData?.metrics ?? null);
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/overview-stats?timeRange=month");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.aggregated?.totalTxCount > 0) setLiveMetrics(data);
      } catch {
        // keep showing the last good figures
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  const liveGlobeData = { ...globeData, metrics: liveMetrics ?? globeData?.metrics };
  // the server snapshot, not the 60 s poll: the network drawing shows a 30-day
  // window, and a new array each minute would rebuild the whole scene
  const interopData = useMemo(
    () => ({
      chains: (globeData?.metrics?.chains ?? []).map((c) => ({ ...c, logo: resolveChainLogo(c) })),
      flows: globeData?.icmFlows ?? [],
    }),
    [globeData],
  );

  // Funnel depth: fire once per chapter per pageload as it enters view.
  useEffect(() => {
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = (entry.target as HTMLElement).dataset.chapter;
          if (entry.isIntersecting && name && !seen.has(name)) {
            seen.add(name);
            track("home_section_viewed", { section: name });
          }
        }
      },
      { threshold: 0.4 },
    );
    document.querySelectorAll("[data-chapter]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    // a div, not a <main>: the site layout (fumadocs HomeLayout) owns the
    // page's one main landmark
    <div className="relative bg-white dark:bg-zinc-950">
      {/* the hero and the board stand on the drafting sheet; it fades out
          under the board's foot, and the story reads on a clean page */}
      <div className="relative">
        <div aria-hidden className="absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_calc(100%-14rem),transparent)]">
          {/* snow only: the avalanche released at the old offering chapter,
              below this sheet, so the hero and the board never had it */}
          <SheetBackdrop snowOnly />
        </div>
        <div className="relative">
          <ChapterOne />
          <StatsChapter globeData={liveGlobeData} l1Count={l1Count} primaryStakeAvax={primaryStakeAvax} primaryStakeUsd={primaryStakeUsd} avaxUsdPrice={avaxUsdPrice} supplyStakedPct={supplyStakedPct} defi={defi} reducedMotion={!!reducedMotion} />
        </div>
      </div>
      <div className="relative bg-white dark:bg-zinc-950">
        <OwnChapter />
        <FinalChapter />
        <InteropChapter data={interopData} />
        <InstitutionsChapter />
        <BuildChapter academyLine={academyLine} />
      </div>
    </div>
  );
}
