import { describe, expect, test } from 'e2e';
import { appFetch, redirectOf } from '../api/app-fetch';
import { knownBug } from '../lib/skip';
import { findRedirectRoutes, findTextRoutes } from './route-list';

// The tests in this file take only the app fixture: they send requests from Node, not from the page.
// The framework has no per-target filter, so they run on both targets.

// /llms-full.txt converts every docs, academy, integration and blog page. A dev server takes more than a minute.
// A preview build serves it from the cache.
const TEXT_ROUTE_TIMEOUT = 240_000;

// A dev server compiles the raw markdown route on its first request, then answers each link in a few seconds.
const LINK_CHECK_TIMEOUT = 300_000;
const LINK_CHECK_CONCURRENCY = 4;

// The content type each route handler sends. A route without an entry must send text or JSON.
const CONTENT_TYPES: Record<string, RegExp> = {
  '/llms.txt': /^text\/plain/,
  '/llms-full.txt': /^text\/plain/,
  '/mcp-manifest': /^application\/json/,
  '/static.json': /^application\/json/,
};

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

describe('site text routes answer with content', { tags: ['sweep'] }, () => {
  // The route handlers, read from app/ when the runner collects the tests.
  const routes = findTextRoutes();

  test('the sweep finds /llms.txt and /mcp-manifest', () => {
    expect(routes).toContain('/llms.txt');
    expect(routes).toContain('/mcp-manifest');
  });

  for (const path of routes) {
    test(`GET ${path} answers 200 with a body`, { timeout: TEXT_ROUTE_TIMEOUT }, async ({ app }) => {
      const res = await appFetch(app, path);
      expect(res.status, `status of ${path}`).toBe(200);
      const type = res.headers.get('content-type') ?? '';
      expect(type, `content type of ${path}`).toMatch(CONTENT_TYPES[path] ?? /^(text\/|application\/json)/);
      const body = await res.text();
      expect(body.trim().length, `body length of ${path}`).toBeGreaterThan(0);
      if (/json/.test(type)) expect(isJson(body), `${path} is valid JSON`).toBe(true);
      // An install route sends a shell script that a visitor pipes to sh.
      if (path.startsWith('/install/')) expect(body.startsWith('#!'), `${path} starts with a shebang`).toBe(true);
    });
  }

  test('/llms.txt starts with the site name and links to /llms-full.txt', async ({ app }) => {
    const body = await (await appFetch(app, '/llms.txt')).text();
    // The llms.txt format starts with an h1 of the site name.
    expect(body.startsWith('# Avalanche Builder Hub\n')).toBe(true);
    expect(body).toContain('/llms-full.txt)');
  });

  test('/llms.txt academy section lists its priority courses', async ({ app }) => {
    knownBug(
      'app/llms.txt/route.ts groups academy pages by the pathway (/academy/<pathway>/...), not by the course, ' +
        'so only the avalanche-l1 entry of academyPrioritySections matches',
    );
    const body = await (await appFetch(app, '/llms.txt')).text();
    const academy = body.slice(body.indexOf('\n## Academy\n'), body.indexOf('\n## Integrations\n'));
    // academyPrioritySections in app/llms.txt/route.ts, as formatSectionName writes them.
    for (const course of ['Blockchain Fundamentals', 'Interchain Messaging', 'Erc20 Bridge', 'Customizing Evm']) {
      expect(academy, `llms.txt academy section has a ### ${course} list`).toContain(`### ${course}\n`);
    }
  });

  test('every .md link in /llms.txt answers 200 with a body', { timeout: LINK_CHECK_TIMEOUT }, async ({ app }) => {
    const body = await (await appFetch(app, '/llms.txt')).text();
    // The links point at the production host. Check the same paths on the site under test.
    const paths = [...new Set([...body.matchAll(/\]\(https:\/\/build\.avax\.network(\/[^)\s]+\.md)\)/g)].map((m) => m[1]))];
    expect(paths.length, 'llms.txt links to raw markdown pages').toBeGreaterThan(0);

    const broken: string[] = [];
    const queue = [...paths];
    const worker = async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        try {
          const res = await appFetch(app, path);
          const text = await res.text();
          if (res.status !== 200 || text.trim().length === 0) broken.push(`${path} (${res.status})`);
        } catch (error) {
          // appFetch fails on a redirect: the link does not answer with the page.
          broken.push(`${path} (${error instanceof Error ? error.message : String(error)})`);
        }
      }
    };
    await Promise.all(Array.from({ length: LINK_CHECK_CONCURRENCY }, worker));
    expect(broken.sort(), 'llms.txt links that do not answer 200 with a body').toEqual([]);
  });

  test('/mcp-manifest names the MCP server and its endpoint', async ({ app }) => {
    const manifest = (await (await appFetch(app, '/mcp-manifest')).json()) as Record<string, unknown>;
    expect(manifest.name).toBe('avalanche-mcp');
    expect(String(manifest.endpoint)).toMatch(/\/api\/mcp$/);
    expect(Array.isArray(manifest.tools) && manifest.tools.length > 0, 'manifest lists tools').toBe(true);
  });
});

describe('pages that only redirect send their redirect', { tags: ['sweep'] }, () => {
  // Pages that redirect to the explorer or the docs, which other suites open. A dynamic one gets one real slug
  // from its data file. Read from app/ when the runner collects the tests.
  const redirects = findRedirectRoutes();

  test('the sweep finds the redirect pages', () => {
    expect(redirects.length, 'pages that only redirect').toBeGreaterThan(0);
  });

  for (const route of redirects) {
    test(`GET ${route.path} redirects to its page`, { timeout: TEXT_ROUTE_TIMEOUT }, async ({ app }) => {
      const { status, location } = await redirectOf(app, route.path);
      expect(status, `status of ${route.path}`).toBe(route.status);
      expect(location, `Location of ${route.path}`).toMatch(route.location);
    });
  }
});
