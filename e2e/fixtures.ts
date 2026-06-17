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
      // The shim runs as a standalone IIFE before any app polyfills, and
      // unlike the real Core extension it performs XP signing IN-PAGE
      // (avalanche-sdk → sendXPTransaction), which needs Buffer. Without a
      // Buffer global every P-Chain tx flow (convert-subnet-to-l1, stake,
      // cross-chain transfer) threw "Buffer is not defined" from inside the
      // shim — a harness-only failure mistakable for a product bug. inject
      // bundles the polyfill into the IIFE so it's set before shim code runs.
      inject: [path.join(__dirname, 'wallet-shim', 'buffer-polyfill.ts')],
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
    // Vercel preview deployments sit behind SSO protection; the bypass secret
    // unlocks them. CRITICAL: scope the bypass header to the deployment origin.
    // A global header (config.use.extraHTTPHeaders) is sent on EVERY request
    // the browser makes — including the shim's cross-origin fetch to the public
    // RPC. That turns the RPC call into a preflighted CORS request, which
    // api.avax-test.network rejects (allow-headers is Content-Type only) →
    // "Failed to fetch". So inject it per-request, only for the target origin.
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypass) {
      const targetOrigin = new URL(process.env.QA_TARGET_URL ?? 'http://localhost:3000').origin;
      await context.route('**/*', async (route) => {
        const req = route.request();
        let sameOrigin = false;
        try {
          sameOrigin = new URL(req.url()).origin === targetOrigin;
        } catch {
          /* non-http request (data:/blob:) — leave untouched */
        }
        if (sameOrigin) {
          await route.continue({
            headers: {
              ...req.headers(),
              'x-vercel-protection-bypass': bypass,
              'x-vercel-set-bypass-cookie': 'true',
            },
          });
        } else {
          await route.continue();
        }
      });
    }

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
