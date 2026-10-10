# Browser and API tests (tester-army/e2e)

Tests for build.avax.network, run with [tester-army/e2e](https://e2e.tester.army/docs):

- Browser tests for the Explorer, Academy, docs, the other site pages, and the Console without a wallet. They run at two sizes: `desktop` (1440x900) and `phone` (390x844).
- API tests for `/api/mcp` in `api/`. They run once, with no browser.
- In-app browser tests in `webview/`. They run on a phone with the user agent of the Instagram or the LinkedIn in-app browser.
- Agent tests in `ai/`. Claude does a step from a plain-language instruction. They need `ANTHROPIC_API_KEY` and skip without it.

Console flows that send transactions are in `chain/`. They run only from their own nightly workflow, on Fuji (see "Console chain tests").

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
- An `act` step replays only when the page it ends on is the same. Do not commit the entry of a step that ends on a page with a live number or ranking: CI would fail it with `REPLAY_STALE` when the number changes. Add its file name to `tests/e2e/.gitignore` instead, so the step calls the model in CI. A content change that alters a recorded count (integrations, lessons) needs the entry recorded again.
- Commit the new cache entries in `.e2e/cache/` with the test. A local run records and updates entries; CI only reads them. When the page changes, the next passing local run records the step again. `npx e2e cache clear` deletes every entry.
- An entry recorded on localhost, a preview or production replays on all of them: `app` in `e2e.config.ts` fixes the cache identity and environment.
- CI runs with `--strict-cache`: an entry that no longer replays fails its step with `REPLAY_STALE` and calls no model. Run the test locally without the flag to record it again, then commit the changed entry.

`agent.assert`, `agent.waitFor` and `agent.extract` call the model on every run.

## Nightly bug hunt

`.github/workflows/e2e-explore.yml` runs `e2e explore` once a night on production, one job for each charter in `explore/charters.json`. The agent gets the charter's goal, drives the site and reports findings. Findings go to the job summary and to the artifact `e2e-explore-<key>` (14 days). They do not fail the job: a person triages them. A job fails only when the run tested nothing.

- A charter costs about 1M to 3M model tokens. The 9 charters cost about 10 to 14 dollars a night.
- Run it by hand on GitHub (Actions, E2E explore, Run workflow), with an optional target URL and charter keys.
- Run one charter locally: `npx e2e explore '<goal>' --target desktop --output .e2e/explore/<key>`.
- Without the `ANTHROPIC_API_KEY` secret the job skips.

### Console bug hunt (watch-only wallet)

`explore/console/` runs `e2e explore` on the Builder Console with a watch-only wallet. No CI job runs it. `charters.json` holds one goal per Console area, and `e2e.config.ts` gives the command for one charter.

- With `E2E_CHAIN_FUJI_KEY_FILE` set, the page gets a Core wallet that knows only the public addresses of the Fuji test key (`watch-wallet.ts`). It reads Fuji and rejects each sign or send request with 4001, so a run sends no transaction. Without the variable, the page has no wallet.
- The wallet's own reads go out one every 600 ms at most and stop at the first HTTP 429. The Console also reads Fuji by itself, so run one charter at a time.
- The results go to `explore/console/.e2e/explore-console/<key>/`, which git ignores.
- Keep each charter to one Console area. The planner's input grows with each step. When it is more than the agent's limit of 64,000 tokens, the run stops early (`STEP_BUDGET_EXHAUSTED`). One charter for ICM and ICTT went above the limit, so they are two charters (`icm-setup`, `ictt-setup`).
- A run on localhost does not test the login gate: the Console lets a local dev server through without a sign-in (`isDevLocalhostBypass` in `components/toolbox/hooks/useAccountRequirements.ts`). To test the pages that need an account (Basic setup, the faucet, the managed relayer), run the charter on a preview. Set `E2E_BASE_URL` to the preview URL and `VERCEL_AUTOMATION_BYPASS_SECRET` to the bypass secret.
- The watch wallet has no signer, so it cannot send a transaction. Other tools can use the same key at the same time, for example a chain test or a script. So a change of the key's balance or nonce during a run does not prove that the watch wallet sent something.

## Console chain tests

`chain/` holds the Console flows that send real transactions on Fuji. They have their own config, `chain/e2e.config.ts`: desktop only (no phone size), one worker, no retries. The main config excludes the folder, so a PR never runs them. [`.github/workflows/e2e-chain.yml`](../../.github/workflows/e2e-chain.yml) runs them each night at 08:23 UTC on build.avax.network: one suite per job, one job after the other ([`e2e-chain-suite.yml`](../../.github/workflows/e2e-chain-suite.yml)). To run them by hand on GitHub: Actions, E2E chain, Run workflow, on `master`. A run from another branch skips every job. The workflow takes no URL: CI tests production only.

### The suites

Each file is one suite, with its own tag and its own ledger in `chain/.run/` (gitignored). Fuji AVAX has no value. The table shows what each suite locks and burns, so you know what the key needs.

| Tag | File (ledger) | Runs | Time | Locks | Burns per run |
|---|---|---|---|---|---|
| `tier1` | `poa-cchain.e2e.ts` (`ledger.json`) | Nightly | About 3 to 7 min (Glacier can take more than 3 min to list a new validator) | Up to 0.05 P-Chain AVAX in L1 validator balances, during the run | About 0.0003 P-Chain AVAX |
| `pos` | `pos-erc20-cchain.e2e.ts` (`pos.json`) | Nightly | About 5.5 min | 0.04 P-Chain AVAX in L1 validator balances, during the run | About 0.001 P-Chain AVAX (estimate) |
| `bridge` | `bridge-cp.e2e.ts` (`bridge-cp.json`) | Nightly | About 35 s | 0.01 AVAX in shared memory, for some seconds | About 0.00001 P-Chain AVAX |
| `stake-reads` | `primary-stake-reads.e2e.ts` (`primary-stake-reads.json`) | Nightly | About 10 s | Nothing | Nothing: it sends no transaction |
| `stake-acp236` | `primary-stake-acp236.e2e.ts` (`stake-acp236.json`) | Weekly, Sunday | About 25 s (about 3 min when the API's validator list lags the add) | 1 P-Chain AVAX for 12 h (one cycle) | About 0.0003 P-Chain AVAX |
| `stake-fixed` | `primary-stake-fixed.e2e.ts` (`stake-fixed.json`) | Weekly, Wednesday | About 13 s | 1 P-Chain AVAX for 12 h 15 min | Below 0.0001 P-Chain AVAX |

The C-Chain gas of a suite is below 0.00001 AVAX at the usual Fuji base fee.

- `tier1` makes a fresh PoA L1, one test per Console step: the questionnaire, Create Subnet, the Validator Manager and its proxy on the C-Chain, Initialize, Create Chain, Convert to L1 with mock validator V0, Initialize Validator Set. Then it runs the validator tools: add V1, change its weight, top up V0, remove V1, disable V0. The sends audit ends the run (see "How the tests work").
- `pos` makes a fresh PoS L1 with the same first steps (`chain/lib/create-l1.ts`). Then it deploys an ERC20 token, the ERC20 staking manager and a reward calculator, stakes mock validator V1 with 1 test token, and delegates 1 token to V1. It checks the read-only pages, removes the delegation and V1, and disables V0.
- `bridge` moves 0.01 AVAX from the P-Chain to the C-Chain and back with the Console's C/P bridge, between the key's own addresses. Its first test imports the key's AVAX that an earlier run left in shared memory. Anyone can export a UTXO to the key's address, so the page imports only the key's own unlocked AVAX. It does not import a UTXO that is locked, of another asset or with more owners. It also leaves each UTXO that does not hold more than the fee of its own input (the gas that the input adds, times the price), so dust cannot raise the fee of an import above the export. One import takes the largest of the other UTXOs first, as many as fit in its gas limit: 100,000 gas on the C-Chain (coreth's gas limit for an atomic tx), and half the P-Chain's maxCapacity on the P-Chain (500,000 gas on Fuji). The page gives the SDK exactly these UTXOs, so a UTXO that the key cannot spend has no effect on the import or its fee. When the import cannot pay its fee (dust), the page imports nothing on that side. The page shows one line with the count of the UTXOs that the wallet cannot import now: the UTXOs of other owners or assets, the locked UTXOs, the dust, and the UTXOs that wait for a later import. The page reads shared memory page by page, at most 10 pages of 1,024 UTXOs for each side. When shared memory holds more, the page shows one more line. The test sorts shared memory with the same rules at the prices that the page reads (`chain/lib/atomic.ts` `atomicUtxos` and `importSelection`), and checks that each import it clicks spends exactly the page's selection. The test and the teardown leave the UTXOs that the key cannot import.
- `stake-reads` opens the Stake page for live Fuji validators of other wallets, and checks the read-only views and the form's refusals.
- `stake-acp236` adds an auto-renewed Primary Network validator (ACP-236), updates its config, and stops the renewal. `stake-fixed` adds a fixed-duration Primary Network validator.
- The mock validators (`chain/lib/mock-validator.ts`) run no node. For a C-Chain manager, the Primary Network signs every Warp message. A Primary Network stake of a mock node earns no reward (its uptime is 0), and the P-Chain returns the stake at the end of the cycle or at the end time. No transaction can return it earlier.
- A weekly suite runs only when `E2E_CHAIN_WEEKLY` names its tag. Without the variable, its tests skip, and a run of its tag stops with `NO_TESTS`. So a local run never locks 1 AVAX by mistake. The CI job of each suite sets the variable to its tag.

### How the tests work

- Every transaction goes out from a Console button. Node signs what the page asks for, makes the mock validators' credentials (the test pastes them into the page), and reads the chain to check each result. The one exception is `chain/lib/teardown.ts`, which signs its txs in Node without the page (see the teardown bullet below).
- The wallet signs in Node with the Fuji test key. The page half is an init script (`chain/wallet/provider.ts`, `web({ initScripts })` in `chain/e2e.config.ts`): a Core provider with no key, announced through EIP-6963. It posts each request to `/__e2e/wallet`. The `wallet` fixture (`chain/lib/fixtures.ts`) answers that path with a `browser.route`, from the signer. The key never goes into the page.
- The signer refuses mainnet, any native AVAX value on an EVM tx, and each stake or atomic tx type that the running file did not turn on. It does not limit contract calls: it signs a zero-value call to any address with any data, so a page can move the key's ERC20 tokens. A stake file turns on `allowPrimaryStake(nodeId)` for its one mock NodeID. The bridge file turns on `allowBridge()`.
- A test can make the wallet act as a user who clicks Reject in Core: `signer.rejectNext(method, { times })` answers a request of that method with error 4001, before any check or network call. By default it rejects the next request only. With a number, `times` rejects that many requests. Only `times: Infinity` rejects every request of that method until the test calls `cancel()` on the handle that `rejectNext` returns.
- The last test of each file runs the sends audit (`chain/lib/audit.ts`). In `tier1` that test is 'audits the wallet sends'. The audit fails on each of these:
  - the count of sends of a tx type is not the exact count that the test expects;
  - the wallet sent a tx that the ledger does not hold, or the ledger holds a sent tx that the wallet did not send or adopt from an earlier run;
  - the wallet refused a request that the test did not expect;
  - a user rejection that the test armed is still armed: the page never sent that request, or the test did not cancel a `times: Infinity` rejection;
  - a ledger step of the file's step table (`TIER1_SENDS` or `POS_ERC20_SENDS` in `chain/lib/audit.ts`) is missing, is not landed or has the wrong number of sends, or a ledger step is not in the table;
  - a total of the signer is above its cap.

  The audit lists the user rejections, writes one table to the ledger and the job summary, and turns every capability off (`revokeAll`).
- Besides the happy path, `tier1` checks how the pages handle a wrong input, with no extra L1 and no extra tx: a reload between the two proxy deploys, a blockchain ID in the Subnet ID field, an Add V1 weight of 25% of the L1, a reload on the P-Chain step, a rejected top-up and its retry, and no 'Insufficient P-Chain balance' warning for the funded key. It reads each tx ID from the page and checks it against the wallet's tx.
- One process has one signer, and each file audits every send of it. So run one suite per command. `tier1`, `pos` and `bridge` stop at their first test when the signer already has a send, a refusal or a user rejection from another file.
- As Core does, the wallet gives a site no account until it connects. The first test clicks 'Connect Wallet', then 'Core' (`connectCore`). After a reload or `app.open`, the Console connects again by itself.
- `chain/lib/ledger.ts` writes the suite's ledger before and after each send. Before a send, a test reads the chain and skips a send whose result is already there. After a send, it polls the chain until a node shows the result.
- `chain/lib/chain.ts` reads the public Fuji RPC and Glacier only. It sends at most 2 requests per second and stops at the first HTTP 429. The wallet's calls go through the same limit (`throttledFetch`).
- The public API caches some P-Chain reads by their params for about 3 min: `platform.getCurrentValidators`, `platform.getSubnet`, `platform.getTx` and `platform.getL1Validator`. The helpers in `chain/lib/chain.ts` (`pCurrentValidators`, `pSubnet`, `pTxJson`, `pL1Validator`) read past it: `freshParams` adds a unique param that the node ignores, so the answer is never a cached one. The Console's own reads still get the cached answer, so a page can show the state from before a tx for up to 3 min. The Stake page shows the values of its own accepted txs at once, until a reload. Right after an add, the Stake page keeps Update Config and Stop Auto-Renewal disabled until its 30 s re-read lists the validator, and `stake-acp236` waits for the button. When the SDK's own read still misses the validator, the page says so, and the test clicks again every 20 s.
- `chain/lib/warp.ts` retries a Warp delivery up to 4 times, 15 s apart. Each attempt aggregates the signatures again.
- `chain/lib/teardown.ts` makes 3 passes. It reads the chain first, and sends a tx only for what the key alone owns:
  1. It disables each L1 validator of the ledgers that the P-Chain shows active, and refunds its balance.
  2. It stops an auto-renewed Primary Network stake of a ledger that still renews (a config tx with period 0), and prints the unlock time of each ledger stake. No tx can return a stake early: the P-Chain returns it at the end of its cycle or its end time.
  3. It imports the key's AVAX that waits in shared memory, on each side, to the key's own address. A `bridge` run that stops between an export and its import leaves it there. Each import takes the UTXOs that the page's next import takes (`importSelection`), at the price that the pass pays: the UTXOs that hold more than the fee of their own input, the largest first, as many as fit in 100,000 gas on the C-Chain or half the P-Chain's maxCapacity on the P-Chain. A later run imports the rest. A UTXO that does not hold more than the fee of its own input stays. A side whose AVAX in the selection is not above the import fee cannot pay for its import. The pass reports both as dust, sends no import for them, and does not fail. A UTXO that is not the key's own unlocked AVAX (locked, another asset, more owners) stays in shared memory: the pass prints it with the reason and does not fail. Do not run the teardown while a `bridge` run is on.

### The key

The tests read the key from the file that `E2E_CHAIN_FUJI_KEY_FILE` names. The file must have mode 0600 (or 0400): `chain/lib/chain.ts` refuses a file that others can read. A file keeps the key out of the environment that the test workers, Chromium and `npx` inherit. `E2E_CHAIN_FUJI_KEY` (the key itself) also works, but the file wins when both are set.

- Never print, log, paste or commit the key. The config gives it to the framework as a secret, so the report masks it.
- Other tools also sign with this key. The suites check that only the txs of their own signer change the key's balances, stakes and shared memory, so a tx of another tool during a run can fail that run. For example, a C/P bridge transfer of another tool puts a UTXO in shared memory and changes the balances that `bridge` checks, and a stake of another tool stops a weekly suite. Two signers of one key also conflict on C-Chain nonces and P-Chain UTXOs. Do not use the key with another tool from 08:23 UTC until the E2E chain run ends. GitHub can start the run about 2 h late.
- In CI the key is the repository secret `E2E_CHAIN_FUJI_KEY`. A suite job installs the dependencies and Chromium first. Then it writes the key to a 0600 file and passes only the path.
- The `master` guards (the `plan` job of `e2e-chain.yml` and the `suite` job of `e2e-chain-suite.yml`) stop the nightly run and a dispatch from running these jobs off `master`. They do not protect the key. A guard is in the workflow file of the ref that runs, so a branch can delete it. Also, any workflow that runs from a branch of this repository, a same-repo `pull_request` included, can read a repository secret.
- The real boundary is a GitHub Environment with a deployment branch policy of `master` only. Only a repo admin can make one (see "Move the key into an Environment").
- Until then, keep only a small Fuji balance on the key: about 1.2 AVAX on the P-Chain and 0.02 AVAX on the C-Chain. Fuji AVAX has no value, but a small balance limits what a person with a leaked key can take.

The two numbers come from the preflight minimums and the weekly stakes:

- P-Chain, 1.2 AVAX. The largest preflight minimum is the weekly 1.05 unlocked AVAX (`tier1` 0.3, `pos` 0.1, `bridge` 0.02). The minimums do not add up: the suites run one after the other, and each nightly suite gets its L1 balances back. Each weekly stake locks 1 AVAX for 12 h to 12 h 15 min and comes back before the next night. The Sunday and Wednesday stakes never overlap. To the 1.05, add 0.09 AVAX for the L1 balances of a night when the Console's Disable and the teardown both fail (0.05 for `tier1` and 0.04 for `pos`), and 0.01 AVAX for a week of fees. That is 1.15 AVAX. 1.2 AVAX keeps a margin of 0.05.
- C-Chain, 0.02 AVAX. The nightly preflight minimum is 0.002 AVAX (the signer's gas cap for one EVM tx), and the preflight warns below 0.01 AVAX. The suites burn less than 0.001 C-Chain AVAX a week, so 0.02 AVAX stays above the warning for many weeks.

#### Move the key into an Environment

Do these steps once, in this order, so the nightly run always has the key. Steps 1, 2, 3 and 7 need a repo admin.

1. In the repository settings, open Environments and make a new environment with the name `e2e-chain-fuji`.
2. In Deployment branches and tags, select Selected branches and tags, and add the branch rule `master`.
3. In Environment secrets, add `E2E_CHAIN_FUJI_KEY` with the key. GitHub cannot show a secret again, so get the key from its owner.
4. In `.github/workflows/e2e-chain-suite.yml`, add `environment: e2e-chain-fuji` to the `suite` job, and remove the `secrets:` block under `on.workflow_call`.
5. In `.github/workflows/e2e-chain.yml`, remove the `secrets:` block of each suite job. A caller cannot read an Environment secret: the `suite` job reads it from its environment.
6. Merge that change to `master`.
7. In Secrets and variables, Actions, delete the repository secret `E2E_CHAIN_FUJI_KEY`.

After the move, only a job that names `e2e-chain-fuji` and runs from `master` gets the key. GitHub stops that job when it runs from another branch, and a job that does not name the environment gets no key.

### Run them locally

Run one suite per command:

```bash
cd tests/e2e
export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # chmod 600
node chain/wallet/selftest.ts                 # the wallet's checks and the teardown txs, signed with fixed reads; sends nothing
node chain/lib/preflight.ts                   # the key's addresses, balances, stakes and their unlock times
node chain/lib/preflight.ts --min-p-avax 0.3 --min-c-avax 0.002   # also fail below these balances, as CI does
npm run test:chain -- --tag tier1
npm run test:chain -- --tag pos
npm run test:chain -- --tag bridge
npm run test:chain -- --tag stake-reads
E2E_CHAIN_WEEKLY=stake-acp236 npm run test:chain -- --tag stake-acp236   # locks 1 AVAX for 12 h
E2E_CHAIN_WEEKLY=stake-fixed npm run test:chain -- --tag stake-fixed     # locks 1 AVAX for 12 h 15 min
node chain/lib/teardown.ts --dry-run          # what each pass would send; sends nothing
node chain/lib/teardown.ts                    # send it: disable, stop a renewal, import stranded AVAX
```

- `npm run test:chain` needs exactly one `--tag`, with one of the six suite tags: `tier1`, `pos`, `bridge`, `stake-reads`, `stake-acp236` or `stake-fixed`. It refuses anything else (no tag, an unknown tag, two tags) with a usage message. It never runs all the files in one process.
- Each `tier1` or `pos` run makes a new L1. The first test moves the suite's last ledger to `chain/.run/archive/`, where the teardown still finds it. Run the teardown before the next run.
- A weekly suite needs 1.05 AVAX unlocked on the P-Chain. The stake of an earlier run stays locked until its end. The suite's ledger records the unlock time.
- A weekly suite starts next to an earlier stake only when the stake cannot change the balances that the suite checks: a local ledger names it, it does not renew, and it comes back more than 1 h later. CI starts with an empty `chain/.run`, so there any earlier stake stops the suite.
- If your local key is the CI key, do not run from 08:23 UTC until the E2E chain run ends. GitHub can start the run about 2 h late. Both runs would sign with one key and conflict on C-Chain nonces and P-Chain UTXOs. The workflow's concurrency group covers CI runs only.
- The public Fuji API is load-balanced, and its nodes accept a block at different times. A check after a tx polls until a node shows the result (`chainShows` in `chain/lib/chain.ts`).
- The tests open `https://build.avax.network` by default. To test a local dev server, set `E2E_BASE_URL=http://localhost:3000` in the shell. To test a preview, set `E2E_BASE_URL` and `VERCEL_AUTOMATION_BYPASS_SECRET`. The chain config does not read `.env.local`.
- The tests find the Console's controls by role and name, as the Console of the same commit names them. A change that renames a control changes its test in the same PR. Until that change is on production, the suites pass only against a dev server of the branch (`E2E_BASE_URL=http://localhost:3000`).

### In CI

Each suite job stops before the tests when the wallet self-test fails, or when a balance is below the suite's minimum:

| Tag | P-Chain minimum (unlocked AVAX) | C-Chain minimum (AVAX) |
|---|---|---|
| `tier1` | 0.3 | 0.002 |
| `pos` | 0.1 | 0.002 |
| `bridge` | 0.02 | 0.002 |
| `stake-reads` | 0 | 0 |
| `stake-acp236`, `stake-fixed` | 1.05 | 0 |

- Before the suites start, the `plan` job waits for a successful Vercel Production deployment of the run's commit. While Vercel builds the commit (its `Vercel` commit status is pending), the job waits for 25 min at most. A build that does not end in that time stops the run. If no deployment of the commit succeeded, a failed build stops the run. If Vercel sets no status on the commit in 10 min (it skipped the commit), the suites test the newest successful Production deployment, and the job summary names its commit. The `plan` job checks only that the build succeeded. After a Vercel rollback, the suites test the rolled-back deployment.
- The weekly suite runs last, so the nightly suites have their L1 balances back before the stake. To run a weekly suite on another day: Run workflow, then set `weekly` to `stake-acp236` or `stake-fixed`. `none` runs the nightly suites only.
- A failed suite does not stop the next one. The teardown runs after each suite, also after a failure or a cancel.
- The `Result` job lists the result of each suite in its job summary, and fails when a suite did not pass. The repository has no Slack secret, so CI sends no other alert.
- Each suite has its own artifacts: the ledger (`e2e-chain-ledger-<tag>-<run>-<attempt>`, 30 days), and the report and the screenshots (`e2e-chain-report-<tag>-<run>-<attempt>`, 14 days). They hold no traces. To tear down what a CI run left, download its ledger artifact and run `node chain/lib/teardown.ts <folder>` with the CI key.

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
