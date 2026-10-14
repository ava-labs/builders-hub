import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { auditSends, revokeOnFailure } from './lib/audit.ts';
import { NANO_AVAX, assertFuji, chainShows, formatNanoAvax, pBalance, pStaked, waitForPTx } from './lib/chain.ts';
import { note, openAsReturningVisitor, readStore, toolHeading, waitForPage, waitForSend } from './lib/console.ts';
import { connectCore, describe, test } from './lib/fixtures.ts';
import {
  archiveLedger,
  finishSend,
  readLedger,
  runIdFromEnv,
  sendOnce,
  updateLedger,
  upsertValidator,
} from './lib/ledger.ts';
import { createMockValidator, nodeCredentialsJson, type MockValidator } from './lib/mock-validator.ts';
import {
  ACCEPTED_TX_NOTE,
  STAKE_FIXED_LEDGER as LEDGER,
  assertStakeRoom,
  chainShowsUnlocked,
  isoFromUnix,
  pPrimaryValidator,
  setPrimaryStake,
  type PrimaryValidator,
} from './lib/primary-stake.ts';

// Weekly (Wednesday): the Console's Stake on Primary Network tool adds a fixed-duration Primary Network validator on
// Fuji (AddPermissionlessValidatorTx). The validator is a mock (lib/mock-validator.ts): no node runs behind it.
//
// It locks 1 AVAX of the test key until the end time, now + 12 h 15 min. The P-Chain allows no early exit, so neither
// the run nor teardown.ts can tear the stake down. At the end time the P-Chain returns the 1 AVAX with no reward,
// because the mock node has an uptime of 0. The ledger (chain/.run/stake-fixed.json, `primaryStake`) records the NodeID,
// the tx and the unlock time; teardown.ts and preflight.ts print it.
//
// The wallet signs a stake only for the mock NodeID that member 1 registers (signer.allowPrimaryStake), of at most
// 1 AVAX, with an end time at most 13 h from now, and with this wallet as every owner. The last member audits each
// send and turns the capability off.
//
// The file runs only when E2E_CHAIN_WEEKLY=stake-fixed. Without it, every member skips: a bare local run never locks
// 1 AVAX. Run it alone, with its tag: the audit counts every send of the process.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   E2E_CHAIN_WEEKLY=stake-fixed npm run test:chain -- --tag stake-fixed

const WEEKLY = 'stake-fixed';
const runId = runIdFromEnv();

const STAKE_PAGE = '/console/primary-network/stake';
const HISTORY_PAGE = '/console/history';
const STAKE_STEP = 'stake-fixed';

const STAKE_AVAX = '1';
const STAKE_NAVAX = NANO_AVAX;
const DELEGATION_FEE = '2';
// The stake and the fee. Below this, the run would fail at the send.
const MIN_UNLOCKED_NAVAX = (105n * NANO_AVAX) / 100n;
// The end time: now + 12 h 15 min. The P-Chain needs 12 h or more on Fuji (Stake.tsx, ACP-273). The signer refuses
// more than 13 h (STAKE_PERIOD_MAX), so the page's default of 1 day + 5 min is refused.
const END_OFFSET_S = 12 * 3600 + 15 * 60;
const MIN_DURATION_S = 12 * 3600;
const SIGNER_MAX_S = 13 * 3600;
// The Console's P-Chain tx history (stores/txHistoryStore.ts, createFlowStore key '<STORE_VERSION>-<name>-testnet').
const TX_HISTORY_STORE = 'v4-tx-history-store-testnet';

// The state of this run. The runner imports this file once for the serial group, so its members share it.
const run: {
  mock?: MockValidator;
  unlockedBefore?: bigint;
  /** nAVAX that the key staked before this run (platform.getStake): an earlier stake that stays locked. */
  stakedBefore?: bigint;
  txId?: string;
  validator?: PrimaryValidator;
} = {};

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`An earlier member did not record ${what}.`);
  return value;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The end time as the page reads it: Stake.tsx turns the local time into 'YYYY-MM-DDTHH:mm' for the datetime-local
