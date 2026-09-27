import { Award, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Production's two progress lines in one card, with a red bar at the completed share (spec 4.8). */
export function CertificateProgress({ completed, total }: { completed: number; total: number }) {
  const percent = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  return (
    <div className="not-prose mb-9 mt-1 grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 gap-y-3.5 rounded-xl border border-ac-rule bg-ac-paper px-[18px] pb-[18px] pt-4 max-md:mb-7 max-md:gap-x-2.5 max-md:px-3.5 max-md:pb-4 max-md:pt-3.5">
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-ac-tile text-ac-ink">
        <Award className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <div>
        <p className="m-0 text-[15px] font-semibold leading-[1.35] text-ac-ink max-md:text-[14.5px]">
          Complete all quizzes to get your certificate.
        </p>
        <p className="m-0 text-[13.5px] leading-[1.35] text-ac-ink-3 tabular-nums">
          {`${completed} of ${total} quizzes completed.`}
        </p>
      </div>
      <span className="col-span-2 block h-1 overflow-hidden rounded-[2px] bg-ac-rule" aria-hidden="true">
        <span className="block h-full rounded-[2px] bg-ac-red" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

/** A chapter heading with its "n of m" count, a check in ok once every question is answered correctly. */
export function ChapterHeading({ chapter, completed, total }: { chapter: string; completed: number; total: number }) {
  const complete = total > 0 && completed === total;
  return (
    <h3 className="mb-3 mt-0 flex items-baseline justify-between gap-3 font-ac-display text-[19px] font-medium leading-[1.4] tracking-[-0.01em] text-ac-ink max-md:mb-2.5 max-md:text-[17px]">
      {chapter}
      <span
        className={cn(
          'inline-flex items-center gap-[5px] whitespace-nowrap font-sans text-[13px] font-medium tracking-normal tabular-nums max-md:text-[12.5px]',
          complete ? 'text-ac-ok' : 'text-ac-ink-3',
        )}
      >
        {complete && <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />}
        {`${completed} of ${total}`}
      </span>
    </h3>
  );
}

/**
 * A question row's title: the status mark (a check when answered correctly, an empty ring otherwise),
 * which names its status to screen readers, then the question.
 */
export function QuestionTitle({ question, answered }: { question: string; answered: boolean }) {
  return (
    <>
      <span
        className={cn(
          'inline-flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] max-md:size-[18px]',
          answered ? 'border-ac-ok bg-ac-ok text-ac-paper' : 'border-ac-ink-3',
        )}
      >
        {answered && <Check className="size-3 max-md:size-[11px]" strokeWidth={3} aria-hidden="true" />}
        <span className="sr-only">{answered ? 'Answered correctly' : 'Not answered yet'}</span>
      </span>
      <span>{question}</span>
    </>
  );
}
