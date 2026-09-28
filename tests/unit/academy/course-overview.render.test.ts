import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseModules } from '@/components/academy/course/course-modules';
import { CourseCertificateCard } from '@/components/academy/course/course-certificate-card';
import { getCourseOutlines } from '@/lib/academy/course-outline';
import { foundations, permissionless, team1, track, tree } from './helpers/tree-fixtures';

const [l1, ent, t1] = getCourseOutlines(tree(track('Avalanche L1', permissionless), track('Entrepreneur', foundations), track('Team1 Academy', team1)));
const modules = (outline = l1) => renderToStaticMarkup(createElement(CourseModules, { outline }));
const card = (afterModules: boolean, courseTitle = 'Foundations of a Web3 Venture') =>
  renderToStaticMarkup(createElement(CourseCertificateCard, {
    academy: 'Entrepreneur Academy', courseTitle, href: '/academy/entrepreneur/foundations-web3-venture/certificate', label: 'Course Completion Certificate', afterModules,
  }));

describe('CourseModules', () => {
  it('lists every module as a numbered tile with its lesson count, linking to its first lesson', () => {
    const html = modules();
    expect(html).toContain('>Modules</h2>');
    expect(html.match(/<a /g)).toHaveLength(4);
    expect(html).toContain('href="/academy/avalanche-l1/permissionless-l1s/04-speedrun-base-l1/01-create-l1-speedrun"');
    expect(html).toContain('>03</span>');
    expect(html).toContain('Permissioned L1 Setup<span');
    expect(html).toContain('>2 lessons</span>');
    expect(html).toContain('>1 lesson</span>');
  });

  it('uses the Entrepreneur folder numbers', () => {
    const numbers = [...modules(ent).matchAll(/font-ac-mono[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(numbers).toEqual(['01', '01b', '02']);
  });

  it('renders nothing for a course without modules', () => {
    expect(modules(t1)).toBe('');
  });
});

describe('CourseCertificateCard', () => {
  it('draws the certificate with the line and the link text of the certificate page', () => {
    const html = card(true);
    expect(html).toContain('>Certificate</h2>');
    expect(html).toContain('href="/academy/entrepreneur/foundations-web3-venture/certificate"');
    expect(html).toContain('<svg');
    expect(html).toContain('>FOUNDATIONS OF A</tspan>');
    expect(html).toContain('Answer every quiz in this course correctly to earn this certificate.');
    expect(html).toContain('Course Completion Certificate<svg');
  });

  it('sits 8 px under the Modules list and 40 px under the body otherwise', () => {
    expect(card(true)).toMatch(/data-academy-part="course-certificate" class="mb-9 mt-2"/);
    expect(card(false)).toMatch(/data-academy-part="course-certificate" class="mb-9 mt-10"/);
  });
});
