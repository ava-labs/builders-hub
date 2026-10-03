import { describe, expect, it } from 'vitest';
import { disciplineHue, type DisciplineHue } from '@/lib/academy/discipline';
import { team1CategoryStyles } from '@/components/academy/learning-path-configs/team1.config';

// Team1's category colours to the Academy hue. The 13 landing courses carry their part's hue directly (academy.config.ts).
const EXPECTED: Record<string, DisciplineHue> = { Fundamentals: 'blue', Technical: 'orange', Community: 'purple', 'Soft Skills': 'green' };
const CATEGORIES = Object.entries(team1CategoryStyles).map(([category, style]) => ({ category, gradient: style.gradient }));

describe('disciplineHue', () => {
  it('reads the 4 category gradients of the Team1 config', () => {
    expect(CATEGORIES).toHaveLength(4);
  });

  it.each(CATEGORIES)('maps $category ($gradient)', ({ category, gradient }) => {
    expect(disciplineHue(gradient)).toBe(EXPECTED[category]);
  });

  it('gives every Team1 category its own hue', () => {
    const hues = CATEGORIES.map((c) => disciplineHue(c.gradient));
    expect(new Set(hues).size).toBe(hues.length);
  });

  it.each([
    ['red', 'from-red-400 to-red-500', 'gold'],
    ['yellow', 'from-yellow-400 to-yellow-500', 'gold'],
    ['indigo', 'from-indigo-500 to-indigo-600', 'teal'],
    ['emerald', 'from-emerald-500 to-emerald-600', 'emerald'],
  ])('maps the %s family', (_family, gradient, hue) => {
    expect(disciplineHue(gradient)).toBe(hue);
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
