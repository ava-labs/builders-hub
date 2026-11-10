import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file is tests/e2e/console/console-routes.ts. The repo root is three folders up.
// Read paths from this file, not from the cwd, so the list is the same wherever the runner starts.
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The Console tool registry. The toolbox grid and the sidebar search read it.
export const REGISTRY_FILE = 'components/toolbox/console/toolbox/tools.ts';

// The Console route tree. Each page.tsx under it is a route.
const CONSOLE_APP_DIR = 'app/console';

export type RouteSource = 'registry' | 'flow-step' | 'route-tree';

export interface ConsoleRoute {
  /** The site path, for example /console/primary-network/faucet. */
  route: string;
  /** The registry name ("Create L1 > Create Chain"), the step title, or the page folder name. */
  label: string;
  /**
   * Where the route comes from:
   * - registry: an entry or a sub-step in tools.ts.
   * - flow-step: a step key of a step flow that tools.ts does not list.
   * - route-tree: a static page under app/console that tools.ts does not list.
   */
  source: RouteSource;
}

export interface RegistryEntry {
  name: string;
  path: string;
  external: boolean;
  subSteps: { name: string; path: string }[];
}

export interface ConsoleRouteList {
  routes: ConsoleRoute[];
  /** Every entry of tools.ts, with the sub-steps it has after the FLOW_SUBSTEPS merge. */
  registry: RegistryEntry[];
  /** The number of registry routes before duplicates are removed (the old manifest counted these). */
  registryRouteCount: number;
  /** Dynamic route folders whose values the sweep cannot read from the repo (job IDs, chain IDs, legacy maps). */
  notEnumerated: string[];
}

