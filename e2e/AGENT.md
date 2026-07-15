---
name: academy-qa
description: Agent-driven QA sweep of Academy courses, docs pages, and console tools on build.avax.network. Runs the Playwright harness in e2e/, judges results (screenshots, partial-mounts, failures), drives flows interactively where assertions can't, and files deduplicated GitHub issues for findings. Designed for /loop — each iteration processes a chunk of the surface manifest and persists progress.
---

# Academy QA sweep

You are the judgment tier of the QA harness in `e2e/` (read `e2e/README.md`
first if you haven't). The deterministic tier (Playwright smoke) catches hard
failures; your job is everything that needs eyes and interaction.

## Each iteration

1. **Load state.** Read `e2e/qa-manifest.json` (regenerate with
   `yarn qa:manifest` if older than the newest commit touching `content/` or
   `components/toolbox/`). Read `e2e/.qa-progress.json` if present —
   `{ "sweepStartedAt": ISO, "done": [routes], "findings": [issue URLs] }`.
   Create it if missing.

2. **Run the deterministic tier** for the next chunk (~10 surfaces not in
   `done`):
   `yarn e2e --grep "<route1>|<route2>|..."` against `QA_TARGET_URL`
   (default local dev — start `yarn dev` in a background task if nothing is
   listening on :3000).

3. **Judge the results** (`e2e/artifacts/results.json` + screenshots):
   - **Failures** → real findings. Reproduce once with a targeted probe
     (Playwright via node, shim injected — copy the pattern from
     `e2e/smoke/wallet-shim.spec.ts` fixtures) to capture the page error and
     a screenshot before filing.
   - **`partial-mount` annotations** → open the page with the shim injected,
     expand accordions/tabs, and determine whether the missing tool is
     (a) legitimately lazy-mounted, (b) not wrapped in
     `withConsoleToolMetadata` (consistency gap — finding), or (c) broken.
   - **Passing screenshots** → spot-check ~3 per chunk for content-level
     breakage assertions can't see: empty code panels, "undefined" in copy,
     stacked error toasts, unstyled blocks, truncated tool UIs.

4. **File findings as GitHub issues** (`gh issue create` on
   ava-labs/builders-hub), but **dedupe first**:
   `gh issue list --search "<route or tool name> in:title" --state open`.
   One issue per root cause (not per page — the same broken tool on 3 pages
   is one issue listing all 3 routes). Template:
   - Title: `[academy-qa] <tool/page>: <symptom>`
   - Body: route(s), what was expected, what happened, console/page errors,
     screenshot, suspected cause (file:line if you traced it), harness command
     to reproduce. Label `bug` + `academy-qa` if labels exist.

5. **Persist + pace.** Update `.qa-progress.json` (append `done` routes and
   any issue URLs). If surfaces remain, schedule the next iteration
   (ScheduleWakeup; short delay — the work is continuous, stay under the
   cache window at ~120–270s). When the manifest is exhausted: write a sweep
   summary (surfaces checked, findings filed, pass rate) to
   `e2e/artifacts/sweep-<date>.md`, report it to the user, reset `done`, and
   end the loop unless told to run continuously.

## Tx-executing flows (deeper tier)

Only when `QA_WALLET_KEY` is set to a funded Fuji key: drive one
high-value flow per sweep end-to-end (rotate: deploy ICM demo → send message;
create subnet → create chain → convert to L1; staking manager setup). Budget:
abort the flow (and note it) if a single step takes >3 min. Never run
tx flows against production or mainnet — the shim refuses mainnet txs by
design; don't work around it.

## Hygiene

- Dismiss the cookie-consent banner before screenshots ("Accept"/"Decline" —
  either is fine).
- A dev server compile on first page hit can take ~30s; don't misread slow
  hydration as breakage — re-probe once before filing.
- Don't fix bugs mid-sweep; file them. (Exception: harness bugs — fix those
  and note it.)
