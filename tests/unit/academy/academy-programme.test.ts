import { describe, expect, it } from 'vitest';
import {
  ACADEMY_COURSES,
  ACADEMY_PARTS,
  ACADEMY_STAGES,
  NEWCOMER_COURSE_ID,
  START_COURSE_ID,
} from '@/components/academy/learning-path-configs/academy.config';
import {
  academyCourse,
  academyCourseBySlug,
  academyCourseOfPathname,
  academyCourseUrl,
  academyPart,
  courseFolder,
  courseLine,
  courseLineWithModules,
  courseNumber,
  coursesOfPart,
  coursesOfStage,
  durationHours,
  groupFacts,
  groupLine,
  hasPathToShow,
  joinsLine,
  learningPath,
  nextActive,
  pathCourseIds,
  programmeLine,
} from '@/lib/academy/academy-programme';
import { getCourseOutlines } from '@/lib/academy/course-outline';
import { COURSE_STATS } from '@/lib/academy/course-stats.generated';
import { getCourseDurations } from '@/content/courses';
import { loadAcademyTree } from './helpers/content-tree';

const ids = (courses: readonly { id: string }[]) => courses.map((course) => course.id);
const outlines = getCourseOutlines(loadAcademyTree());
// The 13 courses live under two url segments, so their stats come from both maps.
const STATS = { ...COURSE_STATS['avalanche-l1'], ...COURSE_STATS.blockchain };
const DURATIONS = getCourseDurations();
const course = (id: string) => ({ kind: 'course', id });

describe('the Academy programme config', () => {
  it('lists the 13 courses of the two merged trees in reading order', () => {
    expect(ids(ACADEMY_COURSES)).toEqual([
      'avalanche-fundamentals', 'blockchain-fundamentals',
      'permissioned-l1s', 'l1-native-tokenomics', 'permissionless-l1s',
      'interchain-messaging', 'erc20-bridge', 'native-token-bridge',
      'customizing-evm', 'access-restriction',
      'intro-to-solidity', 'x402-payment-infrastructure', 'encrypted-erc',
    ]);
  });

  it('keeps every course url: each slug is a course folder in content/academy', () => {
    const urls = new Set(outlines.map((outline) => outline.url));
    ACADEMY_COURSES.forEach((entry) => expect(urls.has(academyCourseUrl(entry)), entry.slug).toBe(true));
  });

  it('names the five parts in order, each with its courses', () => {
    expect(ACADEMY_PARTS.map((part) => [part.name, ids(coursesOfPart(part.id))])).toEqual([
      ['Fundamentals', ['avalanche-fundamentals', 'blockchain-fundamentals']],
      ['L1 Development', ['permissioned-l1s', 'l1-native-tokenomics', 'permissionless-l1s']],
      ['Interoperability', ['interchain-messaging', 'erc20-bridge', 'native-token-bridge']],
      ['VM Customization', ['customizing-evm', 'access-restriction']],
      ['Applications', ['intro-to-solidity', 'x402-payment-infrastructure', 'encrypted-erc']],
    ]);
  });

  it('gives each part its hue: ink for Fundamentals, then emerald, purple, blue and gold', () => {
    expect(ACADEMY_PARTS.map((part) => part.hue)).toEqual([null, 'emerald', 'purple', 'blue', 'gold']);
  });

  it('puts the courses in the three stages as drawn, rows in number order', () => {
    expect(ACADEMY_STAGES.map((stage) => [stage.name, ids(coursesOfStage(stage.id))])).toEqual([
      ['Foundations', ['avalanche-fundamentals', 'blockchain-fundamentals', 'intro-to-solidity']],
      ['Core', ['permissioned-l1s', 'l1-native-tokenomics', 'interchain-messaging', 'customizing-evm', 'x402-payment-infrastructure', 'encrypted-erc']],
      ['Advanced', ['permissionless-l1s', 'erc20-bridge', 'native-token-bridge', 'access-restriction']],
    ]);
  });

  it('keeps the dependencies of the two old configs', () => {
    expect(Object.fromEntries(ACADEMY_COURSES.map((entry) => [entry.id, entry.dependencies]))).toEqual({
      'avalanche-fundamentals': [],
      'blockchain-fundamentals': [],
      'permissioned-l1s': ['avalanche-fundamentals'],
      'l1-native-tokenomics': ['avalanche-fundamentals'],
      'permissionless-l1s': ['permissioned-l1s', 'l1-native-tokenomics'],
      'interchain-messaging': ['avalanche-fundamentals'],
      'erc20-bridge': ['interchain-messaging'],
      'native-token-bridge': ['l1-native-tokenomics', 'erc20-bridge'],
      'customizing-evm': ['avalanche-fundamentals'],
      'access-restriction': ['customizing-evm'],
      'intro-to-solidity': ['blockchain-fundamentals'],
      'x402-payment-infrastructure': ['intro-to-solidity'],
      'encrypted-erc': ['intro-to-solidity'],
    });
  });

  it('places the merged tree on four rows of six columns, as the design round drew it', () => {
    expect(Object.fromEntries(ACADEMY_COURSES.map((entry) => [entry.id, [entry.tree.x, entry.tree.row]]))).toEqual({
      'avalanche-fundamentals': [33.333, 0],
      'blockchain-fundamentals': [83.333, 0],
      'permissioned-l1s': [8.333, 1],
      'l1-native-tokenomics': [25, 1],
      'permissionless-l1s': [16.667, 2],
      'interchain-messaging': [41.667, 1],
      'erc20-bridge': [41.667, 2],
      'native-token-bridge': [33.333, 3],
      'customizing-evm': [58.333, 1],
      'access-restriction': [58.333, 2],
      'intro-to-solidity': [83.333, 1],
      'x402-payment-infrastructure': [75, 2],
      'encrypted-erc': [91.667, 2],
    });
  });

  it('starts at Avalanche Fundamentals and offers Blockchain Fundamentals to newcomers', () => {
    expect(academyCourse(START_COURSE_ID).name).toBe('Avalanche Fundamentals');
    expect(academyCourse(NEWCOMER_COURSE_ID).name).toBe('Blockchain Fundamentals');
  });
});

