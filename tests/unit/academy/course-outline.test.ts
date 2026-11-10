import { describe, expect, it } from 'vitest';
import {
  findCourseOutline,
  getCourseOutlines,
  getCourseStats,
  lessonPosition,
  moduleHeads,
} from '@/lib/academy/course-outline';
import {
  accessRestriction,
  erc20,
  foundations,
  fundamentals,
  permissionless,
  skeleton,
  team1,
  tokenomics,
  track,
  tree,
} from './helpers/tree-fixtures';

const academy = tree(
  track('Avalanche L1', fundamentals, permissionless, accessRestriction, tokenomics, erc20),
  track('Entrepreneur', foundations),
  track('Team1 Academy', team1),
  track('Blockchain', skeleton),
);
const outline = (slug: string) => {
  const found = getCourseOutlines(academy).find((o) => o.slug === slug);
  if (!found) throw new Error(`no outline for ${slug}`);
  return found;
};
const numbersAndNames = (slug: string) => outline(slug).modules.map((m) => `${m.number} ${m.name}`);

describe('getCourseOutlines', () => {
  it('builds one outline per course folder with pages and skips a filtered skeleton', () => {
    expect(getCourseOutlines(academy).map((o) => o.url)).toEqual([
      '/academy/avalanche-l1/avalanche-fundamentals',
      '/academy/avalanche-l1/permissionless-l1s',
      '/academy/avalanche-l1/access-restriction',
      '/academy/avalanche-l1/l1-native-tokenomics',
      '/academy/avalanche-l1/erc20-bridge',
      '/academy/entrepreneur/foundations-web3-venture',
      '/academy/team1/team1-fundamentals',
    ]);
  });

  it('numbers separator modules in sidebar order and keeps the certificate out of the lessons', () => {
    const o = outline('avalanche-fundamentals');
    expect(o).toMatchObject({ track: 'avalanche-l1', name: 'Avalanche Fundamentals' });
    expect(numbersAndNames('avalanche-fundamentals')).toEqual(['01 Primer on Avalanche Consensus', '02 Multi-Chain Architecture']);
    expect(o.lessons).toHaveLength(5);
    expect(o.lessons.map((l) => l.url)).not.toContain('/academy/avalanche-l1/avalanche-fundamentals');
    expect(o.certificateUrl).toBe('/academy/avalanche-l1/avalanche-fundamentals/get-certificate');
    expect(o.modules[1]).toMatchObject({
      firstUrl: '/academy/avalanche-l1/avalanche-fundamentals/03-multi-chain-architecture-intro/01-multi-chain-architecture',
    });
  });

  it('counts a plain folder as its own module and keeps a headingless certificate out of the last module', () => {
    expect(numbersAndNames('permissionless-l1s')).toEqual([
      '01 Review',
      '02 Transformation Requirements',
      '03 Permissioned L1 Setup',
      '04 Staking Manager Setup',
    ]);
    const o = outline('permissionless-l1s');
    expect(o.modules[2].lessons.map((l) => l.name)).toEqual(['Create Your L1', 'Permissioned L1 Speedrun']);
    expect(o.modules[3].lessons).toHaveLength(1);
    expect(o.lessons).toHaveLength(5);
    expect(o.certificateUrl).toBe('/academy/avalanche-l1/permissionless-l1s/certificate');
  });

  it('skips nameless spacers, group headings and certificate sections, and keeps the first certificate', () => {
    expect(numbersAndNames('access-restriction')).toEqual(['01 Introduction', '02 User Error']);
    const o = outline('access-restriction');
    expect(o.lessons.map((l) => l.url).some((url) => url.includes('certificate'))).toBe(false);
    expect(o.certificateUrl).toBe('/academy/avalanche-l1/access-restriction/certificate-fundamentals');
  });

  it('keeps lessons before the first heading as lessons without a module', () => {
    const o = outline('l1-native-tokenomics');
    expect(o.lessons.map((l) => l.name)).toEqual(["Dapp's and L1's", 'Token Ownership', 'Introduction']);
    expect(numbersAndNames('l1-native-tokenomics')).toEqual(['01 Token Fundamentals']);
  });

  it('does not count a heading whose only page is the course index', () => {
    expect(numbersAndNames('erc20-bridge')).toEqual(['01 Token Bridging']);
    expect(outline('erc20-bridge').url).toBe('/academy/avalanche-l1/erc20-bridge');
  });

  it('numbers Entrepreneur modules by their folders', () => {
    expect(outline('foundations-web3-venture').modules.map((m) => m.number)).toEqual(['01', '01b', '02']);
  });

  it('gives a Team1 course lessons and no modules or certificate', () => {
    const o = outline('team1-fundamentals');
    expect(o.modules).toEqual([]);
    expect(o.lessons.map((l) => l.name)).toEqual(['What is Team1', 'Origins', 'Quiz']);
    expect(o.certificateUrl).toBeNull();
  });
});

