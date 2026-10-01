import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PathSteps } from '@/components/academy/landing/path-steps';
import { CourseLink, LandingProvider } from '@/components/academy/landing/course-state';
import { CourseMarker, PartDot } from '@/components/academy/landing/course-marks';
import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { learningPath } from '@/lib/academy/academy-programme';

/** The markup's text, one entry per text run. */
const runs = (html: string) => html.replace(/<[^>]+>/g, '|').split('|').map((part) => part.trim()).filter(Boolean);
const steps = (id: string) => renderToStaticMarkup(createElement(PathSteps, { path: learningPath(id) }));

describe('PathSteps, the hover card of a course', () => {
  it('numbers every step from 1, Blockchain Fundamentals first, the course last', () => {
    expect(runs(steps('interchain-messaging'))).toEqual([
      'Learning path', '1', 'Blockchain Fundamentals', '2', 'Avalanche Fundamentals', '3', 'Interchain Messaging',
    ]);
  });

  it('opens the Avalanche Fundamentals card on Blockchain Fundamentals, and no card says optional', () => {
    expect(runs(steps('avalanche-fundamentals'))).toEqual(['Learning path', '1', 'Blockchain Fundamentals', '2', 'Avalanche Fundamentals']);
    ACADEMY_COURSES.forEach((entry) => expect(steps(entry.id), entry.id).not.toContain('optional'));
  });

  it('shows both branches of a join under one step', () => {
    expect(runs(steps('native-token-bridge'))).toEqual([
      'Learning path', '1', 'Blockchain Fundamentals', '2', 'Avalanche Fundamentals',
      '3', 'L1 Native Tokenomics', 'Interchain Messaging, then ERC20 Bridge', '4', 'Native Token Bridge',
    ]);
  });

  it('numbers Blockchain Fundamentals on the Applications path, where Intro to Solidity needs it', () => {
    expect(runs(steps('x402-payment-infrastructure'))).toEqual([
      'Learning path', '1', 'Blockchain Fundamentals', '2', 'Intro to Solidity', '3', 'x402 Payments',
    ]);
  });

  it('sets the course in ink at weight 600 and the steps before it in ink-2, Blockchain Fundamentals included', () => {
    const html = steps('erc20-bridge');
    expect(html).toContain('<span class="font-semibold text-ac-ink">ERC20 Bridge</span>');
    expect(html).toContain('<span class="text-ac-ink-2">Interchain Messaging</span>');
    expect(html).toContain('<span class="text-ac-ink-2">Blockchain Fundamentals</span>');
  });
});

describe('CourseLink at server render', () => {
  const render = (id: string, withPath?: boolean) =>
    renderToStaticMarkup(
      createElement(LandingProvider, null, createElement(CourseLink, { id, href: `/academy/x/${id}`, className: 'row', withPath, children: 'NAME' })),
    );

  it('links the course, marks it for the landing, and neither dims nor opens a card before a hover', () => {
    const html = render('erc20-bridge');
    expect(html).toContain('href="/academy/x/erc20-bridge"');
    expect(html).toContain('data-course-id="erc20-bridge"');
    expect(html).not.toContain('data-dim');
    expect(html).not.toContain('Learning path');
  });

  it('makes a hover-card trigger of a course with a path, and a plain link otherwise', () => {
    expect(render('erc20-bridge')).toContain('data-state="closed"');
    expect(render('blockchain-fundamentals')).not.toContain('data-state');
    expect(render('erc20-bridge', false)).not.toContain('data-state');
  });
});

describe('CourseMarker and PartDot', () => {
  it('prints the number until the course is completed, then the check with a spoken label', () => {
    expect(renderToStaticMarkup(createElement(CourseMarker, { id: 'intro-to-solidity', completed: false }))).toContain('>11</span>');
    const done = renderToStaticMarkup(createElement(CourseMarker, { id: 'intro-to-solidity', completed: true }));
    expect(done).toContain('lucide-check');
    expect(done).toContain('<span class="sr-only">Completed</span>');
  });

  it('draws the part dot in the part hue, and in ink without one', () => {
    expect(renderToStaticMarkup(createElement(PartDot, { hue: 'purple' }))).toContain('data-hue="purple"');
    expect(renderToStaticMarkup(createElement(PartDot, { hue: null }))).not.toContain('data-hue');
  });
});
