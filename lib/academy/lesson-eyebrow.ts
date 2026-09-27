import type { CourseOutline, LessonPosition } from '@/lib/academy/course-outline';

export interface LessonEyebrowText {
  course: string;              // shown below 1024 px only (spec 4.5, R6)
  module: string | null;       // null without a module, or when the lesson title already names it
  position: string;            // "Lesson N of M"
  steps: { index: number; count: number } | null; // null for a lesson outside the modules of a course that has them
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the title contains the module name as whole words ("Stateful Precompiles" names "Precompiles"). */
export function titleNamesModule(title: string, moduleName: string): boolean {
  const name = moduleName.trim().toLowerCase();
  if (!name) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}($|[^a-z0-9])`).test(title.trim().toLowerCase());
}

export function lessonEyebrow(outline: CourseOutline, position: LessonPosition, lessonTitle: string): LessonEyebrowText {
  const moduleName = position.module?.name ?? null;
  const outsideModules = position.module === null && outline.modules.length > 0;
  return {
    course: outline.name,
    module: moduleName && !titleNamesModule(lessonTitle, moduleName) ? moduleName : null,
    position: `Lesson ${position.index} of ${position.count}`,
    steps: outsideModules ? null : { index: position.index, count: position.count },
  };
}
