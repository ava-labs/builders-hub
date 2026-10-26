import { describe, expect, it } from 'vitest';
import { activeCategory, atPageEnd, markedCategory, scrollToShow } from '@/lib/scroll-spy';

// The scroll spy behind the /integrations sidebar (int-scroll-spy) and the blog outline (eco-blog-outline): which
// section the page is reading. A section's `top` is its distance from the top of the document; `offset` is the line,
// below the top of the window, that its heading has to reach.
describe('activeCategory', () => {
  const sections = [
    { id: 'Featured', top: 500 },
    { id: 'Bridges', top: 1500 },
    { id: 'Wallets', top: 2600 },
  ];

  it('marks nothing before the first heading reaches the line', () => {
    expect(activeCategory(sections, 0, 150)).toBeNull();
    expect(activeCategory(sections, 349, 150)).toBeNull();
  });

  it('marks a section from the moment its heading reaches the line', () => {
    expect(activeCategory(sections, 350, 150)).toBe('Featured');
    expect(activeCategory(sections, 1349, 150)).toBe('Featured');
    expect(activeCategory(sections, 1350, 150)).toBe('Bridges');
    expect(activeCategory(sections, 2450, 150)).toBe('Wallets');
  });

  it('keeps the last section once every heading is above the line', () => {
    expect(activeCategory(sections, 90_000, 150)).toBe('Wallets');
  });

  it('measures from the line it is given', () => {
    expect(activeCategory(sections, 1350, 0)).toBe('Featured');
    expect(activeCategory(sections, 1350, 200)).toBe('Bridges');
  });

  it('marks nothing on a page with no sections (a search that found nothing)', () => {
    expect(activeCategory([], 1000, 150)).toBeNull();
  });
});

// The last sections of a page may never reach the line: once the page can scroll no further, the sidebar marks the last.
describe('atPageEnd', () => {
  it('is false at the top, also on a page too short to scroll', () => {
    expect(atPageEnd(0, 900, 27_000)).toBe(false);
    expect(atPageEnd(0, 900, 600)).toBe(false);
  });

  it('is false while the page can still scroll', () => {
    expect(atPageEnd(26_000, 900, 27_000)).toBe(false);
    expect(atPageEnd(26_097, 900, 27_000)).toBe(false);
  });

  it('is true at the bottom, within 2px for a fractional scroll position', () => {
    expect(atPageEnd(26_100, 900, 27_000)).toBe(true);
    expect(atPageEnd(26_098.5, 900, 27_000)).toBe(true);
  });
});

// The /integrations sidebar's mark: the last section once the page can scroll no further, else the last heading past
// the line `line` px under the navbar's bottom edge (`navbar`, from the top of the window).
describe('markedCategory', () => {
  const sections = [
    { id: 'Featured', top: 500 },
    { id: 'Bridges', top: 1500 },
    { id: 'Wallets', top: 2600 },
  ];
  /** A page 27,000px tall in a 900px window, scrolled to `scrollY`. */
  const long = (scrollY: number) => ({ scrollY, viewportHeight: 900, pageHeight: 27_000 });
  /** The 57px navbar and the sidebar's 96px line: a heading counts at 153px down the window. */
  const NAVBAR = 57;
  const LINE = 96;

  it('marks the section whose heading has passed the line under the navbar', () => {
    expect(markedCategory(sections, long(1347), NAVBAR, LINE)).toBe('Bridges');
    expect(markedCategory(sections, long(1346), NAVBAR, LINE)).toBe('Featured');
  });

  it('moves the line with the navbar: a 40px banner above it pushes the line down', () => {
    expect(markedCategory(sections, long(1307), NAVBAR + 40, LINE)).toBe('Bridges');
    expect(markedCategory(sections, long(1306), NAVBAR + 40, LINE)).toBe('Featured');
  });

  it('marks nothing before the first heading reaches the line, also at the top of a page too short to scroll', () => {
    expect(markedCategory(sections, long(0), NAVBAR, LINE)).toBeNull();
    expect(markedCategory(sections, { scrollY: 0, viewportHeight: 900, pageHeight: 600 }, NAVBAR, LINE)).toBeNull();
  });

  it('at the page end marks the last section, whose heading may never reach the line', () => {
    // 3,000px tall in a 900px window: it scrolls 2,100px at most, and Wallets' heading (2,600) stops at 500px down
    const short = (scrollY: number) => ({ scrollY, viewportHeight: 900, pageHeight: 3_000 });
    expect(markedCategory(sections, short(2_100), NAVBAR, LINE)).toBe('Wallets');
    expect(markedCategory(sections, short(2_098.5), NAVBAR, LINE)).toBe('Wallets');
    // before the end the line decides
    expect(markedCategory(sections, short(2_000), NAVBAR, LINE)).toBe('Bridges');
  });

  it('marks nothing on a page with no sections (a search that found nothing), at its end too', () => {
    expect(markedCategory([], long(26_100), NAVBAR, LINE)).toBeNull();
    expect(markedCategory([], long(1_000), NAVBAR, LINE)).toBeNull();
  });
});

// A list that scrolls on its own (the blog outline) keeps its marked entry in view. `entryTop` is the entry's distance
// from the top of the list's content, `scrollTop` and `viewHeight` the list's scroll position and visible height.
describe('scrollToShow', () => {
  it('leaves the list where it is while the entry is fully in view', () => {
    expect(scrollToShow(0, 35, 0, 812)).toBeNull();
    expect(scrollToShow(400, 35, 0, 812)).toBeNull();
    expect(scrollToShow(777, 35, 0, 812)).toBeNull();
    expect(scrollToShow(300, 35, 300, 812)).toBeNull();
  });

  it('scrolls an entry below the visible part up to a third of the way down', () => {
    expect(scrollToShow(778, 35, 0, 812)).toBe(778 - 812 / 3);
    expect(scrollToShow(950, 35, 0, 812)).toBe(950 - 812 / 3);
  });

  it('scrolls an entry above the visible part back down to a third of the way down, never past the top', () => {
    expect(scrollToShow(500, 35, 600, 812)).toBe(500 - 812 / 3);
    expect(scrollToShow(43, 35, 200, 812)).toBe(0);
  });

  it('never scrolls a list that shows everything, or one that is not on screen (0 high)', () => {
    expect(scrollToShow(480, 35, 0, 548)).toBeNull();
    expect(scrollToShow(0, 0, 0, 0)).toBeNull();
  });
});
