import { describe, expect, it } from 'vitest';
import { getCourseOutlines, lessonPosition, type CourseOutline } from '@/lib/academy/course-outline';
import { lessonEyebrow, titleNamesModule } from '@/lib/academy/lesson-eyebrow';
import { fundamentals, team1, tokenomics, track, tree } from './helpers/tree-fixtures';

const outlines = getCourseOutlines(tree(track('Avalanche L1', fundamentals, tokenomics), track('Team1 Academy', team1)));
const bySlug = (slug: string): CourseOutline => outlines.find((o) => o.slug === slug)!;
const eyebrowFor = (slug: string, url: string, title: string) => {
  const outline = bySlug(slug);
  const position = lessonPosition(outline, url);
  if (!position) throw new Error(`no position for ${url}`);
  return lessonEyebrow(outline, position, title);
};

describe('titleNamesModule', () => {
  it('matches the module name as whole words, ignoring case', () => {
    expect(titleNamesModule('Stateful Precompiles', 'Precompiles')).toBe(true);
    expect(titleNamesModule('Multi-Chain Architecture', 'Multi-Chain Architecture')).toBe(true);
    expect(titleNamesModule('Governance 2.0', 'governance')).toBe(true);
    expect(titleNamesModule('Precompiled Contracts', 'Precompile')).toBe(false);
    expect(titleNamesModule('Anything', '')).toBe(false);
  });
});

describe('lessonEyebrow', () => {
  const L1 = '/academy/avalanche-l1/avalanche-fundamentals';

  it('names the module and the position within it', () => {
    expect(eyebrowFor('avalanche-fundamentals', `${L1}/03-multi-chain-architecture-intro/02-primary-network`, 'The Primary Network')).toEqual({
      course: 'Avalanche Fundamentals',
      module: 'Multi-Chain Architecture',
      position: 'Lesson 2 of 3',
      steps: { index: 2, count: 3 },
    });
  });

  it('leaves the module out when the lesson title already names it', () => {
    const text = eyebrowFor('avalanche-fundamentals', `${L1}/03-multi-chain-architecture-intro/01-multi-chain-architecture`, 'Multi-Chain Architecture');
    expect(text.module).toBeNull();
    expect(text.position).toBe('Lesson 1 of 3');
  });

  it('counts within the course for a course without modules (Team1)', () => {
    expect(eyebrowFor('team1-fundamentals', '/academy/team1/team1-fundamentals/quiz', 'Quiz')).toEqual({
      course: 'Team1 Fundamentals',
      module: null,
      position: 'Lesson 3 of 3',
      steps: { index: 3, count: 3 },
    });
  });

  it('shows the course position without a step bar for a lesson before the first module', () => {
    expect(eyebrowFor('l1-native-tokenomics', '/academy/avalanche-l1/l1-native-tokenomics/token-ownership', 'Token Ownership')).toEqual({
      course: 'L1 Native Tokenomics',
      module: null,
      position: 'Lesson 2 of 3',
      steps: null,
    });
  });
});
