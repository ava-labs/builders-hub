# Browser and API tests (tester-army/e2e)

Tests for build.avax.network, run with [tester-army/e2e](https://e2e.tester.army/docs):

- Browser tests for the Explorer, Academy, docs, the other site pages, and the Console without a wallet. They run at two sizes: `desktop` (1440x900) and `phone` (390x844).
- API tests for `/api/mcp` in `api/`. They run once, with no browser.
- In-app browser tests in `webview/`. They run on a phone with the user agent of the Instagram or the LinkedIn in-app browser.
- Agent tests in `ai/`. Claude does a step from a plain-language instruction. They need `ANTHROPIC_API_KEY` and skip without it.

Console flows that send transactions are in `chain/`. They run only nightly, on Fuji (see "Console chain tests").

## Why a separate package

This folder has its own `package.json` and `package-lock.json`. The browser engine, `@e2e-dev/web`, pins its own `playwright-core` (1.63.0), and agent steps need `ai` 7. The site uses `ai` 6. A separate package keeps the two versions apart, and the site install does not download Playwright. The root `tsconfig.json` excludes `tests/`, so the site build does not type-check this folder.

## Run the tests

1. Start the site: `yarn dev` in the repo root. Note the port. Run `yarn build:remote` once before: some tests (for example `docs/tables.e2e.ts`) open docs pages that it writes.
2. Install this package once:

   ```bash
   cd tests/e2e
   npm ci
   npx @e2e-dev/web install chromium
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

6. Run the in-app browser tests:

   ```bash
   E2E_BASE_URL=http://localhost:3000 npm run test:webview
   ```

A failed test writes a readable report to `.e2e/failures/`. It shows each step, the error, and the page as text at the failure.

To test a Vercel preview, set `E2E_BASE_URL` to the preview URL and `VERCEL_AUTOMATION_BYPASS_SECRET` to the bypass secret.

The `npm` scripts turn telemetry off (`E2E_TELEMETRY_DISABLED=1`). If you call `npx e2e` directly, set that variable yourself.

## Write a test

- Put the test in the folder of its surface: `explorer/`, `academy/`, `docs/`, `embeds/`, `console/`, `routes/`, `site/`, `ai/`, `api/` or `webview/`. Name the file `<behavior>.e2e.ts`.
- An API test sets `platforms: ['api']` and calls the site with `appFetch` or `callTool` from `api/`. `api/e2e.config.ts` runs it.
- The engine sets the user agent per target. A test that needs an in-app browser goes in `webview/`, and `webview/e2e.config.ts` runs it.
- A test that signs in or signs up calls `fakeAuth()` from `lib/fake-auth.ts` before it opens the page. The fake answers each write of the login flow, so no test creates an account or sends an email. The fake aborts an API write that it has no answer for. End the test with `expect(auth.unanswered).toEqual([])`.
- Find elements by role and accessible name. A name matches exactly: use a RegExp for part of a name. A locator that matches more than one element is an error.
- Explorer data is live. Assert the page structure (heading, active tab, table header), not values.
- A test runs at both sizes. For a test about one layout, call `desktopOnly(browser)` or `phoneOnly(browser)` from `lib/skip.ts` after `app.open`.
- Use locators and `expect` when they can state the check. Use an agent step (`agent.act`, `agent.assert`) only when they cannot. Put that test in `ai/`, take the fixtures as one object, and call `needsModel()` from `lib/skip.ts` before you read `agent` (see `ai/agent-smoke.e2e.ts`).
- The sweeps (every embedded Console tool, every Console tool route, every site route) have the `sweep` tag and are split into shards that run in parallel.

## Agent tests

Agent tests in `ai/` use Claude (`claude-sonnet-5-5`, set in `e2e.config.ts`). They check what a locator cannot state well. There are three kinds:

| Kind | Files | How it works | Model cost per run |
|---|---|---|---|
| Journey | `ai/journey-*.e2e.ts` and the older `ai/*.e2e.ts` | `agent.act` does a visitor task in plain words, then a locator `expect` checks where it landed | Close to 0: a verified `act` replays from the cache |
| Visual | `ai/visual-*.e2e.ts`, tag `visual` | `agent.assert(..., { vision: true })` judges a screenshot: nothing cut off, overlapping or covered | About 2k to 3k tokens per page and size |
| Data | `ai/data-*.e2e.ts` | `agent.extract` reads facts off the page, then `expect` compares them with known values | About 4k to 10k tokens per test |

A full run of `ai/` costs well under 1 dollar when the cache replays.

To run them locally, put `ANTHROPIC_API_KEY=<key>` in `tests/e2e/.env.local`. Git ignores that file.

```bash
E2E_BASE_URL=http://localhost:3000 npm test -- ai/
E2E_BASE_URL=http://localhost:3000 npm test -- --tag visual
```

Rules for a new agent test:

- Take the fixtures as one object and call `needsModel()` before you read `agent` (see `ai/agent-smoke.e2e.ts`). Without a key the test is skipped.
- After an `act`, check the result with a locator (URL, heading, active tab). The model does the task; the `expect` decides pass or fail.
- Use `desktopOnly()` unless the test is about layout. Visual tests run at both sizes on purpose.
- Explorer data is live. Use a fixed historical block or transaction, never a live value.
- An `act` step replays only when the page it ends on is the same. A step that reads a live ranking or a live number calls the model on every run.
- Commit the new cache entries in `.e2e/cache/` with the test. A local run records and updates entries; CI only reads them. When the page changes, the next passing local run records the step again. `npx e2e cache clear` deletes every entry.

`agent.assert`, `agent.waitFor` and `agent.extract` call the model on every run.

## Nightly bug hunt

`.github/workflows/e2e-explore.yml` runs `e2e explore` once a night on production, one job for each charter in `explore/charters.json`. The agent gets the charter's goal, drives the site and reports findings. Findings go to the job summary and to the artifact `e2e-explore-<key>` (14 days). They do not fail the job: a person triages them. A job fails only when the run tested nothing.

- A charter costs about 1M to 3M model tokens. The 9 charters cost about 10 to 14 dollars a night.
- Run it by hand on GitHub (Actions, E2E explore, Run workflow), with an optional target URL and charter keys.
- Run one charter locally: `npx e2e explore '<goal>' --target desktop --output .e2e/explore/<key>`.
- Without the `ANTHROPIC_API_KEY` secret the job skips.

## Console chain tests

`chain/` holds the Console flows that send real transactions on Fuji. They have their own config, `chain/e2e.config.ts`: desktop only (no phone size), one worker, no retries. The main config excludes the folder, so a PR never runs them. [`.github/workflows/e2e-chain.yml`](../../.github/workflows/e2e-chain.yml) runs them each night at 08:23 UTC on build.avax.network. To run them by hand on GitHub: Actions, E2E chain, Run workflow. The workflow takes no URL: CI tests production only.

- Tier 1 (`chain/poa-cchain.e2e.ts`) makes a fresh PoA L1, one test per Console step: the questionnaire, Create Subnet, the Validator Manager and its proxy on the C-Chain, Initialize, Create Chain, Convert to L1 with mock validator V0, Initialize Validator Set. Then it runs the validator tools: add V1, change its weight, top up V0, remove V1. Disable V0 ends the run. The mock validators (`chain/lib/mock-validator.ts`) run no node: the Primary Network signs every Warp message for a C-Chain manager.
- Every transaction goes out from a Console button. Node signs what the page asks for, makes the mock validators' credentials (the test pastes them into the page), and reads the chain to check each result. The one exception is `chain/lib/teardown.ts`, which disables left-over validators without the page.
- The wallet signs in Node with the Fuji test key. The page half is an init script (`chain/wallet/provider.ts`, `web({ initScripts })` in `chain/e2e.config.ts`): a Core provider with no key, announced through EIP-6963. It posts each request to `/__e2e/wallet`. The `wallet` fixture (`chain/lib/fixtures.ts`) answers that path with a `browser.route`, from the signer. The key never goes into the page. The signer refuses mainnet.
- As Core does, the wallet gives a site no account until it connects. The first test clicks 'Connect Wallet', then 'Core' (`connectCore`). After a reload or `app.open`, the Console connects again by itself.
- `chain/lib/ledger.ts` writes `chain/.run/ledger.json` (gitignored) before and after each send. Before a send, a test reads the chain and skips a send whose result is already there. After a send, it polls the chain until a node shows the result.
- `chain/lib/chain.ts` reads the public Fuji RPC and Glacier only. It sends at most 2 requests per second and stops at the first HTTP 429. The wallet's calls go through the same limit (`throttledFetch`).
- `chain/lib/warp.ts` retries a Warp delivery up to 4 times, 15 s apart. Each attempt aggregates the signatures again.
- `chain/lib/teardown.ts` disables each validator of the ledgers that the P-Chain shows active, and refunds its balance.

### The key

The tests read the key from the file that `E2E_CHAIN_FUJI_KEY_FILE` names. The file must have mode 0600 (or 0400): `chain/lib/chain.ts` refuses a file that others can read. A file keeps the key out of the environment that the test workers, Chromium and `npx` inherit. `E2E_CHAIN_FUJI_KEY` (the key itself) also works, but the file wins when both are set.

- Never print, log, paste or commit the key. The config gives it to the framework as a secret, so the report masks it.
- In CI the key is the repository secret `E2E_CHAIN_FUJI_KEY`. The job runs on `master` only. A workflow on any branch can read a repository secret, so keep about 2 Fuji AVAX on the key. The workflow writes it to a 0600 file and passes only the path.

### Run them locally

```bash
cd tests/e2e
export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # chmod 600
node chain/wallet/selftest.ts               # the wallet's checks; no transaction, no browser
node chain/lib/preflight.ts                 # the key's addresses and balances
npm run test:chain                          # tier 1
node chain/lib/teardown.ts --dry-run        # what the teardown would disable
node chain/lib/teardown.ts                  # disable the validators that are still active
```

- Each run makes a new L1. The first test moves the last ledger to `chain/.run/archive/`, where the teardown still finds it. Run the teardown before the next run.
- If your local key is the CI key, do not run while the nightly run is on (from 08:23 UTC). Both runs would sign with one key and conflict on C-Chain nonces and P-Chain UTXOs. The workflow's concurrency group covers CI runs only.
- The public Fuji API is load-balanced, and its nodes accept a block at different times. A check after a tx polls until a node shows the result (`chainShows` in `chain/lib/chain.ts`).
- The tests open `https://build.avax.network` by default. To test a preview locally, set `E2E_BASE_URL` and `VERCEL_AUTOMATION_BYPASS_SECRET` in the shell. The chain config does not read `.env.local`.

In CI the job stops when the P-Chain balance is below 0.3 AVAX, or when the wallet self-test fails. The teardown also runs after a failure or a cancel. The artifacts are the ledger (30 days), and the report and the screenshots (14 days). They hold no traces. To tear down what a CI run left, download its ledger artifact and run `node chain/lib/teardown.ts <folder>` with the CI key.

## Known bugs

A test can state the right behavior for a bug the site still has. Call `knownBug('<what breaks>')` from `lib/skip.ts` as the first line of the test. The test is skipped, so CI stays green. To see the known bugs fail:

```bash
E2E_KNOWN_BUGS=1 E2E_BASE_URL=http://localhost:3000 npm test
```

When you fix the bug, remove the `knownBug` call in the same PR.

## Phone size limits

The `phone` target sets the size and an iPhone user agent. It does not emulate touch or a device scale factor. It finds layout breaks below the `md` breakpoint, not touch-only bugs.

## CI

[`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) runs on each pull request, on each push to `master`, and every night. A PR tests the Vercel preview of its head commit, a push to `master` the production deployment of its commit, and the nightly run build.avax.network. The plan job splits the tests into legs, one job each: the browser tests, the sweeps, the smoke set, the API tests and the in-app browser tests. A leg of more than 200 tests runs as up to 3 parallel shards. Each browser job runs 4 workers. The agent tests run only when the repo has an `ANTHROPIC_API_KEY` secret. The nightly bug hunt is a separate workflow (see "Nightly bug hunt"). The job summary shows the results. A failed run uploads the report, the failure pages and the screenshots as an artifact. It does not upload traces: a trace records the request headers, the Vercel bypass secret included, and the artifacts of a public repo are public. To get a trace, run the failed test locally.

A test job stops at once when the bypass secret does not open the deployment (a redirect to the Vercel login), so a wrong secret does not hold a runner until the timeout.

The check to require on `master` is `E2E result`. It also fails when the test location check (`scripts/check-e2e-location.sh`) fails. A fork or Dependabot PR gets no bypass secret, so its tests skip, and `E2E result` passes with a notice when the location check passes.

## Test selection

A PR runs the tests that its changed files can break, not the whole suite. The plan job picks them with `select/`, and its job summary lists each changed file, the rule that placed it, and the tests it runs.

- A shared file (dependencies, config, the workflow, this package's config, `select/`) runs every test.
- A file that no page or test reads (docs, unit tests, lint config, other workflows) runs no test.
- A code file runs the tests of the pages that import it, directly or through other files. `select/graph.ts` builds the import graph from the route files of `app/` and the MDX files of `content/`.
- A content file runs the tests of its collection. A file of `public/` runs the tests of the pages that name its URL.
- A file of `tests/e2e` runs its own folder, or the folders whose tests import it. The API tests (`api/`) and the in-app browser tests (`webview/`) have their own configs, and each runs as one leg.
- A file that no page reaches in the graph runs every test, because the graph cannot see every way a file is used.
- Every PR also runs the smoke set (tag `smoke`): the home page, the navbar, and one page per area.
- Every push to `master` and every night run the whole suite, so a test that a PR skipped runs within a day.
- A PR and a push to `master` run the sweeps (tag `sweep`) at the desktop size only. The nightly run runs them at both sizes. The sweeps check that each page opens; they read no layout.

To see what a change runs, from `tests/e2e` (Node 24):

```bash
git diff --name-only origin/master | node select/plan.ts -
```

When you add a test folder, a file in `ai/`, or a test helper that reads a repo file, update `select/rules.ts`. The plan job fails until the lists match the suite (`checkSuite` in `select/select.ts`), and `tests/unit/ci/e2e-select.test.ts` runs the same check.
