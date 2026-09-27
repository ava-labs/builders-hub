import { describe, expect, it } from 'vitest';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Folder, Node } from 'fumadocs-core/page-tree';
import { withModuleNumbers } from '@/components/academy/sidebar/module-numbers';
import { accessRestriction, foundations, fundamentals, permissionless, skeleton, team1, track, tree } from './helpers/tree-fixtures';

const numbered = withModuleNumbers(tree(track('Avalanche L1', fundamentals, permissionless, accessRestriction), track('Entrepreneur', foundations), track('Team1 Academy', team1), track('Blockchain', skeleton)));
const course = (t: number, c: number) => (numbered.children[t] as Folder).children[c] as Folder;
const label = (name: ReactNode) => renderToStaticMarkup(createElement(Fragment, null, name));
/** Each heading of a course as the sidebar prints it: "<number> <name>" or the bare name. */
const headings = (f: Folder) =>
  f.children
    .filter((n): n is Exclude<Node, { type: 'page' }> => n.type !== 'page')
    .map((n) => label(n.name).replace(/<span data-academy-part="module-number"[^>]*>([^<]+)<\/span>/, '$1'));

describe('withModuleNumbers', () => {
  it('numbers module headings and leaves the completion heading alone', () => {
    expect(headings(course(0, 0))).toEqual(['01 Primer on Avalanche Consensus', '02 Multi-Chain Architecture', 'Course Completion']);
  });

  it('numbers a plain folder module on its folder row', () => {
    expect(headings(course(0, 1))).toEqual(['01 Review', '02 Transformation Requirements', '03 Permissioned L1 Setup', '04 Staking Manager Setup']);
  });

  it('leaves spacers, group headings and certificate headings without a number', () => {
    expect(headings(course(0, 2))).toEqual([
      '', '📘 FUNDAMENTALS', '01 Introduction', 'Fundamentals Certificate', '', '🔬 ADVANCED TOPICS', '02 User Error', 'Advanced Certificate',
    ]);
  });

  it('uses the Entrepreneur folder numbers', () => {
    expect(headings(course(1, 0)).slice(0, 3)).toEqual(['01 Legal Foundations', '01b Security Fundamentals', '02 Business Model Canvas']);
  });

  it('keeps the number whole and lets a long name wrap beside it, as the round 8 stills show', () => {
    const primer = course(0, 0).children[1];
    const html = label(primer.type === 'separator' ? primer.name : '');
    expect(html).toMatch(/^<span data-academy-part="module-number" class="[^"]*">01<\/span> Primer on Avalanche Consensus$/);
    expect(html).not.toMatch(/truncate|overflow|ellipsis|nowrap/);
    expect(/data-academy-part="module-number" class="([^"]*)"/.exec(html)?.[1]).not.toMatch(/truncate|overflow/);
  });

  it('marks the number for the harness and keeps pages and courses without modules as they are', () => {
    const primer = course(0, 0).children[1];
    expect(primer.type).toBe('separator');
    expect(label(primer.type === 'separator' ? primer.name : '')).toContain('data-academy-part="module-number"');
    expect(course(0, 0).children[0]).toBe(fundamentals.children[0]);
    expect(course(2, 0)).toBe(team1);
    expect(course(3, 0)).toBe(skeleton);
  });
});
