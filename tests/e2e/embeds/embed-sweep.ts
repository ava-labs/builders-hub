import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { CONSOLE_TOOL_MOUNTED as MOUNTED } from '../lib/console-tool';
import { findEmbedPages } from './embed-pages';

// The runner runs one file at a time on each worker. The pages are split over SHARDS files
// (embed-sweep-1.e2e.ts to embed-sweep-4.e2e.ts), so more workers finish the sweep sooner.
export const SHARDS = 4;

// The text of each error screen a page can show:
// - app/error.tsx, the site error boundary (h1).
// - Next.js, after an uncaught client exception.
// - components/toolbox/components/StepErrorBoundary.tsx, when a step flow fails.
const ERROR_TEXT =
  /Oops! Something went wrong|Application error: a (client|server)-side exception has occurred|This step encountered an error/;

// A busy dev server can take a minute or more to serve the client chunks of a page.
// A preview build serves them from the CDN in seconds.
const LOAD_TIMEOUT = 120_000;

/** Registers the sweep tests for one shard: the pages at index shard - 1, shard - 1 + SHARDS, and so on. */
export function defineEmbedSweep(shard: number): void {
  // Read the pages from the MDX when the runner collects the tests.
  const all = findEmbedPages();
  const pages = all.filter((_, index) => index % SHARDS === shard - 1);

  describe(`academy and docs pages render their console tools (${shard} of ${SHARDS})`, { tags: ['sweep'] }, () => {
    if (shard === 1) {
      test('the sweep finds the pages and has every shard file', () => {
        expect(all.length, 'no MDX page under content/ embeds a toolbox component').toBeGreaterThan(0);
        const here = dirname(fileURLToPath(import.meta.url));
        const files = readdirSync(here).filter((name) => /^embed-sweep-\d+\.e2e\.ts$/.test(name));
        expect(files.length, `embed-sweep-N.e2e.ts files in embeds/ (SHARDS is ${SHARDS})`).toBe(SHARDS);
      });
    }

    for (const page of pages) {
      test(`renders ${page.route}`, async ({ screen, browser }) => {
        // Open on the HTML, so the status and title checks report even when a client chunk is slow.
        await browser.goto(page.route, { waitUntil: 'domcontentloaded' });

        // The status of the document response, as the browser received it.
        const status = await browser.evaluate(() => {
          const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          return entry?.responseStatus ?? 0;
        });
        expect(status, `HTTP status of ${page.route}`).toBeGreaterThan(0);
        expect(status, `HTTP status of ${page.route}`).toBeLessThan(400);

        // The lesson title proves the page is the lesson, not a not-found page.
        if (page.title) await expect(screen.getByRole('heading', page.title, { level: 1 })).toBeVisible();

        // Some tools render their mount signal on the server. Wait for every chunk, so React has
        // hydrated the page and a crash in hydration shows before the checks below.
        await expect
          .poll(() => browser.evaluate(() => document.readyState), {
            message: `${page.route} did not finish loading: a client chunk did not arrive`,
            timeout: LOAD_TIMEOUT,
          })
          .toBe('complete');

        await expect
          .poll(() => browser.locator(MOUNTED).count(), {
            message: `no console tool mounted on ${page.route} (the MDX embeds ${page.tools.join(', ')})`,
          })
          .toBeGreaterThanOrEqual(1);

        await expect(screen.getByText(ERROR_TEXT)).toHaveCount(0);
      });
    }
  });
}
