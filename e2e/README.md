# Builders Hub QA Harness

Agent-drivable end-to-end QA for every user-facing surface that embeds
interactive console tools: Academy courses, docs pages, and the Builder
Console itself.

## How it works

```
scripts/generate-qa-manifest.mts ──► e2e/qa-manifest.json   (what to test)
e2e/wallet-shim/core-shim.ts     ──► injected per-page      (how to be a wallet)
e2e/smoke/*.spec.ts              ──► Playwright             (deterministic tier)
.claude/skills/academy-qa        ──► agent loop             (judgment tier)
```

### The wallet shim

`wallet-shim/core-shim.ts` is a private-key-backed EIP-1193 provider that
**impersonates Core wallet**. It installs as `window.avalanche` +
`window.ethereum` and announces via EIP-6963 with rdns `app.core`, which is
the signal `WalletSync.tsx` uses to take the Core path. Implements the full
`coreViem/rpcSchema.ts` contract:

- `avalanche_getAccountPubKey` — compressed secp256k1 pubkeys (the console
  derives the P-Chain address from `xp`)
- `avalanche_sendTransaction` — signs P/X/C tx hex locally via
  `@avalanche-sdk/client` (`xpAccount`) and issues to the network
- `wallet_getEthereumChain`, chain add/switch, EVM signing via viem
- all read methods proxy to the active chain's RPC

Tests auto-connect: the fixture seeds `wagmi.recentConnectorId` so wagmi
reconnects to the shim on mount — no Connect-button UI dance.

Mainnet tx submission is refused unless explicitly enabled (`allowMainnet`).

### Mount signals

Embedded tools are detected via stable data attributes:

- `[data-console-tool]` — tool Container chrome mounted (title attr = tool name)
- `[data-console-tool-gate]` — requirements gate rendered (legitimate when the
  QA wallet lacks funded balances; the wrapper is alive)
- `[data-console-flow]` — multi-step StepFlow mounted (tools embedded as flows
  don't use the Container)

A page fails the smoke only on hard signals: HTTP error, uncaught page
exceptions, error boundary, or **zero** tools mounting. Fewer-than-expected
mounts (collapsed accordions, unwrapped tools) become `partial-mount`
annotations for the agent loop to investigate interactively.

## Running

```bash
# local dev server (terminal 1)
yarn dev

# all smoke specs (terminal 2)
yarn e2e

# subset
yarn e2e --grep wallet-shim

# regenerate the surface manifest after adding/moving course tools
yarn qa:manifest

# tier-1 static check (also runs in console-ci on PRs)
yarn qa:check-embeds
```

### Environment

| Variable | Purpose | Default |
|---|---|---|
| `QA_TARGET_URL` | Base URL to test | `http://localhost:3000` |
| `QA_WALLET_KEY` | 0x private key (drives EVM + XP accounts) | ephemeral random key |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Unlocks protected preview deployments | unset |

Render smoke works with the ephemeral key. Transaction-executing flows
(deploys, P-Chain ops) need a **funded Fuji key** — fund via the
[Fuji faucet](https://core.app/tools/testnet-faucet/) (C-Chain) and the
console's C→P transfer tool for P-Chain balance.

## Flow tier (real transactions)

`e2e/flows/transactions.spec.ts` drives the console like a user and submits
**real Fuji transactions**, verifying them on-chain. All tx tests live in
this one file under a serial describe — they share the wallet's UTXO set, so
they must never overlap; a serial file runs on a single worker even at
`--workers=4`. Current flows:

- **create L1** — Create Subnet → Create Chain; both txs verified `Committed`
  and the chain cross-checked via `platform.getBlockchains`.
- **C-Chain deploy** — deploys ExampleERC20 to Fuji C-Chain (ordinary EVM
  `eth_sendTransaction`); verified with `eth_getCode` at the address.
- **cross-chain transfer (C→P)** — `test.fixme`, blocked: the C-Chain export
  is an EVM *atomic* tx and the shim's `avalanche_sendTransaction` re-signs
  via the SDK's P/X path, which can't handle EVM atomic txs. Needs the shim
  to sign EVM atomic export/import natively (real Core does).

Transaction classes, by reach: P/X-Chain txs and ordinary C-Chain EVM
deploys work today; C-Chain *atomic* txs need the shim fix above; anything
that transacts **on a freshly-created L1** (tokenomics precompiles, staking,
validator mgmt) needs the L1 actually running (validator nodes) — out of
scope for the funded-key-only harness.

```bash
QA_WALLET_KEY=0x... yarn e2e --grep "create-l1 click-through"
```

The whole tier skips itself when `QA_WALLET_KEY` is unset, so the
deterministic smoke stays green in PR CI without secrets. Each run costs
real (testnet) AVAX and leaves throwaway subnet/chain records on Fuji —
run it locally or on a schedule, not per PR push.

The shim resolves **subnet-auth** automatically: for P-Chain txs that
modify a subnet (CreateChainTx, ConvertSubnetToL1Tx, AddSubnetValidatorTx,
…) it parses the tx, fetches the owning CreateSubnetTx, and passes
`subnetOwners`/`subnetAuth` to the SDK so the auth credential is signed —
mirroring what real Core does wallet-side.

### Vercel previews

The `builder-hub` project has deployment protection (SSO). Enable
*Protection Bypass for Automation* in Project Settings → Deployment
Protection, then:

```bash
QA_TARGET_URL=https://<preview>.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \
yarn e2e
```

The config sends the bypass header on every request automatically.

## CI

**`.github/workflows/academy-e2e.yml`** runs the full suite — render *and*
transactions in one job — on every Vercel deployment (`deployment_status`):
each preview deploy (every push to every branch) and the production deploy
after merge, plus `workflow_dispatch` for an arbitrary URL.

A single `yarn e2e --workers=4` runs both tiers, so the result is one
`results.json` and one deduped report. What runs depends on which secrets
are set:

- `VERCEL_AUTOMATION_BYPASS_SECRET` — unlocks SSO-protected previews
  (required for preview deploys).
- `QA_WALLET_KEY` — funded Fuji key that activates the transaction tier. If
  it's absent, the flow tier skips and only the render smoke runs (the shim
  falls back to an ephemeral key), so the job still passes.

The flow tier (`e2e/flows/*`) is a serial describe, so its real-tx tests run
one-at-a-time on a single worker even at `--workers=4`, while render specs
parallelize across the rest.

**Cost note:** with `QA_WALLET_KEY` set, transactions run on *every* deploy
— each spends a little testnet AVAX and leaves a throwaway subnet/chain on
Fuji. To restrict transactions to production deploys only, gate the run step
(or split the flow into its own step) with
`if: github.event.deployment.environment == 'Production'`.

Static embed integrity (`yarn qa:check-embeds`) runs separately in
`console-ci.yml`. Results, screenshots, and traces upload as the
`academy-e2e-artifacts` workflow artifact.

Failures are **deduped by root cause**: one broken component takes down
every page embedding it, so the smoke spec tags zero-mount failures with
the missing tool and `yarn qa:summary` (also an `always()` CI step)
collapses them — "Tool failed to mount: TestSend, 3 pages affected" is one
finding and one GitHub annotation, not three reworded ones.

## Artifacts

- `e2e/artifacts/results.json` — machine-readable results (agent loop input)
- `e2e/artifacts/screenshots/` — full-page screenshots of every passing surface
- `e2e/artifacts/test-output/` — failure screenshots + traces
  (`npx playwright show-trace <trace.zip>`)
