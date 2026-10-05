import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { getAddress, parseEventLogs, type Address, type Hex } from 'viem';
import {
  EIP1967,
  FUJI,
  VALIDATOR_MANAGER_ABI,
  ValidatorStatus,
  assertFuji,
  cHasCode,
  cSlotAddress,
  glacierL1Validators,
  hexToCb58,
  initialValidationId,
  jsonRpc,
  managerIsValidatorSetInitialized,
  managerNodeValidationId,
  managerOwner,
  managerSubnetId,
  managerTotalWeight,
  managerValidator,
  pIsL1,
  chainShows,
  pL1Validator,
  pSubnet,
  pTxStatus,
  pollUntil,
  validationIdToHex,
  waitForCTx,
  waitForGlacierSubnet,
  waitForPTx,
} from './lib/chain.ts';
import {
  MANAGER_CHAIN_RECORD,
  busyThenIdle,
  clickAndSettle,
  clickNext,
  note,
  openAsReturningVisitor,
  readStore,
  remountStep,
  toolHeading,
  waitForPage,
  waitForPoaBadge,
  waitForSend,
} from './lib/console.ts';
import { connectCore, describe, test } from './lib/fixtures.ts';
import {
  archiveLedger,
  finishSend,
  runIdFromEnv,
  sendOnce,
  setL1,
  updateLedger,
  upsertValidator,
  type LedgerSend,
} from './lib/ledger.ts';
import { createMockValidator, nodeCredentialsJson, type MockValidator } from './lib/mock-validator.ts';
import { deliverWithRetry } from './lib/warp.ts';
import type { Signer } from './wallet/signer.ts';

// Tier 1 of the nightly Console suite: a fresh PoA L1 whose Validator Manager runs on the Fuji C-Chain, made with
// the Console at build.avax.network, one member per Console step. No node runs the L1: the validators are mock
// validators (lib/mock-validator.ts), and the Primary Network signs every Warp message for a C-Chain manager.
// lib/console-map.md lists the controls, success signals and traps of each step.
//
// The create flow (questionnaire to Initialize Validator Set) makes the L1 with V0. The validator tools then add V1,
// change its weight, top up V0 and remove V1. Disable V0 ends the run and refunds its balance; teardown.ts is the
// backstop for a run that stops before it.
//
// Each member checks the chain after its tx (Node reads, lib/chain.ts) and skips a send that already landed
// (sendOnce, lib/ledger.ts). The group never retries: a retry would send the txs again. Only lib/warp.ts retries a
// Warp delivery, which changes no state when it reverts.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   npm run test:chain

const runId = runIdFromEnv();

// The state of this run. The runner imports this file once for the serial group, so its members share it.
const run: {
  v0?: MockValidator;
  subnetId?: string;
  blockchainId?: string;
  validatorMessages?: Address;
  validatorManager?: Address;
  proxyAdmin?: Address;
  proxy?: Address;
  conversionTxId?: string;
  v0ValidationId?: string;
  v1?: MockValidator;
  v1ValidationId?: string;
} = {};

const CREATE = '/console/create-l1';
const V0_WEIGHT = 100n;
const V0_BALANCE_AVAX = '0.02';
const V0_BALANCE_NAVAX = 20_000_000n;
const V1_WEIGHT = 10n;
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
// A Node check after a tx: the public RPC is load-balanced, and a node can lag the tx for a few seconds (chainShows).
const CHAIN_POLL = { timeout: 90_000, interval: 2_000 };
// The Primary Network's subnet ID signs for a manager on the C-Chain.
const PRIMARY_NETWORK = FUJI.pBlockchainId;
// The VM of the chain that Create Chain makes: subnet-evm (SUBNET_EVM_VM_ID in constants/console.ts).
const SUBNET_EVM_VM_ID = 'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy';

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`An earlier member did not record ${what}.`);
  return value;
}

function output(send: LedgerSend, key: string): string {
  const value = send.outputs?.[key];
  if (typeof value !== 'string') throw new Error(`The ledger step '${send.step}' has no output '${key}'.`);
  return value;
}

// The fields of a CreateChainTx that the test checks (platform.getTx, JSON encoding). A node that has not seen the tx
// answers 'not found', which chainShows reads as not yet.
async function pCreateChainTx(txId: string): Promise<{ subnetID: string; vmID: string }> {
  const { tx } = await jsonRpc<{ tx: { unsignedTx: { subnetID: string; vmID: string } } }>(
    FUJI.pRpc,
    'platform.getTx',
    { txID: txId, encoding: 'json' },
  );
  return tx.unsignedTx;
}

