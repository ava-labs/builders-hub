import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

/**
 * Contract tests for the Academy design tokens (spec section 3; index contracts C1, C2, C3).
 * They read the CSS as text. The live cascade (scope roots, dark mode, nothing outside the
 * Academy) is checked on live pages by the token probe of the gate harness (contract C9).
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const TOKENS_FILE = 'components/academy/theme/academy-tokens.css';

// Index C3, spec section 3: name, light, dark.
const COLOR_TOKENS = [
  ['ground', '#ffffff', '#0a0a0a'],
  ['docs-ground', '#ffffff', '#121212'],
  ['paper', '#ffffff', '#171717'],
  ['panel', '#fafafa', '#1f1f1f'],
  ['tile', '#f4f4f5', '#27272a'],
  ['ink', '#1f1f1f', '#ededed'],
  ['ink-2', '#3f3f46', '#d4d4d8'],
  ['ink-3', '#71717a', '#a1a1aa'],
  ['rule', '#e4e4e7', '#262626'],
  ['rule-2', '#d4d4d8', '#3f3f46'],
  ['red', '#e6212f', '#ff394a'],
  ['ok', '#2f6b4f', '#6fcf97'],
  ['ok-bg', '#eef5f0', '#14211a'],
  ['code', '#fafafa', '#171717'],
  ['line', '#909098', '#64646d'],
] as const;

// Index C3 hues, spec section 3: hue, light colour, light tint, dark colour, dark tint.
const HUES = [
  ['blue', '#2563eb', 'rgba(37, 99, 235, 0.09)', '#60a5fa', 'rgba(96, 165, 250, 0.16)'],
  ['purple', '#7c3aed', 'rgba(124, 58, 237, 0.09)', '#a78bfa', 'rgba(167, 139, 250, 0.16)'],
  ['emerald', '#059669', 'rgba(5, 150, 105, 0.09)', '#34d399', 'rgba(52, 211, 153, 0.16)'],
  ['gold', '#a16207', 'rgba(161, 98, 7, 0.10)', '#eab308', 'rgba(234, 179, 8, 0.16)'],
  ['orange', '#ea580c', 'rgba(234, 88, 12, 0.09)', '#fb923c', 'rgba(251, 146, 60, 0.16)'],
  ['teal', '#0d9488', 'rgba(13, 148, 136, 0.09)', '#2dd4bf', 'rgba(45, 212, 191, 0.16)'],
  ['green', '#16a34a', 'rgba(22, 163, 74, 0.09)', '#4ade80', 'rgba(74, 222, 128, 0.16)'],
] as const;

const isRule = (node: postcss.ChildNode): node is Rule => node.type === 'rule';
const isDecl = (node: postcss.ChildNode): node is Declaration => node.type === 'decl';

/** Declarations of the top-level rules whose selector is exactly `selector`, as prop to value. */
function declarations(css: string, selector: string): Record<string, string> {
  const rules = postcss.parse(css).nodes.filter(isRule).filter((rule) => rule.selector === selector);
  return Object.fromEntries(rules.flatMap((rule) => rule.nodes.filter(isDecl).map((d) => [d.prop, d.value])));
}

/** The `@theme inline { ... }` block of app/global.css, as CSS text. */
function themeInlineBlock(): string {
  const block = postcss
    .parse(read('app/global.css'))
    .nodes.find((node): node is AtRule => node.type === 'atrule' && node.name === 'theme' && node.params === 'inline');
  if (!block) throw new Error('app/global.css has no @theme inline block');
  return block.toString();
}

describe('Academy tokens (index C3)', () => {
  it.each(COLOR_TOKENS)('defines --ac-%s as %s in light and %s in dark', (name, light, dark) => {
    const css = read(TOKENS_FILE);
    expect(declarations(css, '[data-academy]')[`--ac-${name}`]).toBe(light);
    expect(declarations(css, '.dark [data-academy]')[`--ac-${name}`]).toBe(dark);
  });

  it('defaults the icon tile to ink on the tile colour', () => {
    const light = declarations(read(TOKENS_FILE), '[data-academy]');
    expect(light['--ac-h']).toBe('var(--ac-ink)');
    expect(light['--ac-t']).toBe('var(--ac-tile)');
  });

  it('defines the type stacks', () => {
    const css = read(TOKENS_FILE);
    const light = declarations(css, '[data-academy]');
    expect(light['--ac-display']).toBe('"Aeonik", var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif');
    expect(light['--ac-sans']).toBe('var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif');
    expect(light['--ac-mono']).toBe('var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace');
  });

  it.each(HUES)('defines the %s hue and tint for both themes', (hue, lightHue, lightTint, darkHue, darkTint) => {
    const css = read(TOKENS_FILE);
    const light = declarations(css, '[data-academy]');
    const dark = declarations(css, '.dark [data-academy]');
    expect([light[`--ac-hue-${hue}`], light[`--ac-tint-${hue}`]]).toEqual([lightHue, lightTint]);
    expect([dark[`--ac-hue-${hue}`], dark[`--ac-tint-${hue}`]]).toEqual([darkHue, darkTint]);
  });

  it.each(HUES.map(([hue]) => hue))('maps data-hue="%s" to its hue and tint inside the scope', (hue) => {
    expect(declarations(read(TOKENS_FILE), `[data-academy] [data-hue="${hue}"]`)).toEqual({
      '--ac-h': `var(--ac-hue-${hue})`,
      '--ac-t': `var(--ac-tint-${hue})`,
    });
  });

  it('scopes every rule to an Academy root and wraps none in an at-rule (index C1)', () => {
    const nodes = postcss.parse(read(TOKENS_FILE)).nodes;
    // Unlayered and top level on purpose: the app/global.css pins it overrides (contract C2) are unlayered.
    expect(nodes.filter((node) => node.type === 'atrule')).toEqual([]);
    const outside = nodes.filter(isRule).flatMap((rule) => rule.selectors).filter((s) => !/^(\.dark )?\[data-academy[\]=]/.test(s));
    expect(outside).toEqual([]);
  });
});

