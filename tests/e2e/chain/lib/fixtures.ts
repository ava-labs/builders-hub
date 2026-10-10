import { describe, test as base } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { installWalletRoute } from '../wallet/bridge.ts';
import { createSignerFromEnv, type Signer } from '../wallet/signer.ts';

// The `test` of the chain tests: the web engine's test plus the e2e Core wallet. Import `test` and `describe` from
// this module, not from @e2e-dev/web.
//
// The wallet has two halves:
// - The page half is the provider in chain/wallet/provider.ts. chain/e2e.config.ts gives it to the engine as an init
//   script, so each document of the app has window.avalanche before its own scripts run.
// - The Node half is the signer. The `wallet` fixture installs the route that answers the provider's requests from
//   the signer (chain/wallet/bridge.ts). It does this before the test body runs, so before the first navigation.
//
// The signer reads the key with chain/lib/chain.ts readFujiKey: the file that E2E_CHAIN_FUJI_KEY_FILE names (mode
// 0600), or E2E_CHAIN_FUJI_KEY. Without a key each test fails in its setup. For a local run:
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key
//
// As Core does, the wallet gives the site no account until the site is connected (bridge.ts, "site grant"). So the
// first test of a serial group runs connectCore on a Console page. The grant then lasts for the group: after a
// reload, wagmi connects again by itself.

export interface CoreWallet {
  // The Node signer: the C-Chain and P-Chain addresses, the wallet's chain, and each tx it sent (`sends`).
  readonly signer: Signer;
}

// One signer for each import of this module. The runner imports a test file again for each serial group and each
// retry, so the members of one serial group share the signer: its chain, the chains the page added, and its nonces.
let shared: Signer | undefined;

export const test = base.extend<{ wallet: CoreWallet }>({
  wallet: async ({ app, browser }, use) => {
    if (!app.baseUrl) throw new Error('the chain tests need app.url in chain/e2e.config.ts');
    shared ??= createSignerFromEnv();
    // Routes belong to the attempt, and the engine removes them when it ends. In a serial group each member adds
    // its own route, and the newest route answers.
    await installWalletRoute(browser, shared, app.baseUrl);
    await use({ signer: shared });
  },
});

export { describe };

// The Console's connect flow on any Console page: 'Connect Wallet' in the header opens the RainbowKit dialog, which
// offers the e2e wallet as 'Core' (EIP-6963). The flow is done when the header shows the P-Chain balance: the
// Console shows it only for a Core wallet, after it read the P-Chain address.
export async function connectCore(screen: Screen): Promise<void> {
  await screen.getByRole('button', 'Connect Wallet').click();
  await screen.getByRole('dialog', 'Connect a Wallet').getByRole('button', /Core/).click();
  await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
}
