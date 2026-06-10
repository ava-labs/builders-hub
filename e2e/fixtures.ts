/**
 * Shared Playwright fixtures for the QA harness.
 *
 * Every test gets a browser context with the Core-impersonating wallet shim
 * (wallet-shim/core-shim.ts) pre-injected. The shim is bundled once per
 * worker with esbuild and installed via addInitScript so it runs before any
 * page script — wagmi's EIP-6963 discovery then picks it up as Core.
 *
 * Environment:
 *   QA_TARGET_URL                     base URL (default http://localhost:3000)
 *   QA_WALLET_KEY                     0x-prefixed private key; one key drives both
 *                                     the EVM and XP accounts. Falls back to an
 *                                     ephemeral random key (fine for render
 *                                     smoke; tx flows need a funded Fuji key).
 *   VERCEL_AUTOMATION_BYPASS_SECRET   unlocks protected preview deployments
 *                                     (configured in playwright.config.ts).
 */

import { test as base } from '@playwright/test';
import { buildSync } from 'esbuild';
import * as path from 'node:path';
import { generatePrivateKey } from 'viem/accounts';

type Hex = `0x${string}`;

let shimBundle: string | null = null;

/** Bundle the wallet shim (cached per worker process). */
export function getShimBundle(): string {
  if (!shimBundle) {
    const result = buildSync({
      entryPoints: [path.join(__dirname, 'wallet-shim', 'core-shim.ts')],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: 'es2022',
      write: false,
      define: {
        'process.env.NODE_ENV': '"production"',
        global: 'globalThis',
      },
      // Some transitive deps touch bare `process` at runtime; give the
      // browser bundle a minimal stub so the init script doesn't throw.
      banner: { js: 'var process = globalThis.process ?? { env: {} };' },
    });
    shimBundle = result.outputFiles[0].text;
  }
  return shimBundle;
}

export interface QAFixtures {
  /** Private key backing the injected wallet. */
  walletKey: Hex;
}

export const test = base.extend<QAFixtures>({
  walletKey: [
    async ({}, use) => {
      await use((process.env.QA_WALLET_KEY as Hex) ?? generatePrivateKey());
    },
    { option: true },
  ],

  context: async ({ context, walletKey }, use) => {
    await context.addInitScript(
      `window.__QA_WALLET_CONFIG__ = ${JSON.stringify({ privateKey: walletKey })};`,
    );
    // Seed wagmi's storage so it auto-reconnects to the shim's EIP-6963
    // connector (rdns app.core) on mount — no Connect-button UI dance.
    // isAuthorized() for a 6963-targeted connector just calls eth_accounts,
    // which the shim always answers.
    await context.addInitScript(`
      try {
        localStorage.setItem('wagmi.recentConnectorId', '"app.core"');
        localStorage.setItem('wagmi.injected.connected', 'true');
      } catch {}
    `);
    await context.addInitScript(getShimBundle());
    await use(context);
  },
});

export { expect } from '@playwright/test';
