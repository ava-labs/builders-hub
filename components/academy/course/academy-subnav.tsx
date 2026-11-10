'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { COURSE_ICONS } from '@/components/academy/course/course-icons';
import { ACADEMY_PARTS, type AcademyCourse, type AcademyPartId } from '@/components/academy/learning-path-configs/academy.config';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { getCourseDurations } from '@/content/courses';
import { useIsMobile } from '@/hooks/use-mobile';
import { academyCourseOfPathname, academyCourseUrl, courseFolder, courseLine, coursesOfPart } from '@/lib/academy/academy-programme';
import { COURSE_STATS } from '@/lib/academy/course-stats.generated';
import { cn } from '@/utils/cn';

// The 13 courses live under two url segments, so their stats come from both tracks' maps.
const STATS = { ...COURSE_STATS['avalanche-l1'], ...COURSE_STATS.blockchain };
const DURATIONS = getCourseDurations();

export interface PartMenuItem {
  /** The course id, the key of its icon in COURSE_ICONS (course-icons.tsx). */
  id: string;
  title: string;
  /** What the course teaches, from academy.config.ts; the landing prints it for the spotlight's course only. */
  description: string;
  url: string;
  /** "30 lessons · 2 h". */
  line: string;
}

/** The courses of a part, as its hover card lists them on desktop and the drawer's dropdown below 1024 px. */
export function partMenu(part: AcademyPartId): PartMenuItem[] {
  return coursesOfPart(part).map((course) => ({
    id: course.id,
    title: course.name,
    description: course.description,
    url: academyCourseUrl(course),
    line: courseLine(STATS[academyCourseUrl(course)], DURATIONS[courseFolder(course)]),
  }));
}

/**
 * A part's hover card list, item for item the docs card's (components/navigation/docs-subnav.tsx): each course's own
 * icon, muted, then its title, what it teaches, and its lessons and hours.
 */
export function PartCourses({ items, current }: { items: PartMenuItem[]; current: AcademyCourse | null }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const Icon = COURSE_ICONS[item.id];
        return (
          <Link
            key={item.url}
            href={item.url}
            aria-current={current && academyCourseUrl(current) === item.url ? 'true' : undefined}
            className="flex items-start gap-2 rounded-none p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <div className="mt-0.5 text-muted-foreground">
              <Icon aria-hidden="true" className="w-5 h-5" />
            </div>
            <div className="grid gap-0.5">
              <p className="text-sm font-medium leading-none">{item.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              <p className="text-xs text-muted-foreground">{item.line}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The course pages' sub-nav: the five parts, each opening on its first course, the current part on the red rule.
 * A copy of the docs bar (components/navigation/docs-subnav.tsx) and its classes, so the Academy and the docs read
 * as one; the hover card lists the part's courses as the docs card lists a section (PartCourses). A div with the
 * navigation role, not a nav element: app/global.css pads and recolours every `nav a` with !important.
 */
export function AcademySubNav() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const current = academyCourseOfPathname(pathname);

  return (
    <div
      id="academy-subnav"
      role="navigation"
      aria-label="Academy parts"
      className="fixed left-0 z-[30] w-full border-b border-zinc-200 bg-white/85 backdrop-blur-[12px] dark:border-zinc-800 dark:bg-zinc-950/85"
      style={{ top: 'calc(var(--fd-banner-height, 0px) + 3.5rem)' }}
    >
      <div className="relative flex h-12 items-center justify-start gap-1 overflow-x-auto pl-8 pr-4 md:pl-16 md:pr-4 lg:gap-2">
        {ACADEMY_PARTS.map((part) => {
          const items = partMenu(part.id);
          const isActive = current?.part === part.id;
          const link = (
            <Link
              key={part.id}
              href={items[0].url}
              data-active={isActive ? 'true' : undefined}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'docs-subnav-link group whitespace-nowrap px-3 py-2 text-sm font-medium transition-all',
                isActive ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-300',
              )}
            >
              <span className="flex items-center gap-1">
                {part.name}
                {isMobile ? null : (
                  <ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                )}
              </span>
            </Link>
          );

          // Below 768 px, as the docs bar: the part links alone, no hover card.
          if (isMobile) return link;

          return (
            <HoverCard key={part.id} openDelay={100} closeDelay={200}>
              <HoverCardTrigger asChild>{link}</HoverCardTrigger>
              <HoverCardContent
                align="start"
                className="w-80 rounded-none border-zinc-200 bg-white shadow-[0_12px_24px_-12px_rgb(0_0_0_/_0.15)] dark:border-zinc-800 dark:bg-zinc-950"
              >
                <PartCourses items={items} current={current} />
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}
