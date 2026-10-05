// Picks the units of the suite that a PR's changed files can break. Each changed file gets the first answer of:
//  1. RUN_ALL: a shared file (dependencies, config, the e2e runner, this selector): every unit.
//  2. NO_PAGE: a file no page reads (docs, lint config, unit tests): no unit.
//  3. A file of tests/e2e: the units whose test files import it.
//  4. A content file: the pages of its collection. A public file: the pages of the files that name its URL.
//  5. A code file: the import graph (graph.ts), plus the pages that fetch an API route the file serves. A file that
//     no page and no test reaches runs every unit, because the graph cannot see every way a file is used. A file
//     that only type imports reach runs none.
//  6. A removed file: a removed route or wrapper of app/ runs the pages under it, a removed API route the pages that
//     fetch it. Any other removed file runs none: the files that imported it changed in the same PR, or the build
//     fails.
// A file that a test helper reads at collection time also gets that helper's units (rules.ts COLLECTION_READS).

import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import {
  buildGraph,
  CODE,
  fetchersOf,
  gitFiles,
  ROUTE_FILE,
  SITE_WRAPPERS,
  urlOf,
  WRAPPER_FILE,
  type Graph,
} from './graph.ts';
import {
  AI_FILES,
  ALL_PAGE_ENTRIES,
  COLLECTION_READS,
  CONTENT_GROUPS,
  GROUPS,
  NO_PAGE,
  RUN_ALL,
  SMOKE_TAG,
  SMOKE_UNITS,
  SWEEP_TAG,
  SWEEP_UNITS,
  UNITS,
  groupOfUrl,
  matches,
  type GroupName,
  type Unit,
} from './rules.ts';

export interface Change {
  file: string;
  status: string; // added, modified, removed, renamed, copied, changed, unchanged (the GitHub PR files API)
  previous?: string;
}

export interface Reason {
  file: string;
  why: string;
  units: readonly Unit[];
}

export interface Selection {
  all: boolean;
  units: Unit[];
  reasons: Reason[];
}

export interface Context {
  repo: string;
  graph: Graph;
  /** For each file of tests/e2e (a path inside it), the units whose test files import it. */
  tests: Map<string, Set<Unit>>;
}

interface Reach {
  groups: Set<GroupName>;
  /** An API route that reaches the file has no page that fetches it. */
  unnamed: boolean;
}

export function loadContext(repo: string): Context {
  return { repo, graph: buildGraph(repo), tests: buildTestGraph(repo) };
}

export function select(changes: Change[], context: Context): Selection {
  const reasons: Reason[] = [];
  for (const change of changes) {
    reasons.push(place(change.file, change.status === 'removed', context));
    // A renamed file leaves its old path: place that path as a removed file.
    if (change.previous && change.previous !== change.file) reasons.push(place(change.previous, true, context));
  }
  for (const reason of [...reasons]) {
    const read = COLLECTION_READS[reason.file];
    if (read) reasons.push({ file: reason.file, why: 'a test helper reads it to list its tests', units: read });
  }
  const all = reasons.some((reason) => reason.units.length === UNITS.length);
  const picked = new Set(reasons.flatMap((reason) => reason.units));
  return { all, units: all ? [...UNITS] : UNITS.filter((unit) => picked.has(unit)), reasons };
}

function place(file: string, removed: boolean, { graph, tests }: Context): Reason {
  const reason = (why: string, units: readonly Unit[]): Reason => ({ file, why, units });
  if (matches(file, RUN_ALL)) return reason('shared: dependencies, config, or the e2e runner', UNITS);
  if (matches(file, NO_PAGE)) return reason('no page or test reads it', []);

  if (file.startsWith('tests/e2e/')) {
    const path = file.slice('tests/e2e/'.length);
    if (path.startsWith('.e2e/cache/')) return reason('the replay cache of the agent tests', aiUnits());
    const own = unitsOfTestFile(path);
    if (own.length) return reason('a test file', own);
    if (path === 'api/e2e.config.ts') return reason('the API test config', ['api']);
    if (path === 'webview/e2e.config.ts') return reason('the in-app browser test config', ['webview']);
    const users = tests.get(path);
    if (users?.size) return reason('a test helper', sorted(users));
    if (removed) return reason('a removed test helper: the files that imported it changed too', []);
    return reason('a file in tests/e2e that no test imports', UNITS);
  }

  if (file.startsWith('content/') && !CODE.test(file)) {
    const groups = CONTENT_GROUPS[file.split('/')[1]];
    if (!groups) return reason('content of an unknown collection', UNITS);
    return reason(`content: ${groups.map((group) => GROUPS[group].label).join(', ')}`, unitsOf(groups));
  }

  if (file.startsWith('public/')) {
    const namers = [...(graph.assetNamers.get(file.slice('public'.length)) ?? [])];
    const { groups, unnamed } = merge(namers.map((namer) => reachOf(namer, graph)));
    if (unitsOf([...groups]).length) return describe(file, 'its URL is named by code of', groups);
    // A removed file that no code names any more broke nothing: a page that named it changed in this PR too.
    if (removed && !namers.length) return reason('a removed public file that no code names', []);
    if (unnamed) return reason('a public file that only an API route that no page names uses', UNITS);
    return reason('a public file that no page reaches', UNITS);
  }

  if (removed || !graph.files.has(file)) {
    if (ALL_PAGE_ENTRIES.includes(file) || SITE_WRAPPERS.includes(file)) {
      return reason('a removed file that every page uses', UNITS);
    }
    const name = file.slice(file.lastIndexOf('/') + 1);
    if (file.startsWith('app/') && ROUTE_FILE.test(name)) return removedRoute(file, graph);
    if (file.startsWith('app/') && WRAPPER_FILE.test(name)) return removedWrapper(file, graph);
    return reason('removed: the files that imported it changed too', []);
  }

  const { groups, unnamed } = reachOf(file, graph);
  if (unitsOf([...groups]).length) return describe(file, 'reached from', groups);
  if (unnamed) return reason('an API route that no page names', UNITS);
  if (graph.typeReached.has(file)) return reason('only type imports reach it', []);
  return reason('no page reaches it in the import graph', UNITS);
}

