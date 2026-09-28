/**
 * Regression smoke for the Initialize Validator Set step (Validator Manager
 * setup). A wallet on the C-Chain names only the Primary Network, which
 * Glacier reports with no conversion; the step used to crash on it with
 * "Cannot read properties of undefined (reading 'trim')".
 *
 * The shim's wallet starts on the Fuji C-Chain, as for a Validator Manager
 * hosted there. Each case seeds the create-chain flow's persisted state and
 * checks which conversion the step resolves. Glacier's answers for the test
 * subnets are fixed below (copied from the live API, where an unconverted
 * subnet has no l1ConversionTransactionHash), so the cases do not depend on
 * live subnet state. Sends no transaction, so an ephemeral key is enough.
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

const STEP = '/console/permissioned-l1s/validator-manager-setup/init-validator-set';
const FLOW_KEY = 'v4-create-chain-store-testnet';
const CRASH = 'This step encountered an error';

const CONVERTED = {
  subnetId: '23Euo1vei8d8Pwj7RyCrDZ6E6tJ3CwDCt3gugb28Xac4qaEQUm',
  txId: '2WgSUmEAUgRzJWvEse7dDob3r4thR9xySPctGdkMCHVqBrskCx',
};
const LEGACY = '2QBurQNZuE1WpmqTZCvWThCvhVJZozjkEWkEfMTciMAvxBKbq4';
const ECHO = {
  subnetId: 'i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK',
  chainId: '0x2a6b6', // 173750, in the console's default Fuji list
  txId: '2va4ozH8x7JwJBtkHTb8CpCvn7wffhKp5NCALiEabw5D37p2xv',
};

const subnet = (subnetId: string, conversionTxId?: string) => ({
  createBlockTimestamp: 1700000000,
  createBlockIndex: '1',
  subnetId,
  ownerAddresses: [],
  threshold: 1,
  locktime: 0,
  subnetOwnershipInfo: { addresses: [], locktime: 0, threshold: 1 },
  isL1: Boolean(conversionTxId),
  ...(conversionTxId ? { l1ConversionTransactionHash: conversionTxId } : {}),
  blockchains: [],
});
const GLACIER: Record<string, object> = {
  [CONVERTED.subnetId]: subnet(CONVERTED.subnetId, CONVERTED.txId),
  [LEGACY]: subnet(LEGACY),
  [ECHO.subnetId]: subnet(ECHO.subnetId, ECHO.txId),
};

test.beforeEach(async ({ page }) => {
  await page.route('https://glacier-api.avax.network/v1/networks/*/subnets/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const body = GLACIER[id];
    return body ? route.fulfill({ json: body }) : route.continue();
  });
});

async function seedFlow(page: Page, state: Record<string, string>) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [FLOW_KEY, JSON.stringify({ state, version: 0 })] as const,
  );
}

/**
 * Open the step, let the wallet connect and the step's lookups settle, and
 * return what the error boundary caught. The boundary retries a crash out of
 * sight five times before it shows one, so its log is the reliable signal.
 */
async function openStep(page: Page): Promise<string[]> {
  const caught: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && m.text().startsWith('StepErrorBoundary caught')) caught.push(m.text());
  });
  await page.goto(STEP, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('button', { name: 'Aggregate Signatures' }).or(page.getByText(CRASH)),
  ).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3_000);
  return caught;
}

const txInput = (page: Page) => page.getByPlaceholder('txID...');

test.describe('Initialize Validator Set, wallet on the C-Chain', () => {
  test('renders with no flow state', async ({ page }) => {
    const caught = await openStep(page);
    expect(caught).toEqual([]);
    await expect(txInput(page)).toHaveValue('');
  });

  test("fills the flow subnet's conversion ID from Glacier", async ({ page }) => {
    await seedFlow(page, { subnetId: CONVERTED.subnetId });
    const caught = await openStep(page);
    expect(caught).toEqual([]);
    await expect(txInput(page)).toHaveValue(CONVERTED.txId);
  });

  test('says a subnet is not converted, instead of crashing', async ({ page }) => {
    await seedFlow(page, { subnetId: LEGACY });
    const caught = await openStep(page);
    expect(caught).toEqual([]);
    await expect(page.getByText('This subnet is not converted to an L1 yet')).toBeVisible();
  });

  test("falls back to the convert step's saved ID", async ({ page }) => {
    await seedFlow(page, { subnetId: LEGACY, convertToL1TxId: CONVERTED.txId });
    const caught = await openStep(page);
    expect(caught).toEqual([]);
    await expect(txInput(page)).toHaveValue(CONVERTED.txId);
  });
});

test('Initialize Validator Set, wallet on an L1, uses that L1', async ({ page }) => {
  const caught = await openStep(page);
  await page.evaluate(async (chainId) => {
    const w = window as any;
    await w.avalanche.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: 'Echo',
          rpcUrls: ['https://subnets.avax.network/echo/testnet/rpc'],
          nativeCurrency: { name: 'ECH', symbol: 'ECH', decimals: 18 },
        },
      ],
    });
    await w.avalanche.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  }, ECHO.chainId);
  await expect(txInput(page)).toHaveValue(ECHO.txId, { timeout: 30_000 });
  expect(caught).toEqual([]);
});
