"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PILLARS } from "@/components/landing-v2/pillars";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import PillarDiagram from "@/components/landing-v2/PillarDiagrams";
import { ROTATE_MS } from "@/components/landing-v2/scrub";
import { track } from "@/components/landing-v2/track";

/* ------------------------------------------------------------------ */
/* Why Avalanche — brand accordion: four numbered panels, one expanded  */
/* ------------------------------------------------------------------ */

// Board-row listing of the pillars, used by the /solutions index (the
// homepage chapter below cycles them on one stage instead). Each row is
// a hard vertical split in the brand's diptych grammar: statement on the
// left, the pillar's live instrument right of a hairline rule.
export function PillarRows({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
      {PILLARS.map((pillar, i) => (
        <motion.div
          key={pillar.slug}
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={`/solutions/${pillar.slug}`}
            className="group relative grid grid-cols-1 items-center gap-x-10 gap-y-3 px-5 py-9 transition-colors hover:bg-zinc-50 md:px-6 lg:grid-cols-[2.5rem_10rem_minmax(0,1fr)_minmax(0,20rem)_auto] lg:py-6 dark:hover:bg-zinc-900/60"
          >
            <span className="absolute bottom-0 left-0 top-0 w-px bg-transparent transition-colors duration-300 group-hover:bg-[#E6212F]" />
            <span className="hidden font-mono text-[10px] tracking-[0.18em] text-zinc-400 lg:block dark:text-zinc-500">
              {`0${i + 1}`}
            </span>
            <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {pillar.label}
            </span>
            <span>
              <span className="block text-2xl font-light leading-snug tracking-[-0.02em] text-zinc-900 dark:text-zinc-50 md:text-[2rem]">
                {pillar.title}.
              </span>
              <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {pillar.tagline}
              </span>
            </span>
            <span className="hidden h-44 items-center justify-center border-l border-zinc-200 pl-10 lg:flex dark:border-zinc-800">
              <PillarDiagram slug={pillar.slug} />
            </span>
            <span className="flex items-center justify-self-start lg:justify-self-end">
              <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-50" />
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

type PillarSlug = (typeof PILLARS)[number]["slug"];

function titleCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

export default function PillarsChapter({ reducedMotion }: { reducedMotion: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.5 });
  const [activeIdx, setActiveIdx] = useState(0);
  // bumping restarts the rotation timer so a click always buys a full interval
  const [cycle, setCycle] = useState(0);

  // The section is complete on arrival; the stage walks the four guarantees
  // on its own while in view. Scrolling only ever moves between sections.
  useEffect(() => {
    if (reducedMotion || !inView) return;
    const timer = setInterval(() => setActiveIdx((i) => (i + 1) % PILLARS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [reducedMotion, inView, cycle]);

  const select = (slug: PillarSlug) => {
    track("home_pillar_selected", { pillar: slug });
    setCycle((c) => c + 1);
    setActiveIdx(PILLARS.findIndex((p) => p.slug === slug));
  };

  return (
    <section
      ref={sectionRef}
      data-chapter="pillars"
      className="v2-snap-section flex items-center py-24 lg:min-h-[calc(100vh-3.5rem)] lg:py-0"
    >
      <motion.div
        className="w-full"
        initial={reducedMotion ? false : { opacity: 0, y: 48 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
          {/* brand accordion: the active guarantee expands, the rest wait as
              numbered strips. Panels are always brand-dark (#1F1F1F), so the
              diagram wrapper carries `dark` to flip its palette locally. */}
          <div className="flex h-[min(74vh,680px)] flex-col gap-3 lg:flex-row">
            {PILLARS.map((pillar, i) => {
              const isActive = i === activeIdx;
              const number = `0${i + 1}`;
              return (
                <div
                  key={pillar.slug}
                  className="relative overflow-hidden rounded-2xl bg-[#1F1F1F] transition-[flex-grow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ flexGrow: isActive ? 8 : 1, flexBasis: 0, minWidth: 0 }}
                >
                  {/* collapsed strip: number, label, red arrow */}
                  <button
                    type="button"
                    onClick={() => select(pillar.slug)}
                    aria-label={`Show ${titleCase(pillar.label)}`}
                    className={`absolute inset-0 z-10 flex flex-row items-center justify-between p-4 transition-opacity duration-300 lg:flex-col lg:p-5 ${
                      isActive ? "pointer-events-none opacity-0" : "opacity-100"
                    }`}
                  >
                    <span className="font-mono text-[11px] tracking-[0.18em] text-[#A2AFB2]">{number}</span>
                    <span className="font-mono text-[10px] tracking-[0.18em] text-[#A2AFB2]/80 lg:hidden">
                      {pillar.label}
                    </span>
                    <span className="hidden rotate-180 font-mono text-[10px] tracking-[0.18em] text-[#A2AFB2]/80 [writing-mode:vertical-rl] lg:block">
                      {pillar.label}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6212F]">
                      <ArrowRight className="h-4 w-4 text-white" />
                    </span>
                  </button>

                  {/* expanded panel */}
                  <div
                    className={`flex h-full flex-col p-6 transition-opacity duration-500 md:p-10 ${
                      isActive ? "opacity-100 delay-200" : "pointer-events-none opacity-0"
                    }`}
                  >
                    <span className="font-mono text-[11px] tracking-[0.18em] text-[#A2AFB2]">{number}</span>
                    <div className="mt-5 grid gap-6 lg:grid-cols-[7fr_5fr] lg:gap-12">
                      <h3 className="v2-display text-2xl md:text-4xl xl:text-[3.25rem]">
                        {pillar.display.lead.map((line) => (
                          <span key={line} className="block text-[#EBF0FA]">
                            {line}
                          </span>
                        ))}
                        <span className="block text-[#E6212F]">{pillar.display.punch}</span>
                      </h3>
                      <p className="max-w-md text-sm leading-relaxed text-[#EBF0FA]/90 md:text-base">
                        {pillar.tagline}
                      </p>
                    </div>
                    {/* the instrument holds the panel's center, like the
                        imagery band in the brand reference */}
                    <div className="dark hidden min-h-0 flex-1 items-center justify-center py-4 lg:flex">
                      <PillarDiagram slug={pillar.slug} />
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-8 pt-6 lg:mt-0">
                      <BrandButton
                        href={`/solutions/${pillar.slug}`}
                        onClick={() => track("home_cta_clicked", { section: "pillars", label: `Explore ${pillar.slug}`, href: `/solutions/${pillar.slug}` })}
                        className="w-full sm:w-auto"
                      >
                        Explore {titleCase(pillar.label)}
                      </BrandButton>
                    </div>
                    {/* rotation progress along the panel floor */}
                    {isActive && !reducedMotion && inView && (
                      <span
                        key={`${pillar.slug}-${cycle}`}
                        aria-hidden
                        className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-[#E6212F]"
                        style={{ animation: `v2-fill-x ${ROTATE_MS}ms linear forwards`, transform: "scaleX(0)" }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
