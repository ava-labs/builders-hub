import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file is tests/e2e/routes/route-list.ts. The repo root is three folders up.
// Read paths from this file, not from the cwd, so the list is the same wherever the runner starts.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP_DIR = join(REPO_ROOT, 'app');

// Other suites cover these folders of app/: api/ (API tests), console/ (site/console.e2e.ts and the
// embed sweep), (home)/explorer (explorer/), academy/ and docs/ (academy/, docs/, embeds/).
const EXCLUDED_DIRS = ['api', 'console', '(home)/explorer', 'academy', 'docs'];

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;
const ROUTE_FILE = /^route\.(tsx|ts|jsx|js)$/;

// Where a visitor without a session lands, for the routes that send such a visitor to another path.
// next.config.mjs redirects are read from the file (staticRedirects). These come from code that runs per request.
const SESSIONLESS_REDIRECTS: Record<string, string> = {
  '/audits/portal': '/audits/portal/sign-in', // app/(audit-portal)/audits/portal/page.tsx
  '/audits/portal/firm': '/audits/portal/sign-in', // app/(audit-portal)/audits/portal/firm/page.tsx
  '/builder-insights': '/profile', // app/(home)/builder-insights/page.tsx, to ?tab=insights
  '/evaluate': '/', // app/(home)/evaluate/page.tsx
  '/events/edit': '/', // proxy.ts, the /events/edit branch
  '/events/new': '/', // app/(home)/events/new/page.tsx
  '/profile/rewards-board': '/profile', // app/(home)/profile/rewards-board/page.tsx, to ?tab=achievements
  '/projects/new': '/login', // app/(home)/projects/new/page.tsx, with ?callbackUrl=/projects/new
  '/send-notifications': '/profile', // app/(home)/send-notifications/page.tsx, to ?tab=notifications
  '/validator-notification': '/validator-alerts', // app/(home)/validator-notification/page.tsx
};

export interface SiteRoute {
  /** The path the test opens, for example /grants or /blog/226-min-block-times. */
  path: string;
  /** The page file, relative to the repo root. */
  file: string;
  /** The path the browser must show after the redirects, for a visitor without a session. */
  finalPath: string;
  /** The final path is in PROTECTED_PATHS (lib/auth/protected-paths.ts): the page opens the sign-in dialog. */
  signIn: boolean;
}

export interface SkippedRoute {
  /** The route pattern, for example /events/[id]. */
  pattern: string;
  /** Why the sweep does not open it. */
  reason: string;
  /** SKIP_REASONS states the reason. False for a new dynamic route that nobody has looked at yet. */
  stated: boolean;
}