// The groups that reach a code file through imports and, for each API route that reaches it, the groups of the
// pages that fetch that route by URL. The answer does not depend on the order of the routes.
function reachOf(file: string, graph: Graph): Reach {
  const groups = new Set(graph.valueGroups.get(file) ?? []);
  let unnamed = false;
  for (const route of graph.apiRoutes.get(file) ?? []) {
    const fetched = pageGroups([...(graph.fetchers.get(route) ?? [])], graph);
    if (!fetched.size) unnamed = true;
    for (const group of fetched) groups.add(group);
  }
  return { groups, unnamed };
}

function merge(reaches: Reach[]): Reach {
  return {
    groups: new Set(reaches.flatMap((reach) => [...reach.groups])),
    unnamed: reaches.some((reach) => reach.unnamed),
  };
}

// The groups of a list of files that run tests. An API group runs none by itself.
function pageGroups(files: string[], graph: Graph): Set<GroupName> {
  const groups = files.flatMap((file) => [...(graph.valueGroups.get(file) ?? [])]);
  return new Set(groups.filter((group) => GROUPS[group].units.length));
}

// A removed route file: the group of its URL. A removed API route: the pages that still fetch it by URL.
function removedRoute(file: string, graph: Graph): Reason {
  const route = { file, url: urlOf(file), kind: 'route' as const };
  const group = groupOfUrl(route.url, file);
  if (GROUPS[group].units.length) return describe(file, 'a removed route of', new Set([group]));
  const groups = pageGroups(fetchersOf(route, graph), graph);
  if (groups.size) return describe(file, 'a removed API route that code of these pages fetches:', groups);
  return { file, why: 'a removed API route that no page names', units: UNITS };
}

// A removed layout, template, loading, error or not-found file: the pages under its folder. Nothing imports a
// wrapper (Next.js applies it by its folder), so no other changed file carries its pages.
function removedWrapper(file: string, graph: Graph): Reason {
  const folder = `${posix.dirname(file)}/`;
  if (folder === 'app/') return { file, why: 'a removed wrapper of every page', units: UNITS };
  const under = graph.routes.filter((route) => route.kind === 'route' && route.file.startsWith(folder));
  if (!under.length) return { file, why: 'a removed wrapper with no page left under it', units: [] };
  return describe(file, 'a removed wrapper of', new Set(under.map((route) => groupOfUrl(route.url, route.file))));
}

function describe(file: string, how: string, groups: Set<GroupName>): Reason {
  const named = [...groups].filter((group) => GROUPS[group].units.length);
  const labels = named.includes('all') ? GROUPS.all.label : named.map((group) => GROUPS[group].label).join(', ');
  return { file, why: `${how} ${labels}`, units: unitsOf(named) };
}

function unitsOf(groups: readonly GroupName[]): Unit[] {
  const picked = new Set(groups.flatMap((group) => GROUPS[group].units));
  return UNITS.filter((unit) => picked.has(unit));
}

function sorted(units: Set<Unit>): Unit[] {
  return UNITS.filter((unit) => units.has(unit));
}

function aiUnits(): Unit[] {
  return UNITS.filter((unit) => unit.startsWith('ai:'));
}

/** The units of a test file (a path inside tests/e2e): its folder, or for ai/ every unit that lists it. */
export function unitsOfTestFile(path: string): Unit[] {
  if (!path.endsWith('.e2e.ts')) return [];
  const [folder, name] = path.split('/');
  if (folder === 'ai') {
    const base = (name ?? '').replace(/\.e2e\.ts$/, '');
    return UNITS.filter((unit) => AI_FILES[unit]?.includes(base));
  }
  return (UNITS as readonly string[]).includes(folder) ? [folder as Unit] : [];
}

