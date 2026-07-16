"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import PatternDiagram from "@/components/landing-v2/PatternDiagrams";
import { PILLARS } from "@/components/landing-v2/pillars";
import { PATTERNS, type DesignPattern } from "@/components/landing-v2/patterns";

/* ------------------------------------------------------------------ */
/* Design-pattern splash page — one real-world build, in the sheet voice */
/* ------------------------------------------------------------------ */

function pillarTitle(slug: string) {
  return PILLARS.find((p) => p.slug === slug)?.title;
}

function Rule({ label }: { label: string }) {
  return (
    <div className="mb-10 flex items-baseline gap-4">
      <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
        {label}
      </p>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

const CARD =
  "border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80";

export default function PatternPage({ pattern }: { pattern: DesignPattern }) {
  const reducedMotion = useReducedMotion();
  const others = PATTERNS.filter((p) => p.slug !== pattern.slug);

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
          {/* breadcrumb */}
          <motion.div className="flex items-baseline gap-4" {...rise(0)}>
            <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              <Link href="/solutions" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
                SOLUTIONS
              </Link>{" "}
              ·{" "}
              <Link
                href="/solutions/design-patterns"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                DESIGN PATTERNS
              </Link>{" "}
              · <span className="text-zinc-900 dark:text-zinc-100">{pattern.label}</span>
            </p>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </motion.div>

          {/* statement + hero diagram */}
          <div className="grid gap-12 py-14 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-20 lg:py-20">
            <motion.div {...rise(0.08)}>
              {pattern.status === "coming-soon" && (
                <p className="mb-5 inline-block font-mono text-[10px] tracking-[0.2em] text-[#E84142]">
                  IN PROGRESS
                </p>
              )}
              <h1 className="text-4xl font-extralight leading-[1.08] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 md:text-6xl xl:text-[3.75rem]">
                {pattern.title}
                <span className="text-[#E84142]">.</span>
              </h1>
              {pattern.intro.map((para, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "mt-8 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300 md:text-lg"
                      : "mt-3 max-w-2xl text-base font-medium leading-relaxed text-zinc-900 dark:text-zinc-50 md:text-lg"
                  }
                >
                  {para}
                </p>
              ))}
              <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <Link
                  href="https://www.avax.network/contact"
                  className="group inline-flex items-center gap-3 bg-zinc-900 px-6 py-3.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Talk to our team
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={pattern.resources[0].links[0].href}
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  READ THE DOCS →
                </Link>
              </div>
            </motion.div>

            {pattern.flow?.diagram && (
              <motion.div className="flex items-center justify-center" {...rise(0.16)}>
                <PatternDiagram id={pattern.flow.diagram} />
              </motion.div>
            )}
          </div>

          {/* concepts composed */}
          <motion.div className="pb-20 lg:pb-28" {...rise(0.2)}>
            <Rule label="COMPOSES" />
            <div className={`grid grid-cols-1 divide-y divide-zinc-200 md:grid-cols-2 md:divide-x lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800 ${CARD}`}>
              {pattern.concepts.map((c) => {
                const inner = (
                  <>
                    <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      {c.label}
                      {c.pillar ? " →" : ""}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{c.role}</p>
                  </>
                );
                return c.pillar ? (
                  <Link
                    key={c.label}
                    href={`/solutions/${c.pillar}`}
                    className="group px-5 py-8 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900/60"
                    title={pillarTitle(c.pillar)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={c.label} className="px-5 py-8 md:px-6">
                    {inner}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* problem */}
          {pattern.problem && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.24)}>
              <Rule label="THE PROBLEM" />
              <p className="mb-8 max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                {pattern.problem.body}
              </p>
              <div className={`grid grid-cols-1 divide-y divide-zinc-200 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800 ${CARD}`}>
                {pattern.problem.points.map((pt) => (
                  <p key={pt} className="px-5 py-6 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:px-6">
                    {pt}
                  </p>
                ))}
              </div>
            </motion.div>
          )}

          {/* the pattern: flow + elements */}
          {(pattern.flow || pattern.elements) && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.26)}>
              <Rule label="THE PATTERN" />
              {pattern.flow && (
                <ol className={`mb-4 divide-y divide-zinc-200 dark:divide-zinc-800 ${CARD}`}>
                  {pattern.flow.phases.map((ph, i) => (
                    <li key={ph.label} className="grid gap-3 px-5 py-6 md:grid-cols-[13rem_1fr] md:gap-10 md:px-6">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-[11px] text-[#E84142]">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-base font-medium text-zinc-900 dark:text-zinc-50">{ph.label}</span>
                      </div>
                      <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{ph.detail}</p>
                    </li>
                  ))}
                </ol>
              )}
              {pattern.elements && (
                <div className="grid grid-cols-1 gap-px overflow-hidden border border-zinc-200 bg-zinc-200 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
                  {pattern.elements.map((el) => (
                    <div key={el.title} className="bg-white p-5 dark:bg-zinc-950 md:p-6">
                      <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">{el.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{el.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* tiers (provenance-style) */}
          {pattern.tiers && pattern.tiers.length > 0 && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.27)}>
              <Rule label="ARCHITECTURES" />
              <div className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${CARD}`}>
                {pattern.tiers.map((t) => (
                  <div key={t.name} className="grid gap-8 px-5 py-10 md:px-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-14">
                    <div>
                      <h3 className="text-2xl font-light tracking-[-0.01em] text-zinc-900 dark:text-zinc-50">{t.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t.tagline}</p>
                      <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{t.description}</p>
                      <p className="mt-5 font-mono text-[10px] tracking-[0.14em] text-zinc-400 dark:text-zinc-500">BEST FOR</p>
                      <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{t.bestFor}</p>
                    </div>
                    {t.diagram && (
                      <div className="flex justify-center lg:justify-end">
                        <PatternDiagram id={t.diagram} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* why avalanche */}
          {pattern.whyAvalanche && pattern.whyAvalanche.length > 0 && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.28)}>
              <Rule label="WHY AVALANCHE" />
              <div className="grid grid-cols-1 gap-px overflow-hidden border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
                {pattern.whyAvalanche.map((f) => (
                  <div key={f.title} className="bg-white p-5 dark:bg-zinc-950 md:p-6">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{f.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{f.body}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* in production */}
          {pattern.inProduction && pattern.inProduction.length > 0 && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.3)}>
              <Rule label="IN PRODUCTION" />
              <div className={`grid grid-cols-1 divide-y divide-zinc-200 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800 ${CARD}`}>
                {pattern.inProduction.map((p) => (
                  <div key={p.name} className="px-5 py-8 md:px-6">
                    <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#E84142]">{p.sub}</p>
                    <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{p.body}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* comparison */}
          {pattern.comparison && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.32)}>
              <Rule label="COMPARED" />
              <p className="mb-1 text-lg font-light text-zinc-900 dark:text-zinc-50">{pattern.comparison.title}.</p>
              {pattern.comparison.subtitle && (
                <p className="mb-8 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {pattern.comparison.subtitle}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {pattern.comparison.headers.map((h, i) => {
                        const last = i === pattern.comparison!.headers.length - 1;
                        return (
                          <th
                            key={i}
                            className={`border-b border-zinc-200 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] dark:border-zinc-800 ${
                              last ? "text-[#E84142]" : "text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pattern.comparison.rows.map((row) => (
                      <tr key={row.metric}>
                        <th className="border-b border-zinc-200 px-4 py-4 text-left align-top font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
                          {row.metric}
                        </th>
                        {row.values.map((v, i) => {
                          const last = i === row.values.length - 1;
                          return (
                            <td
                              key={i}
                              className={`border-b border-zinc-200 px-4 py-4 align-top text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 ${
                                last ? "bg-[#E84142]/5 text-zinc-900 dark:text-zinc-100" : ""
                              }`}
                            >
                              {v}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pattern.comparison.footnote && (
                <p className="mt-4 text-xs italic text-zinc-400 dark:text-zinc-500">{pattern.comparison.footnote}</p>
              )}
            </motion.div>
          )}

          {/* when to use */}
          {pattern.whenToUse && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.34)}>
              <Rule label="WHEN TO USE IT" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(
                  [
                    { title: "Use this pattern when", items: pattern.whenToUse.use, mark: "✓" },
                    { title: "Look elsewhere when", items: pattern.whenToUse.avoid, mark: "✕" },
                  ] as const
                ).map((col) => (
                  <div key={col.title} className={`p-5 md:p-6 ${CARD} border-x`}>
                    <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-900 dark:text-zinc-100">
                      {col.title}
                    </p>
                    <ul className="space-y-3">
                      {col.items.map((t) => (
                        <li key={t} className="flex gap-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                          <span className="shrink-0 font-mono text-[#E84142]">{col.mark}</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* faq */}
          {pattern.faqs && pattern.faqs.length > 0 && (
            <motion.div className="pb-20 lg:pb-28" {...rise(0.36)}>
              <Rule label="FAQ" />
              <div className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${CARD}`}>
                {pattern.faqs.map((f) => (
                  <details key={f.question} className="group px-5 py-5 md:px-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {f.question}
                      <span className="font-mono text-zinc-400 transition-transform group-open:rotate-45 dark:text-zinc-500">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{f.answer}</p>
                  </details>
                ))}
              </div>
            </motion.div>
          )}

          {/* resources */}
          <motion.div className="pb-20 lg:pb-28" {...rise(0.38)}>
            <Rule label="RESOURCES" />
            <div className={`grid grid-cols-1 divide-y divide-zinc-200 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800 ${CARD}`}>
              {pattern.resources.map((group) => (
                <div key={group.heading} className="px-5 py-8 md:px-6">
                  <h3 className="mb-5 font-mono text-[10px] tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {group.heading}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="group inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                          {link.text}
                          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>

          {/* other patterns */}
          {others.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 pb-16">
              <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                MORE PATTERNS
              </span>
              {others.map((o) => (
                <Link
                  key={o.slug}
                  href={`/solutions/design-patterns/${o.slug}`}
                  className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {o.label} →
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* full-bleed CTA */}
        <Link
          href="https://www.avax.network/contact"
          className="group flex items-center justify-between bg-zinc-900 py-5 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:hover:bg-zinc-300"
        >
          <span className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 md:px-6">
            <span className="text-sm font-medium text-zinc-50 dark:text-zinc-900">Map this to your build with our team</span>
            <ArrowRight className="h-4 w-4 text-zinc-50 transition-transform group-hover:translate-x-1 dark:text-zinc-900" />
          </span>
        </Link>
      </div>
    </main>
  );
}