describe('tier 1: PoA L1, manager on the C-Chain', { serial: true, retries: 0, tags: ['chain', 'tier1'] }, () => {
  test('answers the create-L1 questionnaire', { timeout: 5 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    // A run makes a new L1. The last run's ledger moves to .run/archive/, where teardown.ts still finds it.
    archiveLedger();
    updateLedger((ledger) => {
      ledger.runId = runId;
      ledger.baseUrl = app.baseUrl;
      ledger.l1.managerChain = 'C';
    });
    await assertFuji();
    note(`run ${runId}, wallet C ${wallet.signer.address}, P ${wallet.signer.pChainAddress}`);

    await openAsReturningVisitor(app, browser, CREATE);
    await connectCore(screen);

    await expect(screen.getByRole('heading', 'Choose a setup')).toBeVisible();
    await screen.getByRole('button', /^Advanced setup/).click();
    await screen.getByRole('button', 'Continue').click();

    // A card's name is its title, its description and, on some cards, 'Recommended'.
    const answer = async (question: string, card: RegExp) => {
      await expect(screen.getByRole('heading', question)).toBeVisible();
      await screen.getByRole('button', card).click();
      await screen.getByRole('button', 'Continue').click();
    };
    // Pick the validator type first: picking it resets the manager location (CreateL1Questionnaire.tsx).
    await answer('Validator management', /^Proof of Authority/);
    await answer('Validator Manager location', /^On C-Chain/);
    await answer('Interoperability', /^Enable cross-chain messaging/);
    await answer('Contract ownership', /^Single wallet/);
    await answer('Infrastructure', /^Docker/);

    await expect(screen.getByRole('heading', 'Review your setup')).toBeVisible();
    // The banner shows when the wallet is on mainnet. The wallet is on Fuji.
    await expect(screen.getByText('We recommend starting on Fuji testnet', { exact: false })).toBeHidden();
    for (const step of [
      'Create Subnet',
      'Deploy Validator Manager',
      'Proxy Setup',
      'Initialize Validator Manager',
      'Create Chain + Genesis',
      'Docker Node Setup',
      'Convert to L1',
      'Init Validator Set',
    ]) {
      await expect(screen.getByText(step, { exact: true }).first()).toBeVisible();
    }
    await screen.getByRole('button', 'Start deployment').click();
    await browser.waitForURL(/\/console\/create-l1\/create-subnet$/, { timeout: 60_000 });
  });

  test('creates the subnet', { timeout: 5 * 60_000 }, async ({ browser, screen, wallet }) => {
    const { signer } = wallet;
    await expect(toolHeading(screen, 'Create Subnet')).toBeVisible();
    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'create-subnet',
      chain: 'P',
      landed: async (prev) => !!prev?.txIds[0] && (await pSubnet(prev.txIds[0])) !== null,
      send: async () => {
        await screen.getByRole('button', 'Core Create Subnet').click();
        const tx = await waitForSend(browser, signer, from, 'pvm.CreateSubnetTx');
        return { txIds: [tx.hash] };
      },
      confirm: async (sent) => {
        await waitForPTx(sent.txIds[0]);
        await chainShows('the P-Chain lists the subnet', () => pSubnet(sent.txIds[0]));
        return true;
      },
    });
    const subnetId = send.txIds[0];
    run.subnetId = subnetId;
    setL1({ subnetId });
    note(`subnet ${subnetId} (${result})`);

    // The subnet ID is the CreateSubnetTx ID. The wallet's P-Chain address is its only owner.
    const subnet = await chainShows('the P-Chain lists the subnet', () => pSubnet(subnetId));
    expect(subnet?.controlKeys).toEqual([signer.pChainAddress]);
    expect(subnet?.threshold).toBe('1');
    if (result === 'sent') {
      await waitForPage(browser, 'Create Subnet success', screen.getByText('Subnet ID (CreateSubnetTx)'));
      await expect(screen.getByRole('link', subnetId)).toBeVisible();
    }
  });

  test('deploys the validator manager contracts', { timeout: 8 * 60_000 }, async ({ browser, screen, wallet }) => {
    const { signer } = wallet;
    await clickNext(screen, browser, /\/console\/create-l1\/deploy-validator-manager$/);
    await expect(toolHeading(screen, 'Deploy Validator Contracts')).toBeVisible();

    // One contract deploy from one button: the receipt names the contract.
    const deploy = async (step: string, button: string): Promise<Address> => {
      const from = signer.sends.length;
      const { send } = await sendOnce({
        step,
        chain: 'C',
        landed: async (prev) => !!prev?.outputs?.address && (await cHasCode(output(prev, 'address') as Address)),
        send: async () => {
          await screen.getByRole('button', button).click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction');
          const receipt = await waitForCTx(tx.hash as Hex);
          if (!receipt.contractAddress) throw new Error(`${step}: the receipt of ${tx.hash} has no contract address.`);
          return { txIds: [tx.hash], outputs: { address: getAddress(receipt.contractAddress) } };
        },
        confirm: async (sent) =>
          chainShows(`code at ${output(sent, 'address')}`, () => cHasCode(output(sent, 'address') as Address)),
      });
      const address = getAddress(output(send, 'address'));
      note(`${step}: ${address}`);
      return address;
    };

    run.validatorMessages = await deploy('deploy-validator-messages', 'Deploy Library');
    await waitForPage(browser, 'Deploy Library success', screen.getByRole('button', 'Redeploy'));
    await expect(screen.getByText(new RegExp(`^${run.validatorMessages}$`, 'i'))).toBeVisible();

    run.validatorManager = await deploy('deploy-validator-manager', 'Deploy Contract');
    await expect(screen.getByRole('button', 'Redeploy')).toHaveCount(2);
    await expect(screen.getByText(new RegExp(`^${run.validatorManager}$`, 'i'))).toBeVisible();
    setL1({ validatorMessagesLibrary: run.validatorMessages, validatorManagerImplementation: run.validatorManager });
  });

  test('deploys the proxy', { timeout: 8 * 60_000 }, async ({ browser, screen, wallet }) => {
    const { signer } = wallet;
    const implementation = need(run.validatorManager, 'the ValidatorManager address');
    await clickNext(screen, browser, /\/console\/create-l1\/proxy-setup$/);
    await expect(toolHeading(screen, 'Proxy Setup')).toBeVisible();

    // On the C-Chain the 'Deploy New Proxy' section opens by itself once the wallet chain is known. Two buttons are
    // named 'Deploy' (ProxyAdmin and proxy, UX finding B19); only the ProxyAdmin one is enabled at first.
    const deployButton = screen.getByRole('button', 'Deploy', { disabled: false });
    await expect(deployButton).toBeVisible({ timeout: 60_000 });

    const deploy = async (step: string): Promise<Address> => {
      const from = signer.sends.length;
      const { send } = await sendOnce({
        step,
        chain: 'C',
        landed: async (prev) => !!prev?.outputs?.address && (await cHasCode(output(prev, 'address') as Address)),
        send: async () => {
          await deployButton.click();
          const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction');
          const receipt = await waitForCTx(tx.hash as Hex);
          if (!receipt.contractAddress) throw new Error(`${step}: the receipt of ${tx.hash} has no contract address.`);
          return { txIds: [tx.hash], outputs: { address: getAddress(receipt.contractAddress) } };
        },
        confirm: async (sent) =>
          chainShows(`code at ${output(sent, 'address')}`, () => cHasCode(output(sent, 'address') as Address)),
      });
      const address = getAddress(output(send, 'address'));
      note(`${step}: ${address}`);
      return address;
    };

    run.proxyAdmin = await deploy('deploy-proxy-admin');
    // The ProxyAdmin button is gone; the proxy button takes the ValidatorManager as its implementation.
    await expect(screen.getByRole('button', 'Deploy')).toHaveCount(1, { timeout: 60_000 });
    await expect(deployButton).toBeVisible({ timeout: 60_000 });
    run.proxy = await deploy('deploy-proxy');
    setL1({ proxyAdmin: run.proxyAdmin, validatorManager: run.proxy });

    await waitForPage(browser, 'Proxy Setup success', screen.getByText('Proxy is up to date'));
    // EIP-1967: the proxy points at the ValidatorManager, and the ProxyAdmin administers it.
    const proxy = run.proxy;
    await expect.poll(() => cSlotAddress(proxy, EIP1967.implementation), CHAIN_POLL).toBe(implementation);
    await expect.poll(() => cSlotAddress(proxy, EIP1967.admin), CHAIN_POLL).toBe(run.proxyAdmin);
    // The next steps take the manager address from the create store: it is the proxy now.
    const store = await readStore(browser, 'v4-create-chain-store-testnet');
    expect(getAddress(String(store.managerAddress))).toBe(run.proxy);
  });

  test('initializes the validator manager', { timeout: 6 * 60_000 }, async ({ browser, screen, wallet }) => {
    const { signer } = wallet;
    const proxy = need(run.proxy, 'the proxy address');
    const subnetId = need(run.subnetId, 'the subnet ID');
    await clickNext(screen, browser, /\/console\/create-l1\/initialize-manager$/);
    await expect(toolHeading(screen, 'Initialize Validator Manager')).toBeVisible();

    // Initialize binds the manager to the subnet for good: check the subnet before the click.
    await waitForPage(browser, 'Initialize status', screen.getByText('Ready to initialize'), 90_000);
    // By placeholder: the label 'Subnet ID' is not tied to its input (UX finding B16).
    await expect(screen.getByPlaceholder('Enter subnet ID')).toHaveValue(subnetId);

    const from = signer.sends.length;
    await sendOnce({
      step: 'initialize-validator-manager',
      chain: 'C',
      landed: async () => (await managerSubnetId(proxy)) === subnetId,
      send: async () => {
        await screen.getByRole('button', 'Initialize Contract').click();
        const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction');
        await waitForCTx(tx.hash as Hex);
        return { txIds: [tx.hash] };
      },
    });
    // The page's only success signal is an amber notice (UX finding C29).
    await waitForPage(browser, 'Initialize success', screen.getByText('Contract already initialized'));
    await expect.poll(() => managerSubnetId(proxy), CHAIN_POLL).toBe(subnetId);
    await expect.poll(() => managerOwner(proxy), CHAIN_POLL).toBe(signer.address);
  });

  test('creates the chain', { timeout: 6 * 60_000 }, async ({ browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    await clickNext(screen, browser, /\/console\/create-l1\/create-chain$/);
    await expect(toolHeading(screen, 'Create Chain')).toBeVisible();

    // The button shows once the default genesis is valid.
    const create = screen.getByRole('button', 'Core Create Chain');
    await waitForPage(browser, 'Create Chain button', create, 60_000);
    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'create-chain',
      chain: 'P',
      landed: async (prev) => !!prev?.txIds[0] && (await pTxStatus(prev.txIds[0])).status === 'Committed',
      send: async () => {
        await create.click();
        const tx = await waitForSend(browser, signer, from, 'pvm.CreateChainTx');
        return { txIds: [tx.hash] };
      },
      confirm: async (sent) => {
        await waitForPTx(sent.txIds[0]);
        return true;
      },
    });
    const blockchainId = send.txIds[0];
    run.blockchainId = blockchainId;
    setL1({ blockchainId });
    note(`chain ${blockchainId} (${result})`);

    // The blockchain ID is the CreateChainTx ID. The P-Chain holds the chain on this run's subnet, with subnet-evm.
    const created = await chainShows('the P-Chain holds the CreateChainTx', () => pCreateChainTx(blockchainId));
    expect(created.subnetID).toBe(subnetId);
    expect(created.vmID).toBe(SUBNET_EVM_VM_ID);
    if (result === 'sent') {
      await waitForPage(browser, 'Create Chain success', screen.getByText(/^Chain ".*" created \(CreateChainTx ID\)$/));
      await expect(screen.getByRole('link', blockchainId)).toBeVisible();
    }
  });

  test('skips the Docker node setup', { timeout: 2 * 60_000 }, async ({ browser, screen }) => {
    // Tier 1 runs no node: the mock validators need none. 'Next' is not gated on this step.
    await clickNext(screen, browser, /\/console\/create-l1\/docker-setup$/);
    await expect(toolHeading(screen, 'L1 Node Setup with Docker')).toBeVisible();
  });

  test(
    'converts the subnet to an L1 with mock validator V0',
    { timeout: 20 * 60_000 },
    async ({ browser, screen, wallet }) => {
      const { signer } = wallet;
      const subnetId = need(run.subnetId, 'the subnet ID');
      const proxy = need(run.proxy, 'the proxy address');
      const v0 = createMockValidator({ label: 'V0', seed: `${runId} V0` });
      run.v0 = v0;
      const v0ValidationId = initialValidationId(subnetId, 0);
      run.v0ValidationId = v0ValidationId;
      upsertValidator('V0', {
        nodeId: v0.nodeID,
        validationId: v0ValidationId,
        subnetId,
        weight: V0_WEIGHT.toString(),
        balance: V0_BALANCE_NAVAX.toString(),
        blsPublicKey: v0.publicKey,
        state: 'initial',
      });

      // The page reads the subnet from Glacier once, when it mounts (SelectSubnet.tsx): wait for Glacier first.
      const { waitedMs: glacierLagMs } = await waitForGlacierSubnet(subnetId);
      note(`Glacier listed subnet ${subnetId} after ${Math.round(glacierLagMs / 1000)} s`);
      await clickNext(screen, browser, /\/console\/create-l1\/convert-to-l1$/);
      await expect(toolHeading(screen, 'Convert Subnet to L1')).toBeVisible();

      await expect(screen.getByRole('textbox', 'Subnet')).toHaveValue(subnetId);
      await waitForPage(
        browser,
        'Convert manager check',
        screen.getByText('A Validator Manager exists at this address on the C-Chain, so the C-Chain is selected.'),
        90_000,
      );
      await expect(screen.getByDisplayValue(FUJI.cBlockchainId)).toBeVisible();
      await expect(screen.getByDisplayValue(new RegExp(`^${proxy}$`, 'i'))).toBeVisible();

      await screen.getByRole('tab', 'API Response').click();
      // The JSON field has no label: its name is its placeholder (UX finding B18).
      await screen.getByPlaceholder(/"nodePOP"/).fill(nodeCredentialsJson(v0));
      await screen.getByRole('button', 'Add Validator').click();
      await expect(screen.getByText(v0.nodeID, { exact: true }).first()).toBeVisible();

      // Consensus Weight and Validator Balance have no accessible name: the labels are not tied to the inputs and
      // the inputs have no placeholder (ValidatorItem.tsx, UX finding B17). These are the narrowest selectors.
      const weight = browser.locator('input[type="number"]:not([step]):not([min])');
      const balance = browser.locator('input[type="number"][step="0.000001"]');
      await expect(weight).toHaveValue(V0_WEIGHT.toString());
      // fill, not typed keys: the field converts each value to nAVAX at once.
      await balance.fill(V0_BALANCE_AVAX);
      await expect(balance).toHaveValue(V0_BALANCE_AVAX);
      await expect(screen.getByText('Checking the manager address on the C-Chain...')).toBeHidden({ timeout: 60_000 });

      const from = signer.sends.length;
      const { result, send } = await sendOnce({
        step: 'convert-to-l1',
        chain: 'P',
        inputs: { nodeId: v0.nodeID, weight: V0_WEIGHT.toString(), balance: V0_BALANCE_NAVAX.toString() },
        landed: () => pIsL1(subnetId),
        send: async () => {
          await screen.getByRole('button', 'Core Convert to L1').click();
          const tx = await waitForSend(browser, signer, from, 'pvm.ConvertSubnetToL1Tx');
          return { txIds: [tx.hash] };
        },
        confirm: async (sent) => {
          await waitForPTx(sent.txIds[0]);
          await chainShows('the P-Chain shows the L1', () => pIsL1(subnetId));
          return true;
        },
      });
      finishSend('convert-to-l1', { status: 'landed', glacierLagMs });
      run.conversionTxId = send.txIds[0];
      setL1({ conversionTxId: run.conversionTxId });
      note(`conversion ${run.conversionTxId} (${result})`);

      // The P-Chain: the manager is the proxy on the C-Chain, and V0 is the first validator.
      const subnet = await chainShows('the P-Chain names the manager', async () => {
        const read = await pSubnet(subnetId);
        return read?.managerAddress ? read : null;
      });
      expect(subnet?.managerChainID).toBe(FUJI.cBlockchainId);
      expect(getAddress(String(subnet?.managerAddress))).toBe(proxy);
      const validator = await chainShows('the P-Chain lists V0', () => pL1Validator(v0ValidationId));
      expect(validator?.nodeId).toBe(v0.nodeID);
      expect(validator?.weight).toBe(V0_WEIGHT);
      expect(validator && validator.balance > 0n && validator.balance <= V0_BALANCE_NAVAX).toBe(true);
      expect(validator?.remainingBalanceOwner.addresses).toEqual([signer.pChainAddress]);
      expect(validator?.deactivationOwner.addresses).toEqual([signer.pChainAddress]);

      // The page shows no success (UX finding A3): after the tx the button is idle again, and it shows no error.
      if (result === 'sent') {
        await waitForPage(browser, 'Convert idle', screen.getByRole('button', 'Core Convert to L1'));
        const store = await readStore(browser, 'v4-create-chain-store-testnet');
        expect(store.convertToL1TxId).toBe(run.conversionTxId);
      }
    },
  );

  test('initializes the validator set', { timeout: 25 * 60_000 }, async ({ browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    const proxy = need(run.proxy, 'the proxy address');
    const v0 = need(run.v0, 'mock validator V0');
    const v0ValidationId = need(run.v0ValidationId, 'the V0 validation ID');
    await clickNext(screen, browser, /\/console\/create-l1\/init-validator-set$/);
    await expect(toolHeading(screen, 'Initialize Validator Set')).toBeVisible();
    // By placeholder: the label 'L1 Subnet ID' is not tied to its input (UX finding B16), and the label 'Conversion
    // Tx ID (P-Chain)' is a raw label with no htmlFor (UX finding B17).
    await expect(screen.getByPlaceholder('Enter subnet ID')).toHaveValue(subnetId);
    await expect(screen.getByPlaceholder('txID...')).toHaveValue(need(run.conversionTxId, 'the conversion tx'));

    let attempts = 0;
    const firstSend = signer.sends.length;
    await sendOnce({
      step: 'init-validator-set',
      chain: 'C',
      landed: () => managerIsValidatorSetInitialized(proxy),
      send: async () => {
        const result = await deliverWithRetry({
          label: 'Initialize Validator Set',
          log: note,
          landed: () => managerIsValidatorSetInitialized(proxy),
          // The page keeps one signature per mount and reuses it on each 'Initialize Validator Set' click (UX
          // finding A5). A reload gives a fresh aggregation; the create flow's stores survive it.
          aggregate: async (attempt) => {
            if (attempt > 1) {
              await browser.reload();
              await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
              // 'Conversion Tx ID (P-Chain)' is not tied to its input (UX finding B17).
              await expect(screen.getByPlaceholder('txID...')).toHaveValue(need(run.conversionTxId, 'tx'), {
                timeout: 60_000,
              });
            }
            await clickAndSettle(
              browser,
              'Aggregate Signatures',
              screen.getByRole('button', 'Aggregate Signatures'),
              screen.getByText('Signature aggregated'),
            );
            note(`signature aggregated (${await screen.getByText(/^subnet: /).textContent()})`);
          },
          deliver: async () => {
            const from = signer.sends.length;
            const button = screen.getByRole('button', 'Initialize Validator Set');
            await button.click();
            const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction', {
              timeoutMs: 300_000,
              failed: busyThenIdle(button),
            });
            note(`init validator set tx ${tx.hash}`);
            await waitForCTx(tx.hash as Hex).catch((error: unknown) => {
              throw new Error(`the delivery reverted: ${error instanceof Error ? error.message : String(error)}`);
            });
            await waitForPage(browser, 'Init Validator Set success', screen.getByText('Validator set initialized'));
          },
        });
        attempts = result.attempts;
        note(`Initialize Validator Set: ${result.attempts} attempt(s). ${result.errors.join('; ')}`);
        return { txIds: signer.sends.slice(firstSend).map((s) => s.hash) };
      },
    });
    finishSend('init-validator-set', { status: 'landed', attempts });

    // The manager holds V0 as its only active validator.
    await expect.poll(() => managerIsValidatorSetInitialized(proxy), CHAIN_POLL).toBe(true);
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT);
    await expect
      .poll(() => managerNodeValidationId(proxy, v0.nodeID), CHAIN_POLL)
      .toBe(validationIdToHex(v0ValidationId));
    const record = await chainShows('the manager holds V0 as active', async () => {
      const read = await managerValidator(proxy, v0ValidationId);
      return read.status === ValidatorStatus.Active ? read : null;
    });
    expect(record.weight).toBe(V0_WEIGHT);
    upsertValidator('V0', { state: 'registered' });
    // The signing subnet is the Primary Network for a C-Chain manager.
    expect(await screen.getByText(/^subnet: /).textContent()).toContain(PRIMARY_NETWORK.slice(0, 12));
  });

  test('adds validator V1', { timeout: 30 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    const proxy = need(run.proxy, 'the proxy address');
    const v1 = createMockValidator({ label: 'V1', seed: `${runId} V1` });
    run.v1 = v1;
    upsertValidator('V1', { nodeId: v1.nodeID, subnetId, weight: V1_WEIGHT.toString(), blsPublicKey: v1.publicKey });

    // The validator flows read the manager from Glacier's record of the L1 (hooks/useVMCAddress.ts).
    const { waitedMs: glacierLagMs } = await waitForGlacierSubnet(subnetId, { converted: true });
    note(`Glacier listed ${subnetId} as an L1 after ${Math.round(glacierLagMs / 1000)} s`);

    // 1. Select L1 Subnet. The query sets the subnet: the flow does not persist it (UX finding A12).
    await app.open(`/console/add-validator/select-subnet?subnetId=${subnetId}`);
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByRole('heading', 'Select L1 Subnet')).toBeVisible();
    await waitForPoaBadge(screen);
    await expect(screen.getByRole('button', PRIMARY_NETWORK)).toBeVisible();
    await clickNext(screen, browser, ADD_STEP.initiate);

    // 2. Initiate Validator Registration (C-Chain).
    await waitForPoaBadge(screen);
    await screen.getByRole('tab', 'API Response').click();
    // The JSON field has no label: its name is its placeholder (UX finding B18).
    await screen.getByPlaceholder(/"nodePOP"/).fill(nodeCredentialsJson(v1));
    await screen.getByRole('button', 'Add Validator').click();
    await expect(screen.getByText(v1.nodeID, { exact: true }).first()).toBeVisible();
    // By CSS: 'Consensus Weight' and 'Validator Balance (P-Chain AVAX)' are not tied to their inputs, and the inputs
    // have no placeholder (ValidatorItem.tsx, UX finding B17).
    await browser.locator('input[type="number"]:not([step]):not([min])').fill(V1_WEIGHT.toString());
    await browser.locator('input[type="number"][step="0.000001"]').fill(V1_BALANCE_AVAX);
    await expect(browser.locator('input[type="number"][step="0.000001"]')).toHaveValue(V1_BALANCE_AVAX);

    const initiate = screen.getByRole('button', 'Initiate Validator Registration');
    let from = signer.sends.length;
    const { send: initiated } = await sendOnce({
      step: 'add-v1-initiate',
      chain: 'C',
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
    finishSend('add-v1-initiate', { status: 'landed', glacierLagMs });
    const v1ValidationId = output(initiated, 'validationId');
    run.v1ValidationId = v1ValidationId;
    upsertValidator('V1', {
      validationId: v1ValidationId,
      balance: V1_BALANCE_NAVAX.toString(),
      blockNumber: output(initiated, 'blockNumber'),
      registrationExpiry: output(initiated, 'registrationExpiry'),
      state: 'initiated',
    });
    note(`V1 initiated: ${v1ValidationId}`);
    await waitForPage(browser, 'Initiate success', screen.getByRole('button', 'Transaction Completed'));
    await expect.poll(async () => (await managerValidator(proxy, v1ValidationId)).weight, CHAIN_POLL).toBe(V1_WEIGHT);
    await expect
      .poll(() => managerNodeValidationId(proxy, v1.nodeID), CHAIN_POLL)
      .toBe(validationIdToHex(v1ValidationId));

    // 3. P-Chain Registration: one button aggregates and sends the RegisterL1ValidatorTx.
    await clickNext(screen, browser, ADD_STEP.pchain);
    const registerReady = async () => {
      await waitForPoaBadge(screen);
      await expect(screen.getByText('Initial Balance:')).toBeVisible({ timeout: 60_000 });
      await expect(screen.getByText(`${V1_BALANCE_AVAX} AVAX`, { exact: true })).toBeVisible();
    };
    await registerReady();
    let registerAttempts = 0;
    await sendOnce({
      step: 'add-v1-register',
      chain: 'P',
      landed: async () => (await pL1Validator(v1ValidationId)) !== null,
      send: async () => {
        const result = await deliverWithRetry({
          label: 'Register V1 on the P-Chain',
          log: note,
          landed: async () => (await pL1Validator(v1ValidationId)) !== null,
          deliver: async (attempt) => {
            // After a failure the button is gone (UX finding A6): mount the step again.
            if (attempt > 1) {
              await remountStep(screen, browser, ADD_STEP.pchain);
              await registerReady();
            }
            from = signer.sends.length;
            const button = screen.getByRole('button', 'Core Sign & Submit to P-Chain');
            await button.click();
            const idle = busyThenIdle(button);
            const failure = screen.getByText(/^P-Chain transaction failed:/).first();
            const tx = await waitForSend(browser, signer, from, 'pvm.RegisterL1ValidatorTx', {
              timeoutMs: 6 * 60_000,
              failed: async () => (await idle()) || (await failure.isVisible()),
            });
            await waitForPTx(tx.hash);
            // The page shows no tx ID (UX finding A6): its success is the store's P-Chain tx ID.
            await expect
              .poll(async () => (await readStore(browser, ADD_STORE)).pChainTxId, { timeout: 120_000 })
              .toBe(tx.hash);
          },
        });
        registerAttempts = result.attempts;
        return { txIds: signer.sends.filter((s) => s.txType === 'pvm.RegisterL1ValidatorTx').map((s) => s.hash) };
      },
      confirm: async () => !!(await chainShows('the P-Chain lists V1', () => pL1Validator(v1ValidationId))),
    });
    finishSend('add-v1-register', { status: 'landed', attempts: registerAttempts });
    const registered = await chainShows('the P-Chain lists V1', () => pL1Validator(v1ValidationId));
    expect(registered.weight).toBe(V1_WEIGHT);
    expect(registered.balance > 0n && registered.balance <= V1_BALANCE_NAVAX).toBe(true);
    const registerTxId = String((await readStore(browser, ADD_STORE)).pChainTxId);

    // 4. Complete Registration (C-Chain): the P-Chain's signed message goes to the manager.
    await clickNext(screen, browser, ADD_STEP.complete);
    await waitForPoaBadge(screen);
    // By placeholder: the label 'P-Chain Transaction ID' is not tied to its input (UX finding B16).
    await expect(screen.getByPlaceholder('Enter the P-Chain transaction ID from the previous step')).toHaveValue(
      registerTxId,
    );
    const completeAttempts = await completeOnManager({
      step: 'add-v1-complete',
      label: 'Complete V1 registration',
      stepPath: ADD_STEP.complete,
      button: 'Complete Validator Registration',
      done: screen.getByText('Registration completed'),
      landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.Active,
      ready: () => waitForPoaBadge(screen),
      browser,
      screen,
      signer,
    });
    note(`V1 registration completed in ${completeAttempts} attempt(s)`);
    await expect(
      screen.getByText('Your validator is now registered and active on the L1.', { exact: false }),
    ).toBeVisible();
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_WEIGHT);
    upsertValidator('V1', { state: 'registered' });
  });

  test('changes the weight of V1', { timeout: 30 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    const proxy = need(run.proxy, 'the proxy address');
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

    // 1. Select L1 Subnet. This flow takes no subnetId query (UX finding 38). By placeholder: the label 'Subnet ID'
    // is not tied to its input (UX finding B16).
    await app.open(WEIGHT_STEP.select);
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await screen.getByPlaceholder('Enter subnet ID').fill(subnetId);
    await expect(screen.getByRole('button', PRIMARY_NETWORK)).toBeVisible({ timeout: 90_000 });
    await clickNext(screen, browser, WEIGHT_STEP.initiate);

    // 2. Initiate Weight Change. The suggestion is a clickable div with no role (UX finding B21); a typed ID never
    // gets its NodeID (UX finding A10).
    await screen.getByText(v1.nodeID, { exact: true }).click({ timeout: 90_000 });
    await screen.getByRole('textbox', 'New Weight').fill(V1_NEW_WEIGHT.toString());
    const initiate = screen.getByRole('button', 'Initiate Change Weight');
    let from = signer.sends.length;
    await sendOnce({
      step: 'weight-v1-initiate',
      chain: 'C',
      inputs: { validationId: v1ValidationId, weight: V1_NEW_WEIGHT.toString() },
      landed: async () => (await managerValidator(proxy, v1ValidationId)).weight === V1_NEW_WEIGHT,
      send: async () => {
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
    finishSend('weight-v1-initiate', { status: 'landed', glacierLagMs });
    await waitForPage(browser, 'Initiate Change Weight success', screen.getByRole('button', 'Transaction Completed'));
    // The manager waits for the P-Chain: it sent a weight message that the P-Chain has not confirmed yet.
    await expect
      .poll(async () => {
        const { sentNonce, receivedNonce } = await managerValidator(proxy, v1ValidationId);
        return sentNonce > receivedNonce;
      }, CHAIN_POLL)
      .toBe(true);

    // 3. P-Chain Weight Update. No badge on this step: wait for the manager-details load to end.
    const detailsLoaded = browser.waitForResponse(MANAGER_CHAIN_RECORD, { timeout: 90_000 });
    await clickNext(screen, browser, WEIGHT_STEP.pchain);
    await detailsLoaded;
    await submitWeightUpdate({
      step: 'weight-v1-pchain',
      label: 'Set V1 weight on the P-Chain',
      stepPath: WEIGHT_STEP.pchain,
      landed: async () => (await pL1Validator(v1ValidationId))?.weight === V1_NEW_WEIGHT,
      beforeRetry: async () => {
        const loaded = browser.waitForResponse(MANAGER_CHAIN_RECORD, { timeout: 90_000 });
        await remountStep(screen, browser, WEIGHT_STEP.pchain);
        await loaded;
      },
      browser,
      screen,
      signer,
    });
    await chainShows('the P-Chain holds the new weight', async () => {
      return (await pL1Validator(v1ValidationId))?.weight === V1_NEW_WEIGHT;
    });

    // 4. Complete Weight Change. It signs with the L1's own subnet until the details load (UX finding 37).
    const completeLoaded = browser.waitForResponse(MANAGER_CHAIN_RECORD, { timeout: 90_000 });
    await clickNext(screen, browser, WEIGHT_STEP.complete);
    await completeLoaded;
    const attempts = await completeOnManager({
      step: 'weight-v1-complete',
      label: 'Complete V1 weight change',
      stepPath: WEIGHT_STEP.complete,
      button: 'Complete Weight Change',
      done: screen.getByText(/The validator weight has been updated successfully\./),
      landed: async () => {
        const v = await managerValidator(proxy, v1ValidationId);
        return v.receivedNonce === v.sentNonce && v.weight === V1_NEW_WEIGHT;
      },
      ready: async () => {
        await expect(screen.getByRole('button', 'Complete Weight Change')).toBeEnabled({ timeout: 60_000 });
      },
      remountReady: async () => {
        const loaded = browser.waitForResponse(MANAGER_CHAIN_RECORD, { timeout: 90_000 });
        await remountStep(screen, browser, WEIGHT_STEP.complete);
        await loaded;
      },
      browser,
      screen,
      signer,
    });
    note(`V1 weight change completed in ${attempts} attempt(s)`);
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT + V1_NEW_WEIGHT);
  });

  test('tops up the balance of V0', { timeout: 10 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    const v0 = need(run.v0, 'mock validator V0');
    const v0ValidationId = need(run.v0ValidationId, 'the V0 validation ID');

    await app.open('/console/layer-1/l1-validator-balance');
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await expect(toolHeading(screen, 'Validator Balance Increase')).toBeVisible();
    // By placeholder: the label 'Subnet ID' is not tied to its input (UX finding B16).
    await screen.getByPlaceholder('Enter subnet ID').fill(subnetId);
    await screen.getByText(v0.nodeID, { exact: true }).click({ timeout: 90_000 });
    // 'Amount' is not tied to its input (UX finding B17): the placeholder names it.
    await screen.getByPlaceholder('0.0').fill(TOP_UP_AVAX);

    const before = await chainShows('the P-Chain lists V0', () => pL1Validator(v0ValidationId));
    const button = screen.getByRole('button', 'Core Increase Balance');
    const from = signer.sends.length;
    const { send } = await sendOnce({
      step: 'top-up-v0',
      chain: 'P',
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
  });

  test('removes validator V1', { timeout: 25 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    const proxy = need(run.proxy, 'the proxy address');
    const v1 = need(run.v1, 'mock validator V1');
    const v1ValidationId = need(run.v1ValidationId, 'the V1 validation ID');

    // 1. Select L1 Subnet (the query sets it).
    await app.open(`/console/remove-validator/select-subnet?subnetId=${subnetId}`);
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
    await waitForPoaBadge(screen);
    await clickNext(screen, browser, REMOVE_STEP.initiate);

    // 2. Initiate Removal.
    await waitForPoaBadge(screen);
    await screen.getByText(v1.nodeID, { exact: true }).click({ timeout: 90_000 });
    const initiate = screen.getByRole('button', 'Initiate Validator Removal');
    let from = signer.sends.length;
    await sendOnce({
      step: 'remove-v1-initiate',
      chain: 'C',
      inputs: { validationId: v1ValidationId },
      landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.PendingRemoved,
      send: async () => {
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
    await submitWeightUpdate({
      step: 'remove-v1-pchain',
      label: 'Remove V1 on the P-Chain',
      stepPath: REMOVE_STEP.pchain,
      landed: async () => ((await pL1Validator(v1ValidationId))?.weight ?? 0n) === 0n,
      beforeRetry: async () => {
        await remountStep(screen, browser, REMOVE_STEP.pchain);
        await waitForPoaBadge(screen);
      },
      browser,
      screen,
      signer,
    });

    // 4. Complete Removal.
    await clickNext(screen, browser, REMOVE_STEP.complete);
    await waitForPoaBadge(screen);
    const attempts = await completeOnManager({
      step: 'remove-v1-complete',
      label: 'Complete V1 removal',
      stepPath: REMOVE_STEP.complete,
      button: 'Sign & Complete Validator Removal',
      done: screen.getByText('Validator removal completed'),
      landed: async () => (await managerValidator(proxy, v1ValidationId)).status === ValidatorStatus.Completed,
      ready: () => waitForPoaBadge(screen),
      browser,
      screen,
      signer,
    });
    note(`V1 removal completed in ${attempts} attempt(s)`);
    await expect.poll(() => managerTotalWeight(proxy), CHAIN_POLL).toBe(V0_WEIGHT);
    upsertValidator('V1', { state: 'removed' });
  });

  test('disables validator V0 (teardown)', { timeout: 20 * 60_000 }, async ({ app, browser, screen, wallet }) => {
    const { signer } = wallet;
    const subnetId = need(run.subnetId, 'the subnet ID');
    const v0 = need(run.v0, 'mock validator V0');
    const v0ValidationId = need(run.v0ValidationId, 'the V0 validation ID');

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
    // By placeholder: the label 'Subnet ID' is not tied to its input (UX finding B16).
    await screen.getByPlaceholder('Enter subnet ID').fill(subnetId);
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
    const { result } = await sendOnce({
      step: 'disable-v0',
      chain: 'P',
      inputs: { validationId: v0ValidationId },
      landed: async () => (await pL1Validator(v0ValidationId))?.balance === 0n,
      send: async () => {
        await screen.getByRole('button', 'Core Disable Validator').click();
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
    finishSend('disable-v0', { status: 'landed', glacierLagMs, outputs: { refunded: before.balance.toString() } });
    upsertValidator('V0', { state: 'disabled' });
    note(`V0 disabled (${result}); refund about ${before.balance} nAVAX`);
    if (result === 'sent') {
      await waitForPage(browser, 'Disable success', screen.getByRole('heading', 'Validator Disabled'));
    }
  });
});

interface StepContext {
  browser: Browser;
  screen: Screen;
  signer: Signer;
}

// A completion on the manager (C-Chain): the button aggregates the P-Chain's signed message and sends the tx with
// the Warp access list. Each click aggregates again. A reverted tx keeps the button disabled until the step mounts
// again (UX finding A7), so a retry mounts it first. Returns the attempts that clicked.
async function completeOnManager(
  o: StepContext & {
    step: string;
    label: string;
    stepPath: RegExp;
    button: string;
    done: Locator;
    landed: () => Promise<boolean>;
    ready: () => Promise<void>;
    remountReady?: () => Promise<void>;
  },
): Promise<number> {
  let attempts = 0;
  await sendOnce({
    step: o.step,
    chain: 'C',
    landed: o.landed,
    send: async () => {
      const from = o.signer.sends.length;
      const result = await deliverWithRetry({
        label: o.label,
        log: note,
        landed: o.landed,
        deliver: async (attempt) => {
          if (attempt > 1) {
            if (o.remountReady) await o.remountReady();
            else await remountStep(o.screen, o.browser, o.stepPath);
          }
          await o.ready();
          const start = o.signer.sends.length;
          const button = o.screen.getByRole('button', o.button);
          await button.click();
          const tx = await waitForSend(o.browser, o.signer, start, 'eth_sendTransaction', {
            timeoutMs: 6 * 60_000,
            failed: busyThenIdle(button),
          });
          note(`${o.label}: tx ${tx.hash}`);
          await waitForCTx(tx.hash as Hex);
          await waitForPage(o.browser, `${o.label} success`, o.done);
        },
      });
      attempts = result.attempts;
      return { txIds: o.signer.sends.slice(from).map((s) => s.hash) };
    },
    confirm: () => chainShows(o.label, o.landed),
  });
  finishSend(o.step, { status: 'landed', attempts });
  return attempts;
}

// The P-Chain step of change weight and remove (console/shared/SubmitPChainTxWeightUpdate.tsx): 'Aggregate
// Signatures', then 'Submit to P-Chain'. A retry mounts the step again, so it aggregates a fresh signature.
async function submitWeightUpdate(
  o: StepContext & {
    step: string;
    label: string;
    stepPath: RegExp;
    landed: () => Promise<boolean>;
    beforeRetry: () => Promise<void>;
  },
): Promise<void> {
  let attempts = 0;
  await sendOnce({
    step: o.step,
    chain: 'P',
    landed: o.landed,
    send: async () => {
      const from = o.signer.sends.length;
      const result = await deliverWithRetry({
        label: o.label,
        log: note,
        landed: o.landed,
        aggregate: async (attempt) => {
          if (attempt > 1) await o.beforeRetry();
          await clickAndSettle(
            o.browser,
            'Aggregate Signatures',
            o.screen.getByRole('button', 'Aggregate Signatures'),
            o.screen.getByText('Signatures aggregated'),
          );
        },
        deliver: async () => {
          const start = o.signer.sends.length;
          const button = o.screen.getByRole('button', 'Core Submit to P-Chain');
          await button.click();
          const idle = busyThenIdle(button);
          const failure = o.screen.getByText(/^P-Chain submission failed:/).first();
          const tx = await waitForSend(o.browser, o.signer, start, 'pvm.SetL1ValidatorWeightTx', {
            failed: async () => (await idle()) || (await failure.isVisible()),
          });
          note(`${o.label}: tx ${tx.hash}`);
          await waitForPTx(tx.hash);
          await waitForPage(o.browser, `${o.label} success`, o.screen.getByText(/^P-Chain tx confirmed:/));
        },
      });
      attempts = result.attempts;
      return { txIds: o.signer.sends.slice(from).map((s) => s.hash) };
    },
    confirm: () => chainShows(o.label, o.landed),
  });
  finishSend(o.step, { status: 'landed', attempts });
}
