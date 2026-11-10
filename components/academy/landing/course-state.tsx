'use client';

import Link from 'next/link';
import * as HoverCard from '@radix-ui/react-hover-card';
import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useMediaQuery } from 'fumadocs-core/utils/use-media-query';
import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { useCourseCompletion, type CourseCompletionEntry } from '@/hooks/useCourseCompletion';
import { courseFolder, hasPathToShow, learningPath, nextActive, pathCourseIds } from '@/lib/academy/academy-programme';
import { cn } from '@/utils/cn';
import { PathSteps } from './path-steps';

/** Hover cards open on desktop pointers and keyboards only: 1024 px and up, on a device that hovers. */
const HOVER_QUERY = '(hover: hover) and (min-width: 1024px)';

// Completion reads each course's quizzes under its folder slug (hooks/useCourseCompletion.ts).
const COMPLETION_ENTRIES: CourseCompletionEntry[] = ACADEMY_COURSES.map((course) => ({
  nodeId: course.id,
  courseSlug: courseFolder(course),
}));

interface LandingState {
  /** The course whose path shows, or null. */
  active: string | null;
  /** The courses that path names; null while none shows. */
  lit: ReadonlySet<string> | null;
  canHover: boolean;
  /** Completed courses by id, empty until IndexedDB answers after mount (the server markup is neutral). */
  completion: ReadonlyMap<string, boolean>;
  setActive: Dispatch<SetStateAction<string | null>>;
}

const LandingContext = createContext<LandingState>({
  active: null,
  lit: null,
  canHover: false,
  completion: new Map(),
  setActive: () => undefined,
});

/** The state every course of a landing view reads: whose path shows, and which courses are completed. */
export function LandingProvider({ children }: { children: ReactNode }) {
  const canHover = useMediaQuery(HOVER_QUERY) === true;
  const [active, setActive] = useState<string | null>(null);
  const { completionMap } = useCourseCompletion(COMPLETION_ENTRIES);
  // The query closes a card with no Radix close event, so drop its course and dim nothing while no card can open.
  useEffect(() => {
    if (!canHover) setActive(null);
  }, [canHover]);
  const value = useMemo<LandingState>(
    () => ({ active, lit: canHover && active ? pathCourseIds(learningPath(active)) : null, canHover, completion: completionMap, setActive }),
    [active, canHover, completionMap],
  );
  return <LandingContext.Provider value={value}>{children}</LandingContext.Provider>;
}

export function useLandingState(): LandingState {
  return useContext(LandingContext);
}

/** Whether a course dims (a path shows and does not name it), and whether it is completed. */
export function useCourseState(id: string): { dimmed: boolean; completed: boolean } {
  const { lit, completion } = useContext(LandingContext);
  return { dimmed: lit !== null && !lit.has(id), completed: completion.get(id) === true };
}

interface CourseLinkProps {
  id: string;
  href: string;
  className?: string;
  /** False on a copy the desktop never shows (the tree's phone column), so one card opens per course. */
  withPath?: boolean;
  children: ReactNode;
}

/**
 * A course link that shows the course's learning path on desktop hover and on keyboard focus (Radix opens a
 * hover card on pointer enter, touch excluded, and on focus; Escape closes it). While it shows, the other courses dim.
 */
export function CourseLink({ id, href, className, withPath = true, children }: CourseLinkProps) {
  const { active, canHover, setActive } = useLandingState();
  const { dimmed } = useCourseState(id);
  const path = useMemo(() => learningPath(id), [id]);
  const link = (
    <Link
      href={href}
      data-course-id={id}
      data-dim={dimmed ? 'true' : undefined}
      className={cn('transition-opacity duration-150 motion-reduce:transition-none data-[dim=true]:opacity-20', className)}
    >
      {children}
    </Link>
  );
  if (!withPath || !hasPathToShow(path)) return link;
  return (
    <HoverCard.Root
      open={canHover && active === id}
      onOpenChange={(open) => {
        if (canHover) setActive((current) => nextActive(current, id, open));
      }}
      // Close later than the next course opens, so a move between courses hands the path straight over
      // (nextActive ignores the late close); a shorter close left a moment with no card and nothing dimmed.
      openDelay={150}
      closeDelay={200}
    >
      <HoverCard.Trigger asChild>{link}</HoverCard.Trigger>
      <HoverCard.Portal>
        {/* The portal renders outside the landing root, so the card carries its own Academy scope for the tokens. */}
        <HoverCard.Content
          data-academy="landing"
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-[300px] rounded-xl border border-ac-rule bg-ac-paper p-4 shadow-[0_12px_24px_-12px_rgb(0_0_0_/_0.15)]"
        >
          <PathSteps path={path} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
