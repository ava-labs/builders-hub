import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseFacts, CourseHeader } from '@/components/academy/course/course-header';
import { courseDiscipline } from '@/lib/academy/course-discipline';
import { getCourseOutlines, type CourseOutline } from '@/lib/academy/course-outline';
import { fundamentals, team1, track, tree } from './helpers/tree-fixtures';

const [l1, t1] = getCourseOutlines(tree(track('Avalanche L1', fundamentals), track('Team1 Academy', team1)));
const facts = (outline: CourseOutline, duration: string | undefined) =>
  renderToStaticMarkup(createElement(CourseFacts, { outline, duration }));

describe('CourseHeader', () => {
  it('shows the hue tile and "Course · <part>"', () => {
    const html = renderToStaticMarkup(createElement(CourseHeader, { discipline: courseDiscipline('avalanche-l1', 'interchain-messaging') }));
    expect(html).toContain('data-hue="purple"');
    expect(html).toContain('bg-ac-t text-ac-h');
    expect(html).toContain('<svg');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Course·Interoperability');
  });

  it('draws the Fundamentals tile in ink, with no hue', () => {
    const html = renderToStaticMarkup(createElement(CourseHeader, { discipline: courseDiscipline('avalanche-l1', 'avalanche-fundamentals') }));
    expect(html).not.toContain('data-hue');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Course·Fundamentals');
  });

  it('shows "Course" alone without a discipline', () => {
    const html = renderToStaticMarkup(createElement(CourseHeader, { discipline: null }));
    expect(html).not.toContain('data-hue');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Course');
  });
});

describe('CourseFacts', () => {
  it('lists modules, lessons, the duration and the certificate, then Start course to the first lesson', () => {
    const html = facts(l1, '1.5 hours');
    const text = html.replace(/<[^>]+>/g, '|').split('|').map((s) => s.trim()).filter(Boolean);
    expect(text).toEqual(['2', 'modules', '5', 'lessons', '1.5', 'hours', 'Certificate', 'Start course']);
    expect(html).toContain('href="/academy/avalanche-l1/avalanche-fundamentals/02-avalanche-consensus-intro/01-avalanche-consensus-intro"');
    expect(html).toContain('bg-ac-ink');
    expect(html).toContain('font-ac-mono');
  });

  it('uses the singular for one module and one lesson', () => {
    const [lesson] = l1.lessons;
    const one: CourseOutline = { ...l1, modules: [{ ...l1.modules[0], lessons: [lesson] }], lessons: [lesson] };
    const text = facts(one, '1 hour').replace(/<[^>]+>/g, '|').split('|').map((s) => s.trim()).filter(Boolean);
    expect(text).toEqual(['1', 'module', '1', 'lesson', '1', 'hour', 'Certificate', 'Start course']);
  });

  it('leaves out the modules, the duration and the certificate a course does not have (Team1)', () => {
    const text = facts(t1, undefined).replace(/<[^>]+>/g, '|').split('|').map((s) => s.trim()).filter(Boolean);
    expect(text).toEqual(['3', 'lessons', 'Start course']);
  });

  it('keeps a duration it cannot split as one label', () => {
    expect(facts(t1, 'Self-paced')).toContain('Self-paced');
  });
});
