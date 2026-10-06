"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
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
import AvaxCoin from "@/components/landing-v2/AvaxCoin";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import PillarsChapter from "@/components/landing-v2/PillarsChapter";
import ChainDiagram from "@/components/landing-v2/diagrams/ChainDiagram";
import { formatCompact, formatCompactIn, formatExact } from "@/components/landing-v2/compactFigure";
import NetworkLanes from "@/components/landing-v2/NetworkLanes";
import { rosterOf } from "@/components/explorer-v2/network/network-reads";
import l1ChainsData from "@/constants/l1-chains.json";
import { ROTATE_MS, SCRUB_SPRING } from "@/components/landing-v2/scrub";
import { track } from "@/components/landing-v2/track";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// Arrival cascade for snap sections: the board rises as one, then its rows
// stagger in. Everything plays on entry — no reveal is gated behind scroll.
const BOARD_VARIANTS = {
  hidden: { opacity: 0, y: 48 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT, staggerChildren: 0.12, delayChildren: 0.1 },
  },
};
const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};
const TABLE_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT, staggerChildren: 0.07, delayChildren: 0.1 },
  },
};
const CHAIN_ROW_VARIANTS = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/* ------------------------------------------------------------------ */
/* Ledger strip — live figures set like a settlement ledger            */
/* ------------------------------------------------------------------ */

const DAY_SECONDS = 86_400;
// every flow metric on the page reads over the same 30-day window
const MONTH_SECONDS = 30 * DAY_SECONDS;

// Extrapolated live counter for FLOW metrics (transactions, messages,
// volume): the figure climbs at the average rate the aggregate implies,
// then re-anchors when fresh data arrives. Levels (validators, stake)
// must never use this — a ticking level would be fiction.
// Re-anchoring never steps the visible figure backwards unless the
// measurement window clearly rolled (new value well below what's shown).
function useExtrapolatedCount(value: number, periodSeconds?: number): number {
  const [display, setDisplay] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    shownRef.current =
      value < shownRef.current * 0.95 ? value : Math.max(shownRef.current, value);
    setDisplay(Math.floor(shownRef.current));
    if (!periodSeconds || value <= 0) return;
    const rate = value / periodSeconds;
    const timer = setInterval(() => {
      shownRef.current += rate * 0.25;
      setDisplay(Math.floor(shownRef.current));
    }, 250);
    return () => clearInterval(timer);
  }, [value, periodSeconds]);

  return display;
}

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
  const [display, setDisplay] = useState(animateIn ? 0 : value);
  // live refreshes count from the last shown figure, not from zero again
  const shownRef = useRef(0);

  useEffect(() => {
    if (!animateIn) {
      shownRef.current = value;
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(shownRef.current, value, {
      duration: 1.4,
      ease: EASE_OUT,
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
    <span ref={ref}>
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
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 dark:text-zinc-400 lg:whitespace-nowrap">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
          </span>
        )}
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
        className={`${cellClass} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900`}
      >
        {content}
      </Link>
    );
  }
  return <div className={cellClass}>{content}</div>;
}

const FIRST_ROW_OF_TWO = "max-lg:border-b max-lg:border-zinc-200 dark:max-lg:border-zinc-800";

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
          label="CROSS-CHAIN MSGS"
          period="30D"
          live
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
        <LedgerCell label="VALIDATORS" href="/explorer/mainnet/chains">
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

function LedgerDash() {
  return <span className="font-mono text-2xl text-zinc-300 dark:text-zinc-700">—</span>;
}

/* ------------------------------------------------------------------ */
/* Chapter 1 — statement hero with the live network                    */
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

