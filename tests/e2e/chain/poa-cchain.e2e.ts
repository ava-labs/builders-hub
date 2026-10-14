import { expect } from 'e2e';
import { parseEventLogs, type Hex } from 'viem';
import {
  FUJI,
  VALIDATOR_MANAGER_ABI,
  ValidatorStatus,
  chainShows,
  glacierL1Validators,
  hexToCb58,
  managerNodeValidationId,
  managerTotalWeight,
  managerValidator,
  pL1Validator,
  pollUntil,
  validationIdToHex,
  waitForCTx,
  waitForGlacierSubnet,
  waitForPTx,
} from './lib/chain.ts';
import { TIER1_SENDS, auditSends, expectedSends, requireOwnSigner } from './lib/audit.ts';
import {
  busyThenIdle,
  clickNext,
  note,
  pageAlert,
  readStore,
  remountStep,
  toolHeading,
  waitForPage,
  WALLET_REJECTED,
  waitForPoaBadge,
  waitForSend,
} from './lib/console.ts';
import { CHAIN_POLL, addValidatorFromJson, createL1Flow, need, output } from './lib/create-l1.ts';
import { describe, test } from './lib/fixtures.ts';
import { LEDGER_PATH, finishSend, readLedger, runIdFromEnv, sendOnce, upsertValidator } from './lib/ledger.ts';
import { createMockValidator, type MockValidator } from './lib/mock-validator.ts';
import { aggregateThenSend, completeOnManager, registerOnPChain } from './lib/validator-steps.ts';

// Tier 1 of the nightly Console suite: a fresh PoA L1 whose Validator Manager runs on the Fuji C-Chain, made with
// the Console, one member per Console step. No node runs the L1: the validators are mock validators
// (lib/mock-validator.ts), and the Primary Network signs every Warp message for a C-Chain manager.
// lib/console-map.md lists the controls, success signals and traps of each step.
//
// Members 1 to 9 are the create flow of lib/create-l1.ts (questionnaire to Initialize Validator Set), which makes the
// L1 with V0. The validator tools then add V1, change its weight, top up V0 and remove V1. Disable V0 refunds its
// balance; teardown.ts is the backstop for a run that stops before it. The last member audits every send of the wallet
// (lib/audit.ts, TIER1_SENDS), so the group needs the signer to itself: member 1 stops when an earlier test file of
// the process used it.
//
// The run also checks how the pages handle a wrong input, with no extra L1 and no extra tx:
//   - the create flow (uxChecks): a reload between the two proxy deploys keeps the ProxyAdmin, and a blockchain ID in
//     the Subnet ID field of Initialize Validator Set gets the 'not a blockchain ID' text;
//   - Add V1: a weight of 25 (25% of the L1) gets the page's warning and its refusal, and no wallet request (the
//     wallet rejects each eth_sendTransaction during the check, so a regressed page sends nothing);
//   - a reload on the P-Chain Registration step keeps the L1 that the flow store holds;
//   - Top up V0: the wallet answers the first request as a user who clicks Reject in Core (signer.rejectNext); the
//     page shows the rejection, and the next click sends the tx;
//   - the P-Chain steps show no 'Insufficient P-Chain balance' warning for the funded key.
//
// Each member checks the chain after its tx (Node reads, lib/chain.ts) and skips a send that already landed
// (sendOnce, lib/ledger.ts). The group never retries: a retry would send the txs again. Only lib/warp.ts retries a
// Warp delivery, which changes no state when it reverts.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   npm run test:chain -- --tag tier1

const runId = runIdFromEnv();
// The ledger of tier 1: chain/.run/ledger.json, or E2E_CHAIN_LEDGER.
const LEDGER = LEDGER_PATH;
const flow = createL1Flow({
  validatorType: 'poa',
  ledgerPath: LEDGER,
  runId,
  uxChecks: true,
  // The audit in the last member counts every send, refusal and user rejection of the signer.
  beforeStart: ({ wallet }) => requireOwnSigner(wallet.signer, 'tier1'),
});
const l1 = flow.state;

// The state of the validator members. The runner imports this file once for the serial group, so they share it.
const run: {
  v1?: MockValidator;
  v1ValidationId?: string;
} = {};

