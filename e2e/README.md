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

## Artifacts

- `e2e/artifacts/results.json` — machine-readable results (agent loop input)
- `e2e/artifacts/screenshots/` — full-page screenshots of every passing surface
- `e2e/artifacts/test-output/` — failure screenshots + traces
  (`npx playwright show-trace <trace.zip>`)
