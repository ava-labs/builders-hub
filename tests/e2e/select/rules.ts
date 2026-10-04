// The tables of the PR test selection: what a selection can run, which pages each unit opens, and the files that
// the import graph cannot place. select.ts reads them. Read the "Test selection" part of tests/e2e/README.md first.

// A unit is a part of the suite that a selection can run on its own.
export const UNITS = [
  'academy',
  'console',
  'docs',
  'embeds',
  'explorer',
  'routes',
  'site',
  'api',
  'ai:academy',
  'ai:console',
  'ai:docs',
  'ai:explorer',
  'ai:site',
] as const;
export type Unit = (typeof UNITS)[number];

// The ai/ folder is split by the areas each file opens, so a change to one area runs only that area's agent tests.
// Each file of ai/ must be in at least one list: the plan job checks it (checkSuite in select.ts).
export const AI_FILES: Record<string, readonly string[]> = {
  'ai:academy': ['academy-quiz', 'agent-smoke', 'data-academy', 'journey-academy', 'visual-academy'],
  'ai:console': ['console-wallet-gate', 'data-console', 'journey-console', 'visual-console'],
  'ai:docs': ['data-docs', 'docs-search', 'journey-docs', 'site-navigation', 'visual-docs'],
  'ai:explorer': [
    'data-explorer',
    'explorer-transaction',
    'journey-explorer',
    'journey-explorer-chain-switch',
    'journey-explorer-fuji',
    'site-navigation',
    'visual-explorer',
  ],
  'ai:site': ['journey-site', 'site-navigation', 'visual-home', 'visual-phone-menu'],
};

// The arguments of `e2e run` that select a unit. The API tests have their own config, so they are not a path.
export function unitPaths(unit: Unit): string[] {
  if (unit === 'api') return [];
  if (unit.startsWith('ai:')) return (AI_FILES[unit] ?? []).map((name) => `ai/${name}.e2e.ts`);
  return [`${unit}/`];
}

// A group is a set of pages. Each group lists the units whose tests open its pages.
interface Group {
  label: string;
  units: readonly Unit[];
}

export const GROUPS = {
  explorer: { label: 'Explorer pages', units: ['explorer', 'site', 'ai:explorer'] },
  console: { label: 'Console pages', units: ['console', 'site', 'ai:console'] },
  academy: { label: 'Academy course pages', units: ['academy', 'embeds', 'ai:academy'] },
  'academy-home': { label: 'the Academy home', units: ['academy', 'site', 'routes', 'ai:academy'] },
  docs: { label: 'docs pages', units: ['docs', 'embeds', 'site', 'ai:docs'] },
  'docs-home': { label: 'the /docs redirect', units: ['docs', 'routes'] },
  blog: { label: 'blog pages', units: ['routes', 'site'] },
  integrations: { label: 'integrations pages', units: ['routes', 'site', 'ai:site'] },
  home: { label: 'the home page', units: ['site', 'routes', 'ai:site'] },
  stats: { label: 'stats pages', units: ['routes'] },
  'site-core': { label: 'the site pages that site/ opens', units: ['site', 'routes', 'ai:site'] },
  'site-pages': { label: 'other site pages', units: ['routes'] },
  'text-routes': { label: 'text routes (/llms.txt and others)', units: ['routes'] },
  'api-raw': { label: 'the raw MDX API', units: ['routes'] },
  'api-mcp': { label: 'the MCP API', units: ['api'] },
  // An API route that no page names. Its pages are found through the fetch literals (select.ts).
  'api-other': { label: 'other API routes', units: [] },
  // Files that shape every page: the build, the proxy, the Next.js config.
  all: { label: 'every page', units: UNITS },
} satisfies Record<string, Group>;
export type GroupName = keyof typeof GROUPS;

// The site pages that site/ and ai/ open by name. The routes sweep opens every other site page.
const SITE_CORE = ['/grants', '/events', '/solutions', '/validator-alerts', '/guides'];
const TEXT_ROUTES = ['/llms.txt', '/llms-full.txt', '/mcp-manifest', '/static.json', '/install'];

// The group of a route file of app/, from its URL. `file` tells the Academy and docs front doors in the (home)
// route group from the course and docs pages, which share their URL prefix.
export function groupOfUrl(url: string, file: string): GroupName {
  const under = (prefix: string) => url === prefix || url.startsWith(`${prefix}/`);
  if (file.startsWith('app/(home)/academy/')) return 'academy-home';
  if (file.startsWith('app/(home)/docs/')) return 'docs-home';
  if (under('/explorer')) return 'explorer';
  if (under('/console')) return 'console';
  if (under('/academy')) return 'academy';
  if (under('/docs')) return 'docs';
  if (under('/blog')) return 'blog';
  if (under('/integrations')) return 'integrations';
  if (under('/api/mcp')) return 'api-mcp';
  if (under('/api/raw')) return 'api-raw';
  if (under('/api')) return 'api-other';
  if (TEXT_ROUTES.some(under)) return 'text-routes';
  if (url === '/') return 'home';
  if (under('/stats')) return 'stats';
  if (SITE_CORE.includes(url)) return 'site-core';
  return 'site-pages';
}

