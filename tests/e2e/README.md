# Browser and API tests (tester-army/e2e)

Tests for build.avax.network, run with [tester-army/e2e](https://e2e.tester.army/docs):

- Browser tests for the Explorer, Academy, docs, the other site pages, and the Console without a wallet. They run at two sizes: `desktop` (1440x900) and `phone` (390x844).
- API tests for `/api/mcp` in `api/`. They run once, with no browser.
- Agent tests in `ai/`. Claude does a step from a plain-language instruction. They need `ANTHROPIC_API_KEY` and skip without it.

Console wallet flows have no tests yet. They need the Core wallet shim, and the framework cannot inject a script before page load (no `addInitScript`, [tester-army/e2e#696](https://github.com/tester-army/e2e/issues/696)). The old Playwright shim is in git history: `git show 6a1461e3a:e2e/wallet-shim/core-shim.ts` (with `e2e/fixtures.ts` for the injection).

## Why a separate package

This folder has its own `package.json` and `package-lock.json`. The framework needs Playwright 1.63 or later and, for agent steps, `ai` 7. The site uses `ai` 6. A separate package keeps the two versions apart, and the site install does not download Playwright. The root `tsconfig.json` excludes `tests/`, so the site build does not type-check this folder.

## Run the tests

1. Start the site: `yarn dev` in the repo root. Note the port.
2. Install this package once:

   ```bash
   cd tests/e2e
   npm ci
   npx playwright install chromium
   ```

3. Run every test at both sizes:

   ```bash
   E2E_BASE_URL=http://localhost:3000 npm test
   ```

4. Run one folder, one file or one size:

   ```bash
   E2E_BASE_URL=http://localhost:3000 npm test -- explorer/
   E2E_BASE_URL=http://localhost:3000 npm test -- explorer/network-switch.e2e.ts
   E2E_BASE_URL=http://localhost:3000 npm run test:phone
   ```

5. Run the API tests:

   ```bash
   E2E_BASE_URL=http://localhost:3000 npm run test:api
   ```

A failed test writes a readable report to `.e2e/failures/`. It shows each step, the error, and the page as text at the failure.

To test a Vercel preview, set `E2E_BASE_URL` to the preview URL and `VERCEL_AUTOMATION_BYPASS_SECRET` to the bypass secret.

The `npm` scripts turn telemetry off (`E2E_TELEMETRY_DISABLED=1`). If you call `npx e2e` directly, set that variable yourself.

## Write a test

- Put the test in the folder of its surface: `explorer/`, `academy/`, `docs/`, `embeds/`, `console/`, `routes/`, `site/`, `ai/` or `api/`. Name the file `<behavior>.e2e.ts`.
- An API test sets `platforms: ['api']` and calls the site with `appFetch` or `callTool` from `api/`. `api/e2e.config.ts` runs it.
- Find elements by role and accessible name. A name matches exactly: use a RegExp for part of a name. A locator that matches more than one element is an error.
- Explorer data is live. Assert the page structure (heading, active tab, table header), not values.
- A test runs at both sizes. For a test about one layout, call `desktopOnly(browser)` or `phoneOnly(browser)` from `lib/skip.ts` after `app.open`.
- Use locators and `expect` when they can state the check. Use an agent step (`agent.act`, `agent.assert`) only when they cannot. Put that test in `ai/`, take the fixtures as one object, and call `needsModel()` from `lib/skip.ts` before you read `agent` (see `ai/agent-smoke.e2e.ts`).
- The sweeps (every embedded Console tool, every Console tool route, every site route) have the `sweep` tag and are split into shards that run in parallel.

## Agent tests

The agent steps use `claude-sonnet-5-5` (`e2e.config.ts`). To run them locally, put `ANTHROPIC_API_KEY=<key>` in `tests/e2e/.env.local`. Git ignores that file.

A verified `agent.act` step saves its actions in `.e2e/cache/`. The next run replays them with no model call. Commit the cache with the test. `agent.assert` calls the model on every run.

## Known bugs

A test can state the right behavior for a bug the site still has. Call `knownBug('<what breaks>')` from `lib/skip.ts` as the first line of the test. The test is skipped, so CI stays green. To see the known bugs fail:

```bash
E2E_KNOWN_BUGS=1 E2E_BASE_URL=http://localhost:3000 npm test
```

When you fix the bug, remove the `knownBug` call in the same PR.

## Phone size limits

The `phone` target sets the size and an iPhone user agent. It does not emulate touch or a device scale factor. It finds layout breaks below the `md` breakpoint, not touch-only bugs.

## CI

[`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) runs on each pull request to `master`. It waits for the Vercel preview of the PR's head commit, then runs the browser tests with 4 workers and the API tests once. The agent tests run only when the repo has an `ANTHROPIC_API_KEY` secret. The job summary shows the results. A failed run uploads `.e2e/` (traces and failure pages) as an artifact.
