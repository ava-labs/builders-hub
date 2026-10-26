import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  atRulesAround,
  attrOf,
  block,
  classesOf,
  contrast,
  cssBlock,
  declaration,
  declOf,
  declsOf,
  elementAt,
  firstTag,
  frame,
  fromFrame,
  openingTags,
  outranks,
  palette,
  parseOklch,
  read,
  rulesFor,
  specificity,
  token,
  transitionOf,
  ungatedHover,
  values,
} from './helpers';

describe('ungatedHover', () => {
  it('counts a :hover rule outside every media query', () => {
    expect(ungatedHover('a:hover { color: red; }')).toBe(1);
  });

  it('skips :hover rules inside (hover: hover), with or without a pointer clause', () => {
    expect(ungatedHover('@media (hover: hover) { a:hover { color: red; } }')).toBe(0);
    expect(ungatedHover('@media (hover: hover) and (pointer: fine) { a:hover, b:hover { color: red; } }')).toBe(0);
  });

  it('counts :hover rules in other media queries, layers and supports blocks', () => {
    const css = `
      @media (hover: none) { a:hover { color: red; } }
      @media (any-hover: hover) { b:hover { color: red; } }
      @layer base { c:hover { color: red; } }
      @supports (display: grid) { d:hover { color: red; } }
    `;
    expect(ungatedHover(css)).toBe(4);
  });

  it('follows nested rules and nested media queries', () => {
    expect(
      ungatedHover('.a { color: red; &:hover { color: blue; } @media (hover: hover) { &:hover { color: green; } } }'),
    ).toBe(1);
    expect(ungatedHover('@layer base { @media (hover: hover) { a:hover { color: red; } } }')).toBe(0);
  });

  it('counts every :hover in a selector list', () => {
    expect(ungatedHover('a:hover, b:hover > c, d:not(:hover) { color: red; }')).toBe(3);
  });

  it('ignores comments, quoted strings, declarations and escaped class names', () => {
    const css = `
      /* a:hover { color: red; } */
      a[title=":hover"] { content: ":hover"; }
      .dark\\:hover\\:bg-red { color: red; }
    `;
    expect(ungatedHover(css)).toBe(0);
  });

  it('reads minified Tailwind output', () => {
    expect(ungatedHover('@media (hover:hover){.hover\\:bg-red:hover{background:red}}.x:hover{color:red}')).toBe(1);
  });
});

describe('read', () => {
  it('reads a file by its path from the repo root', () => {
    expect(read('package.json')).toContain('"packageManager"');
  });
});

describe('server markup', () => {
  const html =
    '<nav aria-label="On this page" class="sticky  top-2"><a href="#a" class="block">A</a><a href="#b">B</a></nav>';

  it('openingTags finds each opening tag of one name, not its look-alikes', () => {
    expect(openingTags(html, 'a')).toEqual(['<a href="#a" class="block">', '<a href="#b">']);
    expect(openingTags('<abbr title="x"></abbr><a>', 'a')).toEqual(['<a>']);
  });

  it('attrOf and classesOf read what React writes', () => {
    const nav = openingTags(html, 'nav')[0];
    expect(attrOf(nav, 'aria-label')).toBe('On this page');
    expect(attrOf(nav, 'id')).toBeUndefined();
    expect(classesOf(nav)).toEqual(['sticky', 'top-2']);
    expect(classesOf('<a href="#b">')).toEqual([]);
  });

  it('firstTag picks the first match or gives an empty string; elementAt cuts one element out', () => {
    expect(firstTag(html, 'a', (a) => attrOf(a, 'href') === '#b')).toBe('<a href="#b">');
    expect(firstTag(html, 'a', () => false)).toBe('');
    expect(elementAt(html, '<a href="#b">', 'a')).toBe('<a href="#b">B</a>');
    expect(() => elementAt(html, '<a href="#c">', 'a')).toThrow(/is not in the markup/);
  });
});

