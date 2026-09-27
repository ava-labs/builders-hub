import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LessonEyebrow } from '@/components/academy/lesson/lesson-eyebrow';
import { getCourseOutlines, lessonPosition } from '@/lib/academy/course-outline';
import { folder, page, sep, team1, track, tree } from './helpers/tree-fixtures';

const BC = '/academy/blockchain/blockchain-fundamentals';
const LONG = 'Transaction Ordering Through Consensus'; // the longest module name in the Academy, 38 characters
const course = folder('Blockchain Fundamentals', [
  page(BC, 'Welcome'),
  sep(LONG),
  page(`${BC}/04-tx-ordering-through-consensus/01-the-problem`, 'The Problem: Competing Chains'),
  page(`${BC}/04-tx-ordering-through-consensus/02-longest-chain-consensus`, 'Longest Chain Consensus'),
  page(`${BC}/04-tx-ordering-through-consensus/03-finality`, 'Finality'),
  sep('Course Completion'),
  page(`${BC}/get-certificate`, 'Course Completion Certificate'),
], true);
const [outline, team1Outline] = getCourseOutlines(tree(track('Blockchain', course), track('Team1 Academy', team1)));

const render = (url: string, title: string, o = outline) => {
  const position = lessonPosition(o, url);
  if (!position) throw new Error(`no position for ${url}`);
  return renderToStaticMarkup(createElement(LessonEyebrow, { outline: o, position, lessonTitle: title }));
};
/** The markup of the element whose opening tag carries `marker`, up to its first closing tag. */
const tagWith = (html: string, marker: string) => html.slice(html.lastIndexOf('<', html.indexOf(marker)), html.indexOf('>', html.indexOf(marker)) + 1);

describe('LessonEyebrow markup', () => {
  const html = render(`${BC}/04-tx-ordering-through-consensus/02-longest-chain-consensus`, 'Longest Chain Consensus');

  it('truncates a long module name with an ellipsis and keeps the full name in its title', () => {
    const moduleTag = tagWith(html, `title="${LONG}"`);
    expect(moduleTag).toContain('truncate');
    expect(moduleTag).toContain('min-w-0');
    expect(html).toContain(`>${LONG}</span>`);
  });

  it('keeps every segment on one line', () => {
    expect(tagWith(html, '>Lesson 2 of 3')).toContain('whitespace-nowrap');
    expect(html).toContain('>Lesson 2 of 3</span>');
  });

  it('never wraps from 1024 px: the module segment truncates and the position keeps its width', () => {
    const eyebrowTag = tagWith(html, 'data-academy-part="eyebrow"');
    expect(eyebrowTag).toContain('lg:flex-nowrap');
    expect(eyebrowTag).not.toContain('lg:flex-wrap');
    expect(tagWith(html, '>Lesson 2 of 3')).not.toMatch(/truncate|min-w-0/);
  });

  it('names the course only below 1024 px (R6)', () => {
    expect(tagWith(html, '>Blockchain Fundamentals</b>')).toContain('lg:hidden');
  });

  it('draws one step per lesson with the current one marked', () => {
    expect(html.match(/data-step="/g)).toHaveLength(3);
    expect(html.match(/data-step="(\w+)"/g)).toEqual(['data-step="past"', 'data-step="now"', 'data-step="next"']);
    expect(html).toContain('aria-hidden="true"');
  });

  it('shows only the position when the title names the module, and counts within a Team1 course', () => {
    const titled = render(`${BC}/04-tx-ordering-through-consensus/01-the-problem`, `${LONG} explained`);
    expect(titled).not.toContain(`title="${LONG}"`);
    const t1 = render('/academy/team1/team1-fundamentals/02-origins-from-ambassadors-to-team1/02-origins', 'Origins', team1Outline);
    expect(t1).toContain('>Lesson 2 of 3</span>');
    expect(t1).toContain('>Team1 Fundamentals</b>');
  });
});
