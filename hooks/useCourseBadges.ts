"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type { CourseCompletionEntry } from './useCourseCompletion';

// Split courses: the learning tree tracks the whole course under its original
// slug, but badge requirements key on the certificate halves.
const badgeCourseAlias: Record<string, string> = {
  'access-restriction': 'access-restriction-fundamentals',
};

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
            const badgeSlug = badgeCourseAlias[courseSlug] ?? courseSlug;
            const response = await fetch(`/api/badge?course_id=${badgeSlug}`);
            if (!response.ok) return;
            const data = await response.json();
            // A course id can match several badges (per-course badge + the
            // graduate badge) — the per-course badge has the fewest requirements.
            const badges = Array.isArray(data) ? data : [data];
            const imagePath = badges.sort(
              (a, b) => (a?.requirements?.length ?? 99) - (b?.requirements?.length ?? 99)
            )[0]?.image_path;
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
