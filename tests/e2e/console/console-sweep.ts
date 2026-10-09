import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, type Browser } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { CONSOLE_TOOL_MOUNTED } from '../lib/console-tool';
import { knownBug } from '../lib/skip';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { listConsoleRoutes, pageFolderOf, REGISTRY_FILE, type ConsoleRoute } from './console-routes';

// The runner runs one file at a time on each worker. The routes are split over SHARDS files
// (console-sweep-1.e2e.ts to console-sweep-6.e2e.ts), so more workers finish the sweep sooner.
export const SHARDS = 6;

// The text of each error screen a Console route can show:
// - app/error.tsx and the console error boundaries (h1 "Oops! Something went wrong").
// - Next.js, after an uncaught client or server exception.
// - components/toolbox/components/StepErrorBoundary.tsx, when a step of a flow fails.
// - Next.js not-found and app/not-found.tsx.
// - components/console/step-flow.tsx, for a step key the flow does not have.
const ERROR_TEXT =
  /Oops! Something went wrong|Application error: a (client|server)-side exception has occurred|This step encountered an error|This page could not be found|Oops! This page doesn't exist|^Step ".*" not found\.$/;

// A busy dev server can take minutes to compile a route and serve its client chunks.
// A preview build serves them from the CDN in seconds.
const LOAD_TIMEOUT = 180_000;

// A first visit compiles the route, then waits for the client chunks. Both can take most of LOAD_TIMEOUT on a dev server.
const ROUTE_TIMEOUT = 420_000;

// A visible mount signal of a Console tool (lib/console-tool.ts).
const MOUNTED_VISIBLE = `${CONSOLE_TOOL_MOUNTED} >> visible=true`;

// Routes that render no mount signal. Each shows its own visible heading instead.
// Key: the final path, after the redirects. Value: the heading name and level.
const HEADINGS: Record<string, { name: string; level: number }> = {
  '/console': { name: 'Avalanche Builder Console', level: 1 },
  '/console/history': { name: 'What you deployed and signed.', level: 1 },
  '/console/studio': { name: 'Describe an app. Ship it to testnet. Promote it when it works.', level: 1 },
  '/console/toolbox': { name: 'Every console tool, in one place.', level: 1 },
  '/console/encrypted-erc/overview': { name: 'Private balances, public accountability.', level: 1 },
  '/console/primary-network/validator-alerts': { name: 'Validator alerts', level: 1 },
};

// Routes that break today. The test states the right behavior and is skipped (lib/skip.ts).
// Key: the route path. Value: what breaks. Remove the entry when the fix lands.
const KNOWN_BUGS: Record<string, string> = {};

// The browser could not connect: no server listens on the port. A local dev server restarts now and then
// (a crash, or a supervisor restart), and it is back in seconds. A preview never shows these.
const SERVER_DOWN = /net::ERR_(CONNECTION_REFUSED|CONNECTION_RESET|EMPTY_RESPONSE)\b/;

// The wait between two connection attempts while the server is down.
const RECONNECT_INTERVAL = 3_000;

/**
 * Opens the route on its HTML, so the status check reports even when a client chunk is slow.
 * While the server is down it tries again, up to LOAD_TIMEOUT. Any response, an HTTP error included, ends the wait.
 */
async function openRoute(browser: Browser, path: string): Promise<void> {
  const deadline = Date.now() + LOAD_TIMEOUT;
  for (;;) {
    try {
      await browser.goto(path, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      if (!SERVER_DOWN.test(String(error)) || Date.now() + RECONNECT_INTERVAL > deadline) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
  }
}

async function checkRoute(route: ConsoleRoute, screen: Screen, browser: Browser): Promise<void> {
  // Visit as a returning visitor. On a first visit the Console welcome dialog opens 800 ms after the page mounts and
  // hides the page, so a heading check that runs after it opens finds no heading.
  await openRoute(browser, '/small-logo.png');
  await answerFirstVisitPrompts(browser);
  await openRoute(browser, route.route);

  // The status of the document response, as the browser received it. After a redirect it is the status of the last hop.
  const status = await browser.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return entry?.responseStatus ?? 0;
  });
  expect(status, `HTTP status of ${route.route}`).toBeGreaterThan(0);
  expect(status, `HTTP status of ${route.route}`).toBeLessThan(400);

  // Wait until React has hydrated the page, so a crash in hydration shows before the checks below.
  // React marks each node it hydrates with a __reactFiber$ key. The load event is not the signal:
  // it also waits for every image and embed, which a dev server serves slowly.
  await expect
    .poll(() => browser.evaluate(() => Object.keys(document.body).some((key) => key.startsWith('__reactFiber$'))), {
      message: `React did not hydrate ${route.route}: a client chunk did not arrive`,
      timeout: LOAD_TIMEOUT,
    })
    .toBe(true);

  // A redirect, on the server or in an effect, must stay in the Console.
  const path = new URL(await browser.url()).pathname;
  expect(path, `${route.route} left the Console`).toMatch(/^\/console(\/|$)/);

  const heading = HEADINGS[path];
  if (heading) {
    await expect(screen.getByRole('heading', heading.name, { level: heading.level })).toBeVisible({ timeout: LOAD_TIMEOUT });
  } else {
    // A flow can nest a tool, so the page can show more than one signal.
    await expect
      .poll(() => browser.locator(MOUNTED_VISIBLE).count(), {
        message: `no Console tool mounted on ${route.route} (${route.source}: ${route.label}, final path ${path})`,
        timeout: LOAD_TIMEOUT,
      })
      .toBeGreaterThan(0);
  }

  await expect(screen.getByText(ERROR_TEXT)).toHaveCount(0);
}

/** Registers the sweep tests for one shard: the routes at index shard - 1, shard - 1 + SHARDS, and so on. */
export function defineConsoleSweep(shard: number): void {
  // Read the routes from the repo when the runner collects the tests.
  const list = listConsoleRoutes();
  const routes = list.routes.filter((_, index) => index % SHARDS === shard - 1);

  describe(`console tool routes render without a wallet (${shard} of ${SHARDS})`, { tags: ['sweep'] }, () => {
    if (shard === 1) {
      test('the sweep finds the routes and has every shard file', () => {
        expect(list.registry.length, `no entry read from ${REGISTRY_FILE}`).toBeGreaterThan(0);
        expect(list.routes.length, 'no Console route found').toBeGreaterThan(0);
        const here = dirname(fileURLToPath(import.meta.url));
        const files = readdirSync(here).filter((name) => /^console-sweep-\d+\.e2e\.ts$/.test(name));
        expect(files.length, `console-sweep-N.e2e.ts files in console/ (SHARDS is ${SHARDS})`).toBe(SHARDS);
      });

      test('every registry route has a page under app/console', () => {
        const missing = list.routes.filter((r) => r.source === 'registry' && !pageFolderOf(r.route)).map((r) => r.route);
        expect(missing, `routes in ${REGISTRY_FILE} with no page.tsx`).toEqual([]);
      });
    }

    for (const route of routes) {
      test(`renders ${route.route}`, { timeout: ROUTE_TIMEOUT }, async ({ screen, browser }) => {
        const bug = KNOWN_BUGS[route.route];
        if (bug) knownBug(bug);
        await checkRoute(route, screen, browser);
      });
    }
  });
}
