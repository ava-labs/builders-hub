"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import SolutionsShell from "@/components/landing-v2/SolutionsShell";
import StickyStage from "@/components/landing-v2/StickyStage";
import PillarPlate from "@/components/landing-v2/PillarPlate";
import PrivacyModelDiagram from "@/components/landing-v2/PrivacyModelDiagrams";
import { UseCaseRows } from "@/components/landing-v2/UseCases";
import { PILLARS, USE_CASES, type Pillar } from "@/components/landing-v2/pillars";
import { MaskText, Reveal, pad2, sentenceCase } from "@/components/landing-v2/SpecKit";

/* ------------------------------------------------------------------ */
/* Solution page: one pillar, and the way into everything built on it  */
/*                                                                      */
/* Promise and proof beside the plate, then the index of docs, courses, */
/* and tools, then mechanism, shape, pattern, next step. Hairlines and  */
/* type carry the structure; the plates are the only ornament.          */
/* ------------------------------------------------------------------ */

/** A section's opening: a two-line heading, the second line quiet. */
function SectionHeading({ lead, rest }: { lead: string; rest?: string }) {
  return (
    <h2 className="v2-heading text-3xl text-zinc-900 md:text-[2.5rem] dark:text-zinc-50">
      <MaskText>{lead}</MaskText>
      {rest && (
        <MaskText delay={0.08} className="text-zinc-400 dark:text-zinc-500">
          {rest}
        </MaskText>
      )}
    </h2>
  );
}

