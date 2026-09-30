import { describe, expect, it } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LandingViewProps } from '@/components/academy/landing/academy-views';
import { SpotlightView } from '@/components/academy/landing/spotlight-view';
import { StagesView } from '@/components/academy/landing/stages-view';
import { TreeView } from '@/components/academy/landing/tree-view';
import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { academyCourseUrl, courseNumber } from '@/lib/academy/academy-programme';
import { COURSE_STATS } from '@/lib/academy/course-stats.generated';

const courseStats = { ...COURSE_STATS['avalanche-l1'], ...COURSE_STATS.blockchain };
const render = (View: ComponentType<LandingViewProps>) => renderToStaticMarkup(createElement(View, { courseStats }));
const spotlight = render(SpotlightView);
const tree = render(TreeView);
const stages = render(StagesView);
/** The text a reader sees: tags removed, spaces collapsed. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** Every anchor of the markup, each up to its closing tag. */
const anchors = (html: string) => html.split('<a ').slice(1).map((segment) => `<a ${segment.split('</a>')[0]}</a>`);
/** The anchors of one course, in document order. */
const linksTo = (html: string, id: string) => anchors(html).filter((a) => a.includes(`data-course-id="${id}"`));
/** The class list of a markup segment's first tag. */
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? '').split(' ');
/** The keyboard focus ring: 2 px of ink, 2 px outside the control. */
const FOCUS_RING = ['focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-ac-ink'];

