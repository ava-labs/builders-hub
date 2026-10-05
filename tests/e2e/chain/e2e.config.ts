import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { bypassHeaders } from '../lib/bypass.ts';
import { readFujiKeyIfSet } from './lib/chain.ts';
import { coreProvider } from './wallet/provider.ts';

// The Console chain tests: each night they drive build.avax.network/console through a fresh L1 on Fuji, with real
// transactions signed in Node by the Fuji test key (E2E_CHAIN_FUJI_KEY_FILE or E2E_CHAIN_FUJI_KEY). They run only
// from .github/workflows/e2e-chain.yml or by hand (README.md, "Console chain tests"). The main config excludes this
// folder.
//
//   npm run test:chain

// Production by default. A local run can test a preview: set E2E_BASE_URL and VERCEL_AUTOMATION_BYPASS_SECRET.
// This config does not load .env.local, so only the shell sets the target.
const app = { url: process.env.E2E_BASE_URL ?? 'https://build.avax.network', identity: 'builders-hub' };

// A static secret joins the framework's redaction ledger when the run starts: the report, the console output and the
// failure pages never show it. The signer reads the key itself, not from here; this entry only makes sure that a slip
// prints a mask. Both forms are listed, because code can print the key with or without the 0x prefix.
const key = readFujiKeyIfSet();
const secrets = key ? { E2E_CHAIN_FUJI_KEY: key, E2E_CHAIN_FUJI_KEY_HEX: key.slice(2) } : undefined;

export default {
  tests: ['**/*.e2e.ts'],
  // Desktop only. The flows are long and send transactions, so a second size would double the cost and the run time.
  // The init script is the page half of the e2e Core wallet (wallet/provider.ts). The engine runs it in each document
  // before the app's scripts. It holds no key; the `wallet` fixture (lib/fixtures.ts) answers its requests in Node.
  targets: [
    {
      name: 'desktop',
      engine: web({ viewport: { width: 1440, height: 900 }, headers: bypassHeaders(), initScripts: [coreProvider] }),
      app,
    },
  ],
  // A retry would send the transactions again. A test checks the ledger and the chain before each send instead, and
  // only chain/lib/warp.ts retries (a Warp delivery that reverted changes no state).
  retries: 0,
  // One key signs every transaction, so tests never run in parallel (C-Chain nonces and P-Chain UTXOs).
  workers: 1,
  // A member can wait 15 minutes for Glacier and then send. A test sets a lower `timeout` for a short step.
  timeout: 20 * 60_000,
  actionTimeout: 60_000,
  assertionTimeout: 60_000,
  // No traces in CI: a trace records the requests and their headers, and the artifacts of a public repo are public. A
  // local run keeps the trace of a failed test.
  trace: process.env.CI ? 'off' : 'retain-on-failure',
  // No agent steps, so no replay cache.
  cache: 'off',
  reporters: ['list', 'junit', 'markdown'],
  ...(secrets && { secrets }),
} satisfies E2EConfig;
