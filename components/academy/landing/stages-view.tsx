'use client';

import {
  ACADEMY_STAGES,
  START_COURSE_ID,
  type AcademyCourse,
  type AcademyStage,
} from '@/components/academy/learning-path-configs/academy.config';
import { twoDigits } from '@/components/academy/shared/academy-tracks';
import { getCourseDurations } from '@/content/courses';
import type { CourseStats } from '@/lib/academy/course-outline';
import {
  academyCourseUrl,
  academyPart,
  courseFolder,
  courseLine,
  coursesOfStage,
  groupFacts,
  groupLine,
  joinsLine,
} from '@/lib/academy/academy-programme';
import { cn } from '@/utils/cn';
import type { LandingViewProps } from './academy-views';
import { CourseMarker, FOCUS_RING, PartDot } from './course-marks';
import { CourseLink, LandingProvider, useCourseState } from './course-state';

const DURATIONS = getCourseDurations();

/** F, the stage columns: Foundations, Core, Advanced, three columns at 1024 px and up. */
export function StagesView({ courseStats }: LandingViewProps) {
  return (
    <LandingProvider>
      <div className="grid gap-[22px] lg:grid-cols-3 lg:gap-5 xl:gap-9">
        {ACADEMY_STAGES.map((stage, index) => (
          <StageColumn key={stage.id} stage={stage} index={index} courseStats={courseStats} />
        ))}
      </div>
    </LandingProvider>
  );
}

function StageColumn({ stage, index, courseStats }: { stage: AcademyStage; index: number } & LandingViewProps) {
  const courses = coursesOfStage(stage.id);
  return (
    <section>
      <p className="font-ac-mono text-[11px] tracking-[0.08em] text-ac-ink-3">{twoDigits(index + 1)}</p>
      <h2 className="mt-[9px] font-ac-display text-[22px] font-medium leading-[1.1] tracking-[-0.012em] text-ac-ink lg:max-xl:text-[19px]">
        {stage.name}
      </h2>
      <p className="mt-1.5 text-[12px] leading-[1.35] text-ac-ink-3 tabular-nums">{groupLine(groupFacts(courses, courseStats, DURATIONS))}</p>
      <ol className="mt-3 border-t border-ac-rule-2">
        {courses.map((course) => (
          <StageRow key={course.id} course={course} stats={courseStats[academyCourseUrl(course)]} />
        ))}
      </ol>
    </section>
  );
}

function StageRow({ course, stats }: { course: AcademyCourse; stats: CourseStats | undefined }) {
  const part = academyPart(course.part);
  const { completed } = useCourseState(course.id);
  const joins = joinsLine(course);
  return (
    <li>
      <CourseLink id={course.id} href={academyCourseUrl(course)} className={cn('group block border-b border-ac-rule pt-[11px] pb-3', FOCUS_RING)}>
        <span className="flex items-baseline gap-2">
          <CourseMarker id={course.id} completed={completed} className={completed ? 'self-center' : undefined} />
          <span className="text-[15px] font-semibold leading-[1.25] tracking-[-0.006em] text-ac-ink group-hover:underline group-hover:underline-offset-[3px] group-focus-visible:underline">
            {course.name}
          </span>
          {course.id === START_COURSE_ID ? (
            <span className="font-ac-mono text-[10px] font-medium uppercase leading-none tracking-[0.12em] text-ac-red">Start</span>
          ) : null}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] leading-[1.35] text-ac-ink-3">
          <PartDot hue={part.hue} />
          <span>{part.name}</span>
          <span className="tabular-nums">{`· ${courseLine(stats, DURATIONS[courseFolder(course)])}`}</span>
        </span>
        {joins ? <span className="mt-1 block text-[12px] leading-[1.35] text-ac-ink-3">{joins}</span> : null}
      </CourseLink>
    </li>
  );
}
