import {
  ACADEMY_COURSES,
  ACADEMY_PARTS,
  NEWCOMER_COURSE_ID,
  START_COURSE_ID,
  type AcademyCourse,
  type AcademyPart,
  type AcademyPartId,
  type AcademyStageId,
} from '@/components/academy/learning-path-configs/academy.config';
import type { CourseStats } from '@/lib/academy/course-outline';

/*
 * Pure helpers over the Academy programme (academy.config.ts): lookups, numbers, the "After ..." line, a course's
 * learning path, and the facts lines the landing prints. No React, so the landing's server and client parts share it.
 */

const BY_ID: ReadonlyMap<string, AcademyCourse> = new Map(ACADEMY_COURSES.map((course) => [course.id, course]));

/** The course with this id; throws on an id the config does not list, which is a typo in the data. */
export function academyCourse(id: string): AcademyCourse {
  const course = BY_ID.get(id);
  if (!course) throw new Error(`Unknown Academy course: ${id}`);
  return course;
}

export function academyPart(id: AcademyPartId): AcademyPart {
  const part = ACADEMY_PARTS.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`Unknown Academy part: ${id}`);
  return part;
}

/** The course under "<track>/<course folder>", or null (a Team1 course, a removed one). */
export function academyCourseBySlug(slug: string): AcademyCourse | null {
  return ACADEMY_COURSES.find((course) => course.slug === slug) ?? null;
}

export function academyCourseUrl(course: AcademyCourse): string {
  return `/academy/${course.slug}`;
}

/** The course a course-page url belongs to (its url, or a page below it); null outside the 13 (Team1, removed ones). */
export function academyCourseOfPathname(pathname: string): AcademyCourse | null {
  return (
    ACADEMY_COURSES.find((course) => {
      const url = academyCourseUrl(course);
      return pathname === url || pathname.startsWith(`${url}/`);
    }) ?? null
  );
}

/** The course folder, the key content/courses.tsx uses: "blockchain/solidity-foundry" gives "solidity-foundry". */
export function courseFolder(course: AcademyCourse): string {
  return course.slug.slice(course.slug.lastIndexOf('/') + 1);
}

/** "01" to "13": the course's place in the reading order, the same in every view. */
export function courseNumber(id: string): string {
  return String(ACADEMY_COURSES.indexOf(academyCourse(id)) + 1).padStart(2, '0');
}

export function coursesOfPart(part: AcademyPartId): AcademyCourse[] {
  return ACADEMY_COURSES.filter((course) => course.part === part);
}

export function coursesOfStage(stage: AcademyStageId): AcademyCourse[] {
  return ACADEMY_COURSES.filter((course) => course.stage === stage);
}

/** "After Permissioned L1s and L1 Native Tokenomics", for a course with two or more prerequisites. */
export function joinsLine(course: AcademyCourse): string | null {
  if (course.dependencies.length < 2) return null;
  return `After ${course.dependencies.map((id) => academyCourse(id).name).join(' and ')}`;
}

export type PathStep = { kind: 'course'; id: string } | { kind: 'branches'; branches: string[][] };

export interface LearningPath {
  /**
   * The prerequisites in order, the course itself last; a join is one step of side-by-side branches. A path that
   * starts at Avalanche Fundamentals opens on Blockchain Fundamentals, a numbered step but not a dependency.
   */
  steps: PathStep[];
}

function ancestors(id: string): Set<string> {
  return new Set([id, ...academyCourse(id).dependencies.flatMap((parent) => [...ancestors(parent)])]);
}

/** The single-parent chain from just below `fork` down to `id`, top-down. */
function branchTo(fork: string, id: string): string[] {
  if (id === fork) throw new Error(`Academy path: a branch of a join is empty at ${fork}`);
  const [parent, ...others] = academyCourse(id).dependencies;
  if (parent === undefined || others.length > 0) throw new Error(`Academy path: ${id} joins inside a branch`);
  return parent === fork ? [id] : [...branchTo(fork, parent), id];
}

