'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CourseStats } from '@/lib/academy/course-outline';

/** What a course page tells the components in its MDX body: the course name and size, from the course outline. */
export interface CourseOutlineFacts extends CourseStats {
  name: string;
}

const CourseOutlineContext = createContext<CourseOutlineFacts | null>(null);

export function CourseOutlineProvider({ value, children }: { value: CourseOutlineFacts | null; children: ReactNode }) {
  return <CourseOutlineContext.Provider value={value}>{children}</CourseOutlineContext.Provider>;
}

/** The current course page's facts; null outside a course page or when the page has no outline. */
export function useCourseOutline(): CourseOutlineFacts | null {
  return useContext(CourseOutlineContext);
}
