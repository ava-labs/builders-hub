import { test, expect } from './fixtures/console-fixtures';

/**
 * Console Navigation E2E Tests
 *
 * Verifies that all /console routes render without crash or 404.
 * Uses the mock wallet extension for Core Wallet detection.
 * All data reads hit real Fuji testnet infrastructure.
 */

// Every static /console route that should render a page
const STATIC_ROUTES = [
  '/console',
  '/console/history',
  '/console/my-l1',
  '/console/primary-network/faucet',
  '/console/primary-network/devnet-faucet',
  '/console/primary-network/node-setup',
  '/console/primary-network/stake',
  '/console/primary-network/c-p-bridge',
  '/console/primary-network/unit-converter',
  '/console/layer-1/validator-set',
  '/console/layer-1/l1-validator-balance',
  '/console/layer-1/l1-node-setup',
  '/console/layer-1/explorer-setup',
  '/console/layer-1/performance-monitor',
  '/console/l1-access-restrictions/deployer-allowlist',
  '/console/l1-access-restrictions/transactor-allowlist',
  '/console/l1-tokenomics/fee-manager',
  '/console/l1-tokenomics/native-minter',
  '/console/l1-tokenomics/reward-manager',
  '/console/permissioned-l1s/add-validator',
  '/console/permissioned-l1s/remove-validator',
  '/console/permissioned-l1s/change-validator-weight',
  '/console/permissioned-l1s/disable-validator',
  '/console/permissioned-l1s/remove-expired-validator-registration',
  '/console/permissionless-l1s/query-staking',
  '/console/testnet-infra/nodes',
  '/console/testnet-infra/icm-relayer',
  '/console/utilities/format-converter',
  '/console/utilities/transfer-proxy-admin',
  '/console/utilities/data-api-keys',
  '/console/utilities/revert-poa-manager',
] as const;

test.describe('Console Static Routes', () => {
  for (const route of STATIC_ROUTES) {
    test(`renders ${route}`, async ({ consolePage, consoleErrors }) => {
      const response = await consolePage.goto(route, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Route should not 404
      expect(response?.status()).not.toBe(404);

      // Console sidebar should render (proves layout loaded)
      await expect(
        consolePage.locator('[data-sidebar="sidebar"]').first(),
      ).toBeAttached({ timeout: 15_000 });

      // No uncaught JS errors
      expect(consoleErrors).toHaveLength(0);
    });
  }
});

// Routes that redirect to a specific sub-step
const REDIRECT_ROUTES: [string, string | RegExp][] = [
  ['/console/icm/setup', '/console/icm/setup/icm-messenger'],
  ['/console/icm/test-connection', '/console/icm/test-connection/deploy-icm-demo'],
  ['/console/ictt/setup', '/console/ictt/setup/deploy-test-erc20'],
  ['/console/ictt/token-transfer', '/console/ictt/token-transfer/add-collateral'],
  ['/console/layer-1/create', /\/console\/layer-1\/create\/create-subnet/],
  ['/console/permissioned-l1s/validator-manager-setup', '/console/permissioned-l1s/validator-manager-setup/deploy-validator-manager'],
  ['/console/permissioned-l1s/multisig-setup', '/console/permissioned-l1s/multisig-setup/deploy-poa-manager'],
  ['/console/permissionless-l1s/staking-manager-setup', '/console/permissionless-l1s/native-staking-manager-setup/deploy'],
  ['/console/permissionless-l1s/native-staking-manager-setup', '/console/permissionless-l1s/native-staking-manager-setup/deploy'],
  ['/console/permissionless-l1s/erc20-staking-manager-setup', '/console/permissionless-l1s/erc20-staking-manager-setup/deploy-erc20-token'],
  ['/console/permissionless-l1s/stake', '/console/permissionless-l1s/stake/native'],
  ['/console/permissionless-l1s/delegate', '/console/permissionless-l1s/delegate/native'],
  ['/console/permissionless-l1s/remove-validator', '/console/permissionless-l1s/remove-validator/native'],
  ['/console/permissionless-l1s/remove-delegation', '/console/permissionless-l1s/remove-delegation/native'],
  ['/console/utilities/vmcMigrateFromV1', '/console/utilities/vmcMigrateFromV1/deploy-validator-manager'],
];

test.describe('Console Redirect Routes', () => {
  for (const [source, target] of REDIRECT_ROUTES) {
    test(`${source} → redirects correctly`, async ({ consolePage }) => {
      await consolePage.goto(source, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Wait for client-side or server-side redirect to land
      if (typeof target === 'string') {
        await consolePage.waitForURL(`**${target}`, { timeout: 15_000 });
      } else {
        await consolePage.waitForURL(target, { timeout: 15_000 });
      }
    });
  }
});
