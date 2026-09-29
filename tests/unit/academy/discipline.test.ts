import { describe, expect, it } from 'vitest';
import { disciplineHue, type DisciplineHue } from '@/lib/academy/discipline';
import { avalancheCategoryStyles } from '@/components/academy/learning-path-configs/avalanche.config';
import { blockchainCategoryStyles } from '@/components/academy/learning-path-configs/blockchain.config';
import { team1CategoryStyles } from '@/components/academy/learning-path-configs/team1.config';

// Production's category colour to the Academy hue, per track and category.
const EXPECTED: Record<string, Record<string, DisciplineHue>> = {
  avalanche: { Fundamentals: 'blue', Interoperability: 'purple', 'L1 Development': 'emerald', 'L1 Tokenomics': 'gold', 'VM Customization': 'orange' },
  blockchain: { Fundamentals: 'blue', Development: 'orange', Privacy: 'teal' },
  team1: { Fundamentals: 'blue', Technical: 'orange', Community: 'purple', 'Soft Skills': 'green' },
};

const TRACKS = {
  avalanche: avalancheCategoryStyles,
  blockchain: blockchainCategoryStyles,
  team1: team1CategoryStyles,
};

const CATEGORIES = Object.entries(TRACKS).flatMap(([track, styles]) =>
  Object.entries(styles).map(([category, style]) => ({ track, category, gradient: style.gradient })),
);

describe('disciplineHue', () => {
  it('reads all 12 category gradients of the three track configs', () => {
    expect(CATEGORIES).toHaveLength(12);
  });

  it.each(CATEGORIES)('maps $track / $category ($gradient)', ({ track, category, gradient }) => {
    expect(disciplineHue(gradient)).toBe(EXPECTED[track][category]);
  });

  it.each(Object.keys(TRACKS))('gives every %s category its own hue', (track) => {
    const hues = CATEGORIES.filter((c) => c.track === track).map((c) => disciplineHue(c.gradient));
    expect(new Set(hues).size).toBe(hues.length);
  });

  it.each([
    ['a palette family outside the mapping', 'from-pink-500 to-pink-600'],
    ['an object key that is not a family', 'from-constructor-500 to-constructor-600'],
    ['a string without a gradient start', 'bg-blue-50'],
    ['a variant-prefixed start', 'dark:from-blue-500'],
    ['an empty string', ''],
  ])('returns null for %s', (_label, gradient) => {
    expect(disciplineHue(gradient)).toBeNull();
  });
});
