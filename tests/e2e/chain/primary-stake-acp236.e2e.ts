import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { auditSends, revokeOnFailure } from './lib/audit.ts';
import { NANO_AVAX, assertFuji, chainShows, formatNanoAvax, pBalance, pStaked, waitForPTx } from './lib/chain.ts';
import {
  busyThenIdle,
  note,
  openAsReturningVisitor,
  pageAlert,
  readStore,
  toolHeading,
  toolText,
  waitForPage,
  waitForSend,
} from './lib/console.ts';
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
  STAKE_ACP236_LEDGER as LEDGER,
  VALIDATOR_NOT_LISTED_YET,
  activeStakes,
  assertStakeRoom,
  chainShowsUnlocked,
  isoFromUnix,
  pPrimaryValidator,
  resumableStake,
  setPrimaryStake,
  type PrimaryValidator,
  type ResumableStake,
} from './lib/primary-stake.ts';
import type { Signer } from './wallet/signer.ts';

// ACP-236 continuous staking on the Fuji Primary Network, with the Console's Stake tool
// (/console/primary-network/stake, components/toolbox/console/primary-network/Stake.tsx). The test adds an
// auto-renewed validator for a mock NodeID (AddAutoRenewedValidatorTx, 1 AVAX, 12 h cycle), changes its config for the
// next cycle (SetAutoRenewedValidatorConfigTx: 13 h, 50% auto-compound), and stops the renewal at once (the same tx
// with period 0). Then the Console's History page must list the 3 txs as confirmed, and the wallet's sends must be
// exactly these 3.
//
// Cost: the 1 AVAX stake stays locked until the end of the first cycle, 12 h after the add: the P-Chain lets no
// validator leave earlier, and the stop only cancels the next cycle. The mock node has no uptime, so the P-Chain gives
// the stake back with no reward. The 3 txs burn about 0.0003 AVAX. So the group runs only when E2E_CHAIN_WEEKLY names
// it (the weekly CI job sets it), and its first member checks that the key has 1.05 AVAX unlocked and that no earlier
// stake can change the balances that the run checks (lib/primary-stake.ts, assertStakeRoom).
//
// Teardown: member 4 stops the renewal in the run. If the run stops after the add and before the stop, the ledger
// (chain/.run/stake-acp236.json, `primaryStake`) holds the NodeID, the add tx ID and the unlock time, and teardown.ts
// (pass 2) sends the stop. Even with no stop, the validator ends at the first cycle end and the stake comes back: a
// cycle that fails the uptime check is not renewed (avalanchego vms/platformvm/docs/validators_auto_renewed.md, "Abort
// Path"; tests/e2e/p/auto_renewed_reward_eligibility.go).
//
// Resume: a run that stopped after the add and before any config tx leaves the stake locked for its 12 h cycle. The
// next run on the same machine (the same chain/.run) finishes it instead of failing at member 1: it adopts the add
// (signer.adoptAutoRenewedValidator checks the committed tx with the add rule), checks the validator, and sends the
// config txs. Its audit expects no add.
//
// The signer refuses each stake tx unless the test turns on its stake capability (allowPrimaryStake) for the one mock
// NodeID. Its rules: at most 1 AVAX per signer, a cycle of 12 to 13 h (the page's default of 336 h is refused), every
// owner is the key alone, and a config tx only for the validator that this signer added or adopted. The audit turns
// the capability off again.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   E2E_CHAIN_WEEKLY=stake-acp236 npm run test:chain -- --tag stake-acp236

const WEEKLY = 'stake-acp236';
const runId = runIdFromEnv();

// The state of this run. The runner imports this file once for the serial group, so its members share it.
const run: {
  mock?: MockValidator;
  addTxId?: string;
  startTime?: string;
  endTime?: string;
  // The unlocked P-Chain balance after the last tx, once a node showed it. The next balance check starts from it, so a
  // node that lags that tx cannot give a stale start.
  unlocked?: bigint;
  configTxIds: string[];
  // Set when member 1 resumed the stake of an earlier run (resumableStake): this run sends the config txs only.
  resumed?: ResumableStake;
} = { configTxIds: [] };

