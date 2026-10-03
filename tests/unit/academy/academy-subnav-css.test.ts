import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

interface Found { value: string; important: boolean; media: string | null }

const CRITICAL = 'app/academy/critical.css';
const STYLES = 'app/academy/styles.css';
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
/** Every declaration of `prop` in the rules whose selector list holds `selector`, with the media query around it. */
function decls(file: string, selector: string, prop: string): Found[] {
  const found: Found[] = [];
  postcss.parse(read(file)).walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const media = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : null;
    rule.walkDecls(prop, (decl) => { found.push({ value: decl.value, important: Boolean(decl.important), media }); });
  });
  return found;
}

const BAR = 'var(--ac-subnav-height)';
const SIDEBAR_TOP = `calc(var(--fd-banner-height, 0px) + 3.5rem + ${BAR})`;
const SIDEBAR_HEIGHT = `calc(100vh - var(--fd-banner-height, 0px) - 3.5rem - ${BAR})`;
const TOC_TOP = `calc(var(--fd-banner-height, 0px) + var(--fd-nav-height, 0px) + ${BAR})`;

describe('the course pages make room for the part sub-nav', () => {
  it('sets the bar height once, on the Academy root: h-12 and its 1 px rule', () => {
    expect(decls(CRITICAL, '[data-route-layout="academy"]', '--ac-subnav-height')).toEqual([{ value: '49px', important: false, media: null }]);
  });

  it('puts the desktop sidebar under the bar, the same before and after hydration', () => {
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-sidebar', 'top')).toEqual([{ value: SIDEBAR_TOP, important: true, media: '(min-width: 1024px)' }]);
    expect(decls(STYLES, 'body[data-layout="academy"] #nd-sidebar', 'top')).toEqual([{ value: SIDEBAR_TOP, important: true, media: null }]);
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-sidebar', 'height')).toEqual([{ value: SIDEBAR_HEIGHT, important: true, media: '(min-width: 1024px)' }]);
    expect(decls(STYLES, 'body[data-layout="academy"] #nd-sidebar', 'height')).toEqual([{ value: SIDEBAR_HEIGHT, important: true, media: null }]);
  });

  it('starts the page under the bar, before and after hydration', () => {
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-docs-layout', 'padding-top')).toEqual([{ value: BAR, important: true, media: null }]);
    expect(decls(STYLES, 'body[data-layout="academy"] #nd-docs-layout', 'padding-top')).toEqual([{ value: BAR, important: true, media: null }]);
  });

  it('moves the right column and the phone table of contents under the bar', () => {
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-toc', 'top')).toEqual([{ value: TOC_TOP, important: true, media: '(min-width: 1024px)' }]);
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-tocnav', 'top')).toEqual([{ value: 'calc(var(--fd-banner-height, 0px) + 3.5rem + var(--ac-subnav-height))', important: true, media: null }]);
  });

  it('aligns the labels as the docs bar does: from 3rem on desktop, from 1rem and left below 1024 px', () => {
    expect(decls(CRITICAL, '[data-route-layout="academy"] #academy-subnav > div', 'padding-left')).toEqual([
      { value: '3rem', important: true, media: '(min-width: 1024px)' },
      { value: '1rem', important: true, media: '(max-width: 1023px)' },
    ]);
    expect(decls(CRITICAL, '[data-route-layout="academy"] #academy-subnav > div', 'justify-content')).toEqual([
      { value: 'flex-start', important: true, media: '(max-width: 1023px)' },
    ]);
  });

  it('mirrors the docs bar search-open rule (inert since 45ac98063, nothing sets the class)', () => {
    expect(decls(STYLES, 'body.search-open #academy-subnav', 'display')).toEqual([{ value: 'none', important: true, media: null }]);
  });

  it('keeps the phone table of contents list inside the viewport under the bar', () => {
    expect(decls(STYLES, 'body[data-layout="academy"] #nd-tocnav [data-toc-popover]', 'max-height')).toEqual([
      { value: 'calc(100dvh - var(--fd-banner-height) - 3.5rem - var(--fd-tocnav-height) - var(--ac-subnav-height))', important: true, media: '(max-width: 1279px)' },
    ]);
  });

  it('keeps the sidebar header padding the same before and after hydration', () => {
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-sidebar > div:first-child', 'padding-top')).toEqual([{ value: '0', important: true, media: null }]);
    expect(decls(STYLES, 'body[data-layout="academy"] #nd-sidebar > div:first-child', 'padding-top')).toEqual([{ value: '0', important: true, media: null }]);
    expect(decls(CRITICAL, '[data-route-layout="academy"] #nd-sidebar > div:first-child', 'margin-top')).toEqual([{ value: '0', important: true, media: null }]);
    expect(decls(STYLES, 'body[data-layout="academy"] #nd-sidebar > div:first-child', 'margin-top')).toEqual([{ value: '0', important: true, media: null }]);
  });
});
