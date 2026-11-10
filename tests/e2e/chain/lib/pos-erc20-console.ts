// Page helpers of the PoS-ERC20 chain test (chain/pos-erc20-cchain.e2e.ts): the staking flows of the Console on an
// L1 whose Validator Manager runs on the Fuji C-Chain and is owned by an ERC20TokenStakingManager. The Warp steps
// that PoA shares are in lib/validator-steps.ts.

import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { pTxStatus } from './chain.ts';
import { note, readStore } from './console.ts';
import type { WalletSend } from '../wallet/signer.ts';

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

// The operation that /console/history shows for each P-Chain tx type of the run: the eventType of the Console's
// P-Chain notification (hooks/usePChainNotifications.ts), in title case. The test keeps its own copy, so a renamed
// operation fails the test.
const HISTORY_OPERATION: Readonly<Record<string, string>> = {
  'pvm.CreateSubnetTx': 'Subnet Created',
  'pvm.CreateChainTx': 'Chain Created',
  'pvm.ConvertSubnetToL1Tx': 'L1 Conversion',
  'pvm.RegisterL1ValidatorTx': 'Validator Registered',
  'pvm.SetL1ValidatorWeightTx': 'Validator Weight Set',
  'pvm.DisableL1ValidatorTx': 'Validator Disabled',
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The text of one P-Chain row of the history's transactions list (app/console/history/page.tsx). A row has no role:
 * its text runs together the status dot's sr-only label, each cell's label (shown below md) and value, and the
 * status: 'Time' (date-fns 'MMM d HH:mm'), 'Action' (the operation), 'Chain', 'Network', 'Hash' (the first 8 and the
 * last 6 characters of the ID) and 'Status'.
 */
function historyRowText(operation: string, txId: string, status: string): RegExp {
  const short = `${txId.slice(0, 8)}...${txId.slice(-6)}`;
  return new RegExp(
    `^${status}\\s*Time\\s*[A-Z][a-z]{2} \\d{1,2} \\d{2}:\\d{2}\\s*Action\\s*${escapeRegExp(operation)}\\s*` +
      `Chain\\s*P-Chain\\s*Network\\s*Fuji\\s*Hash\\s*${escapeRegExp(short)}\\s*Status\\s*${status}$`,
  );
}

/**
 * Checks /console/history: each P-Chain tx of the run has exactly one row, with the operation of its tx type and the
 * status that the P-Chain gives it, 'Confirmed' for a committed tx. The caller opens the page and waits for the
 * wallet first: the tx history store is per network.
 */
export async function expectHistoryRows(
  screen: Screen,
  sends: readonly Pick<WalletSend, 'hash' | 'txType'>[],
): Promise<void> {
  // The label of the transactions list (a SectionHeader: text, not a heading).
  await expect(screen.getByText('Transactions', { exact: true })).toBeVisible({ timeout: 60_000 });
  for (const { hash: txId, txType } of sends) {
    const operation = HISTORY_OPERATION[txType];
    if (!operation) throw new Error(`The history check has no operation for ${txType} (${txId}).`);
    note(`history: looking for ${txId} (${operation})`);
    const { status } = await pTxStatus(txId);
    const label = status === 'Committed' ? 'Confirmed' : status === 'Dropped' ? 'Failed' : 'Pending';
    const row = screen.getByText(historyRowText(operation, txId, label));
    await expect(row).toBeVisible({ timeout: 90_000 });
    await expect(row).toHaveCount(1);
    note(`history: ${txId} ${label}`);
  }
}
