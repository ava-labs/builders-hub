import { resolve } from 'node:path';
import { expect } from 'e2e';
import { parseEventLogs, type Address, type Hex } from 'viem';
import { POS_ERC20_SENDS, auditSends, expectedSends, requireOwnSigner } from './lib/audit.ts';
import {
  VALIDATOR_MANAGER_ABI,
  ValidatorStatus,
  cHasCode,
  chainShows,
  glacierL1Validators,
  hexToCb58,
  managerNodeValidationId,
  managerOwner,
  managerTotalWeight,
  managerValidator,
  pBalance,
  pL1Validator,
  pollUntil,
  sleep,
  validationIdToHex,
  waitForCTx,
  waitForGlacierSubnet,
  waitForPTx,
} from './lib/chain.ts';
import {
  busyThenIdle,
  clickNext,
  note,
  readStore,
  remountStep,
  toolHeading,
  waitForPage,
  waitForSend,
} from './lib/console.ts';
import {
  CHAIN_POLL,
  addValidatorFromJson,
  createL1Flow,
  deployFromButton,
  need,
  output,
  type ChainFixtures,
} from './lib/create-l1.ts';
import { describe, test } from './lib/fixtures.ts';
import { RUN_DIR, finishSend, readLedger, runIdFromEnv, sendOnce, upsertValidator } from './lib/ledger.ts';
import { createMockValidator, type MockValidator } from './lib/mock-validator.ts';
import {
  DEFAULT_ADMIN_ROLE,
  DelegatorStatus,
  MINTER_ROLE,
  ONE_TOKEN,
  STAKING_MANAGER_ABI,
  cCode,
  delegationIdOf,
  delegatorInfo,
  rewardBasisPoints,
  stakingSettings,
  stakingToken,
  stakingValidator,
  tokenAllowance,
  tokenBalance,
  tokenHasRole,
  tokenSymbol,
  tokenTotalSupply,
  waitForGlacierL1Chain,
} from './lib/pos-erc20-chain.ts';
import {
  expectHistoryRows,
  stakingDetailsHeader,
  waitForPosErc20Badge,
  waitForStoreValue,
} from './lib/pos-erc20-console.ts';
import { aggregateThenSend, completeOnManager, registerOnPChain } from './lib/validator-steps.ts';

// PoS-ERC20 staking on a fresh L1 whose Validator Manager runs on the Fuji C-Chain, made and run with the Console at
// build.avax.network. No node runs the L1: V0 and V1 are mock validators (lib/mock-validator.ts), and the Primary
// Network signs every Warp message for a C-Chain manager.
//
// Members 1 to 9 are the create flow of lib/create-l1.ts with the answer 'Proof of Stake (ERC20)'. Members 10 to 15
// are the six PoS steps of the same flow: the test token, the ERC20 staking manager (it reuses the ValidatorMessages
// library of member 3), the reward calculator, Initialize, MINTER_ROLE, and the ownership transfer. Then the staking
// tools: stake V1 with 1 token, delegate 1 token to V1, read the three read-only pages, remove the delegation,
// force-remove V1 and claim its delegation fees (0), and disable V0. The last member checks /console/history and
// audits every send of the wallet.
//
// The stake and the delegation use the test token, which has no value. The P-Chain holds 0.02 AVAX for V0 and 0.02 for
// V1 during the run; the removal of V1 and the disable of V0 refund both. teardown.ts disables what a stopped run left:
// it reads this file's ledger, chain/.run/pos.json.
//
// Each member checks the chain after its tx and skips a send that already landed (sendOnce). The group never
// retries; only lib/warp.ts retries a Warp delivery, which changes no state when it reverts.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   npm run test:chain -- --tag pos

const MIN = 60_000;
const runId = runIdFromEnv();
// The ledger of this file. Never the tier 1 default (chain/.run/ledger.json): one ledger holds one L1.
const POS_LEDGER = resolve(RUN_DIR, 'pos.json');

const flow = createL1Flow({
  validatorType: 'pos-erc20',
  ledgerPath: POS_LEDGER,
  runId,
  seedPrefix: 'pos-erc20',
  // The audit in the last member counts every send and refusal of the signer, so this file needs it to itself.
  beforeStart: ({ wallet }) => requireOwnSigner(wallet.signer, 'pos'),
});
const l1 = flow.state;

// The state of the staking members. The runner imports this file once for the serial group, so they share it.
const pos: {
  token?: Address;
  symbol?: string;
  /** The wallet's token balance after the deploy. The stake and the delegation come back to it. */
  tokenStart?: bigint;
  stakingManager?: Address;
  rewardCalculator?: Address;
  v1?: MockValidator;
  v1ValidationId?: string;
  delegationId?: Hex;
} = {};

const V0_WEIGHT = 100n;
// valueToWeight: weightToValueFactor is 1 token, so 1 token is weight 1.
const V1_WEIGHT = 1n;
const DELEGATION_WEIGHT = 1n;
const V1_BALANCE_AVAX = '0.02';
const V1_BALANCE_NAVAX = 20_000_000n;
const REWARD_BASIS_POINTS = 500n;
const MIN_DELEGATION_FEE_BIPS = 100;
// A refund check allows for the fee of the tx and the balance burned while it waited (512 nAVAX/s per validator).
const REFUND_SLACK_NAVAX = 2_000_000n;
// The Complete Delegation step shows nothing when the page has found the staking manager: it calls the manager
// address until then. After the manager-details load, wait this long before the click. lib/warp.ts retries an early
// click, which the contract refuses with no state change.
const STAKING_SETTLE_MS = 10_000;

