import { describe, expect, it } from 'vitest';

import { sectionAt } from '@/hooks/use-section-navigation';

describe('the active section of a section rail', () => {
  it('is the last section whose top has reached the line', () => {
    expect(sectionAt([0, 500, 1000], 700)).toBe(1);
    expect(sectionAt([0, 500, 1000], 1000)).toBe(2);
  });

  it('is the section a tab scrolled to, though it landed a fraction of a pixel under the line', () => {
    expect(sectionAt([0, 500, 1000.4], 1000)).toBe(2);
  });

  it('skips a section that is not on the page, and is none above every section', () => {
    expect(sectionAt([0, null, 1000], 600)).toBe(0);
    expect(sectionAt([200, 500], 100)).toBe(-1);
  });
});