const PAGE = '/console/primary-network/stake';
const STAKE_AVAX = '1';
const STAKE_NAVAX = NANO_AVAX;
// The stake and the fees of the 3 txs, with margin.
const MIN_UNLOCKED_NAVAX = 1_050_000_000n;
// A resumed run sends the 2 config txs only: their fees, with margin.
const MIN_RESUME_UNLOCKED_NAVAX = 10_000_000n;
const ADD_STEP = 'stake-add';
// How long a resumed run waits for the page to show its validator: the API cache (about 3 min), with margin. The page
// shows its own accepted txs at once, so the other lookups need no wait.
const PAGE_CACHE_WAIT_MS = 5 * 60_000;
const DELEGATION_FEE = '2';
const CYCLE_HOURS = '12';
const CYCLE_SECONDS = 43_200;
const NEW_CYCLE_HOURS = '13';
const NEW_CYCLE_SECONDS = '46800';
const NEW_AUTO_COMPOUND = '50';
const NEW_AUTO_COMPOUND_SHARES = '500000';

// The P-Chain notifications write each tx to this store (hooks/usePChainNotifications.ts). The History page lists it.
const TX_HISTORY_STORE = 'v4-tx-history-store-testnet';
// The History page names each tx by its notification event type: 'auto_renewed_validator_added' and
// 'auto_renewed_validator_config_set', in title case.
const ADD_OPERATION = 'Auto Renewed Validator Added';
const CONFIG_OPERATION = 'Auto Renewed Validator Config Set';

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`An earlier member did not record ${what}.`);
  return value;
}

// The 'Current Config' line of the manage form: '12h cycle · 0% auto-compound' (Stake.tsx, a middle dot).
const currentConfig = (hours: string, autoCompound: string) => `${hours}h cycle · ${autoCompound}% auto-compound`;

// The validator that the add tx made, once a node of the public API shows the expected cycle and auto-compound.
async function validatorShows(nodeId: string, addTxId: string, nextPeriod: string, shares: string) {
  const v = await pPrimaryValidator(nodeId);
  return v?.txID === addTxId && v.nextPeriod === nextPeriod && v.autoCompoundRewardShares === shares ? v : null;
}