function stepsTo(id: string): PathStep[] {
  const parents = academyCourse(id).dependencies;
  if (parents.length === 0) return [{ kind: 'course', id }];
  if (parents.length === 1) return [...stepsTo(parents[0]), { kind: 'course', id }];
  const shared = parents.map(ancestors).reduce((common, set) => new Set([...common].filter((candidate) => set.has(candidate))));
  // The nearest shared prerequisite: the one whose own ancestors hold every other shared one.
  const fork = [...shared].find((candidate) => [...shared].every((other) => ancestors(candidate).has(other)));
  if (fork === undefined) throw new Error(`Academy path: ${id} has no shared prerequisite`);
  return [...stepsTo(fork), { kind: 'branches', branches: parents.map((parent) => branchTo(fork, parent)) }, { kind: 'course', id }];
}

/**
 * The path to a course: its prerequisites in order, a join as its branches side by side, the course last; the
 * newcomer course first when the path starts at the start course.
 */
export function learningPath(id: string): LearningPath {
  const steps = stepsTo(id);
  const [first] = steps;
  const startsAtStart = first.kind === 'course' && first.id === START_COURSE_ID;
  return { steps: startsAtStart ? [{ kind: 'course', id: NEWCOMER_COURSE_ID }, ...steps] : steps };
}

/** Every course a path names: the courses the landing keeps lit. */
export function pathCourseIds(path: LearningPath): Set<string> {
  return new Set(path.steps.flatMap((step) => (step.kind === 'course' ? [step.id] : step.branches.flat())));
}

/** A path worth a card: a step before the course. Blockchain Fundamentals has none. */
export function hasPathToShow(path: LearningPath): boolean {
  return path.steps.length > 1;
}

/**
 * The course whose path shows after a hover card opens or closes. A close clears only its own course, so a late
 * close from the course just left never clears the one just opened.
 */
export function nextActive(current: string | null, id: string, open: boolean): string | null {
  if (open) return id;
  return current === id ? null : current;
}

/** "2 hours" gives 2, "1 hour" 1; content/courses.tsx writes every Academy duration in whole hours (a test checks). */
export function durationHours(duration: string | undefined): number {
  const match = duration === undefined ? null : /^(\d+(?:\.\d+)?) hours?$/.exec(duration.trim());
  return match ? Number(match[1]) : 0;
}

/** "1 lesson", "31 lessons". */
export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export interface GroupFacts {
  courses: number;
  lessons: number;
  hours: number;
}

/** Courses, lessons (the page tree's stats) and hours (content/courses.tsx) of a group of courses. */
export function groupFacts(
  courses: readonly AcademyCourse[],
  stats: Record<string, CourseStats>,
  durations: Record<string, string>,
): GroupFacts {
  return courses.reduce<GroupFacts>(
    (facts, course) => ({
      courses: facts.courses + 1,
      lessons: facts.lessons + (stats[academyCourseUrl(course)]?.lessons ?? 0),
      hours: facts.hours + durationHours(durations[courseFolder(course)]),
    }),
    { courses: 0, lessons: 0, hours: 0 },
  );
}

/** "3 courses · 106 lessons · 6 h": a lane's or a stage's line. */
export function groupLine({ courses, lessons, hours }: GroupFacts): string {
  return `${countOf(courses, 'course')} · ${countOf(lessons, 'lesson')} · ${hours} h`;
}

/** "13 courses · 377 lessons · 26 hours": the hero's line. */
export function programmeLine({ courses, lessons, hours }: GroupFacts): string {
  return `${countOf(courses, 'course')} · ${countOf(lessons, 'lesson')} · ${countOf(hours, 'hour')}`;
}

const shortHours = (duration: string | undefined): string[] => {
  const hours = durationHours(duration);
  return hours > 0 ? [`${hours} h`] : [];
};

/** "40 lessons · 2 h": a course row's line; without stats, the duration alone. */
export function courseLine(stats: CourseStats | undefined, duration: string | undefined): string {
  return [...(stats ? [countOf(stats.lessons, 'lesson')] : []), ...shortHours(duration)].join(' · ');
}

/** "31 lessons · 4 modules · 1 h": the spotlight's line. */
export function courseLineWithModules(stats: CourseStats | undefined, duration: string | undefined): string {
  return [...(stats ? [countOf(stats.lessons, 'lesson'), countOf(stats.modules, 'module')] : []), ...shortHours(duration)].join(' · ');
}
