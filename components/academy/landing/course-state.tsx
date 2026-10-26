'use client';

import Link from 'next/link';
import * as HoverCard from '@radix-ui/react-hover-card';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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

/** Whose path shows, and whether its card took over from another open card with no close between (acad-path-card). */
export interface PathState {
  active: string | null;
  handoff: boolean;
}

/** The state once `next` shows (null: none). A hand-off is one course's card replacing another's directly. */
export function showPath(state: PathState, next: string | null): PathState {
  if (next === state.active) return state;
  return { active: next, handoff: state.active !== null && next !== null };
}

/** What a course's card remembers: the last input on its course, and how the card opened (acad-path-card). */
export interface CardInput {
  /** The last input on the course was keyboard focus that shows the ring; a pointer on the course clears it. */
  keyboard: boolean;
  /** Fixed as the card opens, from `keyboard`, and kept while it shows and leaves: the keyboard opened it. */
  openedByKeyboard: boolean;
}

export type CardEvent = { type: 'focus'; visible: boolean } | { type: 'pointer' } | { type: 'open' };

/** The card's memory after an event. Only an open reads the input, so later input never changes how a card moves. */
export function cardInput(state: CardInput, event: CardEvent): CardInput {
  if (event.type === 'open') {
    return state.openedByKeyboard === state.keyboard ? state : { ...state, openedByKeyboard: state.keyboard };
  }
  const keyboard = event.type === 'focus' && event.visible;
  return keyboard === state.keyboard ? state : { ...state, keyboard };
}

/**
 * Whether the card shows and goes at once, with no animation: the keyboard opened it, it took over from another open
 * card, or, while it leaves, another course's card took its place. Each input stays fixed from the moment it opens.
 */
export function isInstant(open: boolean, card: CardInput, path: PathState): boolean {
  return card.openedByKeyboard || (open ? path.handoff : path.active !== null);
}

const CARD_AT_REST: CardInput = { keyboard: false, openedByKeyboard: false };

interface LandingState {
  /** The course whose path shows, or null. */
  active: string | null;
  /** True while the card that shows took over from another open card: it showed at once, with no entrance. */
  handoff: boolean;
  /** The courses that path names; null while none shows. */
  lit: ReadonlySet<string> | null;
  canHover: boolean;
  /** Completed courses by id, empty until IndexedDB answers after mount (the server markup is neutral). */
  completion: ReadonlyMap<string, boolean>;
  setActive: Dispatch<SetStateAction<string | null>>;
}

const LandingContext = createContext<LandingState>({
  active: null,
  handoff: false,
  lit: null,
  canHover: false,
  completion: new Map(),
  setActive: () => undefined,
});

/** The state every course of a landing view reads: whose path shows, and which courses are completed. */
export function LandingProvider({ children }: { children: ReactNode }) {
  const canHover = useMediaQuery(HOVER_QUERY) === true;
  const [{ active, handoff }, setPath] = useState<PathState>({ active: null, handoff: false });
  const setActive = useCallback<Dispatch<SetStateAction<string | null>>>(
    (action) => setPath((state) => showPath(state, typeof action === 'function' ? action(state.active) : action)),
    [],
  );
  const { completionMap } = useCourseCompletion(COMPLETION_ENTRIES);
  // The query closes a card with no Radix close event, so drop its course and dim nothing while no card can open.
  useEffect(() => {
    if (!canHover) setActive(null);
  }, [canHover, setActive]);
  const value = useMemo<LandingState>(
    () => ({
      active,
      handoff,
      lit: canHover && active ? pathCourseIds(learningPath(active)) : null,
      canHover,
      completion: completionMap,
      setActive,
    }),
    [active, handoff, canHover, completionMap, setActive],
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
  const { active, handoff, canHover, setActive } = useLandingState();
  const { dimmed } = useCourseState(id);
  const path = useMemo(() => learningPath(id), [id]);
  const open = canHover && active === id;
  // A card opened from the keyboard shows and goes at once, as every keyboard-opened surface does (acad-path-card).
  const [card, dispatch] = useReducer(cardInput, CARD_AT_REST);
  const link = (
    <Link
      href={href}
      data-course-id={id}
      data-dim={dimmed ? 'true' : undefined}
      onFocus={(event) => dispatch({ type: 'focus', visible: event.currentTarget.matches(':focus-visible') })}
      onPointerEnter={() => dispatch({ type: 'pointer' })}
      className={cn('transition-opacity duration-150 motion-reduce:transition-none data-[dim=true]:opacity-20', className)}
    >
      {children}
    </Link>
  );
  if (!withPath || !hasPathToShow(path)) return link;
  return (
    <HoverCard.Root
      open={open}
      onOpenChange={(next) => {
        if (!canHover) return;
        // How the card moves is decided once, as it opens: later focus or a pointer on the course leaves it be. Radix
        // starts an open timer without clearing an earlier one, so a second timer can report the card open again;
        // only a card that is closed decides.
        if (next && !open) dispatch({ type: 'open' });
        setActive((current) => nextActive(current, id, next));
      }}
      // While another course's card shows, this one opens at once and takes it over, as tooltips do (acad-path-card);
      // from no card, after 150 ms. Close later than the next course opens, so a move between courses hands the path
      // straight over (nextActive ignores the late close); a shorter close left a moment with no card and nothing dimmed.
      openDelay={active === null ? 150 : 0}
      closeDelay={200}
    >
      <HoverCard.Trigger asChild>{link}</HoverCard.Trigger>
      <HoverCard.Portal>
        {/* The portal renders outside the landing root, so the card carries its own Academy scope for the tokens.
            data-path-card gives it its motion (app/global.css, acad-path-card). data-instant marks a card that shows
            and goes at once, with no animation (isInstant): the card that takes over from another, the card it
            replaces, and a card opened from the keyboard. */}
        <HoverCard.Content
          data-academy="landing"
          data-path-card=""
          data-instant={isInstant(open, card, { active, handoff }) ? '' : undefined}
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