describe('programme lookups', () => {
  it('numbers the courses 01 to 13 in reading order', () => {
    expect(ACADEMY_COURSES.map((entry) => courseNumber(entry.id))).toEqual(
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'],
    );
    expect(courseNumber('intro-to-solidity')).toBe('11');
  });

  it('finds a course by slug, and throws on an id the config does not list', () => {
    expect(academyCourseBySlug('blockchain/solidity-foundry')?.id).toBe('intro-to-solidity');
    expect(academyCourseBySlug('blockchain/nft-deployment')).toBeNull();
    expect(academyCourseBySlug('team1/team1-fundamentals')).toBeNull();
    expect(() => academyCourse('nft-deployment')).toThrow('Unknown Academy course: nft-deployment');
  });

  it('finds a part by its id', () => {
    expect(academyPart('applications').hue).toBe('gold');
  });

  it('keys content/courses.tsx by the course folder', () => {
    expect(courseFolder(academyCourse('intro-to-solidity'))).toBe('solidity-foundry');
  });

  it('writes the After line on the two joins only', () => {
    expect(ACADEMY_COURSES.flatMap((entry) => { const line = joinsLine(entry); return line ? [[entry.id, line]] : []; })).toEqual([
      ['permissionless-l1s', 'After Permissioned L1s and L1 Native Tokenomics'],
      ['native-token-bridge', 'After L1 Native Tokenomics and ERC20 Bridge'],
    ]);
  });
});

describe('learningPath', () => {
  it.each([
    ['avalanche-fundamentals', 'blockchain-fundamentals', [course('avalanche-fundamentals')]],
    ['blockchain-fundamentals', null, [course('blockchain-fundamentals')]],
    ['permissioned-l1s', 'blockchain-fundamentals', [course('avalanche-fundamentals'), course('permissioned-l1s')]],
    ['l1-native-tokenomics', 'blockchain-fundamentals', [course('avalanche-fundamentals'), course('l1-native-tokenomics')]],
    ['permissionless-l1s', 'blockchain-fundamentals', [
      course('avalanche-fundamentals'),
      { kind: 'branches', branches: [['permissioned-l1s'], ['l1-native-tokenomics']] },
      course('permissionless-l1s'),
    ]],
    ['interchain-messaging', 'blockchain-fundamentals', [course('avalanche-fundamentals'), course('interchain-messaging')]],
    ['erc20-bridge', 'blockchain-fundamentals', [course('avalanche-fundamentals'), course('interchain-messaging'), course('erc20-bridge')]],
    ['native-token-bridge', 'blockchain-fundamentals', [
      course('avalanche-fundamentals'),
      { kind: 'branches', branches: [['l1-native-tokenomics'], ['interchain-messaging', 'erc20-bridge']] },
      course('native-token-bridge'),
    ]],
    ['customizing-evm', 'blockchain-fundamentals', [course('avalanche-fundamentals'), course('customizing-evm')]],
    ['access-restriction', 'blockchain-fundamentals', [course('avalanche-fundamentals'), course('customizing-evm'), course('access-restriction')]],
    ['intro-to-solidity', null, [course('blockchain-fundamentals'), course('intro-to-solidity')]],
    ['x402-payment-infrastructure', null, [course('blockchain-fundamentals'), course('intro-to-solidity'), course('x402-payment-infrastructure')]],
    ['encrypted-erc', null, [course('blockchain-fundamentals'), course('intro-to-solidity'), course('encrypted-erc')]],
  ])('%s', (id, optional, steps) => {
    expect(learningPath(id)).toEqual({ optional, steps });
  });

  it('lights the whole path, its optional first step included', () => {
    expect([...pathCourseIds(learningPath('native-token-bridge'))].sort()).toEqual([
      'avalanche-fundamentals', 'blockchain-fundamentals', 'erc20-bridge', 'interchain-messaging', 'l1-native-tokenomics', 'native-token-bridge',
    ]);
  });

  it('has a path to show for every course but Blockchain Fundamentals, which has nothing before it', () => {
    expect(ACADEMY_COURSES.filter((entry) => !hasPathToShow(learningPath(entry.id))).map((entry) => entry.id)).toEqual(['blockchain-fundamentals']);
  });
});