const V0_WEIGHT = 100n;
const V1_WEIGHT = 10n;
// 25% of the L1's weight of 100: the manager refuses a change of 20% or more (validateStakePercentage).
const V1_TOO_HEAVY = 25n;
const V1_NEW_WEIGHT = 12n;
const V1_BALANCE_AVAX = '0.02';
const V1_BALANCE_NAVAX = 20_000_000n;
const TOP_UP_AVAX = '0.01';
const TOP_UP_NAVAX = 10_000_000n;

// The validator flows. A step URL can keep a query, so the patterns allow one.
const ADD_STORE = 'v4-add-validator-store-testnet';
const ADD_STEP = {
  initiate: /\/console\/add-validator\/initiate-registration(\?.*)?$/,
  pchain: /\/console\/add-validator\/pchain-registration(\?.*)?$/,
  complete: /\/console\/add-validator\/complete-registration(\?.*)?$/,
};
const WEIGHT_STEP = {
  select: '/console/permissioned-l1s/change-validator-weight/select-subnet',
  initiate: /\/console\/permissioned-l1s\/change-validator-weight\/initiate-weight-change(\?.*)?$/,
  pchain: /\/console\/permissioned-l1s\/change-validator-weight\/pchain-weight-update(\?.*)?$/,
  complete: /\/console\/permissioned-l1s\/change-validator-weight\/complete-weight-change(\?.*)?$/,
};
const REMOVE_STEP = {
  initiate: /\/console\/remove-validator\/initiate-removal(\?.*)?$/,
  pchain: /\/console\/remove-validator\/pchain-removal(\?.*)?$/,
  complete: /\/console\/remove-validator\/complete-removal(\?.*)?$/,
};
// The Primary Network's subnet ID signs for a manager on the C-Chain.
const PRIMARY_NETWORK = FUJI.primaryNetworkId;
// The warning of the add and remove P-Chain steps when the key holds less than 0.1 AVAX (PChainRegistrationStep.tsx,
// PChainRemovalStep.tsx).
const LOW_P_BALANCE = /^Insufficient P-Chain balance for transaction fees/;

