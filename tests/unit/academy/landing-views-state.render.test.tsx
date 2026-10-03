import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TreeView } from '@/components/academy/landing/tree-view';
import { ACADEMY_COURSES } from '@/components/academy/learning-path-configs/academy.config';
import { courseNumber } from '@/lib/academy/academy-programme';
import { COURSE_STATS } from '@/lib/academy/course-stats.generated';

// After mount, on a desktop pointer: Native Token Bridge's path shows and ERC20 Bridge is completed. The server
// render never gets there (the media query and IndexedDB answer after mount), so the two hooks the views read
// return that state. The rest of course-state stays real; CourseLink reads the module's own hooks, so its links do not dim here.
const { ACTIVE, COMPLETED } = vi.hoisted(() => ({ ACTIVE: 'native-token-bridge', COMPLETED: 'erc20-bridge' }));

vi.mock('@/components/academy/landing/course-state', async (importOriginal) => {
  const { learningPath, pathCourseIds } = await import('@/lib/academy/academy-programme');
  const lit = pathCourseIds(learningPath(ACTIVE));
  const completion = new Map([[COMPLETED, true]]);
  return {
    ...(await importOriginal<typeof import('@/components/academy/landing/course-state')>()),
    useLandingState: () => ({ active: ACTIVE, lit, canHover: true, completion, setActive: () => undefined }),
    useCourseState: (id: string) => ({ dimmed: !lit.has(id), completed: completion.get(id) === true }),
  };
});

const courseStats = { ...COURSE_STATS['avalanche-l1'], ...COURSE_STATS.blockchain };
const tree = renderToStaticMarkup(createElement(TreeView, { courseStats }));
/** The class list of a markup segment's first tag. */
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? '').split(' ');
/** The anchors of one course, each up to its closing tag: the phone column's, then the desktop canvas's. */
const linksTo = (id: string) =>
  tree.split('<a ').slice(1).map((segment) => `<a ${segment.split('</a>')[0]}</a>`).filter((a) => a.includes(`data-course-id="${id}"`));

/** Every curve as "prerequisite>course", in the order treeEdges draws them: course by course, as the config lists them. */
const CURVE_NAMES = ACADEMY_COURSES.flatMap((course) => course.dependencies.map((from) => `${from}>${course.id}`));
const curves = [...tree.matchAll(/<path [^>]*vector-effect="non-scaling-stroke"[^>]*>/g)].map(([tag], index) => ({ name: CURVE_NAMES[index], tag }));
/** The names of the curves whose tag passes a test. */
const curvesWith = (test: (tag: string) => boolean) => curves.filter(({ tag }) => test(tag)).map(({ name }) => name);
/** The phone column's arrows, each with the course it points into (the first course has none). */
const phoneArrows = tree
  .split('<li class="relative">')
  .slice(1)
  .flatMap((item) => {
    const arrow = item.match(/^<svg [^>]*>/)?.[0];
    const id = item.match(/data-course-id="([^"]+)"/)?.[1];
    return arrow && id ? [{ id, classes: classesOf(arrow) }] : [];
  });

/** Native Token Bridge's path: the curves with both ends on it. */
const ON_PATH = [
  'avalanche-fundamentals>l1-native-tokenomics',
  'avalanche-fundamentals>interchain-messaging',
  'interchain-messaging>erc20-bridge',
  'l1-native-tokenomics>native-token-bridge',
  'erc20-bridge>native-token-bridge',
];
/** The one curve into the completed course. */
const INTO_COMPLETED = ['interchain-messaging>erc20-bridge'];

describe('A, the merged tree, once a path shows and a course is completed', () => {
  it('draws one curve per prerequisite', () => {
    expect(curves).toHaveLength(CURVE_NAMES.length);
  });

  it('dims every curve with an end off the path, and no curve on it', () => {
    expect(curvesWith((tag) => !tag.includes('data-dim'))).toEqual(ON_PATH);
    expect(curvesWith((tag) => tag.includes('data-dim="true"'))).toEqual(CURVE_NAMES.filter((name) => !ON_PATH.includes(name)));
  });

  it('draws the curve into the completed course in the ok token at 1.5 px with the ok arrow, every other in the line token', () => {
    const others = CURVE_NAMES.filter((name) => !INTO_COMPLETED.includes(name));
    expect(curvesWith((tag) => classesOf(tag).includes('stroke-ac-ok'))).toEqual(INTO_COMPLETED);
    expect(curvesWith((tag) => classesOf(tag).includes('stroke-ac-line'))).toEqual(others);
    expect(curvesWith((tag) => tag.includes('stroke-width="1.5"'))).toEqual(INTO_COMPLETED);
    expect(curvesWith((tag) => tag.includes('marker-end="url(#academy-tree-arrow-ok)"'))).toEqual(INTO_COMPLETED);
    expect(curvesWith((tag) => tag.includes('marker-end="url(#academy-tree-arrow)"'))).toEqual(others);
  });

  it('draws the phone arrow into the completed course in the ok token, every other in the line token', () => {
    const into = (token: string) => phoneArrows.filter(({ classes }) => classes.includes(token)).map(({ id }) => id);
    expect(into('text-ac-ok')).toEqual([COMPLETED]);
    expect(into('text-ac-line')).toEqual(ACADEMY_COURSES.slice(1).map(({ id }) => id).filter((id) => id !== COMPLETED));
  });

  it('keeps the completed check on the desktop card between 1024 and 1279 px, where only the module count hides', () => {
    const desktop = linksTo(COMPLETED)[1];
    const check = desktop.match(/<span class="[^"]*\bbg-ac-ok\b[^"]*">/)?.[0] ?? '';
    expect(classesOf(check)).toContain('ml-auto');
    expect(classesOf(check)).not.toContain('lg:max-xl:hidden');
    expect(desktop).toContain('>Completed</span>');
    expect(desktop).not.toContain(`>${courseNumber(COMPLETED)}</span>`);
    expect(desktop.match(/lg:max-xl:hidden/g)).toHaveLength(1);
  });
});
