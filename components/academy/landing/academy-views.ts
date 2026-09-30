import type { CourseStats } from '@/lib/academy/course-outline';

export type AcademyView = 'overview' | 'tree' | 'stages';

/** The toggle's three views in order; the first is the default at the bare /academy. */
export const ACADEMY_VIEWS: readonly { id: AcademyView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tree', label: 'Tree' },
  { id: 'stages', label: 'Stages' },
];

/** The view a ?view= value names: "tree" or "stages" exactly; missing, unknown or repeated gives the overview. */
export function parseAcademyView(value: string | string[] | undefined): AcademyView {
  return value === 'tree' || value === 'stages' ? value : 'overview';
}

export function viewHref(view: AcademyView): string {
  return view === 'overview' ? '/academy' : `/academy?view=${view}`;
}

export interface LandingViewProps {
  /** Lessons and modules per course url: the page merges the two tracks of lib/academy/course-stats.generated.ts. */
  courseStats: Record<string, CourseStats>;
}
