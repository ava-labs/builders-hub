import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { HackathonHeader } from '@/types/hackathons';
import { attrOf, classesOf, elementAt, firstTag, openingTags, read, transitionOf } from './helpers';

// The events listing and the Team1 applications read the session and the router; the visitor here has neither.
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
}));

import DiscoveryCard from '@/components/hackathons/DiscoveryCard';
import Events, { landPastEvents, pastCardMotion } from '@/components/hackathons/Events';
import GrantsPage from '@/app/(home)/grants/page';
import Team1MiniGrantsPage from '@/app/(home)/grants/team1-mini-grants/page';

/**
 * Task 19 of the hub motion pass, the events and grants half: past events that dim while the next page loads
 * (eco-events-pagination, variant a), photo cards with one slow zoom (eco-photo-cards) and grants hero buttons that
 * press in (eco-grants-cta). The blog half is in eco-blog.test.ts.
 */
const EVENTS = 'components/hackathons/Events.tsx';
const DISCOVERY = 'components/hackathons/DiscoveryCard.tsx';
const GRANTS = 'app/(home)/grants/page.tsx';
const TEAM1 = 'app/(home)/grants/team1-mini-grants/page.tsx';
const TOUCHED = [EVENTS, DISCOVERY, GRANTS, TEAM1];

const EASE_OUT = 'var(--ease-out)';

const pastEvent = (n: number) =>
  ({
    id: `event-${n}`,
    title: `Event ${n}`,
    description: '',
    start_date: '2026-01-10T12:00:00.000Z',
    end_date: '2026-01-12T12:00:00.000Z',
    location: 'Online',
    total_prizes: 1000,
    participants: 10,
    tags: [],
    organizers: 'Team1',
    cohosts: [],
    status: 'ENDED',
    small_banner: '/events/banner.png',
    banner: '',
    icon: '',
    timezone: 'UTC',
    content: {},
    top_most: false,
    custom_link: undefined,
    created_by: 'someone',
    is_public: true,
    event: 'hackathon',
  }) as unknown as HackathonHeader;
const eventsHtml = renderToStaticMarkup(
  createElement(Events, {
    initialPastEvents: [pastEvent(1), pastEvent(2), pastEvent(3), pastEvent(4)],
    initialUpcomingEvents: [],
    initialOngoingEvents: [],
    initialFilters: { page: 1, recordsByPage: 4 },
    totalPastEvents: 12,
    totalUpcomingEvents: 0,
  }),
);
const grantsHtml = renderToStaticMarkup(createElement(GrantsPage));
const team1Html = renderToStaticMarkup(createElement(Team1MiniGrantsPage));

describe('every file of the events and grants half', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(/transition-all|transition:\s*all/);
    expect(src).not.toMatch(/\bease-in\b(?!-out)/);
  });
});

