import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type AtRule, type ChildNode, type Declaration, type Node, type Root, type Rule } from 'postcss';
import { expect } from 'vitest';

/** A repo file as text; `path` is relative to the repo root. */
export function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/** A :hover pseudo-class (an escaped `\:hover` inside a class name is not one). */
const HOVER = /(?<!\\):hover\b/g;
const QUOTED = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
/** A media query that asks for a primary pointer that can hover. */
const CAN_HOVER = /\(\s*hover\s*:\s*hover\s*\)/;

function insideCanHover(node: Node | undefined): boolean {
  if (!node) return false;
  if (node.type === 'atrule' && (node as AtRule).name === 'media' && CAN_HOVER.test((node as AtRule).params)) {
    return true;
  }
  return insideCanHover(node.parent as Node | undefined);
}

/**
 * How many :hover selectors in `css` sit outside every `@media (hover: hover)` block. A touch screen keeps an
 * ungated hover style stuck after a tap, so hover effects belong inside that query. Nested rules and nested
 * at-rules are followed; comments, declarations and quoted strings never count.
 */
export function ungatedHover(css: string): number {
  const counts: number[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (insideCanHover(rule.parent)) return;
    counts.push(rule.selector.replace(QUOTED, '""').match(HOVER)?.length ?? 0);
  });
  return counts.reduce((sum, count) => sum + count, 0);
}

/* ---------- CSS: global.css blocks, rules and keyframes ---------- */

/** app/global.css, parsed. */
export const globalCss: Root = postcss.parse(read('app/global.css'));

/** The names a root-level comment gives its block before its first colon: `id`, or several (`a and b`, `a, b`). */
const headingNames = (text: string): string[] =>
  text.includes(':')
    ? text
        .split(':')[0]
        .split(/\s+and\s+|,\s*/)
        .map((name) => name.trim())
    : [];

/** The block a root-level comment naming `id` heads in `root`: that comment and the nodes before the first `ends`. */
function blockOf(id: string, root: Root, ends: (node: ChildNode) => boolean): string {
  const nodes = root.nodes;
  const start = nodes.findIndex((node) => node.type === 'comment' && headingNames(node.text).includes(id));
  if (start === -1) return '';
  const end = nodes.findIndex((node, i) => i > start && ends(node));
  return nodes.slice(start, end === -1 ? undefined : end).join('\n');
}

/** Where a lookup reads: global.css, unless a test hands it another stylesheet. */
interface Source {
  root?: Root;
}

/** The block a root-level comment naming `id` heads (in global.css by default), up to the next comment. */
export const block = (id: string, { root = globalCss }: Source = {}): string =>
  blockOf(id, root, (node) => node.type === 'comment');

/** The same block up to the first blank line, for a block whose rules carry comments of their own. */
export const cssBlock = (id: string, { root = globalCss }: Source = {}): string =>
  blockOf(id, root, (node) => /\n[^\S\n]*\n/.test(node.raws.before ?? ''));

/** The at-rules around a node, outermost first, as `@name params`. */
export function atRulesAround(node: ChildNode): string[] {
  const found: string[] = [];
  for (let parent: Node | undefined = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'atrule') found.unshift(`@${(parent as AtRule).name} ${(parent as AtRule).params}`.trim());
  }
  return found;
}

/** Attribute values compare with double quotes, whichever quotes the stylesheet uses. */
const doubleQuoted = (selector: string) => selector.replace(/'/g, '"');

/**
 * Every rule of `root` (global.css by default) whose selector list holds `selector`, keyframe steps left out, with the
 * at-rules around it, outermost first. `anyQuotes` matches attribute values whichever quotes they are written in.
 */
export function rulesFor(
  selector: string,
  { root = globalCss, anyQuotes = false }: Source & { anyQuotes?: boolean } = {},
): { rule: Rule; at: string[] }[] {
  const same = anyQuotes ? doubleQuoted : (text: string) => text;
  const found: { rule: Rule; at: string[] }[] = [];
  root.walkRules((rule) => {
    const step = rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as AtRule).name);
    if (!step && rule.selectors.map(same).includes(same(selector))) found.push({ rule, at: atRulesAround(rule) });
  });
  return found;
}

/** A rule's own declarations, in order. */
export const declsOf = (rule: Rule): Declaration[] =>
  rule.nodes.filter((node): node is Declaration => node.type === 'decl');

