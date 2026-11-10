"use client";

import type { ReactNode, Ref } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HoverPrefetchLink } from "@/components/landing-v2/HoverPrefetchLink";
import { track } from "@/components/landing-v2/track";

/* The story chapters' one type scale and one motion. Every chapter below
   the stats board is built from these parts, so the page speaks with one
   voice: a two-line title in Aeonik Medium, one lead
   sentence, and its proof. Content rises in once, as it enters.

   The scale, largest first:
     Title    36 / 48 / 56 px, Aeonik Medium (h2)
     Figure   30 / 36 / 48 px, Aeonik Medium, one step under the title
     SUBHEAD  24 / 28 px, Aeonik Medium (h3, card names)
     Lead     18 / 20 px
     BODY     15 px
     CAPTION  13 px (footnotes under a figure or a drawing)
     MONO     12 px uppercase, tracked (labels, quiet links) */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const BODY = "text-pretty text-[15px] leading-snug text-zinc-500 dark:text-zinc-400";
export const CAPTION = "text-pretty text-[13px] leading-snug text-zinc-500 dark:text-zinc-400";
export const MONO = "font-mono text-xs uppercase tracking-[0.16em]";
export const SUBHEAD = "v2-heading text-2xl leading-tight tracking-[-0.02em] text-zinc-900 md:text-[1.75rem] dark:text-zinc-50";

/** the keyboard focus ring for every link in the story: brand red, offset clear of the text */
export const FOCUS =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-[#E6212F]";

/** the chapter frame: one message per chapter, generous air around it */
export function Chapter({
  id,
  children,
  className = "",
  ref,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <section ref={ref} data-chapter={id} className={`relative py-16 md:py-28 ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-5 md:px-6">{children}</div>
    </section>
  );
}

/** when a block starts to rise: its top passes 10% above the bottom of the screen, at any block height */
export const REVEAL_VIEW = { once: true, margin: "0px 0px -10% 0px" } as const;

/**
 * Rises in once when its top passes 90% of the screen height, at any block
 * height. Under reduced motion it is in place as soon as the page hydrates.
 * data-reveal lets global.css show it when scripts are off.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  // the server cannot read reduced motion, so both send the same hidden
  // start (a different start would not hydrate); reduced motion only drops
  // the duration, so the content appears in place
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 24 }}
      {...(reduced ? { animate: { opacity: 1, y: 0 } } : { whileInView: { opacity: 1, y: 0 }, viewport: REVEAL_VIEW })}
      transition={reduced ? { duration: 0 } : { duration: 0.7, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The chapter title: the statement in ink, an optional quieter second line,
 * and the red period that closes every headline on the page.
 */
export function Title({
  lead,
  rest,
  className = "",
}: {
  lead: string;
  rest?: string;
  className?: string;
}) {
  return (
    <h2
      className={`v2-heading text-balance text-[2.25rem] leading-[1.06] tracking-[-0.03em] md:text-5xl lg:text-[3.5rem] ${className}`}
    >
      <span className="block text-zinc-900 dark:text-zinc-50">
        {lead}
        {!rest && <span className="text-[#E6212F]">.</span>}
      </span>
      {rest && (
        <span className="block text-zinc-500">
          {rest}
          <span className="text-[#E6212F]">.</span>
        </span>
      )}
    </h2>
  );
}

/** the one sentence under a title */
export function Lead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-pretty max-w-xl text-lg leading-[1.4] text-zinc-600 md:text-xl dark:text-zinc-400 ${className}`}>
      {children}
    </p>
  );
}

/** a proof figure: the number in the heading face, one plain caption under it */
export function Figure({
  value,
  unit,
  caption,
  className = "",
}: {
  value: ReactNode;
  unit?: string;
  caption: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <p className="v2-heading text-3xl tabular-nums leading-none tracking-[-0.04em] text-zinc-900 md:text-4xl lg:text-5xl dark:text-zinc-50">
        {value}
        {/* a no-break space, not a margin, so "1.33 AVAX" stays apart when read or copied */}
        {unit && "\u00a0"}
        {unit && <span className="text-lg tracking-[-0.02em] text-zinc-500 md:text-xl lg:text-2xl">{unit}</span>}
      </p>
      <p className={`max-w-[18rem] ${BODY}`}>{caption}</p>
    </div>
  );
}

/**
 * The page's quiet link: mono label and arrow, tracked as a home CTA. The
 * padding grows the tap area to 44 px; the negative margin keeps the layout.
 */
export function TextLink({
  href,
  section,
  children,
}: {
  href: string;
  section: string;
  children: string;
}) {
  return (
    <HoverPrefetchLink
      href={href}
      onClick={() => track("home_cta_clicked", { section, label: children, href })}
      className={`group -my-3.5 inline-flex items-center max-sm:self-start gap-1.5 py-3.5 text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:text-zinc-50 ${MONO} ${FOCUS}`}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5" />
    </HoverPrefetchLink>
  );
}
