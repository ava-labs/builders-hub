import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, type Browser } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { knownBug } from '../lib/skip';
import { findSiteRoutes, skippedRoutes, type SiteRoute } from './route-list';

// The runner runs one file at a time on each worker. The routes are split over SHARDS files
// (route-sweep-1.e2e.ts to route-sweep-4.e2e.ts), so more workers finish the sweep sooner.
export const SHARDS = 4;

// The text of each error screen a page can show:
// - app/error.tsx, the site error boundary (h1).
// - app/not-found.tsx, when a page calls notFound() after the response started (h1).
// - Next.js, after an uncaught client or server exception.
const ERROR_TEXT =
  /Oops! Something went wrong|Oops! This page doesn't exist|Application error: a (client|server)-side exception has occurred/;

// A busy dev server can take minutes to compile a route and serve its client chunks.
// A preview build serves them from the CDN in seconds.
const LOAD_TIMEOUT = 180_000;

// A first visit compiles the route, then waits for the client chunks. Both can take most of LOAD_TIMEOUT on a dev server.
const ROUTE_TIMEOUT = 420_000;

// Routes that break today. The test states the right behavior and is skipped (lib/skip.ts).
// Key: the route path. Value: what breaks. Remove the entry when the fix lands.
const KNOWN_BUGS: Record<string, string> = {
  // getHackathon (server/services/hackathons.ts:166-167) throws when the row is missing. BuildGamesMentors,
  // BuildGamesPartners and BuildGamesResources (components/build-games/, line 9) expect null and hide their
  // section, so the page fails with a 500 instead.
  '/build-games': 'the page fails with a 500 when the database has no Build Games hackathon row',
  '/hackathons/249d2911-7931-4aa0-a696-37d8370b79f9':
    'the redirect target /build-games fails with a 500 when the database has no Build Games hackathon row',
};

// A dev server shows the Prisma message in the page when the local database lacks a migration
// (P2021 and P2022). A production build hides the message, so this never skips on a preview.
const MISSING_SCHEMA = /The (table|column) `[^`]+` does not exist in the current database/;

async function checkRoute(route: SiteRoute, screen: Screen, browser: Browser): Promise<void> {
  // Open on the HTML, so the status and title checks report even when a client chunk is slow.
  await browser.goto(route.path, { waitUntil: 'domcontentloaded' });

  // The status of the document response, as the browser received it. After a redirect it is the status of the last hop.
  const status = await browser.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return entry?.responseStatus ?? 0;
  });
  if (status >= 500) {
    const missingSchema = await browser.evaluate(
      (source: string) => new RegExp(source).test(document.documentElement.outerHTML),
      MISSING_SCHEMA.source,
    );
    test.skip(missingSchema, `the local database lacks a table or column that ${route.path} reads: run the Prisma migrations`);
  }
  expect(status, `HTTP status of ${route.path}`).toBeGreaterThan(0);
  expect(status, `HTTP status of ${route.path}`).toBeLessThan(400);

  // A redirect sends some routes to another path (route-list.ts). Every other route stays where it is.
  await expect(browser).toHaveURL(new RegExp(`^[^?#]*//[^/]+${escapeRegExp(route.finalPath)}/?([?#].*)?$`));

  // Wait until React has hydrated the page, so a crash in hydration shows before the checks below.
  // React marks each node it hydrates with a __reactFiber$ key. The load event is not the signal:
  // it also waits for every image and embed, which a dev server serves slowly.
  await expect
    .poll(() => browser.evaluate(() => Object.keys(document.body).some((key) => key.startsWith('__reactFiber$'))), {
      message: `React did not hydrate ${route.path}: a client chunk did not arrive`,
      timeout: LOAD_TIMEOUT,
    })
    .toBe(true);

  await expect(browser).toHaveTitle(/\S/);

  if (route.signIn) {
    // A protected path (lib/auth/protected-paths.ts) opens the sign-in dialog for a visitor without a session,
    // and the page content stays behind it.
    await expect(screen.getByRole('dialog', 'Sign in to your account')).toBeVisible({ timeout: LOAD_TIMEOUT });
  } else {
    // The page names itself: a visible h1, or a visible heading in the main landmark. The site layout puts
    // the navbar in an outer main and most pages add their own main inside it, so read the last one.
    const h1 = screen.getByRole('heading', { level: 1, visible: true });
    const mainHeading = screen.getByRole('main').last().getByRole('heading', { visible: true });
    await expect
      .poll(async () => (await h1.count()) + (await mainHeading.count()), {
        message: `${route.path} shows no visible h1 and no visible heading in main`,
        timeout: LOAD_TIMEOUT,
      })
      .toBeGreaterThan(0);
  }

  await expect(screen.getByText(ERROR_TEXT)).toHaveCount(0);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Registers the sweep tests for one shard: the routes at index shard - 1, shard - 1 + SHARDS, and so on. */
export function defineRouteSweep(shard: number): void {
  // Read the routes from app/ when the runner collects the tests.
  const all = findSiteRoutes();
  const routes = all.filter((_, index) => index % SHARDS === shard - 1);

  describe(`site routes open without an error (${shard} of ${SHARDS})`, { tags: ['sweep'] }, () => {
    if (shard === 1) {
      test('the sweep finds the routes and has every shard file', () => {
        expect(all.length, 'no page route found under app/').toBeGreaterThan(0);
        expect(all.map((route) => route.path)).toContain('/');
        const here = dirname(fileURLToPath(import.meta.url));
        const files = readdirSync(here).filter((name) => /^route-sweep-\d+\.e2e\.ts$/.test(name));
        expect(files.length, `route-sweep-N.e2e.ts files in routes/ (SHARDS is ${SHARDS})`).toBe(SHARDS);
        // A new dynamic route needs a sample or a skip reason in route-list.ts, so the sweep does not miss it unseen.
        const unstated = skippedRoutes().filter((route) => !route.stated);
        expect(unstated.map((route) => `${route.pattern}: ${route.reason}`), 'dynamic routes the sweep skips unseen').toEqual([]);
      });
    }

    for (const route of routes) {
      test(`opens ${route.path}`, { timeout: ROUTE_TIMEOUT }, async ({ screen, browser }) => {
        const bug = KNOWN_BUGS[route.path];
        if (bug) knownBug(bug);
        await checkRoute(route, screen, browser);
      });
    }
  });
}