/** Sorted directory entries, so the test order is stable. */
function entries(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

function readRepoFile(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** The first .mdx file name of a content folder, without the extension: one real slug. */
function firstMdxSlug(rel: string): string[] {
  const dir = join(REPO_ROOT, rel);
  if (!existsSync(dir)) return [];
  const file = entries(dir).find((e) => e.isFile() && e.name.endsWith('.mdx') && e.name !== 'index.mdx');
  return file ? [file.name.replace(/\.mdx$/, '')] : [];
}

/** The slugs of the PILLARS list in components/landing-v2/pillars.ts. generateStaticParams builds one page per pillar. */
function pillarSlugs(): string[] {
  const source = readRepoFile('components/landing-v2/pillars.ts');
  const block = source.match(/export const PILLARS[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return [];
  return [...block[1].matchAll(/^ {4}slug:\s*["']([^"']+)["']/gm)].map((m) => m[1]);
}

/** The first slug of the RWA_PROJECTS list in lib/rwa/projects.ts. getRWAProject finds it without network. */
function firstRwaSlug(): string[] {
  const source = readRepoFile('lib/rwa/projects.ts');
  const block = source.match(/export const RWA_PROJECTS[^=]*=\s*\{([\s\S]*?)\n\};?\n/);
  const slug = block?.[1].match(/^ {4}slug:\s*["']([^"']+)["']/m)?.[1];
  return slug ? [slug] : [];
}

/** The first tool of the INSTALL_SCRIPTS registry in app/install/[tool]/route.ts. */
function firstInstallTool(): string[] {
  const source = readRepoFile('app/install/[tool]/route.ts');
  const block = source.match(/const INSTALL_SCRIPTS[^=]*=\s*\{([\s\S]*?)\n\};/);
  const tool = block?.[1].match(/^\s*["']([^"']+)["']\s*:/m)?.[1];
  return tool ? [tool] : [];
}

// Real values for dynamic segments, read from content/ and data files without network.
// A pattern without an entry here, in REDIRECT_SAMPLES or in HANDLER_SAMPLES is skipped, with its reason in SKIP_REASONS.
const SAMPLES: Record<string, () => string[]> = {
  '/blog/[...slug]': () => firstMdxSlug('content/blog'),
  '/integrations/[...slug]': () => firstMdxSlug('content/integrations'),
  '/solutions/[slug]': pillarSlugs,
};

// The RWA view of the C-Chain DeFi tab in the mainnet explorer.
const RWA_VIEW = /^\/explorer\/mainnet\/c-chain\/defi\/rwa$/;

// Dynamic pages that only redirect. The sweep checks the redirect, not the page it lands on (explorer/ covers that).
// An RWA slug opens the RWA view. An unknown slug lands on /explorer/mainnet/c-chain/defi instead.
// Both pages call permanentRedirect, which answers 308.
const REDIRECT_SAMPLES: Record<string, { values: () => string[]; location: RegExp }> = {
  '/stats/dapps/[slug]': { values: firstRwaSlug, location: RWA_VIEW },
  '/stats/dapps/rwa/[slug]': { values: firstRwaSlug, location: RWA_VIEW },
};

// Paths that other suites open. A page that only redirects there is checked by its redirect, not by the page it lands on.
const COVERED_ELSEWHERE = ['/explorer', '/console', '/docs'];

/** The literal redirect of a page file, for example permanentRedirect("/explorer/mainnet"). The first one wins. */
function literalRedirect(file: string): { status: number; location: string } | undefined {
  const m = readRepoFile(file).match(/\b(permanentRedirect|redirect)\(\s*["'](\/[^"'?#]*)["']/);
  if (!m) return undefined;
  // In a server component, permanentRedirect answers 308 and redirect answers 307.
  return { status: m[1] === 'permanentRedirect' ? 308 : 307, location: m[2] };
}

/** A RegExp that matches one path exactly. */
function exactPath(path: string): RegExp {
  return new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

// Real values for dynamic route handlers.
const HANDLER_SAMPLES: Record<string, () => string[]> = {
  '/install/[tool]': firstInstallTool,
};

// Why the sweep skips each dynamic pattern that has no sample. A new pattern without an entry fails the sweep's first test.
const SKIP_REASONS: Record<string, string> = {
  '/audits/[id]': 'the id is a database row',
  '/audits/admin/requests/[id]': 'the id is a database row, and the page needs an admin session',
  '/audits/portal/requests/[id]': 'the id is a database row, and the page needs an auditor session',
  '/chat/share/[token]': 'the token is a database row',
  '/events/[id]': 'the id is a database row',
  '/events/[id]/admin-panel': 'the id is a database row, and the page needs an organizer session',
  '/events/[id]/admin-panel/judges': 'the id is a database row, and the page needs an organizer session',
  '/events/[id]/evaluate': 'the id is a database row, and the page needs a judge session',
  '/events/[id]/registrations': 'the id is a database row, and the page needs an organizer session',
  '/hackathons/[id]/stage-form': 'the id is a database row',
  '/showcase/[id]': 'the id is a database row, and the page needs a showcase session',
};

/** Static redirects of next.config.mjs: source path to destination path. Conditional and pattern redirects are left out. */
function staticRedirects(): Map<string, string> {
  const source = readRepoFile('next.config.mjs');
  const map = new Map<string, string>();
  for (const m of source.matchAll(/source:\s*(['"])([^'"]+)\1,([\s\S]*?)destination:\s*(['"])([^'"]+)\4/g)) {
    const [, , from, between, , to] = m;
    if (/\b(has|missing):/.test(between) || /[:(*]/.test(from)) continue;
    map.set(from, to);
  }
  return map;
}

/** The PROTECTED_PATHS list of lib/auth/protected-paths.ts. A visitor without a session sees the sign-in dialog there. */
function protectedPaths(): string[] {
  const source = readRepoFile('lib/auth/protected-paths.ts');
  const block = source.match(/export const PROTECTED_PATHS\s*=\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error('PROTECTED_PATHS not found in lib/auth/protected-paths.ts');
  // Drop comment lines, so a path that is commented out does not count.
  const lines = block[1].split('\n').filter((line) => !line.trim().startsWith('//'));
  return [...lines.join('\n').matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Follows the static redirects and the sessionless redirects from a path to the path the browser lands on. */
function resolveFinalPath(path: string, redirects: Map<string, string>): string {
  let current = path;
  for (let hop = 0; hop < 10; hop++) {
    const next = redirects.get(current) ?? SESSIONLESS_REDIRECTS[current];
    if (!next || next === current) break;
    current = next.split('#')[0];
  }
  return current;
}

interface Context {
  redirects: Map<string, string>;
  protectedPaths: string[];
}

export interface RedirectRoute {
  /** The path the test requests, for example /stats/dapps/rwa/valinor. */
  path: string;
  /** The page file, relative to the repo root. */
  file: string;
  /** The status the redirect must answer: 308 for permanentRedirect, 307 for redirect. */
  status: number;
  /** The Location path the redirect must send. */
  location: RegExp;
}

interface Walk {
  routes: SiteRoute[];
  redirects: RedirectRoute[];
  skipped: SkippedRoute[];
  handlers: string[];
}

/** The pattern with its dynamic segment set to one value: /blog/[...slug] and 226-min-block-times give /blog/226-min-block-times. */
function fill(pattern: string, value: string): string {
  return pattern.replace(/\[[^\]]+\]/, value);
}

function walk(dir: string, segments: string[], out: Walk, context: Context): void {
  const route = (path: string, file: string): SiteRoute => {
    const finalPath = resolveFinalPath(path, context.redirects);
    // The same prefix match as isProtectedPath in lib/auth/protected-paths.ts.
    const signIn = context.protectedPaths.some((p) => finalPath.startsWith(p));
    return { path, file, finalPath, signIn };
  };
  const rel = dir.slice(APP_DIR.length + 1).split('\\').join('/');
  if (rel && EXCLUDED_DIRS.some((excluded) => rel === excluded || rel.startsWith(excluded + '/'))) return;

  const pattern = '/' + segments.join('/');
  const list = entries(dir);
  const page = list.find((e) => e.isFile() && PAGE_FILE.test(e.name));
  const handler = list.find((e) => e.isFile() && ROUTE_FILE.test(e.name));

  if (page) {
    const file = `app/${rel ? rel + '/' : ''}${page.name}`;
    const dynamic = segments.some((s) => s.startsWith('['));
    const target = dynamic ? undefined : literalRedirect(file);
    if (target && COVERED_ELSEWHERE.some((p) => target.location === p || target.location.startsWith(p + '/'))) {
      out.redirects.push({ path: pattern, file, status: target.status, location: exactPath(target.location) });
    } else if (!dynamic) {
      out.routes.push(route(pattern, file));
    } else if (REDIRECT_SAMPLES[pattern]) {
      const { values, location } = REDIRECT_SAMPLES[pattern];
      const found = values();
      if (found.length === 0) out.skipped.push({ pattern, reason: 'its data file has no value', stated: false });
      for (const value of found) out.redirects.push({ path: fill(pattern, value), file, status: 308, location });
    } else {
      const values = SAMPLES[pattern]?.() ?? [];
      if (values.length === 0) {
        const reason = SKIP_REASONS[pattern];
        out.skipped.push({ pattern, reason: reason ?? 'no sample and no reason in route-list.ts', stated: reason !== undefined });
      }
      for (const value of values) out.routes.push(route(fill(pattern, value), file));
    }
  }
  // A route handler, for example /llms.txt. A dynamic handler (/install/[tool]) gets its values from HANDLER_SAMPLES.
  if (handler) {
    if (!segments.some((s) => s.startsWith('['))) out.handlers.push(pattern);
    else {
      const values = HANDLER_SAMPLES[pattern]?.() ?? [];
      if (values.length === 0) out.skipped.push({ pattern, reason: 'no sample in HANDLER_SAMPLES', stated: false });
      for (const value of values) out.handlers.push(fill(pattern, value));
    }
  }

  for (const entry of list) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    // A private folder (_x) is not a route.
    if (name.startsWith('_')) continue;
    // A route group ((x)) and a parallel slot (@x) add no URL segment.
    const nextSegments = /^\(.*\)$/.test(name) || name.startsWith('@') ? segments : [...segments, name];
    walk(join(dir, name), nextSegments, out, context);
  }
}

let cache: Walk | undefined;

/** Reads the app/ tree once per worker, when the runner collects the tests. Node fs only: CI installs only tests/e2e. */
function scanApp(): Walk {
  if (cache) return cache;
  if (!statSync(APP_DIR, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`app/ not found under ${REPO_ROOT}`);
  const out: Walk = { routes: [], redirects: [], skipped: [], handlers: [] };
  walk(APP_DIR, [], out, { redirects: staticRedirects(), protectedPaths: protectedPaths() });
  out.routes.sort((a, b) => a.path.localeCompare(b.path));
  out.redirects.sort((a, b) => a.path.localeCompare(b.path));
  out.handlers.sort();
  cache = out;
  return out;
}

/** Every site page route outside the folders other suites cover, with one real value for each dynamic segment the sweep can fill. */
export function findSiteRoutes(): SiteRoute[] {
  return scanApp().routes;
}

/** The dynamic patterns the sweep does not open, and why. */
export function skippedRoutes(): SkippedRoute[] {
  return scanApp().skipped;
}

/** The pages that only redirect to a page other suites open (one real value for a dynamic one), with the redirect each must send. */
export function findRedirectRoutes(): RedirectRoute[] {
  return scanApp().redirects;
}

/** The route handlers outside the folders other suites cover, for example /llms.txt, /mcp-manifest and /install/platform-cli. */
export function findTextRoutes(): string[] {
  return scanApp().handlers;
}
