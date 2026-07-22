import UseCaseDiagram from "@/components/landing-v2/UseCaseDiagrams";
import type { UseCase } from "@/components/landing-v2/pillars";

/* ------------------------------------------------------------------ */
/* Use-case rows — the institutional patterns, in the spec-plate voice  */
/*                                                                      */
/* Each row is the ARCHITECTURES diptych: the pattern argued in full on  */
/* the left, and right of a hairline rule its instrument with the        */
/* guarantees as a spec plate beneath it, the same drawing + title-block */
/* pairing the pillar hero uses. Shared by every /solutions subpage,     */
/* each showing the patterns that lean on it.                            */
/* ------------------------------------------------------------------ */

export function UseCaseRows({ useCases }: { useCases: UseCase[] }) {
  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
      {useCases.map((useCase) => (
        <div
          key={useCase.slug}
          className="grid gap-10 px-5 py-10 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-14 lg:py-12"
        >
          {/* the pattern, argued in full */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              {useCase.label}
            </p>
            <h3 className="v2-display mt-3 text-xl text-zinc-900 dark:text-zinc-50 md:text-2xl">
              {useCase.title}
            </h3>
            <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              {useCase.stack}
            </p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {useCase.summary}
            </p>
            <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
              {useCase.tagline}
            </p>
          </div>

          {/* the instrument and its title block, one compartment */}
          <div className="flex flex-col items-center gap-6 lg:border-l lg:border-zinc-200 lg:pl-12 dark:lg:border-zinc-800">
            {useCase.diagram && <UseCaseDiagram id={useCase.diagram} />}
            <dl className="w-full max-w-md">
              {useCase.guarantees.map((g) => (
                <div
                  key={g.label}
                  className="flex items-baseline justify-between gap-6 border-t border-zinc-200 py-2.5 last:border-b dark:border-zinc-800"
                >
                  <dt className="font-mono text-[10px] tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    {g.label}
                  </dt>
                  <dd className="font-mono text-[11px] tracking-[0.08em] text-zinc-900 dark:text-zinc-50">
                    {g.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}