describe('J, the start course spotlight', () => {
  it('features Avalanche Fundamentals: the flat banner, course 01, its facts, the start button', () => {
    expect(spotlight).toContain('academy-fundamentals.webp');
    expect(spotlight).toContain('alt="The Avalanche Fundamentals course banner: a grid of outlined blocks on red, with a white disc and the Avalanche mark"');
    // The default view's largest paint: fetched at once and first, not lazily after layout.
    const banner = spotlight.match(/<img [^>]*>/)?.[0];
    expect(banner).toContain('loading="eager"');
    expect(banner).toContain('fetchPriority="high"');
    expect(text(spotlight)).toContain(
      'Start here Course 01 Avalanche Fundamentals Learn about Avalanche Consensus, Multi-Chain Architecture, and VMs 31 lessons · 4 modules · 1 h · certificate Start the course',
    );
    expect(anchors(spotlight).find((a) => a.includes('>Start the course<'))).toContain('href="/academy/avalanche-l1/avalanche-fundamentals"');
  });

  it('keeps the newcomer line to Blockchain Fundamentals', () => {
    expect(text(spotlight)).toContain('New to blockchain? Begin with Blockchain Fundamentals');
    expect(linksTo(spotlight, 'blockchain-fundamentals')[0]).toContain('href="/academy/blockchain/blockchain-fundamentals"');
  });

  it('lays the four other parts out as lanes with their lines, and drops the lane note', () => {
    expect([...spotlight.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map(([, name]) => name)).toEqual([
      'L1 Development', 'Interoperability', 'VM Customization', 'Applications',
    ]);
    expect(text(spotlight)).toContain('Then choose what to build');
    ['3 courses · 106 lessons · 6 h', '3 courses · 73 lessons · 6 h', '2 courses · 81 lessons · 6 h', '3 courses · 62 lessons · 6 h']
      .forEach((line) => expect(spotlight).toContain(line));
    expect(spotlight).not.toContain('Every lane starts');
  });

  it('lists the eleven lane courses with their number, line and link', () => {
    ACADEMY_COURSES.slice(2).forEach((course) => {
      const [link] = linksTo(spotlight, course.id);
      expect(link, course.id).toContain(`href="${academyCourseUrl(course)}"`);
      expect(link).toContain(`>${courseNumber(course.id)}</span>`);
    });
    expect(text(linksTo(spotlight, 'erc20-bridge')[0])).toBe('07 ERC20 Bridge 21 lessons · 2 h');
  });

  it('keeps the After line on the two joins', () => {
    expect(text(linksTo(spotlight, 'permissionless-l1s')[0])).toBe('05 Permissionless L1s 30 lessons · 2 h After Permissioned L1s and L1 Native Tokenomics');
    expect(text(linksTo(spotlight, 'native-token-bridge')[0])).toBe('08 Native Token Bridge 22 lessons · 2 h After L1 Native Tokenomics and ERC20 Bridge');
  });
});

describe('A, the merged tree', () => {
  it('draws each course twice (the phone column, then the desktop canvas), linked to its course', () => {
    ACADEMY_COURSES.forEach((course) => {
      const links = linksTo(tree, course.id);
      expect(links, course.id).toHaveLength(2);
      links.forEach((link) => expect(link).toContain(`href="${academyCourseUrl(course)}"`));
    });
  });

  it('draws one curve per dependency on a 558 px canvas', () => {
    expect(tree.match(/vector-effect="non-scaling-stroke"/g)).toHaveLength(13);
    expect(tree).toContain('height:558px');
  });

  it('places the cards as the config says: rows 150 px apart, centred on their column', () => {
    expect(tree).toContain('left:33.333%;top:0');
    expect(tree).toContain('left:41.667%;top:300px');
    expect(tree).toContain('left:33.333%;top:450px');
  });

  it('prints the part with its dot, the number, the name and the counts on each card', () => {
    const [phone] = linksTo(tree, 'permissioned-l1s');
    expect(phone).toContain('data-hue="emerald"');
    expect(text(phone)).toBe('L1 Development 03 Permissioned L1s 40 lessons · 7 modules 2 h');
  });

  it('hides the number and the module count between 1024 and 1279 px, where the card is 150 px wide', () => {
    expect(linksTo(tree, 'customizing-evm')[1].match(/lg:max-xl:hidden/g)).toHaveLength(2);
    expect(tree).toContain('w-[150px]');
    expect(tree).toContain('xl:w-[186px]');
  });

  it('opens hover cards from the desktop canvas only', () => {
    const [phone, desktop] = linksTo(tree, 'erc20-bridge');
    expect(phone).not.toContain('data-state');
    expect(desktop).toContain('data-state="closed"');
  });
});

describe('F, the stage columns', () => {
  it('names the three stages with their lines', () => {
    expect([...stages.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(([, name]) => name)).toEqual(['Foundations', 'Core', 'Advanced']);
    ['3 courses · 85 lessons · 3 h', '6 courses · 197 lessons · 15 h', '4 courses · 95 lessons · 8 h'].forEach((line) => expect(stages).toContain(line));
  });

  it('writes each row as number, name, part and line, the start course tagged, a join with its After line', () => {
    expect(text(linksTo(stages, 'avalanche-fundamentals')[0])).toBe('01 Avalanche Fundamentals Start Fundamentals · 31 lessons · 1 h');
    expect(text(linksTo(stages, 'intro-to-solidity')[0])).toBe('11 Intro to Solidity Applications · 30 lessons · 1 h');
    expect(text(linksTo(stages, 'native-token-bridge')[0])).toBe(
      '08 Native Token Bridge Interoperability · 22 lessons · 2 h After L1 Native Tokenomics and ERC20 Bridge',
    );
  });
});

describe('every view', () => {
  const VIEWS: Array<[string, string]> = [['J', spotlight], ['A', tree], ['F', stages]];

  it.each(VIEWS)('%s renders no Lucide icon at server render', (_view, html) => {
    expect(html).not.toContain('lucide');
  });

  it.each(VIEWS)('%s draws the 2 px ink focus ring on every course link', (_view, html) => {
    const courseLinks = anchors(html).filter((a) => a.includes('data-course-id='));
    expect(courseLinks.length).toBeGreaterThan(0);
    courseLinks.forEach((a) => expect(classesOf(a)).toEqual(expect.arrayContaining(FOCUS_RING)));
  });

  it.each(VIEWS)('%s dims nothing and marks nothing completed before mount', (_view, html) => {
    expect(html).not.toContain('data-dim');
    expect(html).not.toContain('Completed');
  });
});