describe('eco-events-pagination: past events dim while the next page loads, and the new ones fade in', () => {
  it('a fetch that lands for the query on screen (the first one repeats the server page) changes nothing', () => {
    const landed = { query: 'page=1&pageSize=4', swaps: 0 };
    expect(landPastEvents(landed, 'page=1&pageSize=4', true)).toBe(landed);
  });

  it('a fetch that lands for a new query swaps the cards once; a failed one only ends the wait', () => {
    const landed = { query: 'page=1&pageSize=4', swaps: 0 };
    expect(landPastEvents(landed, 'page=2&pageSize=4', true)).toEqual({ query: 'page=2&pageSize=4', swaps: 1 });
    expect(landPastEvents(landed, 'page=2&pageSize=4', false)).toEqual({ query: 'page=2&pageSize=4', swaps: 0 });
    expect(landed).toEqual({ query: 'page=1&pageSize=4', swaps: 0 });
  });

  it('a card at rest shows at once: opacity transitions in 120ms ease, 120ms under Reduce Motion too', () => {
    expect(pastCardMotion(0, false, 0)).toEqual({
      className: 'transition-[opacity] duration-120 ease-[ease] motion-reduce:duration-120!',
    });
  });

  it('while a fetch runs the cards on screen dim to 0.45', () => {
    expect(pastCardMotion(2, true, 0).className.split(' ')).toContain('opacity-45');
    expect(pastCardMotion(2, false, 0).className.split(' ')).not.toContain('opacity-45');
  });

  it('cards a fetch brought fade in from 0 in 180ms on the strong ease-out, each 40ms after the one before', () => {
    for (const index of [0, 1, 2, 3]) {
      const motion = pastCardMotion(index, false, 1);
      expect(motion.className.split(' ')).toEqual(
        expect.arrayContaining([
          'animate-[vs-fade-in_180ms_var(--ease-out)_backwards]',
          // Reduce Motion: the site policy drops the delay (no stagger); this keeps a 120ms fade
          'motion-reduce:[animation-duration:120ms]!',
        ]),
      );
      expect(motion.style).toEqual({ animationDelay: `${index * 40}ms` });
    }
    // the fade is opacity only: nothing moves on a list people are reading
    expect(read('app/global.css')).toMatch(/@keyframes vs-fade-in \{\s*from \{\s*opacity: 0;\s*\}\s*\}/);
  });

  it('the stagger stops at the eighth card: no card waits more than 280ms, on a page of 60 too', () => {
    expect(pastCardMotion(6, false, 1).style).toEqual({ animationDelay: '240ms' });
    for (const index of [7, 8, 23, 59]) {
      expect(pastCardMotion(index, false, 1).style, `card ${index}`).toEqual({ animationDelay: '280ms' });
    }
  });

  it('the server HTML shows the past cards at once, the grid not busy and taking clicks', () => {
    const grid = firstTag(eventsHtml, 'div', (div) => attrOf(div, 'aria-busy') !== undefined);
    expect(attrOf(grid, 'aria-busy')).toBe('false');
    expect(classesOf(grid)).toContain('aria-busy:pointer-events-none');
    const at = eventsHtml.indexOf(grid) + grid.length;
    const wrappers = openingTags(eventsHtml.slice(at), 'div').filter((div) =>
      classesOf(div).includes('transition-[opacity]'),
    );
    expect(wrappers).toHaveLength(4);
    for (const wrapper of wrappers) {
      expect(attrOf(wrapper, 'class')).toBe(
        'transition-[opacity] duration-120 ease-[ease] motion-reduce:duration-120!',
      );
      expect(attrOf(wrapper, 'style')).toBeUndefined();
    }
  });

  it('the wait is the gap between the query asked for and the one whose cards are on screen', () => {
    const src = read(EVENTS);
    expect(src).toContain('const pastPending = pastQuery !== pastLanding.query;');
    expect(src).toContain('setPastLanding((landed) => landPastEvents(landed, queryString, true));');
    expect(src).toContain('setPastLanding((landed) => landPastEvents(landed, queryString, false));');
    expect(src).toContain('key={`${pastLanding.swaps}:${event.id}`}');
  });
});

describe('eco-photo-cards: the photo zooms 3% slowly and comes back faster; the text holds still', () => {
  const programCards = openingTags(grantsHtml, 'a').filter(
    (a) => classesOf(a).includes('block') && classesOf(a).includes('group'),
  );

  it('renders the three grant programs', () => {
    expect(programCards).toHaveLength(3);
  });

  it('a grants photo zooms to 1.03 in 700ms and back in 300ms on the strong ease-out, never under Reduce Motion', () => {
    for (const card of programCards) {
      const classes = classesOf(firstTag(elementAt(grantsHtml, card, 'a'), 'img'));
      expect(transitionOf(classes)).toEqual({ scale: `300ms ${EASE_OUT}` });
      expect(classes).toEqual(
        expect.arrayContaining(['group-hover:duration-700', 'motion-safe:group-hover:scale-103']),
      );
      expect(classes.filter((name) => /scale-105/.test(name))).toEqual([]);
    }
  });

  it('a grants card changes one shadow in 200ms ease, its title holds still, and its arrow arrives with the zoom', () => {
    for (const card of programCards) {
      const inner = elementAt(grantsHtml, card, 'a');
      const box = openingTags(inner, 'div')[0] ?? '';
      expect(transitionOf(classesOf(box))).toEqual({ 'box-shadow': '200ms ease' });
      expect(classesOf(box)).toContain('hover:shadow-xl');
      expect(classesOf(firstTag(inner, 'h3')).filter((name) => /transition|translate|duration/.test(name))).toEqual([]);
      const classes = classesOf(firstTag(inner, 'div', (div) => classesOf(div).includes('top-4')));
      expect(transitionOf(classes)).toEqual({ opacity: '200ms ease', translate: `200ms ${EASE_OUT}` });
      // the same 8px travel; under Reduce Motion it rests in place and only fades in
      expect(classes).toEqual(
        expect.arrayContaining([
          'opacity-0',
          'group-hover:opacity-100',
          'translate-x-2',
          'group-hover:translate-x-0',
          'motion-reduce:translate-x-0',
        ]),
      );
    }
  });

  it('a Discover More card on Events keeps one shadow, changed in 200ms ease, and zooms its photo the same way', () => {
    const html = renderToStaticMarkup(
      createElement(DiscoveryCard, {
        title: 'Calendar',
        description: 'Every event',
        image: '/events/cal.png',
        url: 'https://lu.ma/x',
      }),
    );
    const [outer, inner] = openingTags(html, 'div');
    expect(transitionOf(classesOf(outer))).toEqual({ 'box-shadow': '200ms ease' });
    expect(classesOf(outer)).toContain('hover:shadow-lg');
    expect(classesOf(inner).filter((name) => /shadow|transition|duration/.test(name))).toEqual([]);
    const photo = classesOf(firstTag(html, 'img'));
    expect(transitionOf(photo)).toEqual({ scale: `300ms ${EASE_OUT}` });
    expect(photo).toEqual(expect.arrayContaining(['group-hover:duration-700', 'motion-safe:group-hover:scale-103']));
    expect(eventsHtml).toContain(outer);
  });
});

