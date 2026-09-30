import Link from 'next/link';
import { cn } from '@/utils/cn';
import { ACADEMY_VIEWS, viewHref, type AcademyView } from './academy-views';
import { FOCUS_RING } from './course-marks';

/**
 * The landing's three views as links the server renders (?view=), the current one on the red rule as the track
 * tabs drew it. A div with the navigation role, not a nav element: app/global.css pads and recolours every `nav a`
 * with !important, as the track tabs it replaces knew.
 */
export function ViewToggle({ view }: { view: AcademyView }) {
  return (
    <div role="navigation" aria-label="Course views" className="flex gap-6">
      {ACADEMY_VIEWS.map((option) => {
        const current = option.id === view;
        return (
          <Link
            key={option.id}
            href={viewHref(option.id)}
            scroll={false}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 pb-2 text-[15px] font-medium leading-none',
              FOCUS_RING,
              current ? 'border-ac-red text-ac-ink' : 'border-transparent text-ac-ink-3 hover:text-ac-ink',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