// field, and reads it back with new Date(value). Both run in the page, so the page's time zone applies.
async function endTimeInPage(browser: Browser, offsetS: number): Promise<{ value: string; endUnix: number }> {
  return browser.evaluate((offset: number) => {
    const d = new Date(Date.now() + offset * 1000);
    const value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return { value, endUnix: Math.floor(new Date(value).getTime() / 1000) };
  }, offsetS);
}

// The page's own record of a P-Chain tx in its tx history store: 'pending', 'confirmed' or 'failed'.
async function pageTxRecord(
  browser: Browser,
  txId: string,
): Promise<{ status?: string; operation?: string; type?: string; network?: string } | undefined> {
  const { transactions } = (await readStore(browser, TX_HISTORY_STORE)) as {
    transactions?: { txHash?: string; status?: string; operation?: string; type?: string; network?: string }[];
  };
  return transactions?.find((tx) => tx.txHash === txId);
}

// A `failed` check for waitForSend on a toolbox Button: true when the button went busy and came back idle with no
// send, or never went busy in 20 s (the page's form check refused, before any wallet request). While busy, the button
// shows 'Processing...' in place of its label, so the locator by the idle name stops matching.
function gaveUp(button: Locator): () => Promise<boolean> {
  const start = Date.now();
  let sawBusy = false;
  return async () => {
    const idle = await button.isVisible();
    if (!idle) sawBusy = true;
    return (sawBusy && idle) || (!sawBusy && Date.now() - start > 20_000);
  };
}

// Step 1 and step 2 of the stake page: 'Stake a Validator', then the mock's info.getNodeID response on the 'API
// Response' tab. The page then looks the NodeID up on the P-Chain.
async function enterCredentials(screen: Screen, mock: MockValidator): Promise<void> {
  await screen.getByRole('button', /^Stake a Validator/).click();
  await screen.getByRole('tab', 'API Response').click();
  await screen.getByRole('textbox', /^Paste the JSON response/).fill(nodeCredentialsJson(mock));
  await screen.getByRole('button', 'Add Validator').click();
  await expect(screen.getByRole('group', 'Added validator').getByText(mock.nodeID, { exact: true })).toBeVisible();
}