// Each content collection renders on its own pages. /llms.txt and /llms-full.txt carry the Academy and docs text,
// and the routes sweep reads them.
export const CONTENT_GROUPS: Record<string, readonly GroupName[]> = {
  academy: ['academy', 'text-routes'],
  docs: ['docs', 'text-routes'],
  common: ['academy', 'docs', 'text-routes'],
  blog: ['blog'],
  integrations: ['integrations'],
};

// Files that are graph entries for every page: the build runs them, or they run before every request.
// mdx-components.tsx is not one: nothing imports it, and the site compiles MDX with fumadocs-mdx, not @next/mdx.
export const ALL_PAGE_ENTRIES = [
  'next.config.mjs',
  'proxy.ts',
  'source.config.ts',
  'scripts/build-remote.mjs',
  'scripts/build-with-typecheck.mjs',
  'scripts/update_docker_tags.mjs',
  'scripts/generate-event-signatures.mts',
  'scripts/academy/generate-course-stats.mts',
  'utils/update-index.ts',
];

// A pattern list: a string matches a path or a folder prefix that ends in '/'; a RegExp tests the whole path.
type Pattern = string | RegExp;
export function matches(file: string, patterns: readonly Pattern[]): boolean {
  return patterns.some((p) =>
    typeof p === 'string' ? (p.endsWith('/') ? file.startsWith(p) : file === p) : p.test(file),
  );
}

// A change here can change every page or every test: run every unit.
export const RUN_ALL: readonly Pattern[] = [
  'package.json',
  'yarn.lock',
  '.npmrc',
  '.yarnrc',
  'tsconfig.json',
  'postcss.config.mjs',
  'vercel.json',
  'next-env.d.ts',
  'components.json',
  'prisma/',
  '.github/workflows/e2e.yml',
  'tests/e2e/e2e.config.ts',
  'tests/e2e/package.json',
  'tests/e2e/package-lock.json',
  'tests/e2e/tsconfig.json',
  'tests/e2e/select/',
];

// A change here cannot change a page or a test: it needs no browser test. The smoke set still runs.
export const NO_PAGE: readonly Pattern[] = [
  /^(?!content\/|app\/|public\/).*\.md$/,
  // Next.js routes only page and route files, so a note in app/ (app/api/explorer/EXTERNAL_APIS.md) is not a page.
  /^app\/(?:.*\/)?(?!page\.md$)[^/]+\.md$/,
  'LICENSE',
  '.gitignore',
  '.prettierrc',
  '.prettierignore',
  '.lintstagedrc.js',
  'commitlint.config.js',
  'eslint.config.mjs',
  'vitest.config.ts',
  '.husky/',
  '.vscode/',
  'tests/unit/',
  'tests/stubs/',
  /\.test\.tsx?$/,
  /^scripts\/check-[^/]+$/,
  'scripts/explorer-size-ceilings.json',
  'tests/e2e/explore/',
  'tests/e2e/.gitignore',
  /^\.github\/(?!workflows\/e2e\.yml$)/,
];

// Repo files that a test helper reads when the runner collects the tests. A change to one changes the test list.
// tests/unit/ci/e2e-select.test.ts checks that every repo path a helper names is here.
export const COLLECTION_READS: Record<string, readonly Unit[]> = {
  'components/landing-v2/pillars.ts': ['routes'],
  'lib/rwa/projects.ts': ['routes'],
  'app/install/[tool]/route.ts': ['routes'],
  'lib/auth/protected-paths.ts': ['routes'],
  'next.config.mjs': ['routes'],
  'components/toolbox/console/toolbox/tools.ts': ['console'],
  'app/academy/[...slug]/page.tsx': ['embeds'],
};

// The smoke set: tests with the tag `smoke`, one page per area. A PR runs them in every unit it does not select.
export const SMOKE_TAG = 'smoke';
// The folders that hold the smoke tests: the plan job checks that no smoke test is elsewhere.
export const SMOKE_UNITS: readonly Unit[] = ['academy', 'docs', 'explorer', 'site'];

// The sweeps (tag sweep) open every page of an area. They live in these folders.
export const SWEEP_TAG = 'sweep';
export const SWEEP_UNITS: readonly Unit[] = ['console', 'embeds', 'routes'];