export default function PillarPage({ pillar }: { pillar: Pillar }) {
  const index = PILLARS.findIndex((p) => p.slug === pillar.slug);
  const next = PILLARS[(index + 1) % PILLARS.length];
  const useCases = USE_CASES.filter((u) => u.pillar === pillar.slug);

  return (
    <SolutionsShell>
      {/* promise and proof, split against the plate: the plate runs flush
          to the sheet's right edge at full height, exactly 4:5 wide */}
      <section className="-mx-5 -mt-6 md:-mx-6 lg:mr-[-1.5rem] lg:ml-0 lg:flex lg:min-h-[calc(100vh-5.375rem)]">
        <Reveal className="flex flex-1 flex-col justify-center px-5 py-16 md:px-6 lg:py-20 lg:pl-0 lg:pr-16 xl:pr-24">
          <h1 className="v2-display text-3xl text-zinc-900 md:text-5xl xl:text-[3.5rem] dark:text-zinc-50">
            {pillar.display.lead.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="block text-[#E6212F]">{pillar.display.punch}</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">{pillar.intro}</p>
          <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <BrandButton href="/console" className="w-full sm:w-auto">
              Build in the Console
            </BrandButton>
            <Link
              href={pillar.resources[0].links[0].href}
              className="group inline-flex items-center gap-2 text-[15px] font-medium text-zinc-900 dark:text-zinc-50"
            >
              Read the docs
              <ArrowRight className="h-4 w-4 text-[#E6212F] transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
          {/* the proof, as one spec line under the promise */}
          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            {pillar.proofs.map((proof) => (
              <div key={proof.label}>
                <dt className="text-[12px] text-zinc-500 dark:text-zinc-400">{sentenceCase(proof.label)}</dt>
                <dd className="mt-1.5 text-[15px] font-medium leading-snug text-zinc-900 dark:text-zinc-50">
                  {sentenceCase(proof.value)}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <div className="shrink-0 lg:w-[min(50%,calc((100vh-5.375rem)*0.8))]">
          <PillarPlate slug={pillar.slug} priority />
        </div>
      </section>

      <ResourceIndex pillar={pillar} />

      {/* mechanism: three primitives, set as a numbered column list */}
      <section className="border-t border-zinc-200 py-24 lg:py-32 dark:border-zinc-800">
        <SectionHeading lead="How it works." rest="The primitives underneath." />
        <div
          className={`mt-14 grid gap-12 md:gap-10 ${
            pillar.capabilities.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"
          }`}
        >
          {pillar.capabilities.map((capability, i) => (
            <Reveal key={capability.title} delay={i * 0.08} className="border-t border-zinc-900 pt-6 dark:border-zinc-100">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#E6212F]">{pad2(i + 1)}</p>
              <h3 className="v2-heading mt-4 text-xl text-zinc-900 dark:text-zinc-50">{capability.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{capability.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* shape: the architecture models, read beside their drawing */}
      {pillar.models && pillar.models.length > 0 && (
        <section className="pb-24 lg:pb-32">
          <SectionHeading lead="Choose the shape." rest="Architectures the primitives compose into." />
          <div className="mt-14">
            <StickyStage
              steps={pillar.models.map((model) => ({
                key: model.name,
                plate: {
                  caption: [sentenceCase(model.label), model.name],
                  drawing: model.diagram ? <PrivacyModelDiagram id={model.diagram} /> : null,
                },
                content: (
                  <div className="max-w-2xl">
                    <p className="text-[15px] font-medium text-[#E6212F]">{sentenceCase(model.label)}</p>
                    <h3 className="v2-heading mt-4 text-3xl leading-[1.05] text-zinc-900 md:text-[2.75rem] dark:text-zinc-50">
                      {model.name}.
                    </h3>
                    <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">{model.tagline}.</p>
                    <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {model.description}
                    </p>
                    <div className="mt-8 grid gap-1.5 border-y border-zinc-200 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8 dark:border-zinc-800">
                      <p className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">Best for</p>
                      <p className="text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">{model.bestFor}</p>
                    </div>
                  </div>
                ),
              }))}
            />
          </div>
        </section>
      )}

      {/* pattern: where institutions use it */}
      {useCases.length > 0 && (
        <section className="pb-24 lg:pb-32">
          <SectionHeading lead="Where it is used." rest="Institutional patterns built on it." />
          <div className="mt-14">
            <UseCaseRows useCases={useCases} />
          </div>
        </section>
      )}

      {/* hand-off to the next pillar */}
      <Link href={`/solutions/${next.slug}`} className="group block border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Next</span>
        <span className="v2-heading mt-3 flex items-center gap-5 text-3xl text-zinc-900 md:text-5xl dark:text-zinc-50">
          <span className="bg-[linear-gradient(#E6212F,#E6212F)] bg-[length:0%_2px] bg-left-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]">
            {next.title}
          </span>
          <ArrowRight className="h-8 w-8 shrink-0 text-zinc-300 transition-all duration-300 group-hover:translate-x-2 group-hover:text-[#E6212F] dark:text-zinc-600" />
        </span>
      </Link>
    </SolutionsShell>
  );
}

const GROUP_NAMES: Record<string, string> = {
  DOCUMENTATION: "Documentation",
  LEARN: "Academy",
  TOOLING: "Tools",
};

/** What a link opens, read from where it points. */
function kindOf(href: string): string {
  if (href.startsWith("/docs/tooling/avalanche-sdk")) return "SDK";
  if (href.startsWith("/docs")) return "Docs";
  if (href.startsWith("/academy")) return "Course";
  if (href.startsWith("/console")) return "Console";
  if (href.startsWith("/explorer")) return "Live data";
  return "Guide";
}

/* The way in: every doc, course, and tool for this pillar as one index.
   The heading holds its place on the left while the entries scroll past
   on the right; each entry names what it opens, and trades that label
   for an arrow on hover. */
function ResourceIndex({ pillar }: { pillar: Pillar }) {
  const total = pillar.resources.reduce((n, g) => n + g.links.length, 0);
  let n = 0;
  return (
    <section className="border-t border-zinc-900 py-20 lg:py-28 dark:border-zinc-100">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-[calc(var(--fd-banner-height,0px)+8rem)] lg:self-start">
          <SectionHeading lead="Start building." rest="Docs, courses, and tools." />
          <p className="mt-6 text-[13px] tabular-nums text-zinc-500 dark:text-zinc-400">{total} resources</p>
        </div>
        <div className="flex flex-col gap-14">
          {pillar.resources.map((group) => (
            <div key={group.heading}>
              <div className="flex items-baseline justify-between border-b border-zinc-900 pb-3 dark:border-zinc-100">
                <h3 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
                  {GROUP_NAMES[group.heading] ?? sentenceCase(group.heading)}
                </h3>
                <span className="text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">{pad2(group.links.length)}</span>
              </div>
              <ul>
                {group.links.map((link) => {
                  n += 1;
                  return (
                    <li key={link.href} className="border-b border-zinc-200 dark:border-zinc-800">
                      <Link
                        href={link.href}
                        className="group relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-3 py-5 transition-colors sm:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] sm:gap-4"
                      >
                        <span
                          aria-hidden
                          className="absolute -left-4 bottom-4 top-4 w-0.5 origin-top scale-y-0 bg-[#E6212F] transition-transform duration-300 group-hover:scale-y-100"
                        />
                        <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{pad2(n)}</span>
                        <span className="text-[17px] font-medium tracking-[-0.01em] text-zinc-900 transition-transform duration-300 group-hover:translate-x-1 md:text-[19px] dark:text-zinc-50">
                          {link.text}
                        </span>
                        <span className="relative flex justify-end">
                          <span className="text-[12px] text-zinc-400 transition-all duration-300 group-hover:-translate-x-2 group-hover:opacity-0 dark:text-zinc-500">
                            {kindOf(link.href)}
                          </span>
                          <ArrowRight className="absolute right-0 top-1/2 h-4 w-4 -translate-x-2 -translate-y-1/2 text-[#E6212F] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
