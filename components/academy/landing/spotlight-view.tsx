'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ACADEMY_PARTS,
  NEWCOMER_COURSE_ID,
  START_COURSE_ID,
  type AcademyCourse,
  type AcademyPart,
} from '@/components/academy/learning-path-configs/academy.config';
import { getCourseDurations } from '@/content/courses';
import type { CourseStats } from '@/lib/academy/course-outline';
import {
  academyCourse,
  academyCourseUrl,
  courseFolder,
  courseLine,
  courseLineWithModules,
  coursesOfPart,
  groupFacts,
  groupLine,
  joinsLine,
} from '@/lib/academy/academy-programme';
import { cn } from '@/utils/cn';
import type { LandingViewProps } from './academy-views';
import { CourseMarker, FOCUS_RING, START_BUTTON } from './course-marks';
import { CourseLink, LandingProvider, useCourseState } from './course-state';
import { Team1Line } from './team1-link';

const DURATIONS = getCourseDurations();
// Fundamentals is the spotlight and its newcomer line; the four other parts are the lanes.
const LANE_PARTS = ACADEMY_PARTS.filter((part) => part.id !== 'fundamentals');
const NAME = 'text-[15px] font-semibold leading-[1.25] tracking-[-0.006em] text-ac-ink group-hover:underline group-hover:underline-offset-[3px] group-focus-visible:underline';

/** J, the start course spotlight and the default view: the start course as a feature, the four other parts as lanes. */
export function SpotlightView({ courseStats }: LandingViewProps) {
  return (
    <LandingProvider>
      <div className="grid items-start gap-[26px] lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[420px_minmax(0,1fr)] xl:gap-[52px]">
        <StartFeature stats={courseStats[academyCourseUrl(academyCourse(START_COURSE_ID))]} />
        <div>
          <h2 className="border-b border-ac-rule-2 pb-2.5 font-ac-mono text-[11px] font-normal uppercase tracking-[0.12em] text-ac-ink-3">
            Then choose what to build
          </h2>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            {LANE_PARTS.map((part) => (
              <Lane key={part.id} part={part} courseStats={courseStats} />
            ))}
          </div>
        </div>
      </div>
    </LandingProvider>
  );
}

function StartFeature({ stats }: { stats: CourseStats | undefined }) {
  const course = academyCourse(START_COURSE_ID);
  const newcomer = academyCourse(NEWCOMER_COURSE_ID);
  return (
    <article data-course-id={course.id}>
      <Image
        src="/nav/academy-fundamentals.webp"
        alt="The Avalanche Fundamentals course banner: a grid of outlined blocks on red, with a white disc and the Avalanche mark"
        width={1536}
        height={864}
        sizes="(min-width: 1280px) 420px, (min-width: 1024px) 340px, 100vw"
        fetchPriority="high"
        loading="eager"
        className="aspect-video w-full rounded-xl border border-ac-rule object-cover"
      />
      <div className="mt-4 flex items-center gap-2.5">
        <span className="font-ac-mono text-[10px] font-medium uppercase leading-none tracking-[0.12em] text-ac-red">Start here</span>
      </div>
      <h2 className="mt-2 font-ac-display text-[30px] font-medium leading-[1.08] tracking-[-0.018em] text-ac-ink lg:max-xl:text-[26px]">
        {course.name}
      </h2>
      <p className="mt-2 text-[14.5px] leading-[1.5] text-ac-ink-2">{course.description}</p>
      <p className="mt-2.5 text-[12px] leading-[1.35] text-ac-ink-3 tabular-nums">
        {`${courseLineWithModules(stats, DURATIONS[courseFolder(course)])} · certificate`}
      </p>
      <div className="mt-4">
        <Link href={academyCourseUrl(course)} className={START_BUTTON}>
          Start the course
        </Link>
      </div>
      <p className="mt-3.5 text-[13.5px] text-ac-ink-3">
        {'New to blockchain? '}
        <CourseLink
          id={newcomer.id}
          href={academyCourseUrl(newcomer)}
          className={cn('border-b border-ac-rule-2 text-ac-ink-2 hover:border-ac-ink hover:text-ac-ink', FOCUS_RING)}
        >
          {`Begin with ${newcomer.name}`}
        </CourseLink>
      </p>
      <Team1Line className="mt-3.5" />
    </article>
  );
}

function Lane({ part, courseStats }: { part: AcademyPart } & LandingViewProps) {
  const courses = coursesOfPart(part.id);
  return (
    <section className="pt-4 lg:max-xl:pt-3">
      <h3 className="font-ac-display text-[18px] font-medium tracking-[-0.01em] text-ac-ink">{part.name}</h3>
      <p className="mt-[3px] text-[12px] leading-[1.35] text-ac-ink-3 tabular-nums">{groupLine(groupFacts(courses, courseStats, DURATIONS))}</p>
      <ol className="mt-2">
        {courses.map((course) => (
          <LaneRow key={course.id} course={course} stats={courseStats[academyCourseUrl(course)]} />
        ))}
      </ol>
    </section>
  );
}

function LaneRow({ course, stats }: { course: AcademyCourse; stats: CourseStats | undefined }) {
  const { completed } = useCourseState(course.id);
  const joins = joinsLine(course);
  return (
    <li>
      <CourseLink
        id={course.id}
        href={academyCourseUrl(course)}
        className={cn('group grid grid-cols-[26px_minmax(0,1fr)] gap-x-1.5 border-b border-ac-rule pt-2 pb-[9px] lg:max-xl:pt-1.5 lg:max-xl:pb-[7px]', FOCUS_RING)}
      >
        <CourseMarker id={course.id} completed={completed} className={completed ? undefined : 'pt-[3px]'} />
        <span className={NAME}>{course.name}</span>
        <span className="col-start-2 mt-0.5 text-[12px] leading-[1.35] text-ac-ink-3 tabular-nums">
          {courseLine(stats, DURATIONS[courseFolder(course)])}
        </span>
        {joins ? <span className="col-start-2 mt-0.5 text-[12px] leading-[1.35] text-ac-ink-3">{joins}</span> : null}
      </CourseLink>
    </li>
  );
}