/** A rule's (first) declaration of `prop`. */
export const declOf = (rule: Rule, prop: string): Declaration | undefined =>
  declsOf(rule).find((decl) => decl.prop === prop);

/** The first keyframe (`from` or `0%`) of `@keyframes name` in `root` (global.css by default), as prop to value. */
export function fromFrame(name: string, { root = globalCss }: Source = {}): Record<string, string> {
  let first: Record<string, string> | undefined;
  root.walkAtRules('keyframes', (at) => {
    if (at.params !== name) return;
    at.walkRules((rule) => {
      if (rule.selector === 'from' || rule.selector === '0%') {
        first = Object.fromEntries(declsOf(rule).map((decl) => [decl.prop, decl.value]));
      }
    });
  });
  expect(first, `@keyframes ${name} { from { ... } }`).toBeDefined();
  return first ?? {};
}

/**
 * One frame, `from` or `to` by that name (a `0%` step is not `from`), of `@keyframes name` in `root` (global.css by
 * default), as prop to value.
 */
export function frame(name: string, at: 'from' | 'to', { root = globalCss }: Source = {}): Record<string, string> {
  let found: Record<string, string> | undefined;
  root.walkAtRules('keyframes', (keyframes) => {
    if (keyframes.params !== name) return;
    keyframes.walkRules(at, (rule) => {
      found = Object.fromEntries(declsOf(rule).map((decl) => [decl.prop, decl.value]));
    });
  });
  expect(found, `@keyframes ${name} ${at}`).toBeDefined();
  return found ?? {};
}

/* ---------- TypeScript source ---------- */

/** One top-level function or const in `src`: from its declaration to the next top-level one ('' if none). */
export function declaration(src: string, name: string): string {
  const start = src.search(new RegExp(`^(?:export )?(?:default )?(?:async )?(?:function|const) ${name}\\b`, 'm'));
  if (start === -1) return '';
  const rest = src.slice(start + 1);
  const next = rest.search(/^(?:export )?(?:default )?(?:async )?(?:function|const|interface|type) \w+/m);
  return src.slice(start, next === -1 ? undefined : start + 1 + next);
}

/**
 * Each file's lines as the explorer's max-lines rule counts them (blank and comment lines skipped). A file the parser
 * cannot read fails here, rather than counting as one line. ESLint loads only when this runs.
 */
export async function codeLines(files: string[]): Promise<Record<string, number>> {
  const [{ ESLint }, { default: tseslint }] = await Promise.all([import('eslint'), import('typescript-eslint')]);
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tseslint.parser },
        rules: { 'max-lines': ['error', { max: 1, skipBlankLines: true, skipComments: true }] },
      },
    ],
  });
  const out: Record<string, number> = {};
  for (const file of files) {
    const [result] = await eslint.lintText(read(file), { filePath: file });
    expect(result.messages.find((m) => m.fatal)?.message, `${file} parses`).toBeUndefined();
    const message = result.messages.find((m) => m.ruleId === 'max-lines');
    out[file] = message ? Number(/\((\d+)\)/.exec(message.message)?.[1]) : 1;
  }
  return out;
}

/* ---------- server markup: what renderToStaticMarkup writes ---------- */

/** Every opening tag of `tag` in `markup`. */
export const openingTags = (markup: string, tag: string): string[] =>
  markup.match(new RegExp(`<${tag}\\b[^>]*>`, 'g')) ?? [];
/** One attribute of an opening tag, as React writes it (double quotes). */
export const attrOf = (open: string, name: string): string | undefined =>
  open.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
/** The classes of an opening tag. */
export const classesOf = (open: string): string[] => (attrOf(open, 'class') ?? '').split(/\s+/).filter(Boolean);
/** The first opening tag of `tag` in `markup` that `test` picks, or '' when none does. */
export const firstTag = (markup: string, tag: string, test: (open: string) => boolean = () => true): string =>
  openingTags(markup, tag).find(test) ?? '';
/** The markup from the opening tag `open` to the end of its element, for a tag that never nests itself (a, h3, p). */
export function elementAt(markup: string, open: string, tag: string): string {
  const start = markup.indexOf(open);
  if (start === -1) throw new Error(`${open.slice(0, 60)} is not in the markup`);
  return markup.slice(start, markup.indexOf(`</${tag}>`, start) + tag.length + 3);
}

