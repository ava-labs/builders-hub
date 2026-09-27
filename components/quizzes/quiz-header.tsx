import { ListChecks } from 'lucide-react';
import { cn } from '@/utils/cn';
import { quizSegments, type QuizPosition } from './quiz-position';

/** The knowledge check's header row: the ink tile, "Knowledge check" and, when the page has several quizzes, the position with one segment per quiz. */
export function QuizHeader({ position }: { position: QuizPosition | null }) {
  return (
    <div className="not-prose flex items-center gap-2.5 border-b border-ac-rule px-[18px] py-[13px] max-md:flex-wrap max-md:gap-y-1.5">
      <span className="inline-flex size-7 flex-none items-center justify-center rounded-lg bg-ac-tile text-ac-ink">
        <ListChecks className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <h4 className="m-0 shrink-0 text-[14px] font-semibold leading-[1.75] text-ac-ink">Knowledge check</h4>
      {position && <QuizCounter position={position} />}
    </div>
  );
}

/** "Question N of M", with the segment bar only when the page has at most MAX_QUIZ_SEGMENTS quizzes. */
function QuizCounter({ position }: { position: QuizPosition }) {
  const segments = quizSegments(position);
  return (
    <span className="ml-auto inline-flex min-w-0 items-center gap-2.5 whitespace-nowrap text-[13px] leading-[1.75] text-ac-ink-3 max-md:ml-0 max-md:basis-full max-md:pl-[38px]">
      {`Question ${position.index} of ${position.count}`}
      {segments.length > 0 && (
        <span className="flex min-w-0 gap-[3px] overflow-hidden" aria-hidden="true">
          {segments.map((on, k) => (
            <span
              key={k}
              className={cn('block h-1 w-[18px] min-w-[2px] shrink rounded-[2px]', on ? 'bg-ac-red' : 'bg-ac-rule')}
            />
          ))}
        </span>
      )}
    </span>
  );
}