describe('tier 1: PoA L1, manager on the C-Chain', { serial: true, retries: 0, tags: ['chain', 'tier1'] }, () => {
  for (const step of flow.steps) {
    test(step.title, { timeout: step.timeoutMs }, async ({ app, browser, screen, wallet }) =>
      step.run({ app, browser, screen, wallet }),
    );
  }

  test('adds validator V1', { timeout: 30 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(l1.subnetId, 'the subnet ID');
    const proxy = need(l1.proxy, 'the proxy address');
    const v1 = createMockValidator({ label: 'V1', seed: `${runId} V1` });
    run.v1 = v1;
    upsertValidator(
      'V1',
      { nodeId: v1.nodeID, subnetId, weight: V1_WEIGHT.toString(), blsPublicKey: v1.publicKey },
      LEDGER,
    );

    // The validator flows read the manager from Glacier's record of the L1 (hooks/useVMCAddress.ts).
    const { waitedMs: glacierLagMs } = await waitForGlacierSubnet(subnetId, { converted: true });
    note(`Glacier listed ${subnetId} as an L1 after ${Math.round(glacierLagMs / 1000)} s`);

    // 1. Select L1. The query sets the L1, and the flow store keeps it for the later steps.
    await app.open(`/console/add-validator/select-subnet?subnetId=${subnetId}`);
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByRole('heading', 'Select L1')).toBeVisible();
    await waitForPoaBadge(screen);
    await expect(screen.getByRole('button', PRIMARY_NETWORK)).toBeVisible();
    await clickNext(screen, browser, ADD_STEP.initiate);

    // 2. Initiate Validator Registration (C-Chain).
    await waitForPoaBadge(screen);
    await addValidatorFromJson(screen, v1);
    const weight = screen.getByRole('spinbutton', 'Consensus Weight');
    const balance = screen.getByRole('spinbutton', 'Validator Balance (P-Chain AVAX)');
    await balance.fill(V1_BALANCE_AVAX);
    await expect(balance).toHaveValue(V1_BALANCE_AVAX);
    const initiate = screen.getByRole('button', 'Initiate Validator Registration');

    // A weight of 25 is 25% of the L1: the page warns under the field and refuses the click before it asks the
    // wallet. A wallet request here would register V1 with that weight, so until the check ends the wallet rejects
    // each eth_sendTransaction (signer.rejectNext with times: Infinity), and the check fails on any of them.
    const tooHeavy = screen.getByText(
      "This validator's weight is 25.00% of the current total L1 weight. It must be less than 20%. Enter 19 or less.",
      { exact: true },
    );
    const safetyNet = signer.rejectNext('eth_sendTransaction', { times: Infinity });
    const sendsBefore = signer.sends.length;
    try {
      await weight.fill(V1_TOO_HEAVY.toString());
      await expect(tooHeavy).toBeVisible({ timeout: 60_000 });
      await initiate.click();
      await expect(
        pageAlert(
          screen,
          "The new validator's proposed weight (25) represents 25.00% of the current total L1 weight (100). " +
            'This must be less than 20%.',
        ),
      ).toBeVisible();
      expect(safetyNet.used, 'the page asked the wallet to register a validator with 25% of the weight').toBe(0);
      expect(signer.sends.length, 'the wallet sent a tx for the refused weight').toBe(sendsBefore);
    } finally {
      safetyNet.cancel();
    }
    await weight.fill(V1_WEIGHT.toString());
    await expect(weight).toHaveValue(V1_WEIGHT.toString());
    await expect(tooHeavy).toBeHidden();

    let from = signer.sends.length;
    const { send: initiated } = await sendOnce({
      step: 'add-v1-initiate',
      chain: 'C',
      path: LEDGER,
      inputs: { nodeId: v1.nodeID, weight: V1_WEIGHT.toString(), balance: V1_BALANCE_NAVAX.toString() },
      landed: async () => !/^0x0+$/.test(await managerNodeValidationId(proxy, v1.nodeID)),
      send: async () => {
        await initiate.click();
        const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(initiate) });
        const receipt = await waitForCTx(tx.hash as Hex);
        const [event] = parseEventLogs({
          abi: VALIDATOR_MANAGER_ABI,
          logs: receipt.logs,
          eventName: 'InitiatedValidatorRegistration',
        });
        if (!event) throw new Error(`${tx.hash} emitted no InitiatedValidatorRegistration.`);
        return {
          txIds: [tx.hash],
          outputs: {
            validationId: hexToCb58(event.args.validationID),
            blockNumber: receipt.blockNumber.toString(),
            registrationExpiry: event.args.registrationExpiry.toString(),
          },
        };
      },
      confirm: (sent) =>
        chainShows(
          'the manager holds V1',
          async () =>
            (await managerValidator(proxy, output(sent, 'validationId'))).status === ValidatorStatus.PendingAdded,
        ),
    });
    finishSend('add-v1-initiate', { status: 'landed', glacierLagMs }, LEDGER);
    const v1ValidationId = output(initiated, 'validationId');
    run.v1ValidationId = v1ValidationId;
    upsertValidator(
      'V1',
      {
        validationId: v1ValidationId,
        balance: V1_BALANCE_NAVAX.toString(),
        blockNumber: output(initiated, 'blockNumber'),
        registrationExpiry: output(initiated, 'registrationExpiry'),
        state: 'initiated',
      },
      LEDGER,
    );
    note(`V1 initiated: ${v1ValidationId}`);
    await waitForPage(browser, 'Initiate success', screen.getByRole('button', 'Transaction Completed'));
    await expect.poll(async () => (await managerValidator(proxy, v1ValidationId)).weight, CHAIN_POLL).toBe(V1_WEIGHT);
    await expect
      .poll(() => managerNodeValidationId(proxy, v1.nodeID), CHAIN_POLL)
      .toBe(validationIdToHex(v1ValidationId));

    // 3. P-Chain Registration: one button aggregates and sends the RegisterL1ValidatorTx. The flow store keeps the
    // L1 and the initiate tx, so a reload on this step loads the same registration.
    await clickNext(screen, browser, ADD_STEP.pchain);
    await browser.reload();
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    expect((await readStore(browser, ADD_STORE)).subnetIdL1, 'the add-validator store keeps the L1').toBe(subnetId);
    const registerReady = async () => {
      await waitForPoaBadge(screen);
      await expect(screen.getByText('Initial Balance:')).toBeVisible({ timeout: 60_000 });
      await expect(screen.getByText(`${V1_BALANCE_AVAX} AVAX`, { exact: true })).toBeVisible();
    };
    await registerReady();
    await expect(screen.getByRole('button', 'Sign & Submit to P-Chain')).toBeEnabled({ timeout: 90_000 });
    await expect(screen.getByText(/^No transaction hash from the initiation step/)).toBeHidden();
    // The key holds more than 0.1 AVAX on the P-Chain and more than the validator balance.
    await expect(screen.getByText(LOW_P_BALANCE)).toBeHidden();
    await expect(screen.getByText(/^Exceeds P-Chain balance/)).toBeHidden();
    const registerTxId = await registerOnPChain({
      browser,
      screen,
      signer,
      ledgerPath: LEDGER,
      step: 'add-v1-register',
      label: 'Register V1 on the P-Chain',
      storeKey: ADD_STORE,
      landed: async () => (await pL1Validator(v1ValidationId)) !== null,
      ready: registerReady,
    });
    const registered = await chainShows('the P-Chain lists V1', () => pL1Validator(v1ValidationId));
    expect(registered.weight).toBe(V1_WEIGHT);
    expect(registered.balance > 0n && registered.balance <= V1_BALANCE_NAVAX).toBe(true);

    // 4. Complete Registration (C-Chain): the P-Chain's signed message goes to the manager.
    await clickNext(screen, browser, ADD_STEP.complete);
    await waitForPoaBadge(screen);
    await expect(screen.getByRole('textbox', 'P-Chain Transaction ID')).toHaveValue(registerTxId);
    const completeAttempts = await completeOnManager({
      browser,
      screen,
      signer,
      ledgerPath: LEDGER,
      step: 'add-v1-complete',
      label: 'Complete V1 registration',
      button: 'Complete Validator Registration',
      done: screen.getByText('Registration completed'),
      landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.Active,
      ready: () => waitForPoaBadge(screen),
    });
    note(`V1 registration completed in ${completeAttempts} attempt(s)`);
    await expect(
      screen.getByText('Your validator is now registered and active on the L1.', { exact: false }),
    ).toBeVisible();
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_WEIGHT);
    upsertValidator('V1', { state: 'registered' }, LEDGER);
  });

  test('changes the weight of V1', { timeout: 30 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(l1.subnetId, 'the subnet ID');
    const proxy = need(l1.proxy, 'the proxy address');
    const v1 = need(run.v1, 'mock validator V1');
    const v1ValidationId = need(run.v1ValidationId, 'the V1 validation ID');

    // The Validation ID field suggests the validators of Glacier's list, read once when the step mounts.
    const { waitedMs: glacierLagMs } = await pollUntil(
      `Glacier lists V1 of ${subnetId}`,
      async () =>
        (await glacierL1Validators(subnetId, { includeInactive: true })).some(
          (v) => v.validationId === v1ValidationId && v.weight > 0,
        ),
      { timeoutMs: 15 * 60_000, intervalMs: 5_000 },
    );
    note(`Glacier listed V1 after ${Math.round(glacierLagMs / 1000)} s`);

    // 1. Select L1. The query sets the L1.
    await app.open(`${WEIGHT_STEP.select}?subnetId=${subnetId}`);
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByRole('textbox', 'Subnet ID')).toHaveValue(subnetId, { timeout: 60_000 });
    await expect(screen.getByRole('button', PRIMARY_NETWORK)).toBeVisible({ timeout: 90_000 });
    await clickNext(screen, browser, WEIGHT_STEP.initiate);

    // 2. Initiate Weight Change. Each validator of the L1 is a button under 'Validation ID', named by its NodeID and
    // its weight; the picked one is pressed.
    const v1Choice = screen.getByRole('button', new RegExp(`^${v1.nodeID}`));
    await v1Choice.click({ timeout: 90_000 });
    await expect(v1Choice).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('textbox', 'New Weight').fill(V1_NEW_WEIGHT.toString());
    const initiate = screen.getByRole('button', 'Initiate Change Weight');
    const from = signer.sends.length;
    await sendOnce({
      step: 'weight-v1-initiate',
      chain: 'C',
      path: LEDGER,
      inputs: { validationId: v1ValidationId, weight: V1_NEW_WEIGHT.toString() },
      landed: async () => (await managerValidator(proxy, v1ValidationId)).weight === V1_NEW_WEIGHT,
      send: async () => {
        await expect(initiate).toBeEnabled({ timeout: 90_000 });
        await initiate.click();
        const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(initiate) });
        await waitForCTx(tx.hash as Hex);
        return { txIds: [tx.hash] };
      },
      confirm: () =>
        chainShows(
          'the manager holds the new weight',
          async () => (await managerValidator(proxy, v1ValidationId)).weight === V1_NEW_WEIGHT,
        ),
    });
    finishSend('weight-v1-initiate', { status: 'landed', glacierLagMs }, LEDGER);
    await waitForPage(browser, 'Initiate Change Weight success', screen.getByRole('button', 'Transaction Completed'));
    // The manager waits for the P-Chain: it sent a weight message that the P-Chain has not confirmed yet.
    await expect
      .poll(async () => {
        const { sentNonce, receivedNonce } = await managerValidator(proxy, v1ValidationId);
        return sentNonce > receivedNonce;
      }, CHAIN_POLL)
      .toBe(true);

    // 3. P-Chain Weight Update. 'Aggregate Signatures' is enabled once the manager details and the signing subnet
    // have loaded.
    await clickNext(screen, browser, WEIGHT_STEP.pchain);
    await aggregateThenSend({
      browser,
      screen,
      signer,
      ledgerPath: LEDGER,
      step: 'weight-v1-pchain',
      chain: 'P',
      label: 'Set V1 weight on the P-Chain',
      landed: async () => (await pL1Validator(v1ValidationId))?.weight === V1_NEW_WEIGHT,
      beforeRetry: () => remountStep(screen, browser, WEIGHT_STEP.pchain),
      button: 'Submit to P-Chain',
      txType: 'pvm.SetL1ValidatorWeightTx',
      done: /^P-Chain tx confirmed:/,
    });
    await chainShows('the P-Chain holds the new weight', async () => {
      return (await pL1Validator(v1ValidationId))?.weight === V1_NEW_WEIGHT;
    });

    // 4. Complete Weight Change. The button is enabled once the details have loaded.
    await clickNext(screen, browser, WEIGHT_STEP.complete);
    const attempts = await completeOnManager({
      browser,
      screen,
      signer,
      ledgerPath: LEDGER,
      step: 'weight-v1-complete',
      label: 'Complete V1 weight change',
      button: 'Complete Weight Change',
      done: screen.getByText(/The validator weight has been updated successfully\./),
      landed: async () => {
        const v = await managerValidator(proxy, v1ValidationId);
        return v.receivedNonce === v.sentNonce && v.weight === V1_NEW_WEIGHT;
      },
      ready: async () => undefined,
    });
    note(`V1 weight change completed in ${attempts} attempt(s)`);
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_NEW_WEIGHT);
  });

  test('tops up the balance of V0', { timeout: 10 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(l1.subnetId, 'the subnet ID');
    const v0 = need(l1.v0, 'mock validator V0');
    const v0ValidationId = need(l1.v0ValidationId, 'the V0 validation ID');

    await app.open('/console/layer-1/l1-validator-balance');
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await expect(toolHeading(screen, 'Validator Balance Increase')).toBeVisible();
    await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
    const v0Choice = screen.getByRole('button', new RegExp(`^${v0.nodeID}`));
    await v0Choice.click({ timeout: 90_000 });
    await expect(v0Choice).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('spinbutton', 'Amount').fill(TOP_UP_AVAX);
    const button = screen.getByRole('button', 'Increase Balance');
    await expect(button).toBeEnabled({ timeout: 60_000 });

    // The user clicks Reject in Core: the wallet answers the page's first request with 4001. The page shows the
    // rejection in one line, with no stack trace and no raw error, and sends nothing. The next click sends the tx.
    const rejection = signer.rejectNext('avalanche_sendTransaction');
    const sendsBefore = signer.sends.length;
    const rejected = pageAlert(screen, WALLET_REJECTED);
    try {
      await button.click();
      await expect(rejected).toBeVisible({ timeout: 60_000 });
      await expect(rejected).toHaveText(WALLET_REJECTED);
      expect(rejection.used, 'the page sent no avalanche_sendTransaction').toBe(1);
      expect(signer.sends.length, 'the wallet sent a tx after the rejection').toBe(sendsBefore);
    } finally {
      rejection.cancel();
    }
    await expect(button).toBeEnabled();
    note('top-up: the page showed the user rejection; clicking again');

    const before = await chainShows('the P-Chain lists V0', () => pL1Validator(v0ValidationId));
    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'top-up-v0',
      chain: 'P',
      path: LEDGER,
      inputs: { validationId: v0ValidationId, amount: TOP_UP_NAVAX.toString() },
      // V0 burns 512 nAVAX each second, so a balance above the one before means the top-up landed.
      landed: async (prev) => !!prev && ((await pL1Validator(v0ValidationId))?.balance ?? 0n) > before.balance,
      send: async () => {
        await button.click();
        const tx = await waitForSend(browser, signer, from, 'pvm.IncreaseL1ValidatorBalanceTx', {
          failed: busyThenIdle(button),
        });
        return { txIds: [tx.hash] };
      },
      confirm: async (sent) => {
        await waitForPTx(sent.txIds[0]);
        await chainShows('the P-Chain shows the top-up', async () => {
          const balance = (await pL1Validator(v0ValidationId))?.balance ?? 0n;
          return balance > before.balance + TOP_UP_NAVAX - 1_000_000n;
        });
        return true;
      },
    });
    note(`V0 topped up by ${TOP_UP_AVAX} AVAX: ${send.txIds[0]}`);
    await waitForPage(browser, 'Top-up success', screen.getByRole('heading', 'Balance Increased Successfully'));
    await expect(screen.getByText(`Added ${TOP_UP_AVAX} AVAX to validator balance`)).toBeVisible();
    if (result === 'sent') {
      // The page links the tx that the wallet sent.
      await expect(screen.getByRole('link', 'View transaction in the explorer')).toHaveAttribute(
        'href',
        `/explorer/fuji/p-chain/tx/${send.txIds[0]}`,
      );
    }
  });

  test('removes validator V1', { timeout: 25 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(l1.subnetId, 'the subnet ID');
    const proxy = need(l1.proxy, 'the proxy address');
    const v1 = need(run.v1, 'mock validator V1');
    const v1ValidationId = need(run.v1ValidationId, 'the V1 validation ID');

    // 1. Select L1 (the query sets it).
    await app.open(`/console/remove-validator/select-subnet?subnetId=${subnetId}`);
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await waitForPoaBadge(screen);
    await clickNext(screen, browser, REMOVE_STEP.initiate);

    // 2. Initiate Removal. Each validator of the L1 is a button under 'Validation ID'.
    await waitForPoaBadge(screen);
    const v1Choice = screen.getByRole('button', new RegExp(`^${v1.nodeID}`));
    await v1Choice.click({ timeout: 90_000 });
    await expect(v1Choice).toHaveAttribute('aria-pressed', 'true');
    const initiate = screen.getByRole('button', 'Initiate Validator Removal');
    const from = signer.sends.length;
    await sendOnce({
      step: 'remove-v1-initiate',
      chain: 'C',
      path: LEDGER,
      inputs: { validationId: v1ValidationId },
      landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.PendingRemoved,
      send: async () => {
        await expect(initiate).toBeEnabled({ timeout: 90_000 });
        await initiate.click();
        const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(initiate) });
        await waitForCTx(tx.hash as Hex);
        return { txIds: [tx.hash] };
      },
      confirm: () =>
        chainShows(
          'the manager shows V1 pending removal',
          async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.PendingRemoved,
        ),
    });
    await waitForPage(browser, 'Initiate Removal success', screen.getByRole('button', 'Transaction Completed'));

    // 3. P-Chain Weight Update: weight 0 removes V1 from the P-Chain and refunds its balance.
    await clickNext(screen, browser, REMOVE_STEP.pchain);
    await waitForPoaBadge(screen);
    await expect(screen.getByRole('button', 'Aggregate Signatures')).toBeEnabled({ timeout: 90_000 });
    await expect(screen.getByText(LOW_P_BALANCE)).toBeHidden();
    await aggregateThenSend({
      browser,
      screen,
      signer,
      ledgerPath: LEDGER,
      step: 'remove-v1-pchain',
      chain: 'P',
      label: 'Remove V1 on the P-Chain',
      landed: async () => ((await pL1Validator(v1ValidationId))?.weight ?? 0n) === 0n,
      beforeRetry: async () => {
        await remountStep(screen, browser, REMOVE_STEP.pchain);
        await waitForPoaBadge(screen);
      },
      button: 'Submit to P-Chain',
      txType: 'pvm.SetL1ValidatorWeightTx',
      done: /^P-Chain tx confirmed:/,
    });

    // 4. Complete Removal.
    await clickNext(screen, browser, REMOVE_STEP.complete);
    await waitForPoaBadge(screen);
    const attempts = await completeOnManager({
      browser,
      screen,
      signer,
      ledgerPath: LEDGER,
      step: 'remove-v1-complete',
      label: 'Complete V1 removal',
      button: 'Sign & Complete Validator Removal',
      done: screen.getByText('Validator removal completed'),
      landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.Completed,
      ready: () => waitForPoaBadge(screen),
    });
    note(`V1 removal completed in ${attempts} attempt(s)`);
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT);
    upsertValidator('V1', { state: 'removed' }, LEDGER);
  });

  test('disables validator V0 (teardown)', { timeout: 20 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(l1.subnetId, 'the subnet ID');
    const v0 = need(l1.v0, 'mock validator V0');
    const v0ValidationId = need(l1.v0ValidationId, 'the V0 validation ID');

    // The validator list reads Glacier's active L1 validators once per subnet change (ValidatorSelector.tsx).
    const { waitedMs: glacierLagMs } = await pollUntil(
      `Glacier lists V0 of ${subnetId} as active`,
      async () => (await glacierL1Validators(subnetId)).some((v) => v.validationId === v0ValidationId),
      { timeoutMs: 15 * 60_000, intervalMs: 5_000 },
    );
    note(`Glacier listed V0 as active after ${Math.round(glacierLagMs / 1000)} s`);

    await app.open('/console/permissioned-l1s/disable-validator');
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await expect(toolHeading(screen, 'Disable L1 Validator')).toBeVisible();
    await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
    await screen.getByRole('button', new RegExp(`^${v0.nodeID}`)).click();
    await waitForPage(
      browser,
      'Disable authorization',
      screen.getByText('Your wallet is authorized to disable this validator.'),
    );
    await screen.getByRole('checkbox', /^I understand this disables/).check();

    // The balance after the top-up of an earlier member: poll, as after any tx.
    const before = await chainShows('the P-Chain lists V0', () => pL1Validator(v0ValidationId));
    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'disable-v0',
      chain: 'P',
      path: LEDGER,
      inputs: { validationId: v0ValidationId },
      landed: async () => (await pL1Validator(v0ValidationId))?.balance === 0n,
      send: async () => {
        await screen.getByRole('button', 'Disable Validator').click();
        const tx = await waitForSend(browser, signer, from, 'pvm.DisableL1ValidatorTx');
        return { txIds: [tx.hash] };
      },
      confirm: async (sent) => {
        await waitForPTx(sent.txIds[0]);
        await chainShows(
          'the P-Chain shows V0 inactive',
          async () => (await pL1Validator(v0ValidationId))?.balance === 0n,
        );
        return true;
      },
    });
    finishSend(
      'disable-v0',
      { status: 'landed', glacierLagMs, outputs: { refunded: before.balance.toString() } },
      LEDGER,
    );
    upsertValidator('V0', { state: 'disabled' }, LEDGER);
    note(`V0 disabled (${result}); refund about ${before.balance} nAVAX`);
    if (result === 'sent') {
      await waitForPage(browser, 'Disable success', screen.getByRole('heading', 'Validator Disabled'));
      // The page links the tx that the wallet sent.
      await expect(screen.getByRole('link', 'View transaction in the explorer')).toHaveAttribute(
        'href',
        `/explorer/fuji/p-chain/tx/${send.txIds[0]}`,
      );
    }
  });

  test('audits the wallet sends', { timeout: 3 * 60_000 }, async ({ wallet }) => {
    const { signer } = wallet;
    // Every send of the run: the exact count per tx type, each one in the ledger and in TIER1_SENDS, no refusal, no
    // rejection left armed, and the caps. auditSends also turns off every capability of the signer.
    const { counts, problems } = expectedSends(readLedger(LEDGER), TIER1_SENDS);
    const audit = auditSends(signer, { ledgerPath: LEDGER, expect: counts, problems });
    note(`audit: ${audit.types.map((t) => `${t.txType} ${t.sent}`).join(', ')}`);
    // The one user rejection of the run: the first click of the top-up. The 25% check rejected nothing.
    expect(audit.userRejections, 'the user rejections of the run').toEqual(['avalanche_sendTransaction']);
  });
});