describe('findCourseOutline and getCourseStats', () => {
  it('finds a course by track and slug, and returns null for anything else', () => {
    expect(findCourseOutline(academy, 'entrepreneur', 'foundations-web3-venture')?.name).toBe('Foundations');
    expect(findCourseOutline(academy, 'avalanche-l1', 'foundations-web3-venture')).toBeNull();
    expect(findCourseOutline(academy, 'blockchain', 'blockchain-fundamentals')).toBeNull();
  });

  it('keys the counts of one track by course url', () => {
    expect(getCourseStats(academy, 'team1')).toEqual({ '/academy/team1/team1-fundamentals': { modules: 0, lessons: 3 } });
    expect(getCourseStats(academy, 'avalanche-l1')['/academy/avalanche-l1/permissionless-l1s']).toEqual({ modules: 4, lessons: 5 });
    expect(getCourseStats(academy, 'blockchain')).toEqual({});
  });
});

describe('lessonPosition', () => {
  it('places a lesson within its module', () => {
    const o = outline('avalanche-fundamentals');
    const p = lessonPosition(o, '/academy/avalanche-l1/avalanche-fundamentals/03-multi-chain-architecture-intro/02-primary-network');
    expect(p).toMatchObject({ index: 2, count: 3 });
    expect(p?.module?.name).toBe('Multi-Chain Architecture');
  });

  it('places a lesson within the course when it has no module', () => {
    expect(lessonPosition(outline('team1-fundamentals'), '/academy/team1/team1-fundamentals/quiz')).toEqual({ module: null, index: 3, count: 3 });
    expect(lessonPosition(outline('l1-native-tokenomics'), '/academy/avalanche-l1/l1-native-tokenomics/dappVsL1')).toEqual({ module: null, index: 1, count: 3 });
  });

  it('returns null for the index, every certificate page and unknown urls', () => {
    const o = outline('access-restriction');
    expect(lessonPosition(o, o.url)).toBeNull();
    expect(lessonPosition(o, '/academy/avalanche-l1/access-restriction/certificate-fundamentals')).toBeNull();
    expect(lessonPosition(o, '/academy/avalanche-l1/access-restriction/certificate-advanced')).toBeNull();
    expect(lessonPosition(o, '/academy/blockchain/solidity-foundry/03-smart-contracts')).toBeNull();
  });
});

describe('moduleHeads', () => {
  it('returns the sidebar rows that head modules, by identity, with their numbers', () => {
    const heads = moduleHeads(permissionless);
    expect(heads.map((h) => h.number)).toEqual(['01', '02', '03', '04']);
    expect(heads[2].head).toBe(permissionless.children[5]);
    expect(heads[3].head).toBe(permissionless.children[6]);
  });

  it('returns nothing for a course without modules or without pages', () => {
    expect(moduleHeads(team1)).toEqual([]);
    expect(moduleHeads(skeleton)).toEqual([]);
  });
});
