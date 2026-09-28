import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

/**
 * Contract of the course page skin: every rule is scoped to the course page root,
 * every colour is a token, and the course pages load the file right after the tokens.
 */
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const SKIN = 'components/academy/theme/academy-docs.css';
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i;
const CONTENT_LINK = /#nd-page article > \.prose a:not\(\[data-card\]\)/;

/** The content-link rules' selectors: the base rule, :hover and :focus-visible. */
function contentLinkSelectors(): string[] {
  const links: string[] = [];
  postcss.parse(read(SKIN)).walkRules((rule) => {
    links.push(...rule.selectors.filter((selector) => CONTENT_LINK.test(selector)));
  });
  return links;
}

describe('academy-docs.css', () => {
  it('starts every selector with [data-academy="docs"]', () => {
    const selectors: string[] = [];
    postcss.parse(read(SKIN)).walkRules((rule) => {
      selectors.push(...rule.selectors);
    });
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.filter((selector) => !selector.startsWith('[data-academy="docs"]'))).toEqual([]);
  });

  it('writes no literal colour: every colour is an --ac-* token', () => {
    const literal: string[] = [];
    postcss.parse(read(SKIN)).walkDecls((decl) => {
      if (LITERAL_COLOUR.test(decl.value)) literal.push(`${decl.prop}: ${decl.value}`);
    });
    expect(literal).toEqual([]);
  });

  it('leaves button-styled links their own colours: every content-link rule excludes [data-slot="button"]', () => {
    const links = contentLinkSelectors();
    expect(links).toHaveLength(3);
    expect(links.filter((selector) => !selector.includes(':not([data-slot="button"])'))).toEqual([]);
  });

  it('leaves links given buttonVariants classes their own colours: every content-link rule excludes .bg-primary', () => {
    const links = contentLinkSelectors();
    expect(links).toHaveLength(3);
    expect(links.filter((selector) => !selector.includes(':not(.bg-primary)'))).toEqual([]);
  });

  it('is loaded by the course pages right after the tokens', () => {
    const layout = read('app/academy/layout.tsx');
    const tokens = layout.indexOf("import '@/components/academy/theme/academy-tokens.css';");
    const skin = layout.indexOf("import '@/components/academy/theme/academy-docs.css';");
    expect(tokens).toBeGreaterThan(-1);
    expect(skin).toBeGreaterThan(tokens);
  });
});
