import { Check } from 'lucide-react';
import { courseNumber } from '@/lib/academy/academy-programme';
import type { DisciplineHue } from '@/lib/academy/discipline';
import { cn } from '@/utils/cn';

/** The Academy's keyboard ring: 2 px of ink, 2 px outside the control. */
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink';

/** The ink start button of the Team1 landing header (academy-landing-header.tsx), without its arrow icon. */
export const START_BUTTON = cn(
  'inline-flex items-center rounded-lg bg-ac-ink px-[18px] py-3 text-[14.5px] font-medium leading-none text-ac-paper',
  'hover:bg-ac-paper hover:text-ac-ink hover:inset-ring hover:inset-ring-ac-ink',
  FOCUS_RING,
);

interface CourseMarkerProps {
  id: string;
  completed: boolean;
  className?: string;
}

/** The course's number, or the green check once the course is completed (the tree card's grammar, course-card.tsx:90-96). */
export function CourseMarker({ id, completed, className }: CourseMarkerProps) {
  if (completed) {
    return (
      <span className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ac-ok text-ac-paper', className)}>
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">Completed</span>
      </span>
    );
  }
  return <span className={cn('font-ac-mono text-[11px] text-ac-ink-3 tabular-nums', className)}>{courseNumber(id)}</span>;
}

/** The 7 px part dot: the part's hue, ink for Fundamentals (the hue tokens, academy-tokens.css:92-99). */
export function PartDot({ hue }: { hue: DisciplineHue | null }) {
  return <span aria-hidden="true" data-hue={hue ?? undefined} className="size-[7px] flex-none rounded-full bg-ac-h" />;
}