describe('Academy Tailwind utilities (index C3)', () => {
  it('registers every colour token and both type tokens in @theme inline', async () => {
    const { build } = await compile(`${themeInlineBlock()}\n@tailwind utilities;`);
    const names = [...COLOR_TOKENS.map(([name]) => name), 'h', 't'];
    const css = build([...names.map((name) => `bg-ac-${name}`), 'font-ac-display', 'font-ac-mono', 'text-ac-ink/60']);
    names.forEach((name) => expect(css).toContain(`.bg-ac-${name} {\n  background-color: var(--ac-${name});\n}`));
    expect(css).toContain('font-family: var(--ac-display);');
    expect(css).toContain('font-family: var(--ac-mono);');
    expect(css).toContain('color: color-mix(in oklab, var(--ac-ink) 60%, transparent);');
  });
});

describe('Academy stylesheet imports (index C2)', () => {
  const IMPORT = "import '@/components/academy/theme/academy-tokens.css';";

  it('loads the tokens on the course pages after the course-page stylesheets', () => {
    const layout = read('app/academy/layout.tsx');
    expect(layout.indexOf(IMPORT)).toBeGreaterThan(layout.indexOf("import './styles.css';"));
    expect(layout.indexOf("import './styles.css';")).toBeGreaterThan(-1);
  });

  it('loads the tokens on the track landings', () => {
    expect(read('components/academy/shared/academy-layout.tsx')).toContain(IMPORT);
  });
});

describe('fumadocs colour remap on the course pages (spec 4.1)', () => {
  it('maps the fumadocs colour variables to the tokens on [data-academy="docs"]', () => {
    expect(declarations(read(TOKENS_FILE), '[data-academy="docs"]')).toEqual({
      '--color-fd-background': 'var(--ac-docs-ground)',
      '--color-fd-card': 'var(--ac-docs-ground)',
      '--color-fd-popover': 'var(--ac-paper)',
      '--color-fd-border': 'var(--ac-rule)',
      '--color-fd-primary': 'var(--ac-ink)',
      '--color-fd-primary-foreground': 'var(--ac-paper)',
      '--color-fd-muted': 'var(--ac-panel)',
      '--color-fd-muted-foreground': 'var(--ac-ink-3)',
      '--color-fd-secondary': 'var(--ac-panel)',
      '--color-fd-accent': 'var(--ac-panel)',
      '--color-fd-accent-foreground': 'var(--ac-ink)',
      '--color-fd-foreground': 'var(--ac-ink)',
    });
  });

  it('leaves the shadcn variables alone, so the embedded console tools keep their look', () => {
    const SHADCN = ['--background', '--foreground', '--card', '--popover', '--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted', '--muted-foreground', '--accent', '--accent-foreground', '--border', '--input', '--ring'];
    const props = postcss.parse(read(TOKENS_FILE)).nodes.filter(isRule).flatMap((rule) => rule.nodes.filter(isDecl).map((d) => d.prop));
    expect(props.filter((prop) => SHADCN.includes(prop))).toEqual([]);
  });

  it.each([
    ['[data-academy] .text-fd-primary', { color: 'var(--ac-ink)' }],
    ['[data-academy] .bg-fd-primary\\/10', { 'background-color': 'color-mix(in oklab, var(--ac-ink) 10%, transparent)' }],
    ['[data-academy] h2.text-sm.font-medium', { color: 'revert-layer' }],
    [
      '[data-academy] .mb-2.inline-flex.size-7.items-center.justify-center.rounded-full.bg-fd-primary.font-medium.text-fd-primary-foreground',
      { 'background-color': 'revert-layer', color: 'revert-layer' },
    ],
    ['[data-academy] .text-fd-muted-foreground', { color: 'var(--ac-ink-3)' }],
  ])('overrides the app/global.css pin %s inside the scope', (selector, expected) => {
    expect(declarations(read(TOKENS_FILE), selector)).toEqual(expected);
  });
});