const createStep = (key: string) => new RegExp(`/console/create-l1/${key}$`);
const ADD_STORE = 'v4-add-validator-store-testnet';
const DELEGATE_STORE = 'v4-delegate-store-testnet';
const UNDELEGATE_STORE = 'v4-remove-delegation-store-testnet';
const REMOVE_STORE = 'v4-remove-validator-store-testnet';
// The flows. A step URL can keep a query, so the patterns allow one.
const ADD_STEP = {
  initiate: /\/console\/add-validator\/initiate-registration(\?.*)?$/,
  pchain: /\/console\/add-validator\/pchain-registration(\?.*)?$/,
  complete: /\/console\/add-validator\/complete-registration(\?.*)?$/,
};
const DELEGATE_STEP = {
  select: '/console/permissionless-l1s/delegate/erc20/select-l1',
  initiate: /\/console\/permissionless-l1s\/delegate\/erc20\/initiate-delegation(\?.*)?$/,
  pchain: /\/console\/permissionless-l1s\/delegate\/erc20\/pchain-weight-update(\?.*)?$/,
  complete: /\/console\/permissionless-l1s\/delegate\/erc20\/complete-delegation(\?.*)?$/,
};
const UNDELEGATE_STEP = {
  select: '/console/permissionless-l1s/remove-delegation/select-l1',
  initiate: /\/console\/permissionless-l1s\/remove-delegation\/initiate-removal(\?.*)?$/,
  pchain: /\/console\/permissionless-l1s\/remove-delegation\/pchain-weight-update(\?.*)?$/,
  complete: /\/console\/permissionless-l1s\/remove-delegation\/complete-removal(\?.*)?$/,
};
const REMOVE_STEP = {
  initiate: /\/console\/remove-validator\/initiate-removal(\?.*)?$/,
  pchain: /\/console\/remove-validator\/pchain-removal(\?.*)?$/,
  complete: /\/console\/remove-validator\/complete-removal(\?.*)?$/,
  claim: /\/console\/remove-validator\/claim-fees(\?.*)?$/,
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The page shortens an address to its first 10 and last 6 characters. Case-insensitive: the stores keep the case
// that the receipt had.
const shortAddress = (address: string) =>
  new RegExp(`^${escapeRegExp(address.slice(0, 10))}\\.\\.\\.${escapeRegExp(address.slice(-6))}$`, 'i');
const exactAddress = (address: string) => new RegExp(`^${address}$`, 'i');
// The approve buttons name the token by its symbol, or 'tokens' before the page has read it.
const approveName = (symbol: string) => new RegExp(`^1\\. Approve 1 (${escapeRegExp(symbol)}|tokens)$`);
const approvedName = (symbol: string) => new RegExp(`^Approved \\(1 (${escapeRegExp(symbol)}|tokens)\\)$`);

const ZERO_HASH = /^0x0+$/;

// The P-Chain button in the header: the wallet connected again after a full load (lib/console-map.md, 1.2).
async function waitForWallet({ screen }: Pick<ChainFixtures, 'screen'>): Promise<void> {
  await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
}

// The validator flows read the validator list from Glacier once, when a step mounts (SelectValidationID.tsx).
async function waitForGlacierValidator(
  subnetId: string,
  validationId: string,
  label: string,
  check: (weight: number) => boolean = (weight) => weight > 0,
  includeInactive = true,
): Promise<number> {
  const { waitedMs } = await pollUntil(
    `Glacier lists ${label} of ${subnetId}`,
    async () =>
      (await glacierL1Validators(subnetId, { includeInactive })).some(
        (v) => v.validationId === validationId && check(v.weight),
      ),
    { timeoutMs: 10 * MIN, intervalMs: 5_000 },
  );
  note(`Glacier listed ${label} after ${Math.round(waitedMs / 1000)} s`);
  return waitedMs;
}

describe(
  'PoS-ERC20 L1, manager on the C-Chain, mock validators',
  { serial: true, retries: 0, tags: ['chain', 'pos'] },
  () => {
    for (const step of flow.steps) {
      test(step.title, { timeout: step.timeoutMs }, async ({ app, browser, screen, wallet }) =>
        step.run({ app, browser, screen, wallet }),
      );
    }

    test('deploys the ERC20 token', { timeout: 6 * MIN }, async ({ browser, screen, wallet }) => {
      const { signer } = wallet;
      await clickNext(screen, browser, createStep('deploy-erc20-token'));
      await expect(toolHeading(screen, 'Deploy Example ERC20 (Staking)')).toBeVisible();

      const { address: token, result } = await deployFromButton(
        { browser, screen, signer, ledgerPath: POS_LEDGER },
        'deploy-erc20-token',
        () => screen.getByRole('button', 'Deploy ERC20 Token').click(),
      );
      pos.token = token;
      if (result === 'sent') {
        await waitForPage(browser, 'Deploy ERC20 success', screen.getByRole('button', 'Redeploy'));
        await expect(screen.getByText(shortAddress(token)).first()).toBeVisible();
      }

      // The deployer holds the whole supply and administers the roles (ExampleERC20Mintable).
      const balance = await chainShows('the wallet holds the new token', async () => {
        const read = await tokenBalance(token, signer.address);
        return read > 0n ? read : null;
      });
      expect(balance).toBe(await tokenTotalSupply(token));
      expect(balance >= 2n * ONE_TOKEN, 'the wallet has 2 tokens for the stake and the delegation').toBe(true);
      expect(await tokenHasRole(token, DEFAULT_ADMIN_ROLE, signer.address)).toBe(true);
      pos.tokenStart = balance;
      pos.symbol = await tokenSymbol(token);
      note(`token ${token} (${pos.symbol}): the wallet holds ${balance / ONE_TOKEN} tokens`);
    });

    test('deploys the ERC20 staking manager', { timeout: 6 * MIN }, async ({ browser, screen, wallet }) => {
      const { signer } = wallet;
      const library = need(l1.validatorMessages, 'the ValidatorMessages library');
      await clickNext(screen, browser, createStep('deploy-erc20-staking'));
      await expect(toolHeading(screen, 'Deploy ERC20 Token Staking Manager')).toBeVisible();

      // The library of 'Deploy Validator Manager' is still in the toolbox store: its card is done and offers no
      // deploy, so this step sends one tx.
      await expect(screen.getByText(shortAddress(library)).first()).toBeVisible({ timeout: 60_000 });
      await expect(screen.getByRole('button', 'Deploy Library')).toHaveCount(0);
      const from = signer.sends.length;
      const { address: stakingManager, result } = await deployFromButton(
        { browser, screen, signer, ledgerPath: POS_LEDGER },
        'deploy-erc20-staking-manager',
        () => screen.getByRole('button', 'Deploy Staking Manager').click(),
      );
      pos.stakingManager = stakingManager;
      if (result === 'sent') {
        expect(signer.sends.length - from, 'one deploy: the library is reused').toBe(1);
        await expect(screen.getByRole('button', 'Redeploy')).toHaveCount(2, { timeout: 60_000 });
        await expect(screen.getByText(shortAddress(stakingManager)).first()).toBeVisible();
      }

      // The linker writes the library address into the code of the staking manager.
      expect((await cCode(stakingManager)).includes(library.slice(2).toLowerCase()), 'links the library').toBe(true);
      // Not initialized yet.
      expect((await stakingSettings(stakingManager)).minimumStakeAmount).toBe(0n);
    });

    test('deploys the reward calculator', { timeout: 6 * MIN }, async ({ browser, screen, wallet }) => {
      const { signer } = wallet;
      await clickNext(screen, browser, createStep('deploy-reward-calculator'));
      await expect(toolHeading(screen, 'Deploy Example Reward Calculator')).toBeVisible();
      // Keep the default rate of 500 basis points.
      await expect(screen.getByRole('spinbutton', 'Reward Rate (basis points)')).toHaveValue(
        REWARD_BASIS_POINTS.toString(),
      );

      const { address: calculator, result } = await deployFromButton(
        { browser, screen, signer, ledgerPath: POS_LEDGER },
        'deploy-reward-calculator',
        () => screen.getByRole('button', 'Deploy Reward Calculator').click(),
      );
      pos.rewardCalculator = calculator;
      if (result === 'sent') {
        await waitForPage(browser, 'Deploy Reward Calculator success', screen.getByText('@ 5% APR'));
        await expect(screen.getByText(shortAddress(calculator)).first()).toBeVisible();
      }
      expect(await cHasCode(calculator)).toBe(true);
      expect(await rewardBasisPoints(calculator)).toBe(REWARD_BASIS_POINTS);
    });

    test('initializes the staking manager', { timeout: 15 * MIN }, async ({ browser, screen, wallet }) => {
      const { signer } = wallet;
      const subnetId = need(l1.subnetId, 'the subnet ID');
      const blockchainId = need(l1.blockchainId, 'the blockchain ID');
      const proxy = need(l1.proxy, 'the proxy address');
      const token = need(pos.token, 'the token');
      const stakingManager = need(pos.stakingManager, 'the staking manager');
      const calculator = need(pos.rewardCalculator, 'the reward calculator');

      // The page takes the uptime chain from Glacier's record of the L1: its first chain. While Glacier lists no
      // chain, the page falls back to the manager's chain, the C-Chain (hooks/useVMCAddress.ts). Wait for Glacier.
      const { waitedMs: glacierLagMs } = await waitForGlacierL1Chain(subnetId, blockchainId, { timeoutMs: 10 * MIN });
      note(`Glacier listed chain ${blockchainId} on the L1 after ${Math.round(glacierLagMs / 1000)} s`);

      await clickNext(screen, browser, createStep('initialize-staking'));
      // This step renders the tool without its card, so there is no tool heading: check the step cards (h3).
      await expect(screen.getByRole('heading', 'Verify Contract Addresses', { level: 3 })).toBeVisible();
      await expect(screen.getByRole('heading', 'Configure Staking Parameters', { level: 3 })).toBeVisible();

      // The subnet field starts empty: the selected chain is the C-Chain, and the page skips the Primary Network.
      await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
      await waitForPage(
        browser,
        'Initialize staking manager details',
        screen.getByText(new RegExp(`^Validator Manager: ${proxy}$`, 'i')),
        90_000,
      );
      // 'L1 Blockchain (uptime)' shows the first 12 characters of the uptime chain.
      await expect(screen.getByText(`${blockchainId.slice(0, 12)}...`, { exact: true })).toBeVisible();
      // The addresses come from the toolbox store.
      await expect(screen.getByRole('textbox', 'ERC20 Token Staking Manager')).toHaveValue(
        exactAddress(stakingManager),
      );
      await expect(screen.getByRole('textbox', 'Reward Calculator')).toHaveValue(exactAddress(calculator));
      await expect(screen.getByRole('textbox', 'ERC20 Token Address')).toHaveValue(exactAddress(token));
      await waitForPage(browser, 'Initialize staking status', screen.getByText('Ready to initialize'), 60_000);

      // Minimum stake duration: the preset 'None' (0), so the test can remove V1 and the delegation at once. Minimum
      // delegation fee: the '1%' preset (100 bips); the '0%' preset reverts with InvalidDelegationFee. The helper texts
      // show the values.
      await screen.getByRole('button', 'None').click();
      await expect(screen.getByText(/^No minimum /)).toBeVisible();
      await screen.getByRole('button', '1%').click();
      await expect(screen.getByText(/^1\.00% /)).toBeVisible();

      const initialize = screen.getByRole('button', 'Initialize Contract');
      await expect(initialize).toBeEnabled();
      const from = signer.sends.length;
      const { result } = await sendOnce({
        step: 'initialize-staking-manager',
        chain: 'C',
        path: POS_LEDGER,
        inputs: { minimumStakeDuration: '0', minimumDelegationFeeBips: MIN_DELEGATION_FEE_BIPS },
        landed: async () => (await stakingSettings(stakingManager)).minimumStakeAmount > 0n,
        send: async () => {
          await initialize.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', {
            failed: busyThenIdle(initialize),
          });
          await waitForCTx(tx.hash as Hex);
          return { txIds: [tx.hash] };
        },
      });
      if (result === 'sent') {
        // The page's success is an amber notice, as on the manager's Initialize (UX finding C29).
        await waitForPage(browser, 'Initialize staking success', screen.getByText('Contract already initialized'));
      }

      const settings = await chainShows('the staking manager is initialized', async () => {
        const read = await stakingSettings(stakingManager);
        return read.minimumStakeAmount > 0n ? read : null;
      });
      expect(settings.manager).toBe(proxy);
      expect(settings.minimumStakeAmount).toBe(ONE_TOKEN);
      expect(settings.maximumStakeAmount).toBe(1_000_000n * ONE_TOKEN);
      expect(settings.minimumStakeDuration).toBe(0n);
      expect(settings.minimumDelegationFeeBips).toBe(MIN_DELEGATION_FEE_BIPS);
      expect(settings.maximumStakeMultiplier).toBe(10);
      expect(settings.weightToValueFactor).toBe(ONE_TOKEN);
      expect(settings.rewardCalculator).toBe(calculator);
      // The uptime chain is the new L1, not the C-Chain.
      expect(settings.uptimeBlockchainID).toBe(validationIdToHex(blockchainId));
      expect(await stakingToken(stakingManager)).toBe(token);
    });

    test('enables minting for the staking manager', { timeout: 6 * MIN }, async ({ browser, screen, wallet }) => {
      const { signer } = wallet;
      const token = need(pos.token, 'the token');
      const stakingManager = need(pos.stakingManager, 'the staking manager');
      await clickNext(screen, browser, createStep('enable-minting'));
      // This step renders the tool without its card: check the step card (h3).
      await expect(screen.getByRole('heading', 'Grant MINTER_ROLE to Staking Manager', { level: 3 })).toBeVisible();
      // Both addresses come from the toolbox store.
      await expect(screen.getByRole('textbox', 'Staking Manager Address')).toHaveValue(exactAddress(stakingManager));
      await expect(screen.getByRole('textbox', 'ERC20 Token Address')).toHaveValue(exactAddress(token));

      const grant = screen.getByRole('button', 'Grant MINTER_ROLE');
      const from = signer.sends.length;
      const { result } = await sendOnce({
        step: 'enable-minting',
        chain: 'C',
        path: POS_LEDGER,
        landed: () => tokenHasRole(token, MINTER_ROLE, stakingManager),
        send: async () => {
          await grant.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(grant) });
          await waitForCTx(tx.hash as Hex);
          return { txIds: [tx.hash] };
        },
      });
      if (result === 'sent') {
        await waitForPage(browser, 'Grant MINTER_ROLE success', screen.getByText('MINTER_ROLE granted successfully'));
      }
      await expect.poll(() => tokenHasRole(token, MINTER_ROLE, stakingManager), CHAIN_POLL).toBe(true);
    });

    test(
      'transfers the validator manager ownership to the staking manager',
      { timeout: 6 * MIN },
      async ({ browser, screen, wallet }) => {
        const { signer } = wallet;
        const subnetId = need(l1.subnetId, 'the subnet ID');
        const proxy = need(l1.proxy, 'the proxy address');
        const stakingManager = need(pos.stakingManager, 'the staking manager');
        await clickNext(screen, browser, createStep('transfer-to-staking'));
        await expect(toolHeading(screen, 'Transfer Ownership to Staking Manager')).toBeVisible();

        // 'New Owner Address' comes from the toolbox store; the page checks that it is a staking manager.
        await expect(screen.getByRole('textbox', 'New Owner Address')).toHaveValue(exactAddress(stakingManager));
        await expect(screen.getByText(/^Detected: StakingManager$/)).toBeVisible({ timeout: 60_000 });
        // The subnet field starts empty, and 'Transfer Ownership' stays disabled until the page has the manager from
        // Glacier. Do not click 'Redeploy' on an earlier step: it clears the stored addresses that this step and
        // Initialize read.
        await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
        const transfer = screen.getByRole('button', 'Transfer Ownership');
        await expect(transfer).toBeEnabled({ timeout: 90_000 });

        const from = signer.sends.length;
        const { result, send } = await sendOnce({
          step: 'transfer-ownership',
          chain: 'C',
          path: POS_LEDGER,
          inputs: { newOwner: stakingManager },
          landed: async () => (await managerOwner(proxy)) === stakingManager,
          send: async () => {
            await transfer.click();
            const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', {
              failed: busyThenIdle(transfer),
            });
            await waitForCTx(tx.hash as Hex);
            return { txIds: [tx.hash] };
          },
        });
        if (result === 'sent') {
          // The page shows the tx hash under 'Transaction Hash'.
          await waitForPage(browser, 'Transfer Ownership success', screen.getByText(send.txIds[0], { exact: true }));
        }
        await expect.poll(() => managerOwner(proxy), CHAIN_POLL).toBe(stakingManager);
      },
    );

    test('stakes mock validator V1 with 1 token', { timeout: 30 * MIN }, async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      const subnetId = need(l1.subnetId, 'the subnet ID');
      const proxy = need(l1.proxy, 'the proxy address');
      const token = need(pos.token, 'the token');
      const symbol = need(pos.symbol, 'the token symbol');
      const tokenStart = need(pos.tokenStart, 'the token balance');
      const stakingManager = need(pos.stakingManager, 'the staking manager');
      const v1 = createMockValidator({ label: 'V1', seed: `${runId} pos-erc20 V1` });
      pos.v1 = v1;
      upsertValidator(
        'V1',
        { nodeId: v1.nodeID, subnetId, weight: V1_WEIGHT.toString(), blsPublicKey: v1.publicKey },
        POS_LEDGER,
      );

      // The flow reads the manager from Glacier's record of the L1 (hooks/useVMCAddress.ts).
      const { waitedMs: glacierLagMs } = await waitForGlacierSubnet(subnetId, { converted: true });

      // 1. Select L1. The query sets the L1, and the flow store keeps it for the later steps. The badge shows
      // once the page has found the ERC20 staking manager.
      await app.open(`/console/add-validator/select-subnet?subnetId=${subnetId}`);
      await waitForWallet({ screen });
      await expect(screen.getByRole('heading', 'Select L1')).toBeVisible();
      await waitForPosErc20Badge(screen);
      await expect(stakingDetailsHeader(screen)).toBeVisible({ timeout: 60_000 });
      await clickNext(screen, browser, ADD_STEP.initiate);

      // 2. Initiate Validator Registration: the ERC20 stake form.
      await waitForPosErc20Badge(screen);
      await addValidatorFromJson(screen, v1);
      // PoS hides 'Consensus Weight': the stake sets the weight.
      await expect(screen.getByRole('spinbutton', 'Consensus Weight')).toHaveCount(0);
      const balance = screen.getByRole('spinbutton', 'Validator Balance (P-Chain AVAX)');
      await balance.fill(V1_BALANCE_AVAX);
      await expect(balance).toHaveValue(V1_BALANCE_AVAX);
      // The form fills the contract minimums: stake 1 token, delegation fee 100 bips, duration 0 s. The helper texts
      // show them. The page text has an em dash (an escape).
      await expect(screen.getByText(/^Min: 1 \u2014 Max: 1000000$/)).toBeVisible({ timeout: 60_000 });
      await expect(screen.getByText(`Min: ${MIN_DELEGATION_FEE_BIPS} bips (1%)`, { exact: true })).toBeVisible();
      await expect(screen.getByText('Min: 0s', { exact: true })).toBeVisible();

      // Approve 1 token for the staking manager.
      const approve = screen.getByRole('button', approveName(symbol));
      await expect(approve).toBeEnabled({ timeout: 60_000 });
      let from = signer.sends.length;
      const { result: approved } = await sendOnce({
        step: 'stake-v1-approve',
        chain: 'C',
        path: POS_LEDGER,
        inputs: { spender: stakingManager, amount: ONE_TOKEN.toString() },
        landed: async () => (await tokenAllowance(token, signer.address, stakingManager)) >= ONE_TOKEN,
        send: async () => {
          await approve.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(approve) });
          await waitForCTx(tx.hash as Hex);
          return { txIds: [tx.hash] };
        },
      });
      if (approved === 'sent') {
        await waitForPage(browser, 'Approve success', screen.getByRole('button', approvedName(symbol)));
      }
      await expect.poll(() => tokenAllowance(token, signer.address, stakingManager), CHAIN_POLL).toBe(ONE_TOKEN);

      // Initiate the registration: the staking manager takes the token and asks the manager for weight 1.
      const initiate = screen.getByRole('button', '2. Initiate Validator Registration');
      await expect(initiate).toBeEnabled({ timeout: 60_000 });
      from = signer.sends.length;
      const { result: initiatedResult, send: initiated } = await sendOnce({
        step: 'stake-v1-initiate',
        chain: 'C',
        path: POS_LEDGER,
        inputs: {
          nodeId: v1.nodeID,
          stake: ONE_TOKEN.toString(),
          balance: V1_BALANCE_NAVAX.toString(),
          delegationFeeBips: MIN_DELEGATION_FEE_BIPS,
          minStakeDuration: '0',
        },
        landed: async () => !ZERO_HASH.test(await managerNodeValidationId(proxy, v1.nodeID)),
        send: async () => {
          await initiate.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', {
            failed: busyThenIdle(initiate),
          });
          const receipt = await waitForCTx(tx.hash as Hex);
          const [registration] = parseEventLogs({
            abi: VALIDATOR_MANAGER_ABI,
            logs: receipt.logs,
            eventName: 'InitiatedValidatorRegistration',
          });
          const [staking] = parseEventLogs({
            abi: STAKING_MANAGER_ABI,
            logs: receipt.logs,
            eventName: 'InitiatedStakingValidatorRegistration',
          });
          if (!registration || !staking) throw new Error(`${tx.hash} emitted no registration of V1.`);
          return {
            txIds: [tx.hash],
            outputs: {
              validationId: hexToCb58(registration.args.validationID),
              weight: registration.args.weight.toString(),
              blockNumber: receipt.blockNumber.toString(),
              registrationExpiry: registration.args.registrationExpiry.toString(),
              owner: staking.args.owner,
              delegationFeeBips: staking.args.delegationFeeBips.toString(),
              minStakeDuration: staking.args.minStakeDuration.toString(),
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
      finishSend('stake-v1-initiate', { status: 'landed', glacierLagMs }, POS_LEDGER);
      // The page never shows the validation ID (its log lookup matches a topic by name): read it from the manager.
      const v1ValidationId = hexToCb58(
        await chainShows('the manager maps V1 to a validation ID', async () => {
          const id = await managerNodeValidationId(proxy, v1.nodeID);
          return ZERO_HASH.test(id) ? null : id;
        }),
      );
      pos.v1ValidationId = v1ValidationId;
      expect(v1ValidationId).toBe(output(initiated, 'validationId'));
      expect(output(initiated, 'weight')).toBe(V1_WEIGHT.toString());
      expect(output(initiated, 'owner')).toBe(signer.address);
      expect(output(initiated, 'delegationFeeBips')).toBe(String(MIN_DELEGATION_FEE_BIPS));
      expect(output(initiated, 'minStakeDuration')).toBe('0');
      upsertValidator(
        'V1',
        {
          validationId: v1ValidationId,
          balance: V1_BALANCE_NAVAX.toString(),
          blockNumber: output(initiated, 'blockNumber'),
          registrationExpiry: output(initiated, 'registrationExpiry'),
          state: 'initiated',
        },
        POS_LEDGER,
      );
      note(`V1 initiated: ${v1ValidationId}`);
      if (initiatedResult === 'sent') {
        // The page's success: the store holds the tx hash, and the button is done.
        await waitForStoreValue(browser, ADD_STORE, 'evmTxHash', initiated.txIds[0]);
        await expect(initiate).toBeDisabled();
      }
      const pending = await managerValidator(proxy, v1ValidationId);
      expect(pending.status).toBe(ValidatorStatus.PendingAdded);
      expect(pending.weight).toBe(V1_WEIGHT);
      const posInfo = await stakingValidator(stakingManager, v1ValidationId);
      expect(posInfo.owner).toBe(signer.address);
      expect(posInfo.delegationFeeBips).toBe(MIN_DELEGATION_FEE_BIPS);
      expect(posInfo.minStakeDuration).toBe(0n);
      // The stake left the wallet for the staking manager.
      await expect.poll(() => tokenBalance(token, signer.address), CHAIN_POLL).toBe(tokenStart - ONE_TOKEN);
      expect(await tokenBalance(token, stakingManager)).toBe(ONE_TOKEN);

      // 3. P-Chain Registration: one button aggregates and sends the RegisterL1ValidatorTx with 0.02 AVAX.
      await clickNext(screen, browser, ADD_STEP.pchain);
      const registerTxId = await registerOnPChain({
        browser,
        screen,
        signer,
        ledgerPath: POS_LEDGER,
        step: 'stake-v1-register',
        label: 'Register V1 on the P-Chain',
        storeKey: ADD_STORE,
        landed: async () => (await pL1Validator(v1ValidationId)) !== null,
        // 'Sign & Submit to P-Chain' is enabled once the manager details and the signing subnet have loaded.
        ready: async () => {
          await waitForPosErc20Badge(screen);
          await expect(screen.getByText('Initial Balance:')).toBeVisible({ timeout: 60_000 });
          await expect(screen.getByText(`${V1_BALANCE_AVAX} AVAX`, { exact: true })).toBeVisible();
        },
      });
      const registered = await chainShows('the P-Chain lists V1', () => pL1Validator(v1ValidationId));
      expect(registered.nodeId).toBe(v1.nodeID);
      expect(registered.weight).toBe(V1_WEIGHT);
      expect(registered.balance > 0n && registered.balance <= V1_BALANCE_NAVAX).toBe(true);
      expect(registered.remainingBalanceOwner.addresses).toEqual([signer.pChainAddress]);
      expect(registered.deactivationOwner.addresses).toEqual([signer.pChainAddress]);

      // 4. Complete Registration (C-Chain): the staking manager completes it on the manager.
      await clickNext(screen, browser, ADD_STEP.complete);
      await waitForPosErc20Badge(screen);
      await expect(screen.getByRole('textbox', 'P-Chain Transaction ID')).toHaveValue(registerTxId);
      const attempts = await completeOnManager({
        browser,
        screen,
        signer,
        ledgerPath: POS_LEDGER,
        step: 'stake-v1-complete',
        label: 'Complete V1 registration',
        button: 'Complete Validator Registration',
        done: screen.getByText('Registration completed'),
        landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.Active,
        ready: () => waitForPosErc20Badge(screen),
      });
      note(`V1 registration completed in ${attempts} attempt(s)`);
      if (attempts > 0) {
        await expect(
          screen.getByText('Your validator is now registered and active on the L1.', { exact: false }),
        ).toBeVisible();
      }
      const active = await managerValidator(proxy, v1ValidationId);
      expect(active.status).toBe(ValidatorStatus.Active);
      expect(active.weight).toBe(V1_WEIGHT);
      await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_WEIGHT);
      upsertValidator('V1', { state: 'registered' }, POS_LEDGER);
    });

    test('delegates 1 token to V1', { timeout: 30 * MIN }, async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      const subnetId = need(l1.subnetId, 'the subnet ID');
      const proxy = need(l1.proxy, 'the proxy address');
      const token = need(pos.token, 'the token');
      const symbol = need(pos.symbol, 'the token symbol');
      const tokenStart = need(pos.tokenStart, 'the token balance');
      const stakingManager = need(pos.stakingManager, 'the staking manager');
      const v1 = need(pos.v1, 'mock validator V1');
      const v1ValidationId = need(pos.v1ValidationId, 'the V1 validation ID');

      // The Validation ID field suggests the validators of Glacier's list, read once when the step mounts.
      const glacierLagMs = await waitForGlacierValidator(subnetId, v1ValidationId, 'V1');

      // 1. Select L1. The flow takes no subnetId query: type the subnet.
      await app.open(DELEGATE_STEP.select);
      await waitForWallet({ screen });
      await expect(screen.getByRole('heading', 'Select L1')).toBeVisible();
      await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
      await expect(stakingDetailsHeader(screen)).toBeVisible({ timeout: 90_000 });
      await clickNext(screen, browser, DELEGATE_STEP.initiate);

      // 2. Initiate Delegation. Each validator of the L1 is a button under 'Validation ID'; the picked one is pressed.
      const v1Choice = screen.getByRole('button', new RegExp(`^${v1.nodeID}`));
      await v1Choice.click({ timeout: 90_000 });
      await expect(v1Choice).toHaveAttribute('aria-pressed', 'true');
      await expect(screen.getByText(new RegExp(`^Validator: ${v1.nodeID}$`))).toBeVisible();
      await screen.getByRole('spinbutton', 'Delegation Amount').fill('1');
      await expect(screen.getByText('Min: 1 · Max: 1000000', { exact: true })).toBeVisible({ timeout: 60_000 });
      // The approve button shows once the page has the token of the staking manager.
      const approve = screen.getByRole('button', approveName(symbol));
      await expect(approve).toBeEnabled({ timeout: 90_000 });
      let from = signer.sends.length;
      const { result: approved } = await sendOnce({
        step: 'delegate-approve',
        chain: 'C',
        path: POS_LEDGER,
        inputs: { spender: stakingManager, amount: ONE_TOKEN.toString() },
        landed: async () => (await tokenAllowance(token, signer.address, stakingManager)) >= ONE_TOKEN,
        send: async () => {
          await approve.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(approve) });
          await waitForCTx(tx.hash as Hex);
          return { txIds: [tx.hash] };
        },
      });
      if (approved === 'sent') {
        await waitForPage(browser, 'Approve success', screen.getByRole('button', approvedName(symbol)));
      }

      const initiate = screen.getByRole('button', '2. Initiate Delegation');
      await expect(initiate).toBeEnabled({ timeout: 60_000 });
      from = signer.sends.length;
      const { result: initiatedResult, send: initiated } = await sendOnce({
        step: 'delegate-initiate',
        chain: 'C',
        path: POS_LEDGER,
        inputs: { validationId: v1ValidationId, amount: ONE_TOKEN.toString() },
        landed: async () => (await managerValidator(proxy, v1ValidationId)).weight === V1_WEIGHT + DELEGATION_WEIGHT,
        send: async () => {
          await initiate.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', {
            failed: busyThenIdle(initiate),
          });
          const receipt = await waitForCTx(tx.hash as Hex);
          const [event] = parseEventLogs({
            abi: STAKING_MANAGER_ABI,
            logs: receipt.logs,
            eventName: 'InitiatedDelegatorRegistration',
          });
          if (!event) throw new Error(`${tx.hash} emitted no InitiatedDelegatorRegistration.`);
          return {
            txIds: [tx.hash],
            outputs: {
              delegationId: event.args.delegationID,
              nonce: event.args.nonce.toString(),
              validatorWeight: event.args.validatorWeight.toString(),
              delegatorWeight: event.args.delegatorWeight.toString(),
              delegator: event.args.delegatorAddress,
            },
          };
        },
      });
      finishSend('delegate-initiate', { status: 'landed', glacierLagMs }, POS_LEDGER);
      const delegationId = output(initiated, 'delegationId') as Hex;
      pos.delegationId = delegationId;
      // The staking manager names the delegation keccak256(validationID, nonce).
      expect(delegationId).toBe(delegationIdOf(v1ValidationId, BigInt(output(initiated, 'nonce'))));
      expect(output(initiated, 'validatorWeight')).toBe((V1_WEIGHT + DELEGATION_WEIGHT).toString());
      expect(output(initiated, 'delegatorWeight')).toBe(DELEGATION_WEIGHT.toString());
      expect(output(initiated, 'delegator')).toBe(signer.address);
      note(`delegation ${delegationId}`);
      if (initiatedResult === 'sent') {
        await waitForPage(browser, 'Initiate Delegation success', screen.getByText(delegationId, { exact: true }));
        await waitForStoreValue(browser, DELEGATE_STORE, 'evmTxHash', initiated.txIds[0]);
        await waitForStoreValue(browser, DELEGATE_STORE, 'delegationID', delegationId);
      }
      const pendingDelegation = await delegatorInfo(stakingManager, delegationId);
      expect(pendingDelegation.status).toBe(DelegatorStatus.PendingAdded);
      expect(pendingDelegation.owner).toBe(signer.address);
      expect(pendingDelegation.validationID).toBe(validationIdToHex(v1ValidationId));
      expect(pendingDelegation.weight).toBe(DELEGATION_WEIGHT);
      // The manager waits for the P-Chain: it sent a weight message that the P-Chain has not confirmed yet.
      const sentWeight = await managerValidator(proxy, v1ValidationId);
      expect(sentWeight.weight).toBe(V1_WEIGHT + DELEGATION_WEIGHT);
      expect(sentWeight.sentNonce > sentWeight.receivedNonce).toBe(true);
      await expect.poll(() => tokenBalance(token, signer.address), CHAIN_POLL).toBe(tokenStart - 2n * ONE_TOKEN);

      // 3. P-Chain Weight Update. No badge on this step: 'Aggregate Signatures' is enabled once the manager details
      // and the signing subnet have loaded.
      await clickNext(screen, browser, DELEGATE_STEP.pchain);
      await expect(screen.getByRole('textbox', 'Initiate Delegation Transaction Hash')).toHaveValue(initiated.txIds[0]);
      await aggregateThenSend({
        browser,
        screen,
        signer,
        ledgerPath: POS_LEDGER,
        step: 'delegate-pchain',
        chain: 'P',
        label: 'Set V1 weight 2 on the P-Chain',
        landed: async () => (await pL1Validator(v1ValidationId))?.weight === V1_WEIGHT + DELEGATION_WEIGHT,
        beforeRetry: () => remountStep(screen, browser, DELEGATE_STEP.pchain),
        button: 'Submit to P-Chain',
        txType: 'pvm.SetL1ValidatorWeightTx',
        done: /^P-Chain tx confirmed:/,
      });
      await chainShows(
        'the P-Chain holds weight 2 for V1',
        async () => (await pL1Validator(v1ValidationId))?.weight === V1_WEIGHT + DELEGATION_WEIGHT,
      );
      const weightTxId = String((await readStore(browser, DELEGATE_STORE)).pChainTxId ?? '');
      expect(weightTxId).not.toBe('');

      // 4. Complete Delegation. The step shows no badge and nothing that tells when the page has found the staking
      // manager: wait until 'Complete Delegation' is enabled (the manager details have loaded), then
      // STAKING_SETTLE_MS.
      await clickNext(screen, browser, DELEGATE_STEP.complete);
      // Both fields come from the store.
      await expect(screen.getByRole('textbox', 'Delegation ID')).toHaveValue(delegationId);
      await expect(screen.getByRole('textbox', 'P-Chain Transaction ID')).toHaveValue(weightTxId);
      const attempts = await completeOnManager({
        browser,
        screen,
        signer,
        ledgerPath: POS_LEDGER,
        step: 'delegate-complete',
        label: 'Complete the delegation',
        button: 'Complete Delegation',
        done: screen.getByText(/Your delegation is now active\./),
        landed: async () => (await delegatorInfo(stakingManager, delegationId)).status === DelegatorStatus.Active,
        ready: async () => {
          await expect(screen.getByRole('button', 'Complete Delegation')).toBeEnabled({ timeout: 90_000 });
          await sleep(STAKING_SETTLE_MS);
        },
        // A try that failed in the page keeps its error: mount the step again for a clean try.
        beforeRetry: () => remountStep(screen, browser, DELEGATE_STEP.complete),
      });
      note(`delegation completed in ${attempts} attempt(s)`);
      const activeDelegation = await delegatorInfo(stakingManager, delegationId);
      expect(activeDelegation.status).toBe(DelegatorStatus.Active);
      expect(activeDelegation.startTime > 0n).toBe(true);
      const settled = await managerValidator(proxy, v1ValidationId);
      expect(settled.receivedNonce).toBe(settled.sentNonce);
      expect(settled.weight).toBe(V1_WEIGHT + DELEGATION_WEIGHT);
      await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_WEIGHT + DELEGATION_WEIGHT);
    });

    test(
      'shows V0, V1 and the delegation on the read-only pages',
      { timeout: 15 * MIN },
      async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        const subnetId = need(l1.subnetId, 'the subnet ID');
        const blockchainId = need(l1.blockchainId, 'the blockchain ID');
        const v0 = need(l1.v0, 'mock validator V0');
        const v0ValidationId = need(l1.v0ValidationId, 'the V0 validation ID');
        const token = need(pos.token, 'the token');
        const stakingManager = need(pos.stakingManager, 'the staking manager');
        const calculator = need(pos.rewardCalculator, 'the reward calculator');
        const v1 = need(pos.v1, 'mock validator V1');
        const v1ValidationId = need(pos.v1ValidationId, 'the V1 validation ID');
        const delegationId = need(pos.delegationId, 'the delegation ID');
        const totalWeight = V0_WEIGHT + V1_WEIGHT + DELEGATION_WEIGHT;

        // The pages list the active validators from Glacier: wait until it has the delegation's weight.
        await waitForGlacierValidator(subnetId, v0ValidationId, 'V0', (w) => w === Number(V0_WEIGHT), false);
        await waitForGlacierValidator(
          subnetId,
          v1ValidationId,
          'V1 with the delegation',
          (w) => w === Number(V1_WEIGHT + DELEGATION_WEIGHT),
          false,
        );

        // a. Query Staking (/console/permissionless-l1s/query-staking). The stake column shows weightToValue.
        await app.open('/console/permissionless-l1s/query-staking');
        await waitForWallet({ screen });
        await expect(toolHeading(screen, 'PoS Staking Info')).toBeVisible();
        await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
        await expect(
          screen.getByText('This is a PoS L1 - staking details will be fetched from the StakingManager contract.'),
        ).toBeVisible({ timeout: 90_000 });
        const fetchInfo = screen.getByRole('button', 'Fetch Staking Info');
        await expect(fetchInfo).toBeEnabled({ timeout: 60_000 });
        await fetchInfo.click();
        await expect(screen.getByRole('heading', 'Validator List')).toBeVisible({ timeout: 90_000 });
        // A row shows the first 14 characters of the NodeID.
        const row = (v: MockValidator) =>
          screen.getByRole('row').filter({ hasText: `${v.nodeID.substring(0, 14)}...` });
        await expect(row(v0).getByRole('cell', '100.00 tokens')).toBeVisible({ timeout: 60_000 });
        await expect(row(v0).getByText('Genesis Validator', { exact: true })).toBeVisible();
        await expect(row(v0).getByRole('cell', 'Active')).toBeVisible();
        await expect(row(v1).getByRole('cell', '2.00 tokens')).toBeVisible();
        await expect(row(v1).getByRole('cell', '1.00%')).toBeVisible();
        await expect(row(v1).getByRole('cell', 'Active')).toBeVisible();
        await row(v1).getByRole('button', 'Details').click();
        await expect(screen.getByRole('heading', 'Validator Details')).toBeVisible();
        await expect(screen.getByText(v1ValidationId, { exact: true })).toBeVisible();
        await expect(screen.getByText(exactAddress(signer.address))).toBeVisible();

        // The delegations tab reads InitiatedDelegatorRegistration logs of the whole chain. Its event has no
        // rewardRecipient field (QueryPoSValidatorSet.tsx), so its topic is not the staking manager's, and the tab
        // lists nothing. A known bug: E2E_KNOWN_BUGS=1 turns the note into a check.
        await screen.getByRole('button', /^My Delegations/).click();
        await expect(screen.getByRole('heading', 'Your Delegations')).toBeVisible();
        const delegationRow = screen.getByRole('row').filter({ hasText: `${delegationId.substring(0, 10)}...` });
        const listed = await pollUntil(
          'the delegations tab settles',
          async () =>
            (await delegationRow.count()) > 0
              ? 'listed'
              : (await screen.getByText(/^You don.t have any delegations on this L1$/).isVisible())
                ? 'empty'
                : null,
          { timeoutMs: 90_000, intervalMs: 2_000 },
        ).then(
          ({ value }) => value,
          (error: unknown) => `not settled (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`,
        );
        note(`Query Staking, My Delegations: ${listed}`);
        if (process.env.E2E_KNOWN_BUGS) {
          await expect(delegationRow.getByRole('cell', 'Active')).toBeVisible();
        }

        // b. L1 Validators (/console/layer-1/validator-set): the active validators with their share of the weight.
        await app.open('/console/layer-1/validator-set');
        await waitForWallet({ screen });
        await expect(toolHeading(screen, 'L1 Validators')).toBeVisible();
        await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
        await expect(screen.getByText(`Total weight: ${totalWeight}`, { exact: true })).toBeVisible({
          timeout: 90_000,
        });
        // 100 of 102 is 98.0 %, 2 of 102 is 2.0 %.
        await expect(screen.getByRole('button', new RegExp(`^${v0.nodeID}\\s*98\\.0%$`))).toBeVisible();
        const v1Row = screen.getByRole('button', new RegExp(`^${v1.nodeID}\\s*2\\.0%$`));
        await expect(v1Row).toBeVisible();
        await v1Row.click();
        await expect(screen.getByText(v1ValidationId, { exact: true })).toBeVisible();
        // The manager details: the staking manager owns the manager. A row's value is a button named by the value.
        await expect(screen.getByText('StakingManager', { exact: true })).toBeVisible({ timeout: 60_000 });
        await expect(screen.getByRole('button', exactAddress(stakingManager))).toBeVisible();
        await expect(screen.getByRole('button', totalWeight.toString())).toBeVisible();

        // c. The ERC20 read-contract page of the staking manager setup: the staking settings and the addresses.
        await app.open('/console/permissionless-l1s/erc20-staking-manager-setup/read-contract');
        await waitForWallet({ screen });
        await screen.getByRole('textbox', 'L1 (Subnet ID)').fill(subnetId);
        await expect(stakingDetailsHeader(screen)).toBeVisible({ timeout: 90_000 });
        await expect(screen.getByRole('button', exactAddress(token))).toBeVisible();
        await expect(screen.getByRole('button', exactAddress(stakingManager))).toBeVisible();
        await expect(screen.getByRole('button', exactAddress(calculator))).toBeVisible();
        // 'Uptime Chain' is the new L1.
        await expect(screen.getByRole('button', blockchainId)).toBeVisible();
        await expect(screen.getByRole('button', totalWeight.toString())).toBeVisible();
        // The settings tiles. A value can show twice on the page (a tile and a row), so take the first.
        for (const value of ['1000000', 'None', '1%', '10x', '1 tokens/weight']) {
          await expect(screen.getByText(value, { exact: true }).first()).toBeVisible();
        }
      },
    );

    test('removes the delegation', { timeout: 30 * MIN }, async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      const subnetId = need(l1.subnetId, 'the subnet ID');
      const proxy = need(l1.proxy, 'the proxy address');
      const token = need(pos.token, 'the token');
      const tokenStart = need(pos.tokenStart, 'the token balance');
      const stakingManager = need(pos.stakingManager, 'the staking manager');
      const v1ValidationId = need(pos.v1ValidationId, 'the V1 validation ID');
      const delegationId = need(pos.delegationId, 'the delegation ID');

      // 1. Select L1. The flow takes no subnetId query: type the subnet.
      await app.open(UNDELEGATE_STEP.select);
      await waitForWallet({ screen });
      await expect(screen.getByRole('heading', 'Select L1')).toBeVisible();
      await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
      await expect(stakingDetailsHeader(screen)).toBeVisible({ timeout: 90_000 });
      await clickNext(screen, browser, UNDELEGATE_STEP.initiate);

      // 2. Initiate Delegator Removal. The suggestions come from eth_getLogs over the whole chain, which the public
      // RPC can refuse: type the ID. The card 'Delegation Information (ERC20 Token Staking)' shows once the page has
      // the staking manager.
      await screen.getByRole('textbox', 'Delegation ID').fill(delegationId, { timeout: 90_000 });
      await expect(screen.getByRole('heading', 'Delegation Information (ERC20 Token Staking)')).toBeVisible({
        timeout: 90_000,
      });
      await expect(screen.getByText(/^Status: Active$/)).toBeVisible();
      const initiate = screen.getByRole('button', 'Initiate Delegator Removal');
      await expect(initiate).toBeEnabled({ timeout: 60_000 });
      const from = signer.sends.length;
      const { result: initiatedResult, send: initiated } = await sendOnce({
        step: 'undelegate-initiate',
        chain: 'C',
        path: POS_LEDGER,
        inputs: { delegationId },
        landed: async () => {
          const { status } = await delegatorInfo(stakingManager, delegationId);
          return status === DelegatorStatus.PendingRemoved || status === DelegatorStatus.Unknown;
        },
        send: async () => {
          await initiate.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', {
            failed: busyThenIdle(initiate),
          });
          const receipt = await waitForCTx(tx.hash as Hex);
          const [event] = parseEventLogs({
            abi: STAKING_MANAGER_ABI,
            logs: receipt.logs,
            eventName: 'InitiatedDelegatorRemoval',
          });
          if (event?.args.delegationID !== delegationId) {
            throw new Error(`${tx.hash} emitted no InitiatedDelegatorRemoval for ${delegationId}.`);
          }
          return { txIds: [tx.hash] };
        },
      });
      if (initiatedResult === 'sent') {
        // The page shows no success: the store holds the tx hash, and the button is done.
        await waitForStoreValue(browser, UNDELEGATE_STORE, 'evmTxHash', initiated.txIds[0]);
        await expect(initiate).toBeDisabled();
      }
      expect((await delegatorInfo(stakingManager, delegationId)).status).toBe(DelegatorStatus.PendingRemoved);
      const sentWeight = await managerValidator(proxy, v1ValidationId);
      expect(sentWeight.weight).toBe(V1_WEIGHT);
      expect(sentWeight.sentNonce > sentWeight.receivedNonce).toBe(true);

      // 3. P-Chain Weight Update: V1 goes back to weight 1. No badge: 'Aggregate Signatures' is enabled once the
      // manager details have loaded.
      await clickNext(screen, browser, UNDELEGATE_STEP.pchain);
      await expect(screen.getByRole('textbox', 'Initiate Removal Transaction Hash')).toHaveValue(initiated.txIds[0]);
      await aggregateThenSend({
        browser,
        screen,
        signer,
        ledgerPath: POS_LEDGER,
        step: 'undelegate-pchain',
        chain: 'P',
        label: 'Set V1 weight 1 on the P-Chain',
        landed: async () => (await pL1Validator(v1ValidationId))?.weight === V1_WEIGHT,
        beforeRetry: () => remountStep(screen, browser, UNDELEGATE_STEP.pchain),
        button: 'Submit to P-Chain',
        txType: 'pvm.SetL1ValidatorWeightTx',
        done: /^P-Chain tx confirmed:/,
      });
      await chainShows(
        'the P-Chain holds weight 1 for V1',
        async () => (await pL1Validator(v1ValidationId))?.weight === V1_WEIGHT,
      );
      const weightTxId = String((await readStore(browser, UNDELEGATE_STORE)).pChainTxId ?? '');
      expect(weightTxId).not.toBe('');

      // 4. Complete Delegator Removal. The card 'Complete Removal (ERC20 Token Staking)' shows once the page has the
      // staking manager. The page shows no success (its event check matches a topic by name): after the tx the
      // button stays disabled.
      await clickNext(screen, browser, UNDELEGATE_STEP.complete);
      const completeReady = async () => {
        await expect(screen.getByRole('heading', 'Complete Removal (ERC20 Token Staking)')).toBeVisible({
          timeout: 90_000,
        });
        await expect(screen.getByRole('textbox', 'P-Chain Transaction ID')).toHaveValue(weightTxId);
      };
      const removedAt = signer.sends.length;
      const attempts = await completeOnManager({
        browser,
        screen,
        signer,
        ledgerPath: POS_LEDGER,
        step: 'undelegate-complete',
        label: 'Complete the delegator removal',
        button: 'Complete Delegator Removal & Receive Rewards',
        done: screen.getByRole('button', 'Complete Delegator Removal & Receive Rewards', { disabled: true }),
        landed: async () => {
          const info = await delegatorInfo(stakingManager, delegationId);
          return info.status === DelegatorStatus.Unknown && info.weight === 0n;
        },
        ready: completeReady,
        beforeRetry: () => remountStep(screen, browser, UNDELEGATE_STEP.complete),
      });
      note(`delegator removal completed in ${attempts} attempt(s)`);
      // The completion event: no rewards (V1 has no uptime proof), so no fee for V1.
      const completeTx = signer.sends.slice(removedAt).at(-1);
      if (completeTx) {
        const receipt = await waitForCTx(completeTx.hash as Hex);
        const [event] = parseEventLogs({
          abi: STAKING_MANAGER_ABI,
          logs: receipt.logs,
          eventName: 'CompletedDelegatorRemoval',
        });
        expect(event?.args.delegationID).toBe(delegationId);
        expect(event?.args.rewards).toBe(0n);
        expect(event?.args.fees).toBe(0n);
      }
      // The staking manager deletes a completed delegation, and the token comes back.
      const gone = await delegatorInfo(stakingManager, delegationId);
      expect(gone.status).toBe(DelegatorStatus.Unknown);
      expect(gone.weight).toBe(0n);
      await expect.poll(() => tokenBalance(token, signer.address), CHAIN_POLL).toBe(tokenStart - ONE_TOKEN);
      const settled = await managerValidator(proxy, v1ValidationId);
      expect(settled.receivedNonce).toBe(settled.sentNonce);
      expect(settled.weight).toBe(V1_WEIGHT);
      await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_WEIGHT);
    });

    test(
      'force-removes V1 and claims its delegation fees',
      { timeout: 30 * MIN },
      async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        const subnetId = need(l1.subnetId, 'the subnet ID');
        const proxy = need(l1.proxy, 'the proxy address');
        const token = need(pos.token, 'the token');
        const tokenStart = need(pos.tokenStart, 'the token balance');
        const v1 = need(pos.v1, 'mock validator V1');
        const v1ValidationId = need(pos.v1ValidationId, 'the V1 validation ID');
        const v1Hex = validationIdToHex(v1ValidationId);

        // The Validation ID field suggests Glacier's validators with weight above 0, read once at mount.
        await waitForGlacierValidator(subnetId, v1ValidationId, 'V1');

        // 1. Select L1 (the query sets it).
        await app.open(`/console/remove-validator/select-subnet?subnetId=${subnetId}`);
        await waitForWallet({ screen });
        await waitForPosErc20Badge(screen);
        await clickNext(screen, browser, REMOVE_STEP.initiate);

        // 2. Initiate Removal. Each validator of the L1 is a button under 'Validation ID'; the picked one is pressed.
        await waitForPosErc20Badge(screen);
        const v1Choice = screen.getByRole('button', new RegExp(`^${v1.nodeID}`));
        await v1Choice.click({ timeout: 90_000 });
        await expect(v1Choice).toHaveAttribute('aria-pressed', 'true');
        // The page probes the uptime endpoint of the manager's chain. The C-Chain has none for this L1, so the page
        // picks force removal, which forfeits rewards (PosInitiateRemoval.tsx). The uptime path would need
        // signatures of the L1's own nodes, and mock validators have none.
        const removeButton = screen.getByRole(
          'button',
          /^(Force Remove Validator \(forfeits rewards\)|Remove Validator \(preserves rewards\))$/,
        );
        await waitForPage(browser, 'Removal path', removeButton, 120_000);
        if (await screen.getByRole('button', 'Remove Validator (preserves rewards)').isVisible()) {
          throw new Error(
            'The page found an uptime endpoint for V1 and offers the uptime path, which mock validators fail.',
          );
        }
        await expect(screen.getByText(/^Removal will forfeit staking rewards$/)).toBeVisible();
        const force = screen.getByRole('button', 'Force Remove Validator (forfeits rewards)');
        await expect(force).toBeEnabled({ timeout: 90_000 });
        const from = signer.sends.length;
        const { result: initiatedResult, send: initiated } = await sendOnce({
          step: 'remove-v1-initiate',
          chain: 'C',
          path: POS_LEDGER,
          inputs: { validationId: v1ValidationId, force: true },
          landed: async () => {
            const { status } = await managerValidator(proxy, v1ValidationId);
            return status === ValidatorStatus.PendingRemoved || status === ValidatorStatus.Completed;
          },
          send: async () => {
            await force.click();
            const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', { failed: busyThenIdle(force) });
            const receipt = await waitForCTx(tx.hash as Hex);
            const [event] = parseEventLogs({
              abi: VALIDATOR_MANAGER_ABI,
              logs: receipt.logs,
              eventName: 'InitiatedValidatorRemoval',
            });
            if (event?.args.validationID !== v1Hex) throw new Error(`${tx.hash} emitted no InitiatedValidatorRemoval.`);
            return { txIds: [tx.hash] };
          },
          confirm: () =>
            chainShows(
              'the manager shows V1 pending removal',
              async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.PendingRemoved,
            ),
        });
        if (initiatedResult === 'sent') {
          await waitForStoreValue(browser, REMOVE_STORE, 'evmTxHash', initiated.txIds[0]);
          await expect(force).toBeDisabled();
        }

        // 3. P-Chain Weight Update: weight 0 removes V1 from the P-Chain and refunds its balance to the wallet.
        await clickNext(screen, browser, REMOVE_STEP.pchain);
        await waitForPosErc20Badge(screen);
        const before = await chainShows('the P-Chain lists V1', () => pL1Validator(v1ValidationId));
        const pBefore = await pBalance(signer.pChainAddress);
        await aggregateThenSend({
          browser,
          screen,
          signer,
          ledgerPath: POS_LEDGER,
          step: 'remove-v1-pchain',
          chain: 'P',
          label: 'Remove V1 on the P-Chain',
          landed: async () => ((await pL1Validator(v1ValidationId))?.weight ?? 0n) === 0n,
          beforeRetry: async () => {
            await remountStep(screen, browser, REMOVE_STEP.pchain);
            await waitForPosErc20Badge(screen);
          },
          button: 'Submit to P-Chain',
          txType: 'pvm.SetL1ValidatorWeightTx',
          done: /^P-Chain tx confirmed:/,
        });
        const refunded = await chainShows('the wallet got the V1 balance back', async () => {
          const after = await pBalance(signer.pChainAddress);
          return after > pBefore + before.balance - REFUND_SLACK_NAVAX ? after : null;
        });
        note(`V1 refund: P balance ${pBefore} to ${refunded} nAVAX (V1 held ${before.balance})`);

        // 4. Complete Removal: 'Aggregate Signatures' (L1ValidatorRegistration, registered=false), then the staking
        // manager completes it, returns the stake and pays the rewards (0).
        await clickNext(screen, browser, REMOVE_STEP.complete);
        await waitForPosErc20Badge(screen);
        await expect(screen.getByText('Validation ID present', { exact: true })).toBeVisible();
        await expect(screen.getByText(new RegExp(`^${v1Hex}$`, 'i'))).toBeVisible();
        const completedAt = signer.sends.length;
        await aggregateThenSend({
          browser,
          screen,
          signer,
          ledgerPath: POS_LEDGER,
          step: 'remove-v1-complete',
          chain: 'C',
          label: 'Complete the V1 removal',
          landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.Completed,
          beforeRetry: async () => {
            await remountStep(screen, browser, REMOVE_STEP.complete);
            await waitForPosErc20Badge(screen);
          },
          button: 'Complete Removal & Distribute Rewards',
          txType: 'eth_sendTransaction',
          done: /^Removal complete:/,
          failure: /^(Failed to complete validator removal|Signature aggregation failed):/,
        });
        const completeTx = signer.sends.slice(completedAt).at(-1);
        if (completeTx) {
          const receipt = await waitForCTx(completeTx.hash as Hex);
          const [reward] = parseEventLogs({
            abi: STAKING_MANAGER_ABI,
            logs: receipt.logs,
            eventName: 'ValidatorRewardClaimed',
          });
          expect(reward?.args.validationID).toBe(v1Hex);
          expect(reward?.args.amount).toBe(0n);
        }
        const completed = await managerValidator(proxy, v1ValidationId);
        expect(completed.status).toBe(ValidatorStatus.Completed);
        await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT);
        // The stake is back: the token balance is where it started.
        await expect.poll(() => tokenBalance(token, signer.address), CHAIN_POLL).toBe(tokenStart);
        upsertValidator('V1', { state: 'removed' }, POS_LEDGER);

        // 5. Claim Delegation Fees. The delegation earned no rewards, so the fees are 0.
        await clickNext(screen, browser, REMOVE_STEP.claim);
        await waitForPosErc20Badge(screen);
        await expect(screen.getByRole('heading', 'Claim Fees (ERC20 Token Staking)')).toBeVisible();
        const claim = screen.getByRole('button', 'Claim Delegation Fees');
        const claimFrom = signer.sends.length;
        const { result: claimed, send: claimSend } = await sendOnce({
          step: 'claim-fees',
          chain: 'C',
          path: POS_LEDGER,
          inputs: { validationId: v1ValidationId },
          // A claim leaves no state to read: only the ledger knows that it landed.
          landed: async (prev) => prev?.status === 'landed',
          send: async () => {
            await claim.click();
            const tx = await waitForSend(browser, signer, claimFrom, 'eth_sendTransaction', {
              failed: busyThenIdle(claim),
            });
            const receipt = await waitForCTx(tx.hash as Hex);
            const [event] = parseEventLogs({
              abi: STAKING_MANAGER_ABI,
              logs: receipt.logs,
              eventName: 'ValidatorRewardClaimed',
            });
            if (!event) throw new Error(`${tx.hash} emitted no ValidatorRewardClaimed.`);
            return {
              txIds: [tx.hash],
              outputs: { amount: event.args.amount.toString(), recipient: event.args.recipient },
            };
          },
          confirm: async () => true,
        });
        expect(output(claimSend, 'amount')).toBe('0');
        expect(output(claimSend, 'recipient')).toBe(signer.address);
        if (claimed === 'sent') {
          await waitForPage(
            browser,
            'Claim success',
            screen.getByText(/Delegation fees have been claimed and transferred to your address\./),
          );
        }
        expect(await tokenBalance(token, signer.address)).toBe(tokenStart);
      },
    );

    test('disables validator V0 (teardown)', { timeout: 15 * MIN }, async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      const subnetId = need(l1.subnetId, 'the subnet ID');
      const v0 = need(l1.v0, 'mock validator V0');
      const v0ValidationId = need(l1.v0ValidationId, 'the V0 validation ID');

      // The validator list reads Glacier's active L1 validators once per subnet change (ValidatorSelector.tsx).
      const glacierLagMs = await waitForGlacierValidator(subnetId, v0ValidationId, 'V0 as active', undefined, false);

      await app.open('/console/permissioned-l1s/disable-validator');
      await waitForWallet({ screen });
      await expect(toolHeading(screen, 'Disable L1 Validator')).toBeVisible();
      await screen.getByRole('textbox', 'Subnet ID').fill(subnetId);
      await screen.getByRole('button', new RegExp(`^${v0.nodeID}`)).click();
      await waitForPage(
        browser,
        'Disable authorization',
        screen.getByText('Your wallet is authorized to disable this validator.'),
      );
      await screen.getByRole('checkbox', /^I understand this disables/).check();

      const before = await chainShows('the P-Chain lists V0', () => pL1Validator(v0ValidationId));
      const pBefore = await pBalance(signer.pChainAddress);
      const from = signer.sends.length;
      const { result } = await sendOnce({
        step: 'disable-v0',
        chain: 'P',
        path: POS_LEDGER,
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
        POS_LEDGER,
      );
      upsertValidator('V0', { state: 'disabled' }, POS_LEDGER);
      if (result === 'sent') {
        await waitForPage(browser, 'Disable success', screen.getByRole('heading', 'Validator Disabled'));
        const refunded = await chainShows('the wallet got the V0 balance back', async () => {
          const after = await pBalance(signer.pChainAddress);
          return after > pBefore + before.balance - REFUND_SLACK_NAVAX ? after : null;
        });
        note(`V0 refund: P balance ${pBefore} to ${refunded} nAVAX (V0 held ${before.balance})`);
      }
    });

    test(
      'lists the P-Chain txs in the history and audits the wallet sends',
      { timeout: 5 * MIN },
      async ({ app, browser, screen, wallet }) => {
        const { signer } = wallet;
        await app.open('/console/history');
        await waitForWallet({ screen });
        await expect(screen.getByRole('heading', 'History', { level: 1 })).toBeVisible();
        const pTxIds = signer.sends.filter((s) => s.kind === 'p-chain').map((s) => s.hash);
        await expectHistoryRows(browser, screen, pTxIds);

        // Every send of the run: the exact count per tx type, each one in the ledger and in the step table, no
        // refusal, and the caps. auditSends also turns off every capability of the signer (this file turns on none).
        const { counts, problems } = expectedSends(readLedger(POS_LEDGER), POS_ERC20_SENDS);
        const record = auditSends(signer, { ledgerPath: POS_LEDGER, expect: counts, problems });
        note(`audit: ${record.types.map((t) => `${t.txType} ${t.sent}`).join(', ')}`);
      },
    );
  },
);
