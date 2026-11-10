// The import graph of the site, and the groups of pages that reach each file. select.ts turns the groups into units.
//
// Edges:
// - value imports: static imports and re-exports, import() and require() with a literal, MDX import lines, CSS @import.
// - type imports: `import type` and `export type`. A file that only type imports reach has no effect at run time.
// - assets: a literal URL that names a file in public/ ('/images/logo.png').
// - fetches: a literal '/api/...' URL in a code file, to the app/api route that serves it.
// The generated .source/index.ts is not read: content files are entries of their own groups (rules.ts).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { ALL_PAGE_ENTRIES, CONTENT_GROUPS, GROUPS, groupOfUrl, type GroupName } from './rules.ts';

export const CODE = /\.(ts|tsx|js|jsx|mjs|mts|cjs|cts)$/;
const MDX = /\.mdx?$/;
const CSS = /\.css$/;
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.mdx', '.md', '.json', '.css'];
const INDEXES = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.mjs', '/index.mdx'];

// The route files of app/ that answer a URL. A layout, template, loading, error or default file wraps the pages
// under its folder.
export const ROUTE_FILE =
  /^(page|route|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(ts|tsx|js|jsx|mdx)$/;
export const WRAPPER_FILE = /^(layout|template|loading|error|global-error|not-found|default)\.(ts|tsx|js|jsx)$/;
// These wrap every page of the site, whatever their folder.
export const SITE_WRAPPERS = ['app/not-found.tsx', 'app/error.tsx', 'app/global-error.tsx'];

const ASSET_URL =
  /\/[A-Za-z0-9_\-./@%]+\.(?:png|jpe?g|webp|svg|gif|avif|ico|mp4|webm|woff2?|ttf|otf|json|ya?ml|pdf|txt|wasm|zkey|csv|geojson)\b/g;
const API_LITERAL = /(?:["'`]|\})(\/api\/[A-Za-z0-9_\-./[\]]*)/g;

export interface RouteFile {
  file: string;
  /** The URL of the route, or of the folder that a wrapper wraps. */
  url: string;
  kind: 'route' | 'wrapper';
}

export interface Graph {
  files: Set<string>;
  /** The route and wrapper files of app/. */
  routes: RouteFile[];
  /** For each code file, the '/api/...' literals it names. */
  apiLiterals: Map<string, string[]>;
  /** The groups of pages that reach a file through value imports and assets. */
  valueGroups: Map<string, Set<GroupName>>;
  /** Files that type imports reach. */
  typeReached: Set<string>;
  /** The API route files that reach a file through value imports. */
  apiRoutes: Map<string, Set<string>>;
  /** For each API route file, the files whose code names its URL. */
  fetchers: Map<string, Set<string>>;
  /** For each public/ URL a code or MDX file names, the files that name it (the file may not exist). */
  assetNamers: Map<string, Set<string>>;
  /** Imports of a local path that matched no file. */
  unresolved: string[];
  /** Files with an import() or require() of a computed path, which the graph cannot follow. */
  computed: string[];
}

interface Imports {
  value: string[];
  type: string[];
  computed?: boolean;
}

function codeImports(file: string, text: string): Imports {
  const kind = /\.(tsx|jsx)$/.test(file)
    ? ts.ScriptKind.TSX
    : /\.(js|mjs|cjs)$/.test(file)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, kind);
  const out: Imports = { value: [], type: [] };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly ||
        (!!clause &&
          !clause.name &&
          !!named &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((element) => element.isTypeOnly));
      (typeOnly ? out.type : out.value).push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      (node.isTypeOnly ? out.type : out.value).push(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (ts.isStringLiteral(expression)) out.value.push(expression.text);
    } else if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const required = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if ((dynamic || required) && first) {
        if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) out.value.push(first.text);
        else out.computed = true;
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)) out.type.push(argument.literal.text);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

// MDX import lines, outside code fences.
function mdxImports(text: string): Imports {
  const body = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
  const value = [
    ...[...body.matchAll(/^(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]),
    ...[...body.matchAll(/^import\s+["']([^"']+)["']/gm)].map((m) => m[1]),
  ];
  return { value, type: [] };
}

function cssImports(text: string): Imports {
  return { value: [...text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)].map((m) => m[1]), type: [] };
}

/** The tracked files under `path`, as git lists them. -z keeps a non-ASCII name as it is, not quoted. */
export function gitFiles(repo: string, path = '.'): string[] {
  return execFileSync('git', ['-C', repo, 'ls-files', '-z', '--', path], { encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\0')
    .filter(Boolean);
}

/** The tracked files of the repo outside tests/. */
export function trackedFiles(repo: string): string[] {
  return gitFiles(repo).filter((file) => !file.startsWith('tests/'));
}

/** The URL of a route or wrapper file of app/: route groups, parallel slots and the file name left out. */
export function urlOf(file: string): string {
  const segments = file.split('/').slice(1, -1);
  return `/${segments.filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith('@')).join('/')}`;
}

export function buildGraph(repo: string, tracked: string[] = trackedFiles(repo)): Graph {
  const files = new Set(tracked.filter((file) => existsSync(join(repo, file))));
  const topDirs = new Set([...files].filter((file) => file.includes('/')).map((file) => file.split('/')[0]));
  const unresolved: string[] = [];
  const computed: string[] = [];

  const tryFile = (base: string): string | null => {
    const path = posix.normalize(base);
    for (const ext of EXTENSIONS) if (files.has(path + ext)) return path + ext;
    for (const index of INDEXES) if (files.has(path + index)) return path + index;
    return null;
  };

  // The tsconfig paths (@/, @/stores/, @console-header/) and baseUrl ".", then relative paths.
  const resolve = (from: string, specifier: string): string | null => {
    const spec = specifier.replace(/[?#].*$/, '');
    let base: string;
    if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
      base = posix.join(posix.dirname(from), spec);
    } else if (spec === '@/.source' || spec.startsWith('@/.source/')) {
      return null;
    } else if (spec.startsWith('@/stores/')) {
      base = `components/toolbox/stores/${spec.slice('@/stores/'.length)}`;
    } else if (spec.startsWith('@console-header/')) {
      base = `components/toolbox/components/console-header/${spec.slice('@console-header/'.length)}`;
    } else if (spec.startsWith('@/')) {
      base = spec.slice(2);
    } else if (topDirs.has(spec.split('/')[0]) && !spec.startsWith('node_modules/')) {
      return tryFile(spec);
    } else {
      return null; // a package
    }
    if (base.startsWith('node_modules/')) return null; // a package by its path
    const hit = tryFile(base);
    if (!hit) unresolved.push(`${from} -> ${specifier}`);
    return hit;
  };

  const valueEdges = new Map<string, Set<string>>();
  const typeEdges = new Map<string, Set<string>>();
  const assetNamers = new Map<string, Set<string>>();
  const apiLiterals = new Map<string, string[]>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  };

  for (const file of files) {
    const code = CODE.test(file) && !file.endsWith('.d.ts');
    const mdx = MDX.test(file) && (file.startsWith('content/') || file.startsWith('app/'));
    const css = CSS.test(file);
    if (!code && !mdx && !css) continue;
    const text = readFileSync(join(repo, file), 'utf8');
    const imports = code ? codeImports(file, text) : mdx ? mdxImports(text) : cssImports(text);
    if (imports.computed) computed.push(file);
    for (const spec of imports.value) {
      const target = resolve(file, spec);
      if (target && target !== file) add(valueEdges, file, target);
    }
    for (const spec of imports.type) {
      const target = resolve(file, spec);
      if (target && target !== file) add(typeEdges, file, target);
    }
    for (const match of text.matchAll(ASSET_URL)) {
      const url = safeDecode(match[0]);
      add(assetNamers, url, file);
      if (files.has(`public${url}`)) add(valueEdges, file, `public${url}`);
    }
    if (code) {
      const literals = [...text.matchAll(API_LITERAL)].map((m) => m[1]);
      if (literals.length) apiLiterals.set(file, literals);
    }
  }

  // Entries: route files and wrappers of app/, content files, and the files that shape every page.
  const entries = new Map<string, Set<GroupName>>();
  const routes: RouteFile[] = [];
  for (const file of files) {
    if (!file.startsWith('app/')) continue;
    const name = file.slice(file.lastIndexOf('/') + 1);
    const kind = ROUTE_FILE.test(name) ? 'route' : WRAPPER_FILE.test(name) ? 'wrapper' : null;
    if (!kind) continue;
    if (
      file
        .split('/')
        .slice(1, -1)
        .some((segment) => segment.startsWith('_'))
    )
      continue; // a private folder
    routes.push({ file, url: urlOf(file), kind });
  }
  const pages = routes.filter((route) => route.kind === 'route');
  for (const route of routes) {
    if (route.kind === 'route') {
      add(entries, route.file, groupOfUrl(route.url, route.file));
      continue;
    }
    const folder = `${posix.dirname(route.file)}/`;
    const under = pages.filter((page) => page.file.startsWith(folder));
    for (const page of under.length ? under : [route]) add(entries, route.file, groupOfUrl(page.url, page.file));
  }
  const pageGroups = (Object.keys(GROUPS) as GroupName[]).filter(
    (group) => group !== 'all' && !group.startsWith('api'),
  );
  for (const file of SITE_WRAPPERS) if (files.has(file)) for (const group of pageGroups) add(entries, file, group);
  for (const file of files) {
    const collection = file.startsWith('content/') && MDX.test(file) ? file.split('/')[1] : '';
    for (const group of CONTENT_GROUPS[collection] ?? []) add(entries, file, group);
  }
  for (const file of ALL_PAGE_ENTRIES) if (files.has(file)) add(entries, file, 'all');

  // Value reach of each group.
  const valueGroups = new Map<string, Set<GroupName>>();
  const byGroup = new Map<GroupName, string[]>();
  for (const [file, groups] of entries)
    for (const group of groups) byGroup.set(group, [...(byGroup.get(group) ?? []), file]);
  for (const [group, starts] of byGroup) {
    for (const file of walk(starts, [valueEdges])) add(valueGroups, file, group);
  }

  // Type reach: every file that a value or type import of any reached file names.
  const typeReached = new Set<string>();
  const reached = [...valueGroups.keys()];
  for (const file of walk(reached, [valueEdges, typeEdges])) if (!valueGroups.has(file)) typeReached.add(file);

  // The API routes that reach each file, and the files that fetch each API route.
  const apiRouteFiles = pages.filter((page) => page.url.startsWith('/api/')).map((page) => page.file);
  const apiRoutes = new Map<string, Set<string>>();
  for (const route of apiRouteFiles) for (const file of walk([route], [valueEdges])) add(apiRoutes, file, route);
  const matchers = pages.filter((page) => page.url.startsWith('/api/')).map(toMatcher);
  const fetchers = new Map<string, Set<string>>();
  for (const [file, literals] of apiLiterals) {
    for (const literal of literals)
      for (const route of routesForLiteral(literal, matchers)) if (route !== file) add(fetchers, route, file);
  }

  return {
    files,
    routes,
    apiLiterals,
    valueGroups,
    typeReached,
    apiRoutes,
    fetchers,
    assetNamers,
    unresolved,
    computed,
  };
}

/** The files whose '/api/...' literals name one API route, which need not exist in the graph (a removed route). */
export function fetchersOf(route: RouteFile, graph: Graph): string[] {
  const matcher = [toMatcher(route)];
  return [...graph.apiLiterals]
    .filter(
      ([file, literals]) =>
        file !== route.file && literals.some((literal) => routesForLiteral(literal, matcher).length),
    )
    .map(([file]) => file);
}

function toMatcher(route: { file: string; url: string }): { file: string; segments: string[] } {
  return { file: route.file, segments: route.url.split('/').filter(Boolean) };
}

function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function walk(starts: string[], edgeMaps: Map<string, Set<string>>[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const edges of edgeMaps) for (const next of edges.get(file) ?? []) if (!seen.has(next)) stack.push(next);
  }
  return seen;
}

// A literal that ends in "/" is a prefix that the code completes at run time (`/api/explorer/${id}`): it names every
// route under it. A whole literal names the route that matches it best.
function routesForLiteral(literal: string, routes: { file: string; segments: string[] }[]): string[] {
  const path = literal.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) return [];
  const dynamic = (segment: string) => segment.startsWith('[');
  if (path.endsWith('/')) {
    return routes
      .filter((route) =>
        segments.every(
          (segment, i) =>
            route.segments[i] === segment || (route.segments[i] !== undefined && dynamic(route.segments[i])),
        ),
      )
      .filter((route) => route.segments.length > segments.length || route.segments.some((s) => s.startsWith('[...')))
      .map((route) => route.file);
  }
  let best: { file: string; score: number } | null = null;
  for (const route of routes) {
    let score = 0;
    let ok = true;
    for (let i = 0; i < Math.max(route.segments.length, segments.length); i++) {
      const own = route.segments[i];
      const named = segments[i];
      if (own === undefined) {
        ok = false;
        break;
      }
      if (own.startsWith('[[...')) {
        score += 0.1;
        break;
      }
      if (own.startsWith('[...')) {
        ok = named !== undefined;
        score += 0.2;
        break;
      }
      if (named === undefined || (!dynamic(own) && own !== named)) {
        ok = false;
        break;
      }
      score += dynamic(own) ? 0.5 : 1;
    }
    if (ok && (!best || score > best.score)) best = { file: route.file, score };
  }
  return best ? [best.file] : [];
}