// The tracked files of tests/e2e, as paths inside it.
function testFiles(repo: string): string[] {
  return gitFiles(repo, 'tests/e2e')
    .map((file) => file.slice('tests/e2e/'.length))
    .filter((file) => existsSync(join(repo, 'tests/e2e', file)));
}

// The test helpers of tests/e2e and the units whose test files import them.
function buildTestGraph(repo: string): Map<string, Set<Unit>> {
  const files = testFiles(repo).filter((file) => /\.(ts|mts|js|mjs)$/.test(file));
  const known = new Set(files);
  const edges = new Map<string, string[]>();
  for (const file of files) {
    const text = readFileSync(join(repo, 'tests/e2e', file), 'utf8');
    const targets = ts
      .preProcessFile(text, true, true)
      .importedFiles.map((imported) => imported.fileName)
      .filter((spec) => spec.startsWith('.'))
      .map((spec) => posix.join(posix.dirname(file), spec))
      .map((base) => [base, `${base}.ts`, `${base}/index.ts`].find((candidate) => known.has(candidate)))
      .filter((target): target is string => !!target);
    edges.set(file, targets);
  }
  const users = new Map<string, Set<Unit>>();
  for (const file of files) {
    for (const unit of unitsOfTestFile(file)) {
      const stack = [file];
      const seen = new Set<string>();
      while (stack.length) {
        const next = stack.pop() as string;
        if (seen.has(next)) continue;
        seen.add(next);
        const set = users.get(next) ?? new Set<Unit>();
        set.add(unit);
        users.set(next, set);
        stack.push(...(edges.get(next) ?? []));
      }
    }
  }
  return users;
}

/**
 * The places where the hand-kept rules no longer match the suite or the code. The plan job fails on any of them,
 * because each one can shrink a selection with no sign: a test file that no unit lists never runs on a PR, and an
 * import that the graph cannot follow hides the pages that a file is on.
 */
export function checkSuite({ repo, graph }: Context): string[] {
  const problems: string[] = [];
  const files = testFiles(repo);

  // chain/ has its own config and workflow (e2e-chain.yml): no PR unit runs it.
  for (const file of files.filter((f) => f.endsWith('.e2e.ts') && !f.startsWith('chain/'))) {
    if (!unitsOfTestFile(file).length) {
      problems.push(
        `tests/e2e/${file}: no unit runs it. Add its folder to UNITS, or the file to AI_FILES (select/rules.ts).`,
      );
    }
  }
  const aiNames = new Set(
    files
      .filter((f) => f.startsWith('ai/') && f.endsWith('.e2e.ts'))
      .map((f) => f.slice('ai/'.length, -'.e2e.ts'.length)),
  );
  for (const [unit, names] of Object.entries(AI_FILES)) {
    for (const name of names) {
      if (!aiNames.has(name)) problems.push(`AI_FILES['${unit}'] lists ai/${name}.e2e.ts, which does not exist.`);
    }
  }

  for (const file of files.filter((f) => f.endsWith('.ts') && !f.startsWith('select/'))) {
    const text = readFileSync(join(repo, 'tests/e2e', file), 'utf8');
    const unit = file.split('/')[0] as Unit;
    if (new RegExp(`\\[[^\\]\\n]*'${SMOKE_TAG}'`).test(text) && !SMOKE_UNITS.includes(unit)) {
      problems.push(`tests/e2e/${file}: a smoke test outside the smoke folders. Add its folder to SMOKE_UNITS.`);
    }
    if (new RegExp(`tags: \\['${SWEEP_TAG}'\\]`).test(text) && !SWEEP_UNITS.includes(unit)) {
      problems.push(`tests/e2e/${file}: a sweep outside the sweep folders. Add its folder to SWEEP_UNITS.`);
    }
    const paths = text.matchAll(
      /['"`]((?:app|components|lib|hooks|utils|server)\/[^'"`$]+\.(?:ts|tsx|mts|mjs|json))['"`]/g,
    );
    for (const [, path] of paths) {
      if (!COLLECTION_READS[path] && !matches(path, RUN_ALL)) {
        problems.push(`tests/e2e/${file} reads ${path} to list its tests. Add it to COLLECTION_READS.`);
      }
    }
  }

  const site = /^(app|components|lib|hooks|server|utils)\//;
  for (const file of graph.computed.filter((f) => site.test(f))) {
    problems.push(`${file}: an import() or require() of a computed path, which the import graph cannot follow.`);
  }
  for (const edge of graph.unresolved) {
    if (!edge.split(' -> ')[0].includes('.test.'))
      problems.push(`${edge}: a local import that the graph cannot resolve.`);
  }
  return problems;
}