describe('nextActive', () => {
  it('opens a course, and a close clears only the course it belongs to', () => {
    expect(nextActive(null, 'erc20-bridge', true)).toBe('erc20-bridge');
    expect(nextActive('erc20-bridge', 'erc20-bridge', false)).toBeNull();
    expect(nextActive('interchain-messaging', 'erc20-bridge', true)).toBe('erc20-bridge');
    // A late close from the course just left never clears the one just opened.
    expect(nextActive('interchain-messaging', 'erc20-bridge', false)).toBe('interchain-messaging');
  });
});

describe('facts', () => {
  it('finds every Academy duration written in whole hours', () => {
    ACADEMY_COURSES.forEach((entry) => expect(DURATIONS[courseFolder(entry)], entry.id).toMatch(/^\d+ hours?$/));
    expect([durationHours('1 hour'), durationHours('4 hours'), durationHours(undefined), durationHours('45 minutes')]).toEqual([1, 4, 0, 0]);
  });

  it('totals the programme: 13 courses, 377 lessons, 26 hours', () => {
    expect(programmeLine(groupFacts(ACADEMY_COURSES, STATS, DURATIONS))).toBe('13 courses · 377 lessons · 26 hours');
  });

  it('writes the line of each lane', () => {
    expect(ACADEMY_PARTS.slice(1).map((part) => groupLine(groupFacts(coursesOfPart(part.id), STATS, DURATIONS)))).toEqual([
      '3 courses · 106 lessons · 6 h',
      '3 courses · 73 lessons · 6 h',
      '2 courses · 81 lessons · 6 h',
      '3 courses · 62 lessons · 6 h',
    ]);
  });

  it('writes the line of each stage', () => {
    expect(ACADEMY_STAGES.map((stage) => groupLine(groupFacts(coursesOfStage(stage.id), STATS, DURATIONS)))).toEqual([
      '3 courses · 85 lessons · 3 h',
      '6 courses · 197 lessons · 15 h',
      '4 courses · 95 lessons · 8 h',
    ]);
  });

  it('writes a course line with and without modules', () => {
    const stats = STATS[academyCourseUrl(academyCourse('avalanche-fundamentals'))];
    expect(courseLine(stats, '1 hour')).toBe('31 lessons · 1 h');
    expect(courseLineWithModules(stats, '1 hour')).toBe('31 lessons · 4 modules · 1 h');
    expect(courseLine(undefined, '2 hours')).toBe('2 h');
  });

  it('finds the certificate page the spotlight names on the start course', () => {
    const url = academyCourseUrl(academyCourse(START_COURSE_ID));
    expect(outlines.find((outline) => outline.url === url)?.certificateUrl).toBeTruthy();
  });
});

describe('academyCourseOfPathname', () => {
  it.each([
    ['/academy/avalanche-l1/avalanche-fundamentals', 'avalanche-fundamentals'],
    ['/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1', 'avalanche-fundamentals'],
    ['/academy/blockchain/solidity-foundry/03-smart-contracts/01-building-programs-on-blockchain', 'intro-to-solidity'],
    ['/academy/avalanche-l1/erc20-bridge/certificate', 'erc20-bridge'],
  ])('%s belongs to %s', (pathname, id) => {
    expect(academyCourseOfPathname(pathname)?.id).toBe(id);
  });

  it.each([
    '/academy',
    '/academy/avalanche-l1',
    '/academy/team1/team1-fundamentals',
    '/academy/avalanche-l1/avalanche-fundamentals-extra',
    '/docs/avalanche-l1/avalanche-fundamentals',
  ])('%s belongs to none of the 13', (pathname) => {
    expect(academyCourseOfPathname(pathname)).toBeNull();
  });
});
