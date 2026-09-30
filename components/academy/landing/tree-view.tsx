'use client';

import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { treeEdges, type TreeEdgeNode } from '@/components/academy/learning-tree';
import { getCourseDurations } from '@/content/courses';
import type { CourseStats } from '@/lib/academy/course-outline';
import { academyCourse, academyCourseUrl, academyPart, countOf, courseFolder, durationHours } from '@/lib/academy/academy-programme';
import { cn } from '@/utils/cn';
import type { LandingViewProps } from './academy-views';
import { CourseMarker, FOCUS_RING, PartDot } from './course-marks';
import { CourseLink, LandingProvider, useCourseState, useLandingState } from './course-state';

const DURATIONS = getCourseDurations();
// Rows 150 px apart. A card is at least 100 px tall, so a curve leaving its parent 95 px below the top
// (EDGE_START in learning-tree.tsx) starts under the parent's paper.
const ROW_PITCH = 150;
const CARD_MIN_HEIGHT = 100;
const ROWS = Math.max(...ACADEMY_COURSES.map((course) => course.tree.row)) + 1;
const CANVAS_HEIGHT = (ROWS - 1) * ROW_PITCH + CARD_MIN_HEIGHT + 8;
const NODES: TreeEdgeNode[] = ACADEMY_COURSES.map((course) => ({
  id: course.id,
  dependencies: [...course.dependencies],
  position: { x: course.tree.x, y: course.tree.row * ROW_PITCH },
}));
const CARD_LINK = cn('group block rounded-xl', FOCUS_RING);

/** A, the merged tree: the canvas at 1024 px and up, today's numbered column below it. */
export function TreeView({ courseStats }: LandingViewProps) {
  return (
    <LandingProvider>
      <div className="lg:hidden">
        <TreeColumn courseStats={courseStats} />
      </div>
      <div className="hidden lg:block">
        <TreeCanvas courseStats={courseStats} />
      </div>
    </LandingProvider>
  );
}

function TreeCanvas({ courseStats }: LandingViewProps) {
  const { lit, completion } = useLandingState();
  return (
    <div className="relative" style={{ height: CANVAS_HEIGHT }}>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full overflow-visible"
        style={{ height: CANVAS_HEIGHT }}
        viewBox={`0 0 100 ${CANVAS_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker id="academy-tree-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ac-line" />
          </marker>
          <marker id="academy-tree-arrow-ok" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ac-ok" />
          </marker>
        </defs>
        {treeEdges(NODES, completion).map((edge) => (
          <path
            key={edge.key}
            d={edge.d}
            fill="none"
            data-dim={lit !== null && !(lit.has(edge.from) && lit.has(edge.to)) ? 'true' : undefined}
            className={cn(
              'transition-opacity duration-150 motion-reduce:transition-none data-[dim=true]:opacity-[0.12]',
              edge.completed ? 'stroke-ac-ok' : 'stroke-ac-line',
            )}
            strokeWidth={edge.completed ? 1.5 : 1}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={edge.completed ? 'url(#academy-tree-arrow-ok)' : 'url(#academy-tree-arrow)'}
          />
        ))}
      </svg>
      {ACADEMY_COURSES.map((course) => (
        // A focused card rises above its neighbours, whose paper would cover its ring.
        <div
          key={course.id}
          className="absolute z-10 w-[150px] -translate-x-1/2 focus-within:z-20 xl:w-[186px]"
          style={{ left: `${course.tree.x}%`, top: course.tree.row * ROW_PITCH }}
        >
          <CourseLink id={course.id} href={academyCourseUrl(course)} className={CARD_LINK}>
            <TreeCard courseId={course.id} stats={courseStats[academyCourseUrl(course)]} />
          </CourseLink>
        </div>
      ))}
    </div>
  );
}

/** Below 1024 px: every course in number order, an arrow between neighbours, as the Team1 tree's phone list draws it. */
function TreeColumn({ courseStats }: LandingViewProps) {
  const { completion } = useLandingState();
  return (
    <ol className="space-y-4">
      {ACADEMY_COURSES.map((course, index) => (
        <li key={course.id} className="relative">
          {index > 0 ? (
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className={cn('absolute -top-4 left-1/2 -translate-x-1/2', completion.get(course.id) === true ? 'text-ac-ok' : 'text-ac-line')}
            >
              <path d="M8 2 L8 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M4 8 L8 12 L12 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          ) : null}
          <CourseLink id={course.id} href={academyCourseUrl(course)} withPath={false} className={CARD_LINK}>
            <TreeCard courseId={course.id} stats={courseStats[academyCourseUrl(course)]} />
          </CourseLink>
        </li>
      ))}
    </ol>
  );
}

/**
 * The tree card without the icon tile and the clock (FDE-155): the part dot and name, the number, the course name,
 * then lessons, modules and hours. Between 1024 and 1279 px the card is 150 px wide, so it drops the number (a
 * completed check still shows) and the module count, which overflowed there in the design round.
 */
function TreeCard({ courseId, stats }: { courseId: string; stats: CourseStats | undefined }) {
  const course = academyCourse(courseId);
  const part = academyPart(course.part);
  const { completed } = useCourseState(course.id);
  const hours = durationHours(DURATIONS[courseFolder(course)]);
  return (
    <div className="min-h-[100px] rounded-xl border border-ac-rule bg-ac-paper px-[13px] pt-2.5 pb-[9px] transition-colors duration-150 group-hover:border-ac-ink group-focus-visible:border-ac-ink">
      <div className="mb-1.5 flex min-h-[18px] items-center gap-2">
        <PartDot hue={part.hue} />
        <span className="min-w-0 truncate text-[12px] text-ac-ink-3">{part.name}</span>
        <CourseMarker id={course.id} completed={completed} className={cn('ml-auto', !completed && 'lg:max-xl:hidden')} />
      </div>
      <h3 className="text-[15px] font-semibold leading-[1.25] tracking-[-0.006em] text-ac-ink">{course.name}</h3>
      <div className="mt-1.5 flex gap-2.5 whitespace-nowrap border-t border-ac-rule pt-1.5 text-[11.5px] leading-[1.3] text-ac-ink-3 tabular-nums">
        {stats ? (
          <span>
            {countOf(stats.lessons, 'lesson')}
            <span className="lg:max-xl:hidden">{` · ${countOf(stats.modules, 'module')}`}</span>
          </span>
        ) : null}
        {hours > 0 ? <span className="ml-auto">{`${hours} h`}</span> : null}
      </div>
    </div>
  );
}
