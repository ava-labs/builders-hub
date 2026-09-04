"use client";

import { useState, useEffect } from 'react';
import { getQuizResponse } from '@/utils/quizzes/indexedDB';
import quizData from '@/components/quizzes/data';

export interface CourseCompletionEntry {
  nodeId: string;
  courseSlug: string;
}

const quizCourses = quizData.courses;

// Split courses: the learning tree tracks the whole course under its original
// slug, but quiz data and badge requirements key on the certificate halves.
export const splitCourseSlugs: Record<string, string[]> = {
  'access-restriction': ['access-restriction-fundamentals', 'access-restriction-advanced'],
};

export function useCourseCompletion(courses: CourseCompletionEntry[]) {
  const [completionMap, setCompletionMap] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const coursesKey = JSON.stringify(courses);

  useEffect(() => {
    let cancelled = false;

    async function checkAll() {
      const map = new Map<string, boolean>();

      await Promise.all(
        courses.map(async ({ nodeId, courseSlug }) => {
          const slugs = splitCourseSlugs[courseSlug] ?? [courseSlug];
          const quizLists = slugs.map(s => quizCourses[s]?.quizzes ?? []);
          // A missing half must read as "not completed", never as a shorter course.
          if (quizLists.some(l => l.length === 0)) {
            map.set(nodeId, false);
            return;
          }
          const courseQuizzes = quizLists.flat();

          const results = await Promise.all(
            courseQuizzes.map(quizId => getQuizResponse(quizId))
          );

          const isComplete = results.every(r => r?.isCorrect === true);
          map.set(nodeId, isComplete);
        })
      );

      if (!cancelled) {
        setCompletionMap(map);
        setIsLoading(false);
      }
    }

    checkAll();

    return () => { cancelled = true; };
  }, [coursesKey]);

  return { completionMap, isLoading };
}