describe('eco-grants-cta: the hero buttons press in under the finger and do not puff up', () => {
  const buttons: Array<[string, string, string]> = [
    ['Grants View Programs', grantsHtml, '#programs'],
    ['Grants Bug Bounty', grantsHtml, 'https://immunefi.com/bug-bounty/avalanche/information/'],
    ['Team1 Apply Now', team1Html, '/grants/team1-mini-grants/apply'],
    ['Team1 Learn More', team1Html, 'https://team1.network/grants'],
  ];
  const buttonOf = (html: string, href: string) => firstTag(html, 'a', (a) => attrOf(a, 'href') === href);

  it.each(buttons)(
    '%s: no hover growth or glow, a press to 0.97 in 160ms; Reduce Motion dims it instead',
    (_, html, href) => {
      const classes = classesOf(buttonOf(html, href));
      expect(classes.filter((name) => /^hover:(scale|shadow)/.test(name))).toEqual([]);
      expect(transitionOf(classes).scale).toBe(`160ms ${EASE_OUT}`);
      expect(classes).toEqual(
        expect.arrayContaining([
          'active:scale-[0.97]',
          'motion-reduce:active:scale-100',
          'motion-reduce:active:opacity-85',
        ]),
      );
    },
  );

  it('the red buttons keep their rest glow; the glass ones fade their background in 150ms ease', () => {
    for (const [html, href] of [
      [grantsHtml, '#programs'],
      [team1Html, '/grants/team1-mini-grants/apply'],
    ]) {
      const classes = classesOf(buttonOf(html, href));
      expect(classes).toEqual(expect.arrayContaining(['shadow-xl', 'shadow-red-500/30']));
      expect(transitionOf(classes)).toEqual({ scale: `160ms ${EASE_OUT}` });
    }
    for (const [html, href] of [
      [grantsHtml, 'https://immunefi.com/bug-bounty/avalanche/information/'],
      [team1Html, 'https://team1.network/grants'],
    ]) {
      expect(transitionOf(classesOf(buttonOf(html, href)))).toEqual({
        'background-color': '150ms ease',
        scale: `160ms ${EASE_OUT}`,
      });
    }
  });

  it.each([
    ['Grants View Programs', grantsHtml, '#programs'],
    ['Team1 Apply Now', team1Html, '/grants/team1-mini-grants/apply'],
  ])('%s: hover nudges the arrow 3px in 200ms on the strong ease-out, only when motion is welcome', (_, html, href) => {
    const classes = classesOf(openingTags(elementAt(html, buttonOf(html, href), 'a'), 'svg')[0] ?? '');
    expect(transitionOf(classes)).toEqual({ translate: `200ms ${EASE_OUT}` });
    expect(classes).toContain('motion-safe:group-hover:translate-x-[3px]');
    expect(classes.filter((name) => name.startsWith('group-hover:translate'))).toEqual([]);
  });
});
