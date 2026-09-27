import { cn } from '@/utils/cn';
import type { CourseOutline, LessonPosition } from '@/lib/academy/course-outline';
import { lessonEyebrow } from '@/lib/academy/lesson-eyebrow';

interface LessonEyebrowProps {
  outline: CourseOutline;
  position: LessonPosition;
  lessonTitle: string;
}

const STEP_COLOUR = { past: 'bg-ac-rule-2', now: 'bg-ac-red', next: 'bg-ac-rule' } as const;

function StepBar({ index, count }: { index: number; count: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-[3px] justify-self-start whitespace-nowrap lg:ml-1.5">
      {Array.from({ length: count }, (_, i) => {
        const state = i + 1 < index ? 'past' : i + 1 === index ? 'now' : 'next';
        return <span key={i} data-step={state} className={cn('block h-1 w-3.5 rounded-[2px]', STEP_COLOUR[state])} />;
      })}
    </span>
  );
}

/**
 * "<module> / Lesson N of M" and the step bar above the lesson title (spec 4.5). Below 1024 px it
 * stacks the course, the module and the position; from 1024 px the sidebar names the course (R6)
 * and the row never wraps: a module name too long for it ends in an ellipsis instead.
 * The spaces between segments are for screen readers; the grid and flex layouts ignore them.
 */
export function LessonEyebrow({ outline, position, lessonTitle }: LessonEyebrowProps) {
  const text = lessonEyebrow(outline, position, lessonTitle);
  return (
    <div
      data-academy-part="eyebrow"
      className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0.5 text-[13px] text-ac-ink-3 lg:flex lg:flex-nowrap lg:gap-x-2"
    >
      <b className="col-span-full min-w-0 truncate font-medium text-ac-ink-2 lg:hidden">{text.course}</b>{' '}
      {text.module && (
        <>
          <span className="col-span-full inline-flex min-w-0 max-w-full whitespace-nowrap">
            <span title={text.module} className="block min-w-0 truncate text-ac-ink-2 lg:font-medium">
              {text.module}
            </span>
          </span>{' '}
          <span aria-hidden="true" className="hidden whitespace-nowrap lg:inline">/</span>{' '}
        </>
      )}
      <span className="whitespace-nowrap">{text.position}</span>
      {text.steps && <StepBar index={text.steps.index} count={text.steps.count} />}
    </div>
  );
}