/** Returns the text from the bracket at `open` to its closing bracket. It skips brackets inside strings and comments. */
function balanced(source: string, open: number): string {
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const stack: string[] = [];
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i) + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced bracket at offset ${open}`);
}

/** Removes line and block comments. It keeps strings, so a URL such as 'https://core.app' stays whole. */
function stripComments(source: string): string {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end < 0 ? source.length : end - 1;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i) + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const start = i;
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
      out += source.slice(start, i + 1);
      continue;
    }
    out += c;
  }
  return out;
}

/** Splits the body of an array or object literal into its top-level `{ ... }` items. */
function topLevelObjects(literal: string): string[] {
  const items: string[] = [];
  for (let i = 1; i < literal.length - 1; i++) {
    const c = literal[i];
    if (c === '/' && literal[i + 1] === '/') {
      i = literal.indexOf('\n', i);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < literal.length && literal[i] !== c; i++) if (literal[i] === '\\') i++;
      continue;
    }
    if (c === '{' || c === '[') {
      const item = balanced(literal, i);
      if (c === '{') items.push(item);
      i += item.length - 1;
    }
  }
  return items;
}

/** Reads `field: 'value'` from the top level of an object literal: nested objects and arrays are removed first. */
function stringField(object: string, field: string): string | null {
  let flat = object.slice(1, -1);
  for (let i = 0; i < flat.length; i++) {
    const c = flat[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < flat.length && flat[i] !== c; i++) if (flat[i] === '\\') i++;
      continue;
    }
    if (c === '{' || c === '[') {
      const inner = balanced(flat, i);
      flat = flat.slice(0, i) + flat.slice(i + inner.length);
      i--;
    }
  }
  const m = flat.match(new RegExp(`\\b${field}\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1).)*)\\1`));
  return m ? m[2].replace(/\\(.)/g, '$1') : null;
}

/** Returns the literal that follows `name` and `=` (or `name:`), for example the array of `const TOOLS_RAW: ToolCard[] = [`. */
function literalAfter(source: string, pattern: RegExp, what: string): string {
  const m = pattern.exec(source);
  if (!m) throw new Error(`${what} not found`);
  const open = source.slice(m.index + m[0].length).search(/[[{]/) + m.index + m[0].length;
  return balanced(source, open);
}

function readSubSteps(literal: string): { name: string; path: string }[] {
  return topLevelObjects(literal).map((item) => {
    const name = stringField(item, 'name');
    const path = stringField(item, 'path');
    if (!name || !path) throw new Error(`sub-step without name or path: ${item}`);
    return { name, path };
  });
}

/** Reads tools.ts the way its TOOLS export is built: TOOLS_RAW, and FLOW_SUBSTEPS for a tool with no inline subSteps. */
export function readRegistry(): RegistryEntry[] {
  const source = stripComments(readFileSync(join(REPO_ROOT, REGISTRY_FILE), 'utf8'));

  const flowSubSteps = new Map<string, { name: string; path: string }[]>();
  const flowMap = literalAfter(source, /const\s+FLOW_SUBSTEPS\b[^=]*=/, `FLOW_SUBSTEPS in ${REGISTRY_FILE}`);
  for (const m of flowMap.matchAll(/(["'])(\/console[^"']*)\1\s*:\s*\[/g)) {
    flowSubSteps.set(m[2], readSubSteps(balanced(flowMap, m.index + m[0].length - 1)));
  }

  const raw = literalAfter(source, /const\s+TOOLS_RAW\b[^=]*=/, `TOOLS_RAW in ${REGISTRY_FILE}`);
  return topLevelObjects(raw).map((item) => {
    const name = stringField(item, 'name');
    const path = stringField(item, 'path');
    if (!name || !path) throw new Error(`registry entry without name or path: ${item.slice(0, 120)}`);
    const inline = item.match(/\bsubSteps\s*:\s*\[/);
    const subSteps = inline
      ? readSubSteps(balanced(item, inline.index! + inline[0].length - 1))
      : (flowSubSteps.get(path) ?? []);
    return { name, path, external: /\bexternal\s*:\s*true\b/.test(item), subSteps };
  });
}

/** Lists the page folders under app/console, relative to it, sorted. A route group or private folder is not a route. */
function pageFolders(dir: string, rel = ''): string[] {
  const out: string[] = [];
  if (existsSync(join(dir, 'page.tsx')) || existsSync(join(dir, 'page.ts')) || existsSync(join(dir, 'page.mdx'))) out.push(rel);
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('@')) continue;
    out.push(...pageFolders(join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name));
  }
  return out;
}

/** Resolves an import specifier of a page file: "@/x" from the repo root, "./x" from the file. */
function resolveImport(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? join(REPO_ROOT, specifier.slice(2)) : resolve(dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The URL keys of a step list: the key of each single step, and the option keys of a branch step. */
function stepKeys(stepsFile: string): { key: string; title: string }[] {
  const source = stripComments(readFileSync(stepsFile, 'utf8'));
  const list = literalAfter(source, /export\s+const\s+\w*[sS]teps\b[^=]*=/, `the steps array in ${stepsFile}`);
  const keys: { key: string; title: string }[] = [];
  for (const step of topLevelObjects(list)) {
    const options = step.match(/\boptions\s*:\s*\[/);
    if (options) {
      for (const option of topLevelObjects(balanced(step, options.index! + options[0].length - 1))) {
        const key = stringField(option, 'key');
        if (key) keys.push({ key, title: stringField(option, 'label') ?? key });
      }
    } else {
      const key = stringField(step, 'key');
      if (key) keys.push({ key, title: stringField(step, 'title') ?? key });
    }
  }
  return keys;
}

/**
 * The step list of a dynamic page folder: the steps file that its page.tsx or client-page.tsx imports.
 * A folder that imports none (a legacy redirect, a job ID, a chain ID) returns null.
 */
function dynamicStepKeys(folder: string): { key: string; title: string }[] | null {
  for (const name of ['page.tsx', 'client-page.tsx']) {
    const file = join(folder, name);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    const m = source.match(/from\s+["']([^"']*steps)["']/);
    const stepsFile = m && resolveImport(file, m[1]);
    if (stepsFile) return stepKeys(stepsFile);
  }
  return null;
}

/**
 * Every Console tool route, read from the repo at collection time with Node fs only
 * (the CI job installs only tests/e2e, not the repo's node_modules):
 * 1. Each internal entry and sub-step of the registry, tools.ts.
 * 2. Each step of a step flow ([step] or [phase] folder) that the registry does not list.
 * 3. Each static page under app/console that the registry does not list.
 * A route shows once, with its first source.
 */
export function listConsoleRoutes(): ConsoleRouteList {
  const appDir = join(REPO_ROOT, CONSOLE_APP_DIR);
  if (!statSync(appDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${CONSOLE_APP_DIR} not found under ${REPO_ROOT}`);
  }

  const routes: ConsoleRoute[] = [];
  const seen = new Set<string>();
  const add = (route: string, label: string, source: RouteSource) => {
    if (seen.has(route)) return;
    seen.add(route);
    routes.push({ route, label, source });
  };

  const registry = readRegistry();
  let registryRouteCount = 0;
  for (const tool of registry) {
    if (tool.external || !tool.path.startsWith('/console')) continue;
    registryRouteCount++;
    add(tool.path, tool.name, 'registry');
    for (const step of tool.subSteps) {
      if (!step.path.startsWith('/console')) continue;
      registryRouteCount++;
      add(step.path, `${tool.name} > ${step.name}`, 'registry');
    }
  }

  const notEnumerated: string[] = [];
  const folders = pageFolders(appDir);
  for (const rel of folders) {
    const segments = rel ? rel.split('/') : [];
    const dynamicAt = segments.findIndex((segment) => /^\[.+\]$/.test(segment));
    if (dynamicAt < 0) continue;
    const keys = dynamicAt === segments.length - 1 ? dynamicStepKeys(join(appDir, rel)) : null;
    if (!keys) {
      notEnumerated.push(`/console/${rel}`);
      continue;
    }
    const parent = ['/console', ...segments.slice(0, dynamicAt)].join('/');
    for (const { key, title } of keys) add(`${parent}/${key}`, title, 'flow-step');
  }

  for (const rel of folders) {
    if (/\[.+\]/.test(rel)) continue;
    add(rel ? `/console/${rel}` : '/console', rel || 'console', 'route-tree');
  }

  return { routes, registry, registryRouteCount, notEnumerated };
}

/** The page folder of a route under app/console, or null. It tries a static folder first, then a [param] folder. */
export function pageFolderOf(route: string): string | null {
  let dir = join(REPO_ROOT, CONSOLE_APP_DIR);
  for (const segment of route.replace(/^\/console\/?/, '').split('/').filter(Boolean)) {
    const exact = join(dir, segment);
    if (existsSync(exact) && statSync(exact).isDirectory()) {
      dir = exact;
      continue;
    }
    const dynamic = readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory() && /^\[.+\]$/.test(e.name));
    if (!dynamic) return null;
    dir = join(dir, dynamic.name);
  }
  return existsSync(join(dir, 'page.tsx')) ? relative(REPO_ROOT, dir).split('\\').join('/') : null;
}