describe(
  'ACP-236: auto-renewed Primary Network validator',
  {
    serial: true,
    retries: 0,
    tags: ['chain', WEEKLY, 'weekly'],
    // A run locks 1 AVAX for 12 h, so a bare local run or the nightly job never starts it.
    skip:
      process.env.E2E_CHAIN_WEEKLY === WEEKLY
        ? false
        : `locks 1 AVAX for 12 h: runs only with E2E_CHAIN_WEEKLY=${WEEKLY} (the weekly CI job sets it)`,
  },
  () => {
    test(
      'checks the key and opens the Stake page',
      { timeout: 5 * 60_000 },
      revokeOnFailure(async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        await assertFuji();
        const unlocked = await pBalance(signer.pChainAddress);
        note(`run ${runId}, P ${signer.pChainAddress}: ${formatNanoAvax(unlocked)} AVAX unlocked`);

        // The last run stopped after its add: finish that stake (see "Resume" at the top of this file).
        const resume = await resumableStake(ADD_STEP, { nextPeriod: String(CYCLE_SECONDS), shares: '0' });
        if (resume) {
          // The only stake of the key is this one.
          const staked = await pStaked(signer.pChainAddress);
          const earlier = await activeStakes();
          expect(staked, 'platform.getStake: the key stakes only the resumed 1 AVAX').toBe(STAKE_NAVAX);
          expect(earlier.map((s) => s.nodeId)).toEqual([resume.nodeId]);
          if (unlocked < MIN_RESUME_UNLOCKED_NAVAX) {
            throw new Error(
              `The key has ${formatNanoAvax(unlocked)} AVAX unlocked on the P-Chain. The 2 config txs need ` +
                `${formatNanoAvax(MIN_RESUME_UNLOCKED_NAVAX)}.`,
            );
          }
          // The mock of the earlier run: the same seed gives the same NodeID.
          const mock = createMockValidator({ label: 'S0', seed: `${resume.runId} S0` });
          expect(mock.nodeID, 'the NodeID of the resumed run').toBe(resume.nodeId);
          run.mock = mock;
          run.resumed = resume;
          note(`resuming the stake of run ${resume.runId}: ${resume.nodeId}, add tx ${resume.txId}`);
          signer.allowPrimaryStake(mock.nodeID);
          await signer.adoptAutoRenewedValidator(resume.txId);
        } else {
          if (unlocked < MIN_UNLOCKED_NAVAX) {
            throw new Error(
              `The key has ${formatNanoAvax(unlocked)} AVAX unlocked on the P-Chain. The test needs ` +
                `${formatNanoAvax(MIN_UNLOCKED_NAVAX)}: a 1 AVAX stake and the fees. Fund the key, or wait until an ` +
                'earlier stake comes back.',
            );
          }

          // An earlier stake can stay locked only when it cannot change the balances that this run checks. CI starts
          // with an empty chain/.run, so there any earlier stake stops the run.
          await assertStakeRoom(signer.pChainAddress);

          // A run makes a new stake. The last run's ledger moves to .run/archive/ (stake-acp236-<runId>.json), where
          // teardown.ts and preflight.ts still find it.
          archiveLedger(LEDGER);
          const mock = createMockValidator({ label: 'S0', seed: `${runId} S0` });
          run.mock = mock;
          updateLedger((ledger) => {
            ledger.runId = runId;
            ledger.baseUrl = app.baseUrl;
          }, LEDGER);
          upsertValidator(
            'S0',
            { nodeId: mock.nodeID, blsPublicKey: mock.publicKey, weight: STAKE_NAVAX.toString(), state: 'planned' },
            LEDGER,
          );
          setPrimaryStake(LEDGER, {
            kind: 'auto-renewed',
            nodeId: mock.nodeID,
            stake: STAKE_NAVAX.toString(),
            state: 'planned',
          });
          signer.allowPrimaryStake(mock.nodeID);
          note(`mock validator ${mock.nodeID}`);
        }

        await openAsReturningVisitor(app, browser, PAGE);
        await connectCore(screen);
        await expect(toolHeading(screen, 'Stake on Primary Network')).toBeVisible();
      }),
    );

    test(
      'adds an auto-renewed validator',
      { timeout: 8 * 60_000 },
      revokeOnFailure(async ({ browser, screen, wallet }) => {
        const { signer } = wallet;
        const mock = need(run.mock, 'the mock validator');

        // A resumed run sends no add: it checks the add of the earlier run that member 1 adopted.
        const added = run.resumed ? undefined : await addThroughPage(browser, screen, signer, mock);
        const addTxId = added?.txId ?? need(run.resumed, 'the resumed stake').txId;
        if (!added) note(`resumed: the add ${addTxId} landed in an earlier run; this run sends no add`);
        run.addTxId = addTxId;

        // The validator as the P-Chain shows it: 1 AVAX, one 12 h cycle, and the key alone as the authority and the
        // owner of both rewards.
        const v: PrimaryValidator = await chainShows('the P-Chain shows the 12 h cycle', () =>
          validatorShows(mock.nodeID, addTxId, String(CYCLE_SECONDS), '0'),
        );
        expect(v.weight, 'stake').toBe(STAKE_NAVAX.toString());
        expect(Number(v.endTime) - Number(v.startTime), 'first cycle length').toBe(CYCLE_SECONDS);
        expect(Number(v.delegationFee), 'delegation fee').toBe(Number(DELEGATION_FEE));
        const keyAlone = { locktime: '0', threshold: '1', addresses: [signer.pChainAddress] };
        expect(v.validatorAuthority, 'validator authority').toEqual(keyAlone);
        expect(v.validationRewardOwner, 'validation reward owner').toEqual(keyAlone);
        expect(v.delegationRewardOwner, 'delegation reward owner').toEqual(keyAlone);
        run.startTime = v.startTime;
        run.endTime = v.endTime;

        let fee: bigint | undefined;
        if (added) {
          // The unlocked balance drops by the stake and the fee that the wallet signed.
          fee = signer.totals().pSpent - added.spentBefore;
          const expected = added.before - STAKE_NAVAX - fee;
          run.unlocked = await chainShowsUnlocked(
            `the unlocked P-Chain balance drops by 1 AVAX and the fee (${formatNanoAvax(fee)} AVAX)`,
            signer.pChainAddress,
            expected,
          );
        } else {
          // This process did not see the balance before the add. Member 1 checked that the key stakes exactly this
          // 1 AVAX; the balance checks of the config txs start from now.
          run.unlocked = await pBalance(signer.pChainAddress);
        }

        const unlockAt = isoFromUnix(Number(v.startTime) + CYCLE_SECONDS);
        finishSend(
          ADD_STEP,
          {
            status: 'landed',
            outputs: {
              startTime: v.startTime,
              endTime: v.endTime,
              unlockAt,
              ...(fee !== undefined && { fee: fee.toString() }),
            },
          },
          LEDGER,
        );
        upsertValidator('S0', { state: 'staked' }, LEDGER);
        setPrimaryStake(LEDGER, {
          state: 'staked',
          txId: addTxId,
          startTime: v.startTime,
          endTime: v.endTime,
          nextPeriod: v.nextPeriod,
          autoCompoundRewardShares: v.autoCompoundRewardShares,
          unlockAt,
        });
        const cost = fee === undefined ? 'resumed' : `fee ${formatNanoAvax(fee)} AVAX`;
        note(`staked ${mock.nodeID}: tx ${addTxId}, ${cost}, unlocks at ${unlockAt}`);
      }),
    );

    // The cap: two API cache waits of up to 5 min each (the lookup of a resumed run, and the config tx right after the
    // add: sendConfigTx), the commit (up to 3 min) and two chain polls (up to 1.5 min each).
    test(
      'updates the auto-renewal config',
      { timeout: 16 * 60_000 },
      revokeOnFailure(async ({ browser, screen, wallet }) => {
        const { signer } = wallet;
        const mock = need(run.mock, 'the mock validator');
        const addTxId = need(run.addTxId, 'the AddAutoRenewedValidatorTx ID');

        // After the add, the page shows its success; a resumed run is still on the first step.
        if (!run.resumed) await screen.getByRole('button', 'Stake Another Validator').click();
        await screen.getByRole('button', /^Manage Auto-Renewal/).click();
        // The page reads the validator from the load-balanced public API: first make sure a node has it.
        await chainShows('the P-Chain shows the 12 h cycle', () =>
          validatorShows(mock.nodeID, addTxId, String(CYCLE_SECONDS), '0'),
        );
        // A resumed run sent no add on this page, so the page shows the API's read, which can be old.
        await showAutoRenewConfig(screen, browser, mock.nodeID, currentConfig(CYCLE_HOURS, '0'), !!run.resumed);
        await expect(screen.getByRole('heading', 'Auto-Renewal Config')).toBeVisible();

        const cycle = screen.getByRole('spinbutton', 'Cycle Period');
        const compound = screen.getByRole('spinbutton', 'Auto-Compound Rewards');
        await expect(cycle).toHaveValue(CYCLE_HOURS);
        await expect(compound).toHaveValue('0');
        await cycle.fill(NEW_CYCLE_HOURS);
        await compound.fill(NEW_AUTO_COMPOUND);
        await expect(cycle).toHaveValue(NEW_CYCLE_HOURS);
        await expect(compound).toHaveValue(NEW_AUTO_COMPOUND);

        const { txId, validator, unlocked } = await sendConfigTx({
          step: 'stake-update-config',
          label: 'the P-Chain shows the 13 h cycle and 50% auto-compound for the next cycle',
          button: screen.getByRole('button', 'Update Config'),
          nodeId: mock.nodeID,
          addTxId,
          nextPeriod: NEW_CYCLE_SECONDS,
          shares: NEW_AUTO_COMPOUND_SHARES,
          unlockedBefore: need(run.unlocked, 'the unlocked balance after the last tx'),
          browser,
          screen,
          signer,
        });
        run.unlocked = unlocked;
        run.configTxIds.push(txId);
        await waitForPage(browser, 'Update Config success', screen.getByRole('button', 'Start Over'));

        // The change applies from the next cycle: the current one keeps its start, its end and its stake.
        expect(validator.startTime, 'cycle start').toBe(need(run.startTime, 'the cycle start'));
        expect(validator.endTime, 'cycle end').toBe(need(run.endTime, 'the cycle end'));
        expect(validator.weight, 'stake').toBe(STAKE_NAVAX.toString());
        setPrimaryStake(LEDGER, {
          state: 'updated',
          nextPeriod: NEW_CYCLE_SECONDS,
          autoCompoundRewardShares: NEW_AUTO_COMPOUND_SHARES,
        });
        note(`config updated: tx ${txId}`);
      }),
    );

    test(
      'stops the renewal',
      // The cap: the commit (up to 3 min) and two chain polls (up to 1.5 min each), with margin.
      { timeout: 7 * 60_000 },
      revokeOnFailure(async ({ browser, screen, wallet }) => {
        const { signer } = wallet;
        const mock = need(run.mock, 'the mock validator');
        const addTxId = need(run.addTxId, 'the AddAutoRenewedValidatorTx ID');

        // 'Start Over' keeps the manage form and clears the NodeID.
        await screen.getByRole('button', 'Start Over').click();
        await showAutoRenewConfig(
          screen,
          browser,
          mock.nodeID,
          currentConfig(NEW_CYCLE_HOURS, NEW_AUTO_COMPOUND),
          false,
        );
        await screen.getByRole('button', 'Stop Auto-Renewal').click();
        await expect(screen.getByText(/^The validator exits at the end of its current cycle/)).toBeVisible();

        const { txId, validator, unlocked } = await sendConfigTx({
          step: 'stake-stop',
          label: 'the P-Chain shows no next cycle',
          button: screen.getByRole('button', 'Confirm Stop'),
          nodeId: mock.nodeID,
          addTxId,
          nextPeriod: '0',
          shares: '0',
          unlockedBefore: need(run.unlocked, 'the unlocked balance after the last tx'),
          browser,
          screen,
          signer,
        });
        run.unlocked = unlocked;
        run.configTxIds.push(txId);
        await waitForPage(browser, 'Stop success', screen.getByRole('button', 'Start Over'));

        // The validator stays until the end of the current cycle, then the P-Chain gives the stake back.
        expect(validator.startTime, 'cycle start').toBe(need(run.startTime, 'the cycle start'));
        expect(validator.endTime, 'cycle end').toBe(need(run.endTime, 'the cycle end'));
        const unlockAt = isoFromUnix(validator.endTime);
        finishSend('stake-stop', { status: 'landed', outputs: { unlockAt } }, LEDGER);
        upsertValidator('S0', { state: 'stopped' }, LEDGER);
        setPrimaryStake(LEDGER, { state: 'stopped', nextPeriod: '0', autoCompoundRewardShares: '0', unlockAt });
        note(`renewal stopped: tx ${txId}. The P-Chain gives the 1 AVAX back at ${unlockAt}.`);
      }),
    );

    test(
      'lists the txs in History and audits the wallet',
      { timeout: 4 * 60_000 },
      revokeOnFailure(async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        const addTxId = need(run.addTxId, 'the AddAutoRenewedValidatorTx ID');
        expect(run.configTxIds, 'the config tx IDs').toHaveLength(2);
        // A resumed run sent no add in this browser, so its history holds the config txs only.
        const txs: [string, string][] = [
          ...(run.resumed ? [] : [[addTxId, ADD_OPERATION] as [string, string]]),
          [run.configTxIds[0], CONFIG_OPERATION],
          [run.configTxIds[1], CONFIG_OPERATION],
        ];

        // The page marks a tx confirmed after its own getTxStatus poll (up to 60 s), in this document. A new page load
        // would stop a poll that still runs, so wait on the Stake page first.
        await expect
          .poll(
            async () => {
              const { transactions = [] } = (await readStore(browser, TX_HISTORY_STORE)) as {
                transactions?: { txHash: string; status: string }[];
              };
              return txs.map(([id]) => transactions.find((t) => t.txHash === id)?.status ?? 'missing');
            },
            { timeout: 90_000, interval: 2_000, message: `the tx history store (${TX_HISTORY_STORE})` },
          )
          .toEqual(txs.map(() => 'confirmed'));

        // The audit runs also when the History check fails: it is the record of what the wallet sent.
        let historyError: unknown;
        try {
          await app.open('/console/history');
          // Until the wallet connects again, the page reads the mainnet copy of the store.
          await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
          await expect(screen.getByRole('heading', 'Transaction History')).toBeVisible();
          for (const [txId, operation] of txs) {
            const short = shortTxId(txId);
            await expect(screen.getByText(short, { exact: true })).toBeVisible();
            await expect
              .poll(() => historyRowText(browser, short), { timeout: 30_000, interval: 1_000, message: txId })
              .toMatch(new RegExp(`^${operation}${escapeRegExp(short)}ConfirmedP-ChainFuji`));
          }
        } catch (error) {
          historyError = error;
          note(`the History check failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        }

        const audit = auditSends(signer, {
          ledgerPath: LEDGER,
          expect: { 'pvm.AddAutoRenewedValidatorTx': run.resumed ? 0 : 1, 'pvm.SetAutoRenewedValidatorConfigTx': 2 },
        });
        note(`audit: ${audit.types.map((t) => `${t.txType} ${t.sent}`).join(', ')}`);
        expect(signer.totals().pStaked, 'the AVAX the wallet staked').toBe(STAKE_NAVAX);
        if (historyError) throw historyError;

        // The ledger holds what teardown.ts needs: the NodeID, the add tx ID, and when the stake comes back.
        const { primaryStake } = readLedger(LEDGER);
        expect(primaryStake, 'the ledger stake record').toMatchObject({
          kind: 'auto-renewed',
          nodeId: need(run.mock, 'the mock validator').nodeID,
          txId: addTxId,
          unlockAt: isoFromUnix(Number(need(run.startTime, 'the cycle start')) + CYCLE_SECONDS),
          state: 'stopped',
        });
      }),
    );
  },
);

// Adds the auto-renewed validator through the Stake page: 'Stake a Validator', the mock's credentials, 'Auto-Renewed'
// with 1 AVAX, a 2 % delegation fee, a 12 h cycle and no auto-compound, then 'Stake Fuji Validator'. Returns the tx
// ID, and the unlocked balance and the signer's spend before the send.
async function addThroughPage(
  browser: Browser,
  screen: Screen,
  signer: Signer,
  mock: MockValidator,
): Promise<{ txId: string; before: bigint; spentBefore: bigint }> {
  await screen.getByRole('button', /^Stake a Validator/).click();
  await screen.getByRole('tab', 'API Response').click();
  await screen.getByRole('textbox', /^Paste the JSON response/).fill(nodeCredentialsJson(mock));
  const add = screen.getByRole('button', 'Add Validator');
  await add.click();
  // The page takes one validator: it disables 'Add Validator'. It then shows the NodeID twice, in the 'Node ID'
  // summary and in the platform-cli command below it, so take the first (the summary).
  await expect(add).toBeDisabled();
  await expect(screen.getByRole('group', 'Added validator').getByText(mock.nodeID, { exact: true })).toBeVisible();

  await screen.getByRole('button', /^Auto-Renewed/).click();
  // The page's default cycle is 336 h, which would lock the stake for 14 days. The signer refuses it.
  const fields: [Locator, string][] = [
    [screen.getByRole('spinbutton', 'Stake Amount'), STAKE_AVAX],
    [screen.getByRole('spinbutton', 'Delegation Fee'), DELEGATION_FEE],
    [screen.getByRole('spinbutton', 'Cycle Period'), CYCLE_HOURS],
    [screen.getByRole('spinbutton', 'Auto-Compound Rewards'), '0'],
  ];
  for (const [input, value] of fields) await input.fill(value);
  for (const [input, value] of fields) await expect(input).toHaveValue(value);

  // The button is disabled while the page asks the P-Chain whether the NodeID validates already. Its name says which
  // network the page uses.
  const submit = screen.getByRole('button', 'Stake Fuji Validator');
  await expect(submit).toBeEnabled({ timeout: 60_000 });

  const before = await pBalance(signer.pChainAddress);
  const spentBefore = signer.totals().pSpent;
  const from = signer.sends.length;
  const { send } = await sendOnce({
    step: ADD_STEP,
    chain: 'P',
    inputs: {
      nodeId: mock.nodeID,
      stake: STAKE_NAVAX.toString(),
      periodSeconds: CYCLE_SECONDS,
      delegationFeePercent: Number(DELEGATION_FEE),
      autoCompoundPercent: 0,
    },
    landed: async (prev) => !!prev?.txIds[0] && (await pPrimaryValidator(mock.nodeID))?.txID === prev.txIds[0],
    send: async () => {
      await submit.click();
      const tx = await waitForSend(browser, signer, from, 'pvm.AddAutoRenewedValidatorTx', {
        failed: busyThenIdle(submit),
      });
      return { txIds: [tx.hash] };
    },
    confirm: async (sent) => {
      await waitForPTx(sent.txIds[0]);
      await chainShows(
        'the P-Chain lists the auto-renewed validator',
        async () => (await pPrimaryValidator(mock.nodeID))?.txID === sent.txIds[0],
      );
      return true;
    },
    path: LEDGER,
  });
  await waitForPage(browser, 'Stake success', screen.getByRole('button', 'Stake Another Validator'));
  return { txId: send.txIds[0], before, spentBefore };
}

// Types the NodeID on 'Manage Auto-Renewal' and waits until the page shows `config`. Stake.tsx reads
// platform.getCurrentValidators once per NodeID change. The public API caches that read by its params for about 3 min
// (chain.ts pCurrentValidators). After the page's own accepted tx, the page shows what the tx set at once, with a note
// while the API read is old, so one attempt must do. A resumed run sent no add on this page: there the page shows the
// API's read, so `cacheWait` lets each new attempt clear the field and type the NodeID again, until
// PAGE_CACHE_WAIT_MS has passed.
async function showAutoRenewConfig(
  screen: Screen,
  browser: Browser,
  nodeId: string,
  config: string,
  cacheWait: boolean,
): Promise<void> {
  const nodeField = screen.getByRole('textbox', 'Node ID');
  const shown = screen.getByText(config, { exact: true });
  const deadline = Date.now() + (cacheWait ? PAGE_CACHE_WAIT_MS : 0);
  for (let attempt = 1; ; attempt++) {
    await nodeField.fill('');
    await nodeField.fill(nodeId);
    try {
      await expect(shown).toBeVisible({ timeout: cacheWait ? 15_000 : 30_000 });
    } catch {
      if (Date.now() > deadline) {
        const text = await toolText(browser).catch(() => '(no tool text)');
        const when = cacheWait ? `In ${PAGE_CACHE_WAIT_MS / 60_000} min` : 'After its own accepted tx,';
        throw new Error(`${when} the page did not show '${config}' for ${nodeId}. The tool card shows:\n${text}`);
      }
      note(`attempt ${attempt}: the page does not show '${config}' yet; typing the NodeID again`);
      continue;
    }
    const fromTx = await screen.getByText(ACCEPTED_TX_NOTE, { exact: true }).isVisible();
    note(`the page showed '${config}' on attempt ${attempt}, from ${fromTx ? 'its accepted tx' : 'the API'}`);
    return;
  }
}

// One SetAutoRenewedValidatorConfigTx from a button of the manage form ('Update Config' or 'Confirm Stop'). It
// checks the chain before the send, waits for the commit, and checks that the unlocked balance drops by the fee only.
// Returns the tx ID and the validator as the P-Chain shows it after the tx.
//
// The SDK builds the tx from platform.getCurrentValidators, which the public API caches for about 3 min. Right after
// the add, the page shows ACCEPTED_TX_NOTE above the buttons and keeps them disabled until its 30 s re-read lists the
// validator, so the test first waits for the button. The page reads getCurrentValidators({ nodeIDs }) and the SDK
// reads getCurrentValidators({}), and the two cached reads can expire at different times. When the SDK's list still
// misses the validator, the page says so (VALIDATOR_NOT_LISTED_YET) before any wallet request, and the test clicks
// again every 20 s, until PAGE_CACHE_WAIT_MS has passed.
async function sendConfigTx(o: {
  step: string;
  label: string;
  button: Locator;
  nodeId: string;
  addTxId: string;
  nextPeriod: string;
  shares: string;
  /** The unlocked balance before the tx, as a node showed it after the last tx. */
  unlockedBefore: bigint;
  browser: Browser;
  screen: Screen;
  signer: Signer;
}): Promise<{ txId: string; validator: PrimaryValidator; unlocked: bigint }> {
  const shows = () => validatorShows(o.nodeId, o.addTxId, o.nextPeriod, o.shares);
  const spentBefore = o.signer.totals().pSpent;
  const from = o.signer.sends.length;
  const { result, send } = await sendOnce({
    step: o.step,
    chain: 'P',
    inputs: { validatorTxId: o.addTxId, nextPeriod: o.nextPeriod, autoCompoundRewardShares: o.shares },
    landed: async () => !!(await shows()),
    send: async () => {
      await expect(o.button).toBeEnabled({ timeout: PAGE_CACHE_WAIT_MS });
      const deadline = Date.now() + PAGE_CACHE_WAIT_MS;
      for (let attempt = 1; ; attempt++) {
        await o.button.click();
        try {
          const tx = await waitForSend(o.browser, o.signer, from, 'pvm.SetAutoRenewedValidatorConfigTx', {
            failed: busyThenIdle(o.button),
          });
          return { txIds: [tx.hash] };
        } catch (error) {
          const notListed = await pageAlert(o.screen, VALIDATOR_NOT_LISTED_YET).isVisible();
          if (!notListed || Date.now() > deadline) throw error;
          note(`attempt ${attempt}: the validator list does not show ${o.nodeId} yet; clicking again in 20 s`);
          await new Promise((resolve) => setTimeout(resolve, 20_000));
        }
      }
    },
    confirm: async (sent) => {
      await waitForPTx(sent.txIds[0]);
      await chainShows(o.label, shows);
      return true;
    },
    path: LEDGER,
  });
  if (result === 'skipped' || !send.txIds[0]) throw new Error(`${o.step}: the chain showed the result before a send.`);
  const validator = await chainShows(o.label, shows);
  const fee = o.signer.totals().pSpent - spentBefore;
  await chainShowsUnlocked(
    `${o.step}: the unlocked P-Chain balance drops by the fee only (${formatNanoAvax(fee)} AVAX), not by a stake`,
    o.signer.pChainAddress,
    o.unlockedBefore - fee,
  );
  finishSend(o.step, { status: 'landed', outputs: { fee: fee.toString() } }, LEDGER);
  return { txId: send.txIds[0], validator, unlocked: o.unlockedBefore - fee };
}

// The History page shortens a tx ID to its first 8 and last 6 characters (app/console/history/page.tsx).
function shortTxId(txId: string): string {
  return `${txId.slice(0, 8)}...${txId.slice(-6)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The text of the History row that shows this short tx ID: the operation, the ID, the status, the chain, the network
// and the time, with no separators. The rows have no role and no name (a div per tx, app/console/history/page.tsx),
// so the test reads the row around the ID's <code> element.
async function historyRowText(browser: Browser, short: string): Promise<string> {
  return browser.evaluate((id) => {
    const code = Array.from(document.querySelectorAll('code')).find((c) => c.textContent === id);
    return code?.parentElement?.parentElement?.textContent ?? '';
  }, short);
}
