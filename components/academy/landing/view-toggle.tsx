'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, ViewTransition, type ReactNode } from 'react';
import { VIEW_SWITCH } from '@/components/explorer-v2/view-switch';
import { cn } from '@/utils/cn';
import { ACADEMY_VIEWS, viewHref, type AcademyView } from './academy-views';
import { FOCUS_RING } from './course-marks';

/**
 * The landing's three views as links the server renders (?view=), the current one on the red rule as the track
 * tabs drew it. A div with the navigation role, not a nav element: app/global.css pads and recolours every `nav a`
 * with !important, as the track tabs it replaces knew. The links tag their navigation with the Explorer's
 * view-switch type, so the parts a view change replaces cross-fade (ViewFade) while the rest of the page holds
 * still; the links stay mounted through it, so keyboard focus stays on the toggle (acad-view-switch). While the
 * toggle is on the page, data-view-switch keeps the page's root from fading in any view transition (app/global.css).
 */
export function ViewToggle({ view }: { view: AcademyView }) {
  const ref = useViewLine(view);
  return (
    <div ref={ref} role="navigation" aria-label="Course views" className="relative flex gap-6" data-view-switch="academy">
      {ACADEMY_VIEWS.map((option) => {
        const current = option.id === view;
        return (
          <Link
            key={option.id}
            href={viewHref(option.id)}
            scroll={false}
            transitionTypes={VIEW_SWITCH}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 pb-2 text-[15px] font-medium leading-none',
              FOCUS_RING,
              current ? 'border-ac-red text-ac-ink' : 'border-transparent text-ac-ink-3 hover:text-ac-ink',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * acad-view-switch: one red rule under the current view that slides to the next (academy-tokens.css). The server
 * draws each link's own rule, as before; once mounted, the list draws one rule on the current link's box (the same
 * box, so the same pixels) and the links' own rules clear. A view change puts the rule on the new link's box and
 * slides it there from where it showed, with translateX and scaleX; the first draw and a resize (the web font
 * arriving) place it still.
 */
function useViewLine(view: AcademyView) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<AcademyView | null>(null);
  useLayoutEffect(() => {
    const list = ref.current;
    const current = list?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!list || !current) return;
    let placed = '';
    const place = (motion: 'still' | 'travel') => {
      const box = current.getBoundingClientRect();
      const x = box.left - list.getBoundingClientRect().left;
      if (`${x} ${box.width}` === placed) return;
      placed = `${x} ${box.width}`;
      const from = motion === 'travel' ? shownRule(list) : null;
      list.style.setProperty('--view-line-x', `${x}px`);
      list.style.setProperty('--view-line-w', `${box.width}px`);
      list.style.setProperty(
        '--view-line-from',
        from ? `translateX(${from.x - x}px) scaleX(${from.width / box.width})` : 'none',
      );
      list.setAttribute('data-view-line', 'still');
      if (!from) return;
      // The rule takes the box it showed on, then slides to its own.
      void getComputedStyle(list, '::after').transform;
      list.style.setProperty('--view-line-from', 'none');
      list.setAttribute('data-view-line', 'travel');
    };
    place(shown.current === null || shown.current === view ? 'still' : 'travel');
    shown.current = view;
    const observer = new ResizeObserver(() => place('still'));
    list.querySelectorAll('a').forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [view]);
  return ref;
}

/** Where the rule shows now, in the list's coordinates: its box, moved by its transform while it slides. */
function shownRule(list: HTMLElement): { x: number; width: number } | null {
  const x = parseFloat(list.style.getPropertyValue('--view-line-x'));
  const width = parseFloat(list.style.getPropertyValue('--view-line-w'));
  if (Number.isNaN(x) || Number.isNaN(width)) return null;
  const transform = getComputedStyle(list, '::after').transform;
  const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
  return { x: x + matrix.e, width: width * matrix.a };
}

/**
 * A part of the landing that a view change replaces, keyed by its content (acad-view-switch, app/global.css): with a
 * new key the old part fades out and the new one fades in; with the same key it holds still. Any other navigation
 * swaps it at once. ViewTransition comes from the React canary the App Router runs, as in
 * components/explorer-v2/view-switch.tsx; the unit tests stub it.
 */
export function ViewFade({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'view-switch': 'acad-view-in', default: 'none' }}
      exit={{ 'view-switch': 'acad-view-out', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
