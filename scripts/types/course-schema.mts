/**
 * Course generation schema definitions
 */

export type LessonType = 'theoretical' | 'practical';

export interface Lesson {
  title: string;
  type: LessonType;
  order: number;
  icon?: string;
}

export interface CourseSection {
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseInput {
  courseSlug: string;
  courseTitle: string;
  description: string;
  icon: string;
  category: string;
  dependencies: string[];
  position: { x: number; y: number };
  mobileOrder: number;
  authors: string[];
  sections: CourseSection[];
}
