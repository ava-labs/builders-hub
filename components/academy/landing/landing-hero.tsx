import Link from 'next/link';
import { START_COURSE_ID } from '@/components/academy/learning-path-configs/academy.config';
import { academyCourse, academyCourseUrl } from '@/lib/academy/academy-programme';
import type { AcademyView } from './academy-views';
import { START_BUTTON } from './course-marks';
import { Team1Line } from './team1-link';
import { ViewToggle } from './view-toggle';

/** The navbar Academy card's line (app/layout.config.tsx:249). */
export const LANDING_LINE = 'Guided courses, from blockchain fundamentals to launching your own L1.';

interface LandingHeroProps {
  view: AcademyView;
  /** "13 courses · 377 lessons · 26 hours". */
  facts: string;
}

/**
 * Title, line, the view toggle, then the row: the start button, the facts, and the Team1 line at the end; in J, which
 * carries its own button and Team1 line, the facts alone. From 1024 px the toggle sits on the title line; below,
 * under the line, so a view change, which adds or drops the button and the Team1 line, never moves it.
 */
export function LandingHero({ view, facts }: LandingHeroProps) {
  const start = academyCourse(START_COURSE_ID);
  return (
    <div className="grid pt-8 pb-[26px] max-md:pt-[26px] max-md:pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-x-8">
      <h1 className="font-ac-display text-[34px] font-bold leading-[1.02] tracking-[-0.024em] text-ac-ink lg:text-[44px] xl:text-[48px]">
        Avalanche Academy<span className="text-ac-red">.</span>
      </h1>
      <p className="mt-3 max-w-[58ch] text-[16px] leading-[1.55] text-ac-ink-2 md:text-[17px] lg:col-span-2">{LANDING_LINE}</p>
      <div className="mt-4 lg:col-start-2 lg:row-start-1 lg:mt-0">
        <ViewToggle view={view} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-[22px] gap-y-3 max-md:mt-[18px] lg:col-span-2">
        {view === 'overview' ? null : (
          <Link href={academyCourseUrl(start)} className={START_BUTTON}>
            {`Start with ${start.name}`}
          </Link>
        )}
        <span className="font-ac-mono text-[12px] tracking-[0.02em] text-ac-ink-3 tabular-nums">{facts}</span>
        {view === 'overview' ? null : <Team1Line className="ml-auto max-md:ml-0" />}
      </div>
    </div>
  );
}
