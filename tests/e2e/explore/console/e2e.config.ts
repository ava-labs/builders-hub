import { existsSync } from 'node:fs';
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { anthropic } from '@ai-sdk/anthropic';
import { bypassHeaders } from '../../lib/bypass.ts';
import { watchAccountFromKeyFile, watchWalletScript } from './watch-wallet.ts';

// `e2e explore` on the Builder Console, with a watch-only wallet: the explorer walks the Console as a first-time
// builder and reports defects. The wallet reads and never signs, so no run sends a transaction (watch-wallet.ts).
// charters.json in this folder holds one goal per Console area. The site must already run: this config starts no app.
//
// Run one charter from tests/e2e. Set key to a charter key, for example key=create-l1-questionnaire:
//
//   E2E_BASE_URL=http://localhost:3217 E2E_CHAIN_FUJI_KEY_FILE=$HOME/.config/e2e-chain/fuji.key \
//   E2E_TELEMETRY_DISABLED=1 npx e2e explore \
//     "$(jq -r --arg k "$key" '.[] | select(.key == $k) | .goal' explore/console/charters.json)" \
//     --config explore/console/e2e.config.ts --target desktop --max-steps 10 \
//     --output ".e2e/explore-console/$key" --reporter list,markdown
//
// The output path is relative to this folder (the config's folder is the project root), so the results go to
// tests/e2e/explore/console/.e2e/explore-console/<key>/, which git ignores (tests/e2e/.gitignore).
//
// - E2E_CHAIN_FUJI_KEY_FILE names the Fuji test key file. The config reads it in Node and gives the page only the
//   public values: the C-Chain address, the P-Chain address and the public key. Without the variable the page has
//   no wallet, and the explorer sees the Console as a visitor with no wallet.
// - The key is not a `secrets` entry and is in no other config value, so the explorer, the page and the report never
//   get it. watch-wallet.ts keeps it in Node.
// - ANTHROPIC_API_KEY comes from the shell or tests/e2e/.env.local. Without it the explorer has no model.

const envFile = new URL('../../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// The model of the main config (tests/e2e/e2e.config.ts).
const model = process.env.ANTHROPIC_API_KEY ? anthropic('claude-sonnet-5-5') : undefined;

// The site under test: a local server, a Vercel preview, or production. Vercel previews need the bypass header.
const url = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const headers = bypassHeaders();
// The app identity of the main config.
const app = { url, identity: 'builders-hub', environment: 'production' as const };

const account = watchAccountFromKeyFile();

// The same script as the main config: it hides the Next.js route announcer (role alert, empty or the page title)
// from the accessibility tree. Without it the explorer reads each navigation as a new alert.
function hideRouteAnnouncer(): void {
  if (customElements.get('next-route-announcer')) return;
  customElements.define(
    'next-route-announcer',
    class extends HTMLElement {
      connectedCallback() {
        this.setAttribute('aria-hidden', 'true');
      }
    },
  );
}
const initScripts = account ? [hideRouteAnnouncer, watchWalletScript(account, url)] : [hideRouteAnnouncer];

// The acting agent reads `system`. Every model call, the judges too, reads `context`.
const system = [
  'You are a builder who is new to Avalanche. You use only what the page tells you. When the page does not say what',
  'to enter or what to do next, that gap is a finding: do not fill it from your own knowledge.',
  'The wallet is watch-only. It rejects every signature and every transaction. Do not try to get past a rejection.',
  'Click a button that asks the wallet to sign at most once in a run, only to read the error that the page shows.',
  'Then stop that flow. The rejection itself is not a defect. Report how the page explains it.',
  'Do not sign in with GitHub, Google or email. Do not disconnect the wallet or connect another wallet.',
  'Never type a private key, a seed phrase or a password into a field. When the privacy banner shows, click Decline.',
  'Report each defect with the page, the exact text and the steps: wrong or unclear instructions, steps that disagree',
  'with each other, broken or stuck states, errors with no clear next action, controls with no accessible name, and',
  'keyboard or focus problems.',
].join(' ');

const context = [
  'The Builder Console (/console) of build.avax.network has tools to create and run Avalanche L1s.',
  'The docs say "L1". The P-Chain transactions keep the older name "Subnet" (Create Subnet, Subnet ID).',
  'This run uses the Fuji testnet.',
  account
    ? 'The wallet is a watch-only Core wallet on the Fuji C-Chain (chain ID 43113). It is connected when the page ' +
      `loads. Its C-Chain address is ${account.address} and its P-Chain address is ${account.pChainAddress}. ` +
      'It shows balances and reads the chain. It rejects every signature and every transaction with "User rejected ' +
      'the request." (code 4001), so the run sends no transaction.'
    : 'The browser has no wallet extension, so the run cannot connect a wallet.',
].join(' ');

export default {
  // This folder has no test files: the config is for `e2e explore` only.
  targets: [
    {
      name: 'desktop',
      engine: web({ viewport: { width: 1440, height: 900 }, headers, initScripts }),
      app,
    },
  ],
  timeout: 180_000,
  assertionTimeout: 30_000,
  // Explore turns the replay cache off by itself. This makes sure that nothing writes a cache entry in this folder.
  cache: 'off',
  reporters: ['list', 'markdown'],
  ...(model && { agents: { default: { model, system, context } } }),
} satisfies E2EConfig;
