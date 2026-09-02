"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { splitCourseSlugs, type CourseCompletionEntry } from './useCourseCompletion';

export function useCourseBadges(
  completionMap: Map<string, boolean>,
  courseEntries: CourseCompletionEntry[]
) {
  const [badgeImageMap, setBadgeImageMap] = useState<Map<string, string>>(new Map());

  let session = null;
  try {
    const { data } = useSession();
    session = data;
  } catch {
    // SessionProvider not available
  }

  const isAuthenticated = !!session?.user;
  const completedKey = JSON.stringify(
    courseEntries
      .filter(e => completionMap.get(e.nodeId) === true)
      .map(e => e.courseSlug)
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function fetchBadges() {
      const completedEntries = courseEntries.filter(
        e => completionMap.get(e.nodeId) === true
      );

      if (completedEntries.length === 0) return;

      const map = new Map<string, string>();

      await Promise.all(
        completedEntries.map(async ({ nodeId, courseSlug }) => {
          try {
            const slugs = splitCourseSlugs[courseSlug] ?? [courseSlug];
            const response = await fetch(`/api/badge?course_id=${slugs[0]}`);
            if (!response.ok) return;
            const data = await response.json();
            // A course id can match several badges (its own + the Graduate
            // badge, which lists every course) — the course's own badge is the
            // one whose requirements all belong to this course.
            const badges = Array.isArray(data) ? data : [data];
            const imagePath = badges.find(b =>
              b?.requirements?.every((r: any) => slugs.includes(r?.course_id))
            )?.image_path;
            if (imagePath) {
              map.set(nodeId, imagePath);
            }
          } catch {
            // Silently fail - fallback to checkmark
          }
        })
      );

      if (!cancelled) {
        setBadgeImageMap(map);
      }
    }

    fetchBadges();

    return () => { cancelled = true; };
  }, [isAuthenticated, completedKey]);

  return { badgeImageMap };
}
