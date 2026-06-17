/**
 * Self-test for the Core-impersonating wallet shim.
 *
 * Validates the provider contract directly in the page (no UI interaction),
 * so a shim regression is distinguishable from a console/UI regression in
 * the rest of the suite.
 */

import { test, expect } from '../fixtures';

// Any page works — the shim is injected into every context. Academy pages
// also pull in the console wallet stack, which exercises EIP-6963 discovery.
const PROBE_PATH = '/academy/avalanche-l1/interchain-messaging/05-testing-icm/01-deploy-icm-demo';

test.describe('wallet shim', () => {
  test('installs window.avalanche and window.ethereum', async ({ page }) => {
    await page.goto(PROBE_PATH, { waitUntil: 'domcontentloaded' });

    const probe = await page.evaluate(async () => {
      const w = window as any;
      return {
        sameObject: w.avalanche === w.ethereum,
        isAvalanche: w.avalanche?.isAvalanche === true,
        accounts: await w.avalanche.request({ method: 'eth_accounts' }),
        chainId: await w.avalanche.request({ method: 'eth_chainId' }),
      };
    });

    expect(probe.sameObject).toBe(true);
    expect(probe.isAvalanche).toBe(true);
    expect(probe.accounts).toHaveLength(1);
    expect(probe.accounts[0]).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(probe.chainId).toBe('0xa869'); // Fuji C-Chain
  });

  test('implements the Core-specific RPC schema', async ({ page }) => {
    await page.goto(PROBE_PATH, { waitUntil: 'domcontentloaded' });

    const probe = await page.evaluate(async () => {
      const w = window as any;
      const chain = await w.avalanche.request({ method: 'wallet_getEthereumChain' });
      const pubkeys = await w.avalanche.request({ method: 'avalanche_getAccountPubKey' });
      return { chain, pubkeys };
    });

    expect(probe.chain.isTestnet).toBe(true);
    expect(probe.chain.chainId).toBe('0xa869');
    expect(probe.pubkeys.evm).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(probe.pubkeys.xp).toMatch(/^0x(02|03)[0-9a-fA-F]{64}$/); // compressed secp256k1
  });

  test('proxies read methods to the chain RPC', async ({ page }) => {
    await page.goto(PROBE_PATH, { waitUntil: 'domcontentloaded' });

    const blockNumber = await page.evaluate(() =>
      (window as any).avalanche.request({ method: 'eth_blockNumber' }),
    );
    expect(parseInt(blockNumber, 16)).toBeGreaterThan(0);
  });

  test('handles chain add/switch with events', async ({ page }) => {
    await page.goto(PROBE_PATH, { waitUntil: 'domcontentloaded' });

    const probe = await page.evaluate(async () => {
      const w = window as any;
      const events: string[] = [];
      w.avalanche.on('chainChanged', (id: string) => events.push(id));

      await w.avalanche.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x539', // 1337 — fake L1 for the registry, no RPC calls made
            chainName: 'QA Fake L1',
            rpcUrls: ['http://127.0.0.1:9650/ext/bc/fake/rpc'],
            nativeCurrency: { name: 'Fake', symbol: 'FAKE', decimals: 18 },
          },
        ],
      });
      const afterAdd = await w.avalanche.request({ method: 'eth_chainId' });

      await w.avalanche.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa869' }],
      });
      const afterSwitch = await w.avalanche.request({ method: 'eth_chainId' });

      return { events, afterAdd, afterSwitch };
    });

    expect(probe.afterAdd).toBe('0x539');
    expect(probe.afterSwitch).toBe('0xa869');
    expect(probe.events).toEqual(['0x539', '0xa869']);
  });

  test('is discovered as Core by the console (EIP-6963)', async ({ page }) => {
    await page.goto(PROBE_PATH, { waitUntil: 'domcontentloaded' });

    const announced = await page.evaluate(
      () =>
        new Promise<{ rdns: string; name: string } | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 2000);
          window.addEventListener('eip6963:announceProvider', (e: any) => {
            clearTimeout(timer);
            resolve({ rdns: e.detail.info.rdns, name: e.detail.info.name });
          });
          window.dispatchEvent(new Event('eip6963:requestProvider'));
        }),
    );

    expect(announced).not.toBeNull();
    expect(announced!.rdns).toBe('app.core');
    expect(announced!.name).toBe('Core');
  });
});