describe(
  'weekly: fixed-duration Primary Network validator',
  {
    serial: true,
    retries: 0,
    tags: ['chain', 'stake-fixed', 'weekly'],
    skip:
      process.env.E2E_CHAIN_WEEKLY === WEEKLY
        ? false
        : `weekly: it locks 1 Fuji AVAX for 12 h 15 min. Set E2E_CHAIN_WEEKLY=${WEEKLY} to run it.`,
  },
  () => {
    test(
      'checks the key, makes a mock validator and opens the stake page',
      { timeout: 4 * 60_000 },
      revokeOnFailure(async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        await assertFuji();
        // An earlier stake can stay locked only when it cannot change the balances that this run checks.
        run.stakedBefore = await assertStakeRoom(signer.pChainAddress);
        const unlocked = await pBalance(signer.pChainAddress);
        if (unlocked < MIN_UNLOCKED_NAVAX) {
          throw new Error(
            `The P-Chain balance of ${signer.pChainAddress} is ${formatNanoAvax(unlocked)} AVAX unlocked. The stake ` +
              `needs ${formatNanoAvax(MIN_UNLOCKED_NAVAX)} (1 AVAX and the fee). Fund the key: move AVAX from the ` +
              `C-Chain with the Console's C/P bridge.`,
          );
        }
        run.unlockedBefore = unlocked;

        const mock = createMockValidator({ label: 'stake-fixed' });
        run.mock = mock;
        signer.allowPrimaryStake(mock.nodeID);

        // The last run's ledger moves to .run/archive/ (stake-fixed-<runId>.json), where assertStakeRoom,
        // teardown.ts and preflight.ts still read it.
        archiveLedger(LEDGER);
        updateLedger((ledger) => {
          ledger.runId = runId;
          ledger.baseUrl = app.baseUrl;
        }, LEDGER);
        setPrimaryStake(LEDGER, {
          kind: 'fixed',
          nodeId: mock.nodeID,
          stake: STAKE_NAVAX.toString(),
          state: 'planned',
        });
        note(
          `run ${runId}, P ${signer.pChainAddress} (${formatNanoAvax(unlocked)} AVAX unlocked), mock ${mock.nodeID}`,
        );

        await openAsReturningVisitor(app, browser, STAKE_PAGE);
        await connectCore(screen);
        await expect(toolHeading(screen, 'Stake on Primary Network')).toBeVisible();
      }),
    );

    test(
      'stakes 1 AVAX on the mock validator until now + 12 h 15 min',
      { timeout: 10 * 60_000 },
      revokeOnFailure(async ({ browser, screen, wallet }) => {
        const { signer } = wallet;
        const mock = need(run.mock, 'the mock validator');
        const unlockedBefore = need(run.unlockedBefore, 'the unlocked P-Chain balance');
        const stakedBefore = need(run.stakedBefore, 'the stake before the run');

        await enterCredentials(screen, mock);
        // A fresh mock does not validate, so the lookup keeps the stake form.
        await expect(screen.getByText(/^Checking current validator status/)).toBeHidden({ timeout: 60_000 });
        await expect(screen.getByRole('heading', 'Stake Configuration')).toBeVisible();

        await screen.getByRole('button', /^Fixed Duration/).click();
        const amount = screen.getByRole('spinbutton', 'Stake Amount');
        await amount.fill(STAKE_AVAX);
        await expect(amount).toHaveValue(STAKE_AVAX);
        const fee = screen.getByRole('spinbutton', 'Delegation Fee');
        await fee.fill(DELEGATION_FEE);
        await expect(fee).toHaveValue(DELEGATION_FEE);

        // A datetime-local input has no ARIA role, so the field is found by its visible label 'End time'.
        const end = screen.getByLabel('End time');
        const { value, endUnix } = await endTimeInPage(browser, END_OFFSET_S);
        await end.fill(value);
        await expect(end).toHaveValue(value);
        // The page's time zone can move the value. Check it in Node before the send: the P-Chain needs 12 h, and the
        // signer refuses more than 13 h.
        const fromNow = endUnix - Math.floor(Date.now() / 1000);
        if (fromNow < MIN_DURATION_S + 600 || fromNow > SIGNER_MAX_S - 600) {
          throw new Error(`The end time ${value} is ${fromNow} s from now, not about ${END_OFFSET_S} s.`);
        }

        const submit = screen.getByRole('button', 'Stake Fuji Validator');
        await expect(submit).toBeEnabled({ timeout: 60_000 });
        // The NodeID goes into the ledger before the send. The validation ID stays empty, so teardown.ts's L1 pass
        // skips it; its stake pass reads `primaryStake`.
        upsertValidator(
          'stake',
          { nodeId: mock.nodeID, weight: STAKE_NAVAX.toString(), blsPublicKey: mock.publicKey, state: 'planned' },
          LEDGER,
        );
        const from = signer.sends.length;
        const spentBefore = signer.totals().pSpent;
        const { send } = await sendOnce({
          path: LEDGER,
          step: STAKE_STEP,
          chain: 'P',
          inputs: {
            mode: 'fixed',
            nodeId: mock.nodeID,
            blsPublicKey: mock.publicKey,
            stake: STAKE_NAVAX.toString(),
            delegationFeePercent: DELEGATION_FEE,
            endTime: String(endUnix),
            endTimeTyped: value,
          },
          landed: async () => (await pPrimaryValidator(mock.nodeID)) !== null,
          send: async () => {
            await submit.click();
            const tx = await waitForSend(browser, signer, from, 'pvm.AddPermissionlessValidator', {
              failed: gaveUp(submit),
            });
            note(`AddPermissionlessValidatorTx ${tx.hash}`);
            return {
              txIds: [tx.hash],
              outputs: { txId: tx.hash, nodeId: mock.nodeID, endTime: String(endUnix), unlockAt: isoFromUnix(endUnix) },
            };
          },
          confirm: async (sent) => {
            await waitForPTx(sent.txIds[0]);
            await chainShows(`the P-Chain lists ${mock.nodeID}`, () => pPrimaryValidator(mock.nodeID));
            return true;
          },
        });
        const txId = send.txIds[0];
        run.txId = txId;
        await waitForPage(browser, 'Stake success', screen.getByRole('button', 'Stake Another Validator'));

        // The validator as the P-Chain lists it: this tx, 1 AVAX, the typed end, and this wallet as each owner.
        const v = await chainShows(`the P-Chain lists ${mock.nodeID}`, () => pPrimaryValidator(mock.nodeID));
        run.validator = v;
        // The unlock time goes into the ledger first, so a failed check below still leaves it there.
        const unlockAt = isoFromUnix(v.endTime);
        finishSend(
          STAKE_STEP,
          { status: 'landed', outputs: { startTime: v.startTime, endTime: v.endTime, unlockAt } },
          LEDGER,
        );
        upsertValidator('stake', { state: 'staked' }, LEDGER);
        setPrimaryStake(LEDGER, { state: 'staked', txId, startTime: v.startTime, endTime: v.endTime, unlockAt });
        note(`staked 1 AVAX on ${mock.nodeID}; the P-Chain returns it at ${unlockAt}`);
        // The success screen says that the validator list can lag the accepted tx.
        await expect(screen.getByText(ACCEPTED_TX_NOTE, { exact: true })).toBeVisible();
        const owner = { locktime: '0', threshold: '1', addresses: [signer.pChainAddress] };
        expect(v.txID).toBe(txId);
        expect(v.weight).toBe(STAKE_NAVAX.toString());
        expect(v.nextPeriod).toBeUndefined();
        expect(v.validationRewardOwner).toEqual(owner);
        expect(v.delegationRewardOwner).toEqual(owner);
        expect(Number(v.delegationFee)).toBe(Number(DELEGATION_FEE));
        expect(v.signer?.publicKey).toBe(mock.publicKey);
        expect(Math.abs(Number(v.endTime) - endUnix)).toBeLessThanOrEqual(120);
        const duration = Number(v.endTime) - Number(v.startTime);
        expect(duration).toBeGreaterThanOrEqual(MIN_DURATION_S);
        expect(duration).toBeLessThanOrEqual(SIGNER_MAX_S);

        // The key: 1 AVAX more staked, and the unlocked balance down by 1 AVAX and the fee that the wallet signed. A
        // node can lag the tx.
        const stakedAfter = stakedBefore + STAKE_NAVAX;
        await chainShows(`platform.getStake shows ${formatNanoAvax(stakedAfter)} AVAX, 1 AVAX more`, async () => {
          return (await pStaked(signer.pChainAddress)) === stakedAfter;
        });
        const paidFee = signer.totals().pSpent - spentBefore;
        await chainShowsUnlocked(
          `the unlocked P-Chain balance drops by 1 AVAX and the fee (${formatNanoAvax(paidFee)} AVAX)`,
          signer.pChainAddress,
          unlockedBefore - STAKE_NAVAX - paidFee,
        );

        // The page confirms the tx itself (hooks/usePChainNotifications.ts) and records it in its tx history. Wait
        // for that, so a later reload does not cut the page's wait short.
        await expect
          .poll(async () => (await pageTxRecord(browser, txId))?.status, { timeout: 120_000, interval: 2_000 })
          .toBe('confirmed');

        finishSend(STAKE_STEP, { status: 'landed', outputs: { fee: paidFee.toString() } }, LEDGER);
        note(`the stake tx paid a fee of ${formatNanoAvax(paidFee)} AVAX`);
      }),
    );

    test(
      'shows the staked validator as read-only',
      { timeout: 2 * 60_000 },
      revokeOnFailure(async ({ browser, screen, wallet }) => {
        const { signer } = wallet;
        const mock = need(run.mock, 'the mock validator');
        const v = need(run.validator, 'the P-Chain validator');
        const sends = signer.sends.length;
        const refusals = signer.refusals.length;

        // The public API caches the page's lookup of member 2 (no validator yet) for about 3 min. The page keeps what
        // its accepted tx set (Stake.tsx), so the same NodeID on the same page shows the stake at once, with a note
        // while the API read is old. A reload loses that state, so the test does not reload.
        await screen.getByRole('button', 'Stake Another Validator').click();
        await expect(toolHeading(screen, 'Stake on Primary Network')).toBeVisible();
        await enterCredentials(screen, mock);
        await expect(screen.getByRole('heading', 'Existing Validator')).toBeVisible({ timeout: 30_000 });
        const fromTx = await screen.getByText(ACCEPTED_TX_NOTE, { exact: true }).isVisible();
        note(
          `the page shows ${mock.nodeID} from ${fromTx ? 'its accepted tx (the API read is still old)' : 'the API'}`,
        );

        // The page's text for the stake and the end, in the page's locale and time zone.
        const shown = await browser.evaluate(
          ({ weight, end }: { weight: string; end: number }) => ({
            stake: `${(Number(weight) / 1e9).toLocaleString()} AVAX`,
            until: new Date(end * 1000).toLocaleString(),
          }),
          { weight: v.weight, end: Number(v.endTime) },
        );
        await expect(screen.getByText(/Fixed-duration stake can.t be modified/)).toBeVisible();
        await expect(screen.getByText(shown.stake, { exact: true })).toBeVisible();
        await expect(screen.getByText(shown.until, { exact: true })).toBeVisible();
        // Read-only: no submit step, and the page asked the wallet for nothing.
        await expect(screen.getByRole('button', 'Stake Fuji Validator')).toBeHidden();
        expect(signer.sends.length).toBe(sends);
        expect(signer.refusals.length).toBe(refusals);
      }),
    );

    test(
      'lists the stake in the history and audits the wallet',
      { timeout: 5 * 60_000 },
      revokeOnFailure(async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        const txId = need(run.txId, 'the stake tx');
        const v = need(run.validator, 'the P-Chain validator');

        // The history first, then the audit, which runs even when the history check fails: it writes the job summary
        // and turns the stake capability off (auditSends calls signer.revokeAll()).
        let historyError: unknown;
        try {
          await app.open(HISTORY_PAGE);
          await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
          await expect(screen.getByRole('heading', 'History', { level: 1 })).toBeVisible();
          await expect(screen.getByRole('heading', 'Transaction History')).toBeVisible();
          // The page shows a tx ID as its first 8 and last 6 characters (app/console/history/page.tsx).
          const short = `${txId.slice(0, 8)}...${txId.slice(-6)}`;
          await expect(screen.getByText(short, { exact: true })).toBeVisible();
          // By CSS: a tx row is a plain div with no role (app/console/history/page.tsx). The row is the innermost div
          // that holds both the short ID and a status. Ancestors come first in document order, so it is the last.
          const row = browser
            .locator('div')
            .filter({ hasText: new RegExp(escapeRegExp(short)) })
            .filter({ hasText: /Confirmed|Pending|Failed/ })
            .last();
          await expect(row).toContainText('Validator Added');
          await expect(row).toContainText('Confirmed');
          await expect(row).toContainText('P-Chain');
          await expect(row).toContainText('Fuji');
          expect(await pageTxRecord(browser, txId)).toMatchObject({
            status: 'confirmed',
            operation: 'Validator Added',
            type: 'pchain',
            network: 'fuji',
          });
        } catch (error) {
          historyError = error;
        }

        const audit = auditSends(signer, {
          ledgerPath: LEDGER,
          expect: { 'pvm.AddPermissionlessValidator': 1 },
        });
        expect(signer.totals().pStaked, 'the AVAX the wallet staked').toBe(STAKE_NAVAX);
        expect(audit.refusals).toBe(0);
        expect(audit.totals.find((t) => t.name === 'pStaked')?.value).toBe('1 AVAX');

        // The ledger holds the unlock time: no teardown can end a fixed stake early.
        const ledger = readLedger(LEDGER);
        const step = ledger.sends.find((s) => s.step === STAKE_STEP);
        expect(step?.status).toBe('landed');
        expect(step?.txIds).toEqual([txId]);
        expect(step?.outputs?.unlockAt).toBe(isoFromUnix(v.endTime));
        expect(ledger.primaryStake, 'the ledger stake record').toMatchObject({
          kind: 'fixed',
          nodeId: need(run.mock, 'the mock validator').nodeID,
          txId,
          unlockAt: isoFromUnix(v.endTime),
          state: 'staked',
        });
        note(`nothing to tear down: the P-Chain returns the 1 AVAX at ${isoFromUnix(v.endTime)}`);

        if (historyError) throw historyError;
      }),
    );
  },
);