function ChapterOne() {
  const reducedMotion = useReducedMotion();

  // Exit dim: the hero hands off by fading as it scrolls away, so the rising
  // stats board is the only thing asking for attention. Opacity only — a y
  // parallax here could collide with the board entering below the fold.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: exit } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const smoothExit = useSpring(exit, SCRUB_SPRING);
  const exitOpacity = useTransform(smoothExit, [0.35, 0.85], [1, 0]);

  const [nounIndex, setNounIndex] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setNounIndex((i) => (i + 1) % HERO_NOUNS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  // modulo at read time: guards stale state (e.g. Fast Refresh keeping an
  // index from a longer, older version of the array)
  const noun = HERO_NOUNS[nounIndex % HERO_NOUNS.length] ?? HERO_NOUNS[0];
  const article = /^[aeiou]/.test(noun) ? "an" : "a";

  // width-smoothed slot: measure the incoming word and transition the slot's
  // width so the line glides instead of snapping as words change length
  const measureRef = useRef<HTMLSpanElement>(null);
  const [nounWidth, setNounWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => setNounWidth(measureRef.current?.offsetWidth ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [noun]);

  // top-to-bottom load sequence: each block rises in after the one above it
  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    // In-flow navbar (~3.5rem) sits above; subtract it so the section is one viewport.
    // The small viewport (svh): on a phone, 100vh is the screen with the browser's
    // toolbars collapsed, so the ridge and the tape would start under them
    <section
      ref={sectionRef}
      data-chapter="hero"
      className="v2-snap-section relative flex min-h-[calc(100vh-3.5rem)] flex-col supports-[height:100svh]:min-h-[calc(100svh-3.5rem)]"
    >
      <motion.div
        className="flex flex-1 flex-col"
        style={reducedMotion ? undefined : { opacity: exitOpacity }}
      >
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center">
        {/* the splash ends at the ecosystem tape, so the tape never crops it */}
        <HeroSplash />
        {/* phones: as large as the widest noun ("marketplace.", 7.53em) allows */}
        <motion.h1
          className="v2-display text-[clamp(2.5rem,calc((100vw_-_2.75rem)/7.6),3.5rem)] text-zinc-900 dark:text-zinc-50 md:text-[4rem] xl:text-[5rem]"
          {...rise(0.05)}
        >
          Build {article}{" "}
          {/* on mobile the noun always takes its own line — short nouns like
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
              style={{
                width: nounWidth ?? undefined,
                transition: "width 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={noun}
                  className="inline-block whitespace-nowrap"
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-105%" }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {noun}
                </motion.span>
              </AnimatePresence>
              <span ref={measureRef} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">
                {noun}
              </span>
            </span>
            <span className="text-[#E6212F] motion-safe:animate-[pulse_3s_ease-in-out_infinite]">.</span>
          </span>
        </motion.h1>


        <motion.div className="mt-12 flex flex-col items-center gap-6" {...rise(0.3)}>
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
            // over the splash sky, zinc-500 and zinc-400 fall below AA contrast
            className="font-mono text-[11px] tracking-[0.18em] text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            READ THE ARCHITECTURE →
          </HoverPrefetchLink>
        </motion.div>
      </div>

      {/* proof band at the fold: the ecosystem tape is part of the hero */}
      <motion.div {...rise(0.45)}>
        <BuiltOnMarquee embedded />
      </motion.div>
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
/* Chapter furniture — brand layout devices from the visual-narrative  */
/* guidelines: an arrowed eyebrow opening each chapter, and vertical   */
/* measurement rules in the technical-drawing grammar                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Chapter 2 — proof: one dominant figure and its quiet receipts       */
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
      className="group flex flex-col gap-2 md:gap-3 lg:items-end lg:text-right"
    >
      {/* the same link grammar as the page's other mono links: text plus arrow */}
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
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
              <span className="whitespace-nowrap">{supplyStakedPct.toFixed(1)}% OF CIRCULATING SUPPLY</span>
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
  // the lanes row is decided at first render: with no chains it stays out
  // for the visit, since a row that came with a later poll would push the board down
  const [lanesRow] = useState(() => rosterOf(globeData?.metrics?.chains ?? []).length > 0);

  return (
    // One panel: ledger, figures, and table are rows of the same board.
    // The whole board loads when the section snaps into view — rows cascade
    // in; nothing is gated behind further scrolling.
    <section data-chapter="stats" className="v2-snap-section relative flex flex-col justify-center pt-8 md:py-16 lg:min-h-[calc(100vh-3.5rem)] lg:py-0">
      {/* the claim on the left, its proof on the right: the stake that
          secures the network, the figure institutions underwrite */}
      <div className="mx-auto mb-6 w-full max-w-7xl px-5 md:mb-10 md:px-6">
        <motion.div
          className="flex flex-col gap-5 md:gap-10 lg:flex-row lg:items-end lg:justify-between"
          initial={staticMode ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
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
      <motion.div
        className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80"
        variants={BOARD_VARIANTS}
        initial={staticMode ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
      >
        {/* the network now: every block the busiest chains make, as it lands */}
        {lanesRow && (
          <motion.div variants={ROW_VARIANTS}>
            <div className="mx-auto w-full max-w-7xl px-5 py-3 md:px-6 md:pt-4">
              <NetworkLanes
                rows={globeData?.metrics?.chains ?? []}
                reducedMotion={reducedMotion}
                renderMark={(c) => <ChainMark chain={{ chainId: c.chainId, chainName: c.name, chainLogoURI: c.logo }} />}
              />
            </div>
          </motion.div>
        )}
        <motion.div variants={ROW_VARIANTS}>
          <LedgerStrip globeData={globeData} l1Count={l1Count} animateIn={!reducedMotion} />
        </motion.div>

        {/* on-chain capital. Row wrappers stay full-width so the board's
            dividers run full-bleed; content insets to the 7xl measure. */}
        <motion.div variants={ROW_VARIANTS}>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-zinc-200 dark:lg:divide-zinc-800">
          <Link
            href="/explorer/mainnet/c-chain/defi/stablecoins"
            className="flex flex-col justify-between gap-1 px-5 py-3 transition-colors hover:bg-zinc-100 md:gap-1.5 md:px-6 md:py-6 dark:hover:bg-zinc-900 border-zinc-200 max-lg:col-span-2 max-lg:border-b dark:border-zinc-800"
          >
            <span className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                STABLECOINS ON-CHAIN
              </span>
              <TokenStack srcs={["/logos/tokens/usdc.png", "/logos/tokens/usdt.png", "/logos/tokens/eurc.png", "/logos/tokens/jpyc.png", "/logos/tokens/xsgd.png"]} />
            </span>
            <UsdFigure value={defi.stablesUsd} />
          </Link>
          <Link
            href="/explorer/mainnet/c-chain/defi"
            className="flex flex-col justify-between gap-1 px-5 py-3 transition-colors hover:bg-zinc-100 md:gap-1.5 md:px-6 md:py-6 dark:hover:bg-zinc-900 border-zinc-200 max-lg:border-r dark:border-zinc-800"
          >
            <span className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                DEFI TVL
              </span>
              <TokenStack srcs={["/logos/tokens/aave.png", "/logos/tokens/benqi.png", "/logos/tokens/gmx.png"]} />
            </span>
            <UsdFigure value={defi.tvlUsd} />
          </Link>
          <Link
            href="/explorer/mainnet/c-chain/defi"
            className="flex flex-col justify-between gap-1 px-5 py-3 transition-colors hover:bg-zinc-100 md:gap-1.5 md:px-6 md:py-6 dark:hover:bg-zinc-900"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
                </span>
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
        <motion.div variants={ROW_VARIANTS}>
          <HoverPrefetchLink
            href="/explorer"
            onClick={() => track("home_cta_clicked", { section: "stats", label: "Explore the network", href: "/explorer" })}
            className="group relative flex items-center justify-between overflow-hidden bg-[#E6212F] py-4 md:py-5"
          >
            <span
              aria-hidden
              className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100"
            />
            <span className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
              <span className="text-sm font-medium text-white transition-colors duration-300 group-hover:text-[#1F1F1F]">
                Explore the network
              </span>
              <ArrowRight className="h-4 w-4 text-white transition-colors duration-300 group-hover:text-[#E6212F]" />
            </span>
          </HoverPrefetchLink>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter 3 — the offering: one network, two ways to build            */
/* ------------------------------------------------------------------ */

const OFFERINGS = [
  {
    mark: "avax" as const,
    eyebrow: "C-CHAIN",
    title: "Build on the C-Chain",
    lines: [
      "One public EVM chain, hundreds of live applications.",
      "Deep stablecoin liquidity, institutional custody.",
      "Every major wallet and data integration in place.",
    ],
    cta: { text: "Build on C-Chain", href: "/docs/primary-network#c-chain-contract-chain" },
    secondary: { text: "BROWSE INTEGRATIONS", href: "/integrations" },
  },
  {
    mark: "yours" as const,
    eyebrow: "SOVEREIGN L1",
    title: "Build your own L1",
    lines: [
      "One sovereign chain, customized end to end.",
      "Your own VM, gas token, fees, and permissioning.",
      "Validated by operators you choose, ICM optional.",
    ],
    cta: { text: "Build an L1", href: "/console" },
    secondary: { text: "READ THE ARCHITECTURE", href: "/docs/avalanche-l1s" },
  },
];

function OfferingChapter({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section data-chapter="offering" className="v2-snap-section relative flex flex-col justify-center py-24 lg:min-h-[calc(100vh-3.5rem)] lg:py-0">
      <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
        <motion.h2
          className="v2-display text-3xl text-zinc-900 dark:text-zinc-50 md:text-5xl xl:text-6xl"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          One network. Two ways to build
          <span className="text-[#E6212F]">.</span>
        </motion.h2>

        <motion.div
          className="relative mt-12 grid grid-cols-1 divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80"
          initial={reducedMotion ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.12, ease: EASE_OUT }}
        >
          {/* the wire: both chains hang off one network. Node centers sit at
              25% and 75% of the board, so the wire spans the middle half. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[calc(25%+32px)] right-[calc(25%+32px)] top-[72px] hidden lg:block"
          >
            <div className="h-px w-full bg-zinc-300 dark:bg-zinc-700" />
            <span className="v2-wire-dot absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-[#E6212F]" />
            <span className="absolute left-1/2 top-3 -translate-x-1/2 font-mono text-[9px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              INTERCHAIN MESSAGING
            </span>
          </div>
          {/* the choice: one or the other */}
          <span className="absolute left-1/2 top-[55%] z-10 hidden -translate-x-1/2 -translate-y-1/2 border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-zinc-500 lg:block dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            OR
          </span>

          {OFFERINGS.map((offering) => (
            <div
              key={offering.eyebrow}
              className="flex flex-col items-center px-5 pb-10 pt-12 text-center md:px-8 lg:pb-12"
            >
              {/* the known chain wears the mark; yours is still to be drawn */}
              {offering.mark === "avax" ? (
                <AvaxCoin />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-400 dark:border-zinc-500">
                  <span className="font-mono text-base text-zinc-500 dark:text-zinc-400">?</span>
                </span>
              )}
              <span className="mt-4 font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {offering.eyebrow}
              </span>
              <h3 className="mt-4 text-2xl font-light tracking-[-0.02em] text-zinc-900 dark:text-zinc-50 md:text-3xl">
                {offering.title}
              </h3>
              {/* three matched beats, one fact each — the same count and
                  rhythm on both sides so the panels mirror line for line */}
              <div className="mt-4 max-w-md space-y-1.5">
                {offering.lines.map((line) => (
                  <p key={line} className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base">
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-auto flex flex-col items-center gap-5 pt-9 sm:flex-row sm:gap-7">
                <BrandButton
                  href={offering.cta.href}
                  prefetchOnIntent
                  onClick={() => track("home_cta_clicked", { section: "offering", path: offering.eyebrow, label: offering.cta.text, href: offering.cta.href })}
                  className="w-full sm:w-auto"
                >
                  {offering.cta.text}
                </BrandButton>
                <HoverPrefetchLink
                  href={offering.secondary.href}
                  onClick={() => track("home_cta_clicked", { section: "offering", path: offering.eyebrow, label: offering.secondary.text, href: offering.secondary.href })}
                  className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                >
                  {offering.secondary.text}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </HoverPrefetchLink>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Already live — the closing evidence, one screen before the CTA      */
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

// Glacier registry names aren't always the brand names
const DISPLAY_NAMES: Record<string, string> = {
  kite: "Kite AI",
  "intain market": "Intain",
  "lynq 01": "Lynq",
};

// Showcase pins: chains the shared Metrics API doesn't rank fairly but that
// carry the story. Kite AI's figure is injected from its dedicated metrics
// source (see getKiteTxCount in the page). Pins merge into the ranked list —
// they earn their row position by activity like everyone else.
const FEATURED_CHAINS: { name: string }[] = [
  { name: "kite" },
  { name: "dinari financial network" },
  { name: "beam" },
  { name: "fifa" },
];

// Private L1s: real institutional deployments whose activity ends at the
// network's edge. Their validator sets are public P-Chain facts; their
// transactions are not — so the activity column says "private" instead of
// pretending zero is the truth.
const PRIVATE_CHAINS: { name: string }[] = [
  { name: "intain market" },
  { name: "lynq 01" },
];

// public rows shown before the private tier
const PUBLIC_ROW_COUNT = 8;

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

function resolveChainStatsHref(chain: { chainId?: string; chainName: string }): string | null {
  if (chain.chainId === "43114" || chain.chainName.toLowerCase().includes("c-chain")) {
    return "/explorer/mainnet/c-chain/accounts";
  }
  const curated = (l1ChainsData as any[]).find(
    (c) => c.chainId === chain.chainId || c.chainName?.toLowerCase() === chain.chainName.toLowerCase(),
  );
  return curated?.slug ? `/explorer/mainnet/${curated.slug}/accounts` : null;
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

function TopChainRow({
  index,
  chain,
  isPrivate = false,
  staticMode,
}: {
  index: number;
  chain: {
    chainId?: string;
    chainName: string;
    chainLogoURI?: string;
    txCount: number;
    tps: number;
    validatorCount: number | string;
  };
  isPrivate?: boolean;
  staticMode: boolean;
}) {
  // chains without a curated slug still land somewhere real: the full chain list
  const href = resolveChainStatsHref(chain) ?? "/explorer/mainnet/chains";
  const liveTxCount = useExtrapolatedCount(chain.txCount, MONTH_SECONDS);
  const rowClass =
    "grid grid-cols-[2rem_1.5rem_1fr_6rem] items-center gap-4 py-3 sm:grid-cols-[2rem_1.5rem_1fr_10rem_6rem]";

  return (
    <motion.div
      className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800"
      variants={staticMode ? undefined : CHAIN_ROW_VARIANTS}
    >
      <Link
        href={href}
        onClick={() => track("home_chain_clicked", { chain: chain.chainName, href })}
        className={`${rowClass} transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900`}
      >
        <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-600">
          {String(index + 1).padStart(2, "0")}
        </span>
        <ChainMark chain={chain} />
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {DISPLAY_NAMES[chain.chainName.toLowerCase()] ?? chain.chainName}
        </span>
        {isPrivate ? (
          // activity is sealed by design — the label is the datum
          <span className="text-right font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            PRIVATE
          </span>
        ) : (
          <span className="text-right font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
            {liveTxCount > 0 ? liveTxCount.toLocaleString("en-US") : "—"}
          </span>
        )}
        <span className="hidden text-right font-mono text-sm tabular-nums text-zinc-500 sm:block dark:text-zinc-400">
          {typeof chain.validatorCount === "number" ? chain.validatorCount : "—"}
        </span>
      </Link>
    </motion.div>
  );
}

function LiveChainsChapter({
  globeData,
  kiteTxCount,
  reducedMotion,
}: {
  globeData: GlobeData;
  kiteTxCount: number | null;
  reducedMotion: boolean;
}) {
  // curated exclusions for the marketing surface (unbranded / low-tier / staging)
  const EXCLUDED_CHAINS = ["andromeda", "defi kingdoms", "kitestaging2", "orange"];
  const privateNames = PRIVATE_CHAINS.map((p) => p.name);
  const byActivity = (globeData?.metrics?.chains || [])
    .filter((c) => !EXCLUDED_CHAINS.includes(c.chainName.toLowerCase()))
    .sort((a, b) => (b.txCount || 0) - (a.txCount || 0));

  const featured = FEATURED_CHAINS.map((f) => {
    const chain = byActivity.find((c) => c.chainName.toLowerCase() === f.name);
    if (!chain) return null;
    // Kite AI's real figure comes from its dedicated metrics source
    if (f.name === "kite" && kiteTxCount !== null) return { ...chain, txCount: kiteTxCount };
    return chain;
  }).filter(Boolean) as (typeof byActivity)[number][];
  // organic activity leaders fill the remaining public rows, then the whole
  // public set re-ranks by activity so a pin never outranks a busier chain
  const organic = byActivity
    .filter(
      (c) =>
        !featured.some((f) => f.chainName === c.chainName) &&
        !privateNames.includes(c.chainName.toLowerCase()),
    )
    .slice(0, PUBLIC_ROW_COUNT - featured.length);
  const publicRows = [...organic, ...featured].sort(
    (a, b) => (b.txCount || 0) - (a.txCount || 0),
  );
  // the private tier closes the table: sealed activity, public validator sets
  const privateRows = PRIVATE_CHAINS.map((p) =>
    byActivity.find((c) => c.chainName.toLowerCase() === p.name),
  ).filter(Boolean) as (typeof byActivity)[number][];
  const rows = [
    ...publicRows.map((chain) => ({ chain, isPrivate: false })),
    ...privateRows.map((chain) => ({ chain, isPrivate: true })),
  ];

  return (
    <section data-chapter="live-chains" className="v2-snap-section relative flex flex-col justify-center py-24 lg:min-h-[calc(100vh-3.5rem)] lg:py-0">
      <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
        <motion.h2
          className="v2-display text-3xl text-zinc-900 dark:text-zinc-50 md:text-5xl xl:text-6xl"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          Already live
          <span className="text-[#E6212F]">.</span>
        </motion.h2>

        <motion.div
          className="mt-12 border-y border-zinc-200 bg-white/80 px-5 py-4 backdrop-blur-sm md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80"
          variants={TABLE_VARIANTS}
          initial={reducedMotion ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="grid grid-cols-[2rem_1.5rem_1fr_6rem] gap-4 border-b border-zinc-300 pb-2 sm:grid-cols-[2rem_1.5rem_1fr_10rem_6rem] dark:border-zinc-700">
            <span />
            <span />
            <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
              CHAIN
            </span>
            <span className="whitespace-nowrap text-right font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              <span className="sm:hidden">TXS · 30D</span>
              <span className="hidden sm:inline">TRANSACTIONS · 30D</span>
            </span>
            <span className="hidden whitespace-nowrap text-right font-mono text-[10px] tracking-[0.18em] text-zinc-500 sm:block dark:text-zinc-400">
              VALIDATORS
            </span>
          </div>
          {rows.map(({ chain, isPrivate }, i) => (
            <TopChainRow
              key={chain.chainName + i}
              index={i}
              chain={chain}
              isPrivate={isPrivate}
              staticMode={reducedMotion}
            />
          ))}
        </motion.div>

        <motion.div
          className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3"
          initial={reducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link
            href="/explorer/mainnet/chains"
            onClick={() => track("home_cta_clicked", { section: "live-chains", label: "All chains", href: "/explorer/mainnet/chains" })}
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            ALL CHAINS
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <HoverPrefetchLink
            href="/explorer"
            onClick={() => track("home_cta_clicked", { section: "live-chains", label: "Explorer", href: "/explorer" })}
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            EXPLORER
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </HoverPrefetchLink>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter 6: playbooks, one L1 in three access modes                  */
/* ------------------------------------------------------------------ */

const PLAYBOOKS = [
  {
    key: "public",
    title: "Public",
    body: "Anyone can validate; anyone can transact. Build on the shared C-Chain, or run an open L1 of your own.",
  },
  {
    key: "permissioned",
    title: "Permissioned",
    body: "Named operators run consensus; the application stays open. Accountability at the validator layer, reach at the user layer.",
  },
  {
    key: "private",
    title: "Private",
    body: "Participation, data, and access end at the network\u2019s edge. To anyone outside, the chain doesn\u2019t exist.",
  },
] as const;

type PlaybookKey = (typeof PLAYBOOKS)[number]["key"];

function PlaybookSelector({
  mode,
  onSelect,
  progressKey,
  animate,
}: {
  mode: PlaybookKey;
  onSelect: (key: PlaybookKey) => void;
  progressKey: string;
  animate: boolean;
}) {
  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {PLAYBOOKS.map((pb) => {
        const isActive = pb.key === mode;
        return (
          <button
            key={pb.key}
            type="button"
            onClick={() => onSelect(pb.key)}
            aria-pressed={isActive}
            className={`relative block w-full py-7 pl-6 pr-4 text-left transition-opacity duration-300 ${
              isActive ? "" : "opacity-40 hover:opacity-70"
            }`}
          >
            {/* active edge-rule fills over the rotation interval — same
                3px red line as the accordion's floor */}
            {isActive &&
              (animate ? (
                <span
                  key={progressKey}
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-[3px] origin-top bg-[#E6212F]"
                  style={{ animation: `v2-fill-y ${ROTATE_MS}ms linear forwards`, transform: "scaleY(0)" }}
                />
              ) : (
                <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[#E6212F]" />
              ))}
            <span className="v2-display text-xl text-zinc-900 dark:text-zinc-50 md:text-2xl">
              {pb.title}
            </span>
            <span className="mt-2 block max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {pb.body}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlaybooksChapter({ reducedMotion }: { reducedMotion: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.5 });
  const [modeIdx, setModeIdx] = useState(0);
  // bumping restarts the rotation timer so a click always buys a full interval
  const [cycle, setCycle] = useState(0);

  // The section is complete on arrival; the stage walks the three playbooks
  // on its own while in view. Scrolling only ever moves between sections.
  useEffect(() => {
    if (reducedMotion || !inView) return;
    const timer = setInterval(() => setModeIdx((i) => (i + 1) % PLAYBOOKS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [reducedMotion, inView, cycle]);

  const select = (key: PlaybookKey) => {
    track("home_playbook_selected", { playbook: key });
    setCycle((c) => c + 1);
    setModeIdx(PLAYBOOKS.findIndex((pb) => pb.key === key));
  };

  const mode = PLAYBOOKS[modeIdx].key;

  const body = (
    <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
      {/* the last word is the surprise, so it takes the red — the same
          lead/punch grammar as the accordion headlines */}
      <h2 className="v2-display text-3xl text-zinc-900 dark:text-zinc-50 md:text-5xl xl:text-6xl">
        Open, permissioned, or <span className="text-[#E6212F]">invisible.</span>
      </h2>

      {/* a bounded card, not a full-bleed wall — the sheet (and the
          avalanche gathering on it) stays visible around the board */}
      <div className="mt-12 grid items-center gap-12 border-y border-zinc-200 bg-white/80 px-5 py-10 backdrop-blur-sm md:px-8 lg:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div>
          <PlaybookSelector
            mode={mode}
            onSelect={select}
            progressKey={`${mode}-${cycle}`}
            animate={!reducedMotion && inView}
          />
          {/* the chapter's door: every playbook is a Console configuration */}
          <div className="mt-8 hidden lg:block">
            <BrandButton
              variant="secondary"
              href="/console"
              prefetchOnIntent
              onClick={() => track("home_cta_clicked", { section: "playbooks", label: "Configure your L1", href: "/console" })}
            >
              Configure your L1
            </BrandButton>
          </div>
        </div>
        <div className="hidden flex-col items-center lg:flex">
          <ChainDiagram mode={mode} cycle={cycle} />
        </div>

        {/* sub-lg stage: same instrument, compact, below the selector so the
            rotating list visibly drives something */}
        <div className="flex flex-col items-center gap-4 lg:hidden">
          <ChainDiagram mode={mode} cycle={cycle} className="-mx-5 w-[calc(100%+2.5rem)]" />
          <BrandButton
            variant="secondary"
            href="/console"
            prefetchOnIntent
            onClick={() => track("home_cta_clicked", { section: "playbooks", label: "Configure your L1", href: "/console" })}
            className="mt-4 w-full sm:w-auto"
          >
            Configure your L1
          </BrandButton>
        </div>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      data-chapter="playbooks"
      className="v2-snap-section flex items-center py-24 lg:min-h-[calc(100vh-3.5rem)] lg:py-0"
    >
      <motion.div
        className="w-full"
        initial={reducedMotion ? false : { opacity: 0, y: 48 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        {body}
      </motion.div>
    </section>
  );
}

function FinaleRow({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <HoverPrefetchLink
      href={href}
      onClick={() => track("home_cta_clicked", { section: "finale", label: title, href })}
      className="group grid grid-cols-[1fr_auto] items-center gap-6 px-5 py-7 transition-colors hover:bg-zinc-100 md:px-6 dark:hover:bg-zinc-900"
    >
      <span>
        <span className="block text-lg font-medium text-zinc-900 dark:text-zinc-50 md:text-xl">
          {title}
        </span>
        <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
      <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-50" />
    </HoverPrefetchLink>
  );
}

function FinaleChapter({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <section data-chapter="finale" className="v2-snap-section flex flex-col justify-center py-28 lg:min-h-[calc(100vh-3.5rem)] lg:py-0">
      <motion.div
        className="mx-auto w-full max-w-7xl px-5 md:px-6"
        initial={reducedMotion ? false : { opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        <h2 className="v2-display text-[2.5rem] text-zinc-900 dark:text-zinc-50 md:text-[4rem] xl:text-[5rem]">
          Build yours
          <span className="text-[#E6212F] motion-safe:animate-[pulse_3s_ease-in-out_infinite]">.</span>
        </h2>

        {/* a solid panel: the rows read on paper, not over the sheet's lattice */}
        <div className="mt-14 divide-y divide-zinc-200 border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          <FinaleRow
            href="/docs/primary-network"
            title="Build on the C-Chain"
            description="Ship on the shared, permissionless EVM chain today."
          />
          <FinaleRow
            href="/console"
            title="Build an L1 in the Console"
            description="From configuration to mainnet validators, in one guided session."
          />
          <FinaleRow
            href="/docs/avalanche-l1s"
            title="Read the architecture"
            description="How sovereign L1s, the primary network, and interchain messaging fit together."
          />
          <FinaleRow
            href="/explorer"
            title="Explore the live network"
            description="Every chain, validator, and message, observed on-chain."
          />
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default function StoryHome({
  globeData,
  kiteTxCount,
  l1Count,
  primaryStakeAvax,
  primaryStakeUsd,
  avaxUsdPrice,
  supplyStakedPct,
  defi,
}: {
  globeData: GlobeData;
  kiteTxCount: number | null;
  l1Count: number | null;
  primaryStakeAvax: number | null;
  primaryStakeUsd: number | null;
  avaxUsdPrice: number | null;
  supplyStakedPct: number | null;
  defi: { tvlUsd: number | null; stablesUsd: number | null; dexVolume30dUsd: number | null };
}) {
  const reducedMotion = useReducedMotion();

  // Section snapping is a document-level property; scope it to this page by
  // tagging <html> while mounted (CSS lives in global.css under .v2-snap).
  // Layout effect, not effect: the cleanup must remove mandatory snapping
  // SYNCHRONOUSLY in the unmount commit. With useEffect the class survives
  // one paint into the next route, and the browser re-snaps the homepage's
  // deep scroll offset against the shorter page — landing visitors at the
  // bottom of /solutions.
  useLayoutEffect(() => {
    document.documentElement.classList.add("v2-snap");
    return () => document.documentElement.classList.remove("v2-snap");
  }, []);

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
    <main className="relative bg-white dark:bg-zinc-950">
      <SheetBackdrop />
      <div className="relative">
        <ChapterOne />
        <StatsChapter globeData={liveGlobeData} l1Count={l1Count} primaryStakeAvax={primaryStakeAvax} primaryStakeUsd={primaryStakeUsd} avaxUsdPrice={avaxUsdPrice} supplyStakedPct={supplyStakedPct} defi={defi} reducedMotion={!!reducedMotion} />
        <OfferingChapter reducedMotion={!!reducedMotion} />
        <PillarsChapter reducedMotion={!!reducedMotion} />
        <PlaybooksChapter reducedMotion={!!reducedMotion} />
        <LiveChainsChapter globeData={liveGlobeData} kiteTxCount={kiteTxCount} reducedMotion={!!reducedMotion} />
        <FinaleChapter reducedMotion={!!reducedMotion} />
      </div>
    </main>
  );
}