describe('transitionOf', () => {
  it('reads a list utility, bracketed or bare', () => {
    expect(values(['duration-[150ms,160ms]'], 'duration')).toEqual(['150ms', '160ms']);
    expect(values(['duration-150'], 'duration')).toEqual(['150']);
    expect(values(['ease-out'], 'duration')).toEqual([]);
  });

  it('pairs each property with its duration and easing, repeating shorter lists as CSS does', () => {
    const classes = ['transition-[border-color,scale]', 'duration-[150ms,160ms]', 'ease-[ease,var(--ease-out)]'];
    expect(transitionOf(classes)).toEqual({ 'border-color': '150ms ease', scale: '160ms var(--ease-out)' });
    expect(transitionOf(['transition-[opacity,translate]', 'duration-200', 'ease-out'])).toEqual({
      opacity: '200ms var(--ease-out)',
      translate: '200ms var(--ease-out)',
    });
  });

  it('reads one variant when given its prefix', () => {
    const classes = [
      'transition-[opacity]',
      'duration-150',
      'ease-out',
      'max-md:transition-[translate]',
      'max-md:duration-220',
      'max-md:ease-in-out',
    ];
    expect(transitionOf(classes, 'max-md:')).toEqual({ translate: '220ms var(--ease-in-out)' });
  });
});

describe('specificity', () => {
  it('counts ids, classes with attributes and pseudo-classes, and types', () => {
    expect(specificity('nav a')).toEqual([0, 0, 2]);
    expect(specificity('.blog-outline a')).toEqual([0, 1, 1]);
    expect(specificity('.zoomable-image.zoomable-image-instant [data-rmiz-modal-img]')).toEqual([0, 3, 0]);
    expect(specificity('#nd-nav nav > ul li > a:hover')).toEqual([1, 1, 4]);
  });

  it('outranks needs a strict win', () => {
    expect(outranks(specificity('.blog-outline a'), specificity('nav a'))).toBe(true);
    expect(outranks(specificity('.a .b'), specificity('.c.d'))).toBe(false);
    expect(outranks(specificity('#x'), specificity('.a.b.c.d'))).toBe(true);
  });
});

describe('contrast', () => {
  it('parses oklch in both notations and measures WCAG ratios', () => {
    expect(parseOklch('oklch(100% 0 0)')).toEqual([255, 255, 255]);
    expect(parseOklch('oklch(0 0 0)')).toEqual([0, 0, 0]);
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrast([0, 0, 0], [0, 0, 0])).toBe(1);
  });

  it('reads the Tailwind palette and the site tokens', () => {
    expect(palette('zinc-600')).toEqual([82, 82, 92]);
    // the theme writes white and black in hex
    expect(palette('white')).toEqual([255, 255, 255]);
    expect(palette('black')).toEqual([0, 0, 0]);
    // fixed inputs: zinc-600 on a light ground of oklch(96.96% 0 0)
    expect(contrast([82, 82, 92], parseOklch('oklch(96.96% 0 0)'))).toBeCloseTo(7.08, 2);
    const ground = token('background', 'light');
    expect(ground).toHaveLength(3);
    for (const channel of ground) expect(Number.isInteger(channel) && channel >= 0 && channel <= 255).toBe(true);
    expect(() => palette('no-such-colour')).toThrow(/no --color-no-such-colour/);
    expect(() => token('no-such-token', 'dark')).toThrow(/no --no-such-token/);
  });

  it('takes a colour as sRGB or as #rrggbb', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#52525c', '#ffffff')).toBe(contrast([82, 82, 92], [255, 255, 255]));
    expect(contrast('#FFFFFF', [0, 0, 0])).toBe(contrast('#fff', '#000'));
    expect(() => contrast('red', '#000000')).toThrow(/not a #rrggbb colour/);
  });
});

