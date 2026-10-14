// Page helpers of the PoS-ERC20 chain test (chain/pos-erc20-cchain.e2e.ts): the staking flows of the Console on an
// L1 whose Validator Manager runs on the Fuji C-Chain and is owned by an ERC20TokenStakingManager. The Warp steps
// that PoA shares are in lib/validator-steps.ts.

import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { pTxStatus } from './chain.ts';
import { note, readStore } from './console.ts';

/**
 * Waits for the badge 'PoS · ERC20' in a step header of the add-validator and remove-validator flows
 * (console/add-validator/ManagerTypeBadge.tsx). It shows once the page has the manager details from Glacier and has
 * found the ERC20 staking manager that owns the manager. The Warp buttons of a step stay disabled until the details
 * and the signing subnet have loaded (lib/validator-steps.ts waits for them). CSS shows the badge in upper case; the
 * text is mixed case.
 */
export async function waitForPosErc20Badge(screen: Screen): Promise<void> {
  await expect(screen.getByText(/^PoS · ERC20$/i)).toBeVisible({ timeout: 90_000 });
}

/**
 * The header of the staking part of 'Validator Manager Details' (components/ValidatorManagerDetails.tsx): it shows
 * once the page has read the staking manager's settings and its erc20(). The page text has an em dash, written here as
 * an escape.
 */
export function stakingDetailsHeader(screen: Screen): Locator {
  return screen.getByText(/^Staking \u2014 ERC20 Token$/);
}

/** Waits until a persisted flow store (localStorage) holds the value. A step's success signal when the page shows none. */
export async function waitForStoreValue(
  browser: Browser,
  key: string,
  field: string,
  value: string,
  timeoutMs = 120_000,
): Promise<void> {
  await expect.poll(async () => (await readStore(browser, key))[field], { timeout: timeoutMs }).toBe(value);
}

/**
 * Checks /console/history: each P-Chain tx of the run has a row with the status that the P-Chain gives it, 'Confirmed'
 * for a committed tx. The page shortens each ID to its first 8 and last 6 characters (app/console/history/page.tsx).
 * The caller opens the page and waits for the wallet first: the tx history store is per network.
 */
export async function expectHistoryRows(browser: Browser, screen: Screen, txIds: readonly string[]): Promise<void> {
  await expect(screen.getByRole('heading', 'Transaction History')).toBeVisible({ timeout: 60_000 });
  for (const txId of txIds) {
    note(`history: looking for ${txId}`);
    const { status } = await pTxStatus(txId);
    const label = status === 'Committed' ? 'Confirmed' : status === 'Dropped' ? 'Failed' : 'Pending';
    const short = `${txId.slice(0, 8)}...${txId.slice(-6)}`;
    // By XPath: a history row is a plain div with no role, and the list has no list semantics
    // (app/console/history/page.tsx). The row is the nearest rounded, bordered div around the shortened ID.
    const row = browser.locator(
      `xpath=//code[normalize-space(.)="${short}"]/ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rounded-lg ")][1]`,
    );
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(row.getByText(label, { exact: true })).toBeVisible({ timeout: 90_000 });
    note(`history: ${txId} ${label}`);
  }
}
