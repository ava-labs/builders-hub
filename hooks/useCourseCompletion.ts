"use client";

import { useState, useEffect } from 'react';
import { getQuizResponse } from '@/utils/quizzes/indexedDB';
import quizData from '@/components/quizzes/quizData.json';

export interface CourseCompletionEntry {
  nodeId: string;
  courseSlug: string;
}

const quizCourses = (quizData as any).courses as Record<string, { title: string; quizzes: string[] }>;

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
          const courseQuizzes = quizCourses[courseSlug]?.quizzes;
          if (!courseQuizzes || courseQuizzes.length === 0) return;

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