describe('global.css blocks, rules and keyframes (fixed stylesheets)', () => {
  const css = postcss.parse(`
    /* intro without a heading */
    .a { color: red; }
    /* site-one: the first block */
    .one { color: red; }
    /* an inner note */
    .one-more { color: blue; }

    .after-blank { color: green; }
    /* site-two and site-three: one block for two proposals */
    @media (prefers-reduced-motion: reduce) {
      @supports (display: grid) {
        [data-x='y'] { opacity: 0; opacity: 1; scale: 1; }
      }
    }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes rise { 0% { transform: translateY(4px); } }
  `);

  it('block runs from the comment that names an id to the next comment; cssBlock to the first blank line', () => {
    expect(block('site-one', { root: css })).toBe('/* site-one: the first block */\n.one { color: red; }');
    expect(cssBlock('site-one', { root: css })).toBe(
      '/* site-one: the first block */\n.one { color: red; }\n/* an inner note */\n.one-more { color: blue; }',
    );
    // a heading may name several ids
    expect(block('site-three', { root: css })).toBe(block('site-two', { root: css }));
    expect(block('site-three', { root: css })).toMatch(/^\/\* site-two and site-three: /);
    // a name inside another id is not that id
    expect(block('site', { root: css })).toBe('');
    expect(block('no-such-block', { root: css })).toBe('');
  });

  it('rulesFor finds a selector exactly, with the at-rules around it; anyQuotes matches either quote', () => {
    expect(rulesFor('[data-x="y"]', { root: css })).toEqual([]);
    const [found] = rulesFor('[data-x="y"]', { root: css, anyQuotes: true });
    expect(found.at).toEqual(['@media (prefers-reduced-motion: reduce)', '@supports (display: grid)']);
    expect(atRulesAround(found.rule)).toEqual(found.at);
    expect(rulesFor("[data-x='y']", { root: css })).toHaveLength(1);
    // keyframe steps are not rules of the page
    expect(rulesFor('from', { root: css })).toEqual([]);
    expect(rulesFor('.one', { root: css }).map(({ at }) => at)).toEqual([[]]);
  });

  it('declsOf lists the declarations of a rule in order, and declOf gives the first for a property', () => {
    const [{ rule }] = rulesFor("[data-x='y']", { root: css });
    expect(declsOf(rule).map((decl) => `${decl.prop}: ${decl.value}`)).toEqual([
      'opacity: 0',
      'opacity: 1',
      'scale: 1',
    ]);
    expect(declOf(rule, 'opacity')?.value).toBe('0');
    expect(declOf(rule, 'color')).toBeUndefined();
  });

  it('fromFrame reads a from or 0% keyframe, and fails for keyframes that are not there', () => {
    expect(fromFrame('fade', { root: css })).toEqual({ opacity: '0' });
    expect(fromFrame('rise', { root: css })).toEqual({ transform: 'translateY(4px)' });
    expect(() => fromFrame('no-such-keyframes', { root: css })).toThrow(/@keyframes no-such-keyframes/);
  });

  it('frame reads the from or the to keyframe by that name only, and fails for a frame that is not there', () => {
    expect(frame('fade', 'from', { root: css })).toEqual({ opacity: '0' });
    expect(frame('fade', 'to', { root: css })).toEqual({ opacity: '1' });
    // a 0% step is not the from frame
    expect(() => frame('rise', 'from', { root: css })).toThrow(/@keyframes rise from/);
    expect(() => frame('no-such-keyframes', 'to', { root: css })).toThrow(/@keyframes no-such-keyframes to/);
    // without a root it reads global.css
    expect(frame('vs-fade-in', 'from')).toEqual(fromFrame('vs-fade-in'));
  });
});

describe('declaration', () => {
  const src = [
    "'use client';",
    'export const ONE = 1;',
    'const two = () => {',
    '  return 2;',
    '};',
    'export default async function Three() {',
    '  return null;',
    '}',
    'interface Four {}',
  ].join('\n');

  it('cuts one top-level function or const out, up to the next top-level declaration', () => {
    expect(declaration(src, 'ONE')).toBe('export const ONE = 1;\n');
    expect(declaration(src, 'two')).toBe('const two = () => {\n  return 2;\n};\n');
    expect(declaration(src, 'Three')).toBe('export default async function Three() {\n  return null;\n}\n');
    expect(declaration(src, 'tw')).toBe('');
    expect(declaration(src, 'Five')).toBe('');
  });
});
