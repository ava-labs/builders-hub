'use client';

import { useTreeContext } from 'fumadocs-ui/contexts/tree';

/**
 * The course title atop the desktop sidebar, where the course dropdown was: the part is on the sub-nav above, so the
 * heading names the course alone and the lessons follow. fumadocs' tree context holds the course folder of the current
 * page as its root. Below 1024 px the drawer's dropdown names the course, so the heading hides there.
 */
export function CourseSidebarHeading() {
  const { root, full } = useTreeContext();
  if (root === full) return null;
  return (
    <p data-academy-part="course-heading" className="mb-2 px-2 pt-2 pb-2.5 text-[15px] font-semibold leading-[1.3] text-ac-ink max-lg:hidden">
      {root.name}
    </p>
  );
}
