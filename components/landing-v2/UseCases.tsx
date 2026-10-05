"use client";

import UseCaseDiagram from "@/components/landing-v2/UseCaseDiagrams";
import type { UseCase } from "@/components/landing-v2/pillars";
import { MaskText, Reveal, sentenceCase } from "@/components/landing-v2/SpecKit";

/* ------------------------------------------------------------------ */
/* Use-case rows: the institutional patterns, argued in full            */
/*                                                                      */
/* One pattern per hairline-ruled row: the problem and the shape on the */
/* left with the guarantees it buys as three figures beneath, its       */
/* drawing on the right. Shared by every /solutions subpage, each       */
/* showing the patterns that lean on it; rows are anchored by slug.     */
/* ------------------------------------------------------------------ */

export function UseCaseRows({ useCases }: { useCases: UseCase[] }) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      {useCases.map((useCase) => (
        <Reveal
          key={useCase.slug}
          id={useCase.slug}
          className="grid scroll-mt-32 gap-12 border-t border-zinc-200 py-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-20 lg:py-20 dark:border-zinc-800"
        >
          <div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{sentenceCase(useCase.label)}</p>
            <h3 className="v2-heading mt-3 text-2xl text-zinc-900 md:text-3xl dark:text-zinc-50">{useCase.title}.</h3>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{useCase.summary}</p>
            <p className="mt-5 max-w-xl text-[15px] font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
              {useCase.tagline}
            </p>
            <p className="mt-5 font-mono text-[11px] tracking-[0.08em] text-zinc-400 dark:text-zinc-500">{useCase.stack}</p>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              {useCase.guarantees.map((g, i) => (
                <div key={g.label}>
                  <dt className="text-[12px] text-zinc-500 dark:text-zinc-400">{sentenceCase(g.label)}</dt>
                  <dd className="v2-heading mt-2 text-[17px] text-zinc-900 dark:text-zinc-50">
                    <MaskText delay={0.1 + i * 0.06}>{sentenceCase(g.value)}</MaskText>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {useCase.diagram && (
            <div className="flex justify-center">
              <UseCaseDiagram id={useCase.diagram} />
            </div>
          )}
        </Reveal>
      ))}
    </div>
  );
}
