import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getCourseOutlines, lessonPosition } from '@/lib/academy/course-outline';
import { loadAcademyTree } from './helpers/content-tree';

// Every course in content/academy, through the same page-tree builder the site uses. Only
// invariants are asserted, so adding or moving lessons never breaks this test.
const CONTENT = fileURLToPath(new URL('../../../content/academy/', import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));
const urlOf = (file: string): string =>
  `/academy/${relative(CONTENT, file).replace(/\.mdx$/, '').replace(/\/index$/, '')}`;

const all = files(CONTENT);
const courseMetaCount = all.filter((f) => f.endsWith('meta.json') && JSON.parse(readFileSync(f, 'utf8')).root === true).length;
const certificatePages = all.filter((f) => f.endsWith('.mdx') && readFileSync(f, 'utf8').includes('<CertificatePage')).map(urlOf);
const outlines = getCourseOutlines(loadAcademyTree());

describe('course outlines of every course in content/academy', () => {
  it('builds one outline per root course folder', () => {
    expect(courseMetaCount).toBeGreaterThan(0);
    expect(outlines).toHaveLength(courseMetaCount);
  });

  it('gives every course lessons, and every module at least one lesson of that course', () => {
    for (const o of outlines) {
      const urls = o.lessons.map((l) => l.url);
      expect(o.url, o.url).toBe(`/academy/${o.track}/${o.slug}`);
      expect(o.lessons.length, o.url).toBeGreaterThan(0);
      for (const m of o.modules) {
        expect(m.lessons.length, `${o.url} ${m.name}`).toBeGreaterThan(0);
        expect(m.firstUrl).toBe(m.lessons[0].url);
        m.lessons.forEach((l) => expect(urls, `${o.url} ${l.url}`).toContain(l.url));
      }
    }
  });

  it('keeps the index and every certificate page out of the lessons, with no eyebrow position', () => {
    expect(certificatePages.length).toBeGreaterThan(0);
    for (const o of outlines) {
      const urls = o.lessons.map((l) => l.url);
      expect(urls, o.url).not.toContain(o.url);
      expect(lessonPosition(o, o.url)).toBeNull();
      certificatePages.filter((c) => c.startsWith(`${o.url}/`)).forEach((c) => {
        expect(urls, c).not.toContain(c);
        expect(lessonPosition(o, c), c).toBeNull();
      });
      expect(o.certificateUrl === null || certificatePages.includes(o.certificateUrl), o.url).toBe(true);
    }
  });

  it('gives a certificate to every course that has a certificate page, and none to the others', () => {
    for (const o of outlines) {
      const hasPage = certificatePages.some((c) => c.startsWith(`${o.url}/`));
      expect(o.certificateUrl !== null, o.url).toBe(hasPage);
    }
  });

  it('places every lesson, and numbers modules in sidebar order or by Entrepreneur folder', () => {
    for (const o of outlines) {
      o.lessons.forEach((l) => expect(lessonPosition(o, l.url), l.url).not.toBeNull());
      const numbers = o.modules.map((m) => m.number);
      if (o.track === 'entrepreneur') {
        numbers.forEach((n) => expect(n, o.url).toMatch(/^\d{2}[a-z]?$/));
        expect(new Set(numbers).size, o.url).toBe(numbers.length);
      } else {
        expect(numbers, o.url).toEqual(o.modules.map((_, i) => String(i + 1).padStart(2, '0')));
      }
    }
  });

  it('gives the Team1 courses lessons without modules or certificates', () => {
    const team1 = outlines.filter((o) => o.track === 'team1');
    expect(team1.length).toBeGreaterThan(0);
    team1.forEach((o) => expect([o.modules.length, o.certificateUrl]).toEqual([0, null]));
  });
});
