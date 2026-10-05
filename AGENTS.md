# AGENTS.md

Instructions for coding agents and contributors in this repo. The repo is the source for [build.avax.network](https://build.avax.network): docs, Academy courses, the Builder Console, the Explorer, and the marketing pages.

## Next.js 16

This repo uses Next.js 16 with Turbopack. Its APIs and conventions can differ from what you know. Read the guide in `node_modules/next/dist/docs/` before you use a Next.js API.

- `proxy.ts` replaces `middleware.ts`, and it exports `proxy`.
- `next.config.mjs` sets `agentRules: false`, so `next dev` writes no agent files. This file holds the instructions.

## Stack

- Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4 (CSS-first config in `app/global.css`, no `tailwind.config`).
- fumadocs (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`) for MDX content.
- Prisma 6 on PostgreSQL (`prisma/schema.prisma`).
- wagmi 3, viem 2, `@avalanche-sdk/client` and `@avalabs/avalanchejs` for chain access.
- AI SDK 6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`).
- Package manager: yarn 1 (`packageManager` in `package.json`, `yarn.lock`). Do not use npm or pnpm in the repo root.

## Layout

| Path | Contents |
|---|---|
| `app/` | App Router. `(home)` holds the marketing pages, `explorer/[network]`, `stats`, `solutions`. Also `academy/`, `docs/`, `console/`, `api/` |
| `components/toolbox/` | The Builder Console: tools, flows, hooks, stores, `coreViem` |
| `components/console/` | Console shell: sidebar, header, command palette, `console-flows.ts` |
| `components/explorer-v2/` | The Explorer UI |
| `content/` | MDX: `docs/`, `academy/`, `blog/`, `integrations/` |
| `lib/` | Shared modules: `source.ts` (fumadocs loaders), `stats-api.ts`, `explorer-query/`, `pchain-rpc.ts` |
| `server/services/` | Server-side business logic |
| `prisma/` | Schema, migrations, seeds, client singleton |
| `scripts/` | Build, generation and check scripts |
| `tests/unit/` | Vitest unit tests |
| `tests/e2e/` | Browser and API tests (tester-army/e2e). A separate npm package |

## Commands

```bash
yarn install          # postinstall: prisma generate, fumadocs-mdx (.source/), generated files
yarn build:remote     # download remote MDX (API and RPC reference). Run once before yarn dev
yarn dev              # next dev --turbopack
npx tsc --noEmit      # typecheck (tests/ is excluded)
npx vitest run tests/unit/explorer   # one unit test folder; npx vitest run for all
yarn build            # tsc --noEmit && next build
```

The repo has no `lint` script. Run ESLint on the paths you changed, as CI does (see "Checks").

For the browser and API tests, read `tests/e2e/README.md`. They run against a running site:

```bash
cd tests/e2e && npm ci && npx @e2e-dev/web install chromium
E2E_BASE_URL=http://localhost:3000 npm test
```

## Checks

| Check | Runs on | What it does |
|---|---|---|
| `.github/workflows/console-ci.yml` | PRs that touch the Console, contracts or `content/academy` | tsc, toolbox ESLint, folder and import rules, `scripts/check-console-design.sh`, `scripts/check-academy-embeds.mts` |
| `.github/workflows/explorer-ci.yml` | PRs that touch the Explorer | tsc, Explorer ESLint |
| `.github/workflows/unit.yml` | Every PR, and each push to `master` | The whole Vitest suite (`npx vitest run`) |
| `.github/workflows/e2e.yml` | Every PR, each push to `master`, and nightly | Browser tests (desktop, phone and in-app browsers) and API tests. A PR runs the tests its changed files reach plus a smoke set (`tests/e2e/select`); `master` and the nightly run all of them |
| `.github/workflows/e2e-explore.yml` | Nightly, or by hand | AI bug hunt: one `e2e explore` per charter in `tests/e2e/explore/charters.json`, on production. Findings go to the job summary |
| `.github/workflows/commitlint.yml` | Every PR | Conventional Commits on every commit |
| `.husky/pre-commit` (lint-staged) | Each local commit | Prettier and ESLint on the toolbox, the design check on the Console, ESLint on other files that a block covers, then `tsc --noEmit` |
| `.husky/commit-msg` | Each local commit | commitlint |

## Rules that CI enforces

**Explorer** (`eslint.config.mjs`, the `EXPLORER` list):
- No unused code.
- Each shared helper has one home: `lib/explorer-query/values.ts`, `components/explorer-v2/format.ts`, `lib/explorer-query/edges.ts`. Import the helper; do not define a copy.
- A file has at most 600 code lines. A file over the cap has a ceiling in `scripts/explorer-size-ceilings.json`, and a ceiling can only go down. Split a file before you add to it.

**Console** (`eslint.config.mjs`, `console-ci.yml`, `scripts/check-console-design.sh`):
- Use `useResolvedWalletClient`, not wagmi `useWalletClient`.
- Contract hooks use `useContractActions`, not `viem/actions`.
- Use `@/` imports, not `../../../`.
- Use `zinc-*` classes, not `gray-*` or `slate-*`.
- Use `next/link`, not a raw `<a href>` (except `#` anchors and links with `target`).
- Do not wrap contract-hook calls in `notify()`: the hooks notify.
- Do not call `createPublicClient` in the toolbox. Use `usePublicClientForChain`, `makePublicClientForChain` or `useChainPublicClient`.
- Folder names under `components/toolbox/console` are kebab-case, and so are the MDX import paths to them.

**E2E** (`scripts/check-e2e-location.sh`, every PR, forks too): browser and API tests go in `tests/e2e/`. A root `e2e/` folder, or an import of `@playwright/test` or `playwright/test`, fails CI.

**Commits** (`commitlint.config.js`): `type(scope): subject`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. The subject starts in lower case and has no full stop. The header has at most 100 characters.

**Formatting** (`.prettierrc`): single quotes, semicolons, trailing commas, width 120. lint-staged applies it to the toolbox.

## Content

- MDX frontmatter needs `title`. Give every page a `description` too. Collections add fields: see `source.config.ts`.
- `yarn build:remote` writes about 80 MDX files under `content/docs` (ACPs, API and RPC reference). They are gitignored. Edit their upstream source, not the files.
- In text that users read, write "L1", not "subnet". Code keeps the P-Chain names (`subnetId`, `ConvertSubnetToL1Tx`).
- An Academy page that imports a Console tool must resolve: `scripts/check-academy-embeds.mts` checks every import.

## Tests

- **Unit:** Vitest, node environment, no DOM (`vitest.config.ts`). Put tests in `tests/unit/<area>/`. CI runs the whole suite on every PR (`unit.yml`).
- **Browser and API:** `tests/e2e/`, with [tester-army/e2e](https://e2e.tester.army/docs). Details: `tests/e2e/README.md`.
  - Write every new browser or API test in `tests/e2e/` with tester-army/e2e. Do not add tests with `@playwright/test`, Cypress, Puppeteer or another runner, and do not add a second e2e folder. For page behavior that Vitest cannot test (it has no DOM), write a tester-army/e2e test.
  - Every browser test runs at a desktop and a phone size. Find elements by role and accessible name. Explorer data is live: assert structure, not values.
  - A test for a bug the site still has calls `knownBug()` and is skipped until the fix lands. `E2E_KNOWN_BUGS=1` runs it.
  - API tests (`tests/e2e/api/`) have their own config and run once, with no browser.
  - In-app browser tests (`tests/e2e/webview/`) have their own config: a phone with an Instagram or a LinkedIn user agent.
  - A test that signs in or signs up calls `fakeAuth()` from `tests/e2e/lib/fake-auth.ts` before it opens the page, so no test creates an account or sends an email.
  - Agent tests (`tests/e2e/ai/`) need `ANTHROPIC_API_KEY` and skip without it (`needsModel()`). Journeys (`agent.act`, then a locator check), visual checks (`agent.assert` with `vision: true`, tag `visual`) and data checks (`agent.extract`, then `expect`). Commit new entries in `tests/e2e/.e2e/cache/` with the test.
  - Sweeps (every embedded Academy tool, every Console tool route, every site route) carry the `sweep` tag.
  - A PR runs only the tests its changed files reach (`tests/e2e/README.md`, "Test selection"). When you add a test folder, a file in `ai/`, or a test helper that reads a repo file, update `tests/e2e/select/rules.ts`.
- Console wallet flows have no browser tests yet. The framework cannot inject the wallet shim before page load.

## Generated files

Do not edit these by hand:
- `.source/`: written by `fumadocs-mdx` (postinstall). Imported as `@/.source`.
- The Prisma client: written by `prisma generate` (postinstall).
- `abi/event-signatures.generated.ts`, `lib/academy/course-stats.generated.ts`, `scripts/versions.json`: written by postinstall scripts. An install can change them; commit them only when the change is intended.
- `next-env.d.ts`: `next dev` adds a `root-params.d.ts` import. Do not commit that line.

## Environment

The repo has no `.env.example`. Local dev reads `.env.local`. Most pages work without keys. Features that need keys:
- Database and auth: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, GitHub and Google OAuth.
- Explorer data: `EXPLORER_API_URL` (default `https://stats-api.avax.network`), `STATS_QUERY_URL`, `STATS_QUERY_KEY`, `GLACIER_API_KEY`, `CCHAIN_DEBUG_RPC_URL`, `FUJI_DEBUG_RPC_URL`.
- AI features: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
- Analytics: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

Never commit keys, private keys, internal hostnames or private IPs.

## Explorer data

- Most reads go through the stats API (`lib/stats-api.ts`, `lib/explorer-clickhouse.ts`).
- The query feature calls the stats API `/v2/query` (`lib/explorer-query/clickhouse.ts`).
- The remaining Glacier and Data API calls are listed in `app/api/explorer/EXTERNAL_APIS.md`.
- P-Chain reads fall back to a dedicated node when the public RPC rate-limits (`lib/pchain-rpc.ts`). That node is server-only.