/** A list utility's values: `duration-[150ms,160ms]` gives ['150ms', '160ms'], `duration-150` gives ['150']. */
export function values(classes: readonly string[], utility: string): string[] {
  const token = classes.find((name) => name.startsWith(`${utility}-`));
  if (!token) return [];
  const value = token.slice(utility.length + 1);
  return value.startsWith('[') ? value.slice(1, -1).split(',') : [value];
}

/** Tailwind's ease-out and ease-in-out classes, which take the site's strong curves (site-motion-tokens). */
const NAMED_EASES: Record<string, string> = { out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)' };

/**
 * The transition a class list declares, as property to "duration easing" (a shorter duration or easing list repeats,
 * as in CSS). `prefix` reads the classes under one variant, such as `max-md:`.
 */
export function transitionOf(classes: readonly string[], prefix = ''): Record<string, string> {
  const own = classes.filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length));
  const durations = values(own, 'duration').map((value) => (/^\d+$/.test(value) ? `${value}ms` : value));
  const easings = values(own, 'ease').map((value) => NAMED_EASES[value] ?? value);
  return Object.fromEntries(
    values(own, 'transition').map((property, i) => [
      property,
      `${durations[i % durations.length]} ${easings[i % easings.length]}`,
    ]),
  );
}

/* ---------- CSS specificity ---------- */

/** The specificity of a plain selector (no :is, :not or :where), as (ids, classes with attributes and pseudo-classes, types). */
export function specificity(selector: string): [number, number, number] {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const attrs = (selector.match(/\[[^\]]+\]/g) ?? []).length;
  const bare = selector.replace(/\[[^\]]+\]/g, '');
  const classes = (bare.match(/\.[\w-]+/g) ?? []).length + (bare.match(/:(?!:)[\w-]+/g) ?? []).length;
  const types = (bare.replace(/[.:#][\w-]+/g, ' ').match(/(?:^|[\s>+~])([a-z][\w-]*)/g) ?? []).length;
  return [ids, attrs + classes, types];
}

/** True when specificity `a` beats `b` (a tie is not a win). */
export const outranks = (a: [number, number, number], b: [number, number, number]): boolean =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

/* ---------- WCAG contrast from the palette Tailwind ships (oklch) ---------- */

export type RGB = [number, number, number];

/** oklch (L 0-1) to 8-bit sRGB, as the browser paints it. */
export function oklchToRgb(l: number, c: number, h: number): RGB {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ];
  return linear.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    const encoded = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
  }) as RGB;
}

/** `oklch(98.5% 0 0)` or `oklch(0.205 0 0)` as sRGB. */
export function parseOklch(value: string): RGB {
  const match = value.match(/oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)\)/);
  if (!match) throw new Error(`not an oklch() colour: ${value}`);
  return oklchToRgb(Number(match[1]) / (match[2] ? 100 : 1), Number(match[3]), Number(match[4]));
}

/** `#rrggbb` or `#rgb` as sRGB. */
function hexToRgb(value: string): RGB {
  const digits = value.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a #rrggbb colour: ${value}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

/** A Tailwind palette colour (`zinc-500`, or `white` and `black`, which the theme writes in hex) as sRGB. */
export function palette(name: string): RGB {
  const theme = read('node_modules/tailwindcss/theme.css');
  const match = theme.match(new RegExp(`--color-${name}: (oklch\\([^)]*\\)|#[0-9a-fA-F]{3,6});`));
  if (!match) throw new Error(`no --color-${name} in tailwindcss/theme.css`);
  return match[1].startsWith('#') ? hexToRgb(match[1]) : parseOklch(match[1]);
}

/** A site token from app/global.css (`background`) in the light (:root) or the dark (.dark) block. */
export function token(name: string, theme: 'light' | 'dark'): RGB {
  const scope = read('app/global.css').match(theme === 'light' ? /^:root \{[^}]*\}/m : /^\.dark \{[^}]*\}/m)?.[0] ?? '';
  const match = scope.match(new RegExp(`--${name}: (oklch\\([^)]*\\));`));
  if (!match) throw new Error(`no --${name} in the ${theme} block of app/global.css`);
  return parseOklch(match[1]);
}

/** The WCAG contrast ratio of two colours, each sRGB or `#rrggbb`. */
export function contrast(a: RGB | string, b: RGB | string): number {
  const lum = (colour: RGB | string) => {
    const rgb = typeof colour === 'string' ? hexToRgb(colour) : colour;
    const [r, g, bl] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [high, low] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
