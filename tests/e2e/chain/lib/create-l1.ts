// The create flow of the Console chain tests: a fresh L1 whose Validator Manager runs on the Fuji C-Chain, made with
// the Console's create-L1 flow (/console/create-l1), one test member per Console step. The members are the
// questionnaire, Create Subnet, the Validator Manager and its proxy, Initialize, Create Chain, the Docker step (skipped),
// Convert to L1 with mock validator V0, and Initialize Validator Set. No node runs the L1: V0 is a mock validator
// (lib/mock-validator.ts), and the Primary Network signs every Warp message for a C-Chain manager.
//
// A test file registers the members in its serial group and then goes on with its own members:
//
//   const flow = createL1Flow({ validatorType: 'pos-erc20', ledgerPath, runId });
//   describe('...', { serial: true, retries: 0, tags: [...] }, () => {
//     for (const step of flow.steps) {
//       test(step.title, { timeout: step.timeoutMs }, ({ app, browser, screen, wallet }) =>
//         step.run({ app, browser, screen, wallet }),
//       );
//     }
//     // the file's own members read flow.state
//   });
//
// chain/poa-cchain.e2e.ts (tier 1) and chain/pos-erc20-cchain.e2e.ts use it, with the validator type and the ledger
// path as options. Tier 1 also turns on `uxChecks`: the checks of the page that cost no tx (a reload between the two
// proxy deploys, and a blockchain ID in a Subnet ID field), so the PoS run does not repeat them.
//
// Each member checks the chain after its tx (lib/chain.ts) and skips a send that already landed (sendOnce,
// lib/ledger.ts). The page's own success (a tx ID, a link) is read from the page and checked against the wallet's tx;
// the flow stores in localStorage are only a cross-check. lib/console-map.md lists the controls, the success signals
// and the traps of each step.

import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { getAddress, type Address, type Hex } from 'viem';
import {
  EIP1967,
  FUJI,
  ValidatorStatus,
  assertFuji,
  cHasCode,
  cSlotAddress,
  chainShows,
  initialValidationId,
  managerIsValidatorSetInitialized,
  managerNodeValidationId,
  managerOwner,
  managerSubnetId,
  managerTotalWeight,
  managerValidator,
  pIsL1,
  pL1Validator,
  pSubnet,
  pTxJson,
  pTxStatus,
  validationIdToHex,
  waitForCTx,
  waitForGlacierSubnet,
  waitForPTx,
} from './chain.ts';
import {
  busyThenIdle,
  clickAndSettle,
  clickNext,
  note,
  openAsReturningVisitor,
  readStore,
  toolHeading,
  waitForPage,
  waitForSend,
} from './console.ts';
import { connectCore, type CoreWallet } from './fixtures.ts';
import {
  archiveLedger,
  finishSend,
  sendOnce,
  setL1,
  updateLedger,
  upsertValidator,
  type LedgerSend,
} from './ledger.ts';
import { createMockValidator, nodeCredentialsJson, type MockValidator } from './mock-validator.ts';
import { shownPChainTxId } from './validator-steps.ts';
import { deliverWithRetry } from './warp.ts';
import type { Signer } from '../wallet/signer.ts';

/** The questionnaire answer 'Validator management'. */
export type CreateL1ValidatorType = 'poa' | 'pos-erc20';

/** The fixtures that a member of a chain test takes. Destructure them in the test, so the runner sets them up. */
export interface ChainFixtures {
  app: App;
  browser: Browser;
  screen: Screen;
  wallet: CoreWallet;
}

/** What the create members found. The test file's later members read it. */
export interface CreateL1State {
  v0?: MockValidator;
  v0ValidationId?: string;
  subnetId?: string;
  blockchainId?: string;
  validatorMessages?: Address;
  validatorManager?: Address;
  proxyAdmin?: Address;
  /** The address that the Console and the P-Chain use for the manager: the TransparentUpgradeableProxy. */
  proxy?: Address;
  conversionTxId?: string;
}

export interface CreateL1Step {
  title: string;
  timeoutMs: number;
  run: (fixtures: ChainFixtures) => Promise<void>;
}

export interface CreateL1Options {
  validatorType: CreateL1ValidatorType;
  /** The ledger of the test file. Each file has its own, so a run never mixes two L1s in one ledger. */
  ledgerPath: string;
  runId: string;
  /**
   * Goes into the seed of the mock validators, so two files of one run (one CI run ID) make different NodeIDs. No
   * prefix gives the seeds of chain/poa-cchain.e2e.ts: '<runId> V0'.
   */
  seedPrefix?: string;
  /** Runs first in member 1, before the ledger moves to the archive. Throw to stop the group before any send. */
  beforeStart?: (fixtures: ChainFixtures) => void | Promise<void>;
  /**
   * The page checks that send no tx: a reload between the ProxyAdmin and the proxy deploy (the page keeps the
   * ProxyAdmin), and a blockchain ID in the 'L1 Subnet ID' field of Initialize Validator Set (the page says that it is
   * not a Subnet ID). Tier 1 runs them; another file that makes an L1 leaves them out.
   */
  uxChecks?: boolean;
}

export interface CreateL1Flow {
  readonly state: CreateL1State;
  readonly steps: readonly CreateL1Step[];
}

const CREATE = '/console/create-l1';
// The create flow's store (createChainStore.ts, persisted per network).
const CREATE_STORE = 'v4-create-chain-store-testnet';
// The Subnet ID field's text for an ID that Glacier does not know on Fuji or Mainnet (subnetLookupErrorText in
// components/toolbox/utils/vmcLookupText.ts, shown by components/toolbox/components/InputSubnetId.tsx).
const SUBNET_NOT_FOUND =
  'This L1 is not on Fuji. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.';
const V0_WEIGHT = 100n;
const V0_BALANCE_AVAX = '0.02';
const V0_BALANCE_NAVAX = 20_000_000n;
// The VM of the chain that Create Chain makes: subnet-evm (SUBNET_EVM_VM_ID in constants/console.ts).
const SUBNET_EVM_VM_ID = 'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy';
// The Primary Network's subnet ID signs for a manager on the C-Chain.
const PRIMARY_NETWORK = FUJI.primaryNetworkId;

/** A Node check after a tx: the public RPC is load-balanced, and a node can lag the tx for a few seconds. */
export const CHAIN_POLL = { timeout: 90_000, interval: 2_000 };

/** The value that an earlier member put in the shared state, or an error that names it. */
export function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`An earlier member did not record ${what}.`);
  return value;
}

/** One output of a ledger step, as a string. */
export function output(send: LedgerSend, key: string): string {
  const value = send.outputs?.[key];
  if (typeof value !== 'string') throw new Error(`The ledger step '${send.step}' has no output '${key}'.`);
  return value;
}

/**
 * One contract deploy from one button: the receipt names the contract. Skips the send when the ledger step holds an
 * address with code. Returns the address and whether this call sent the tx.
 */
export async function deployFromButton(
  { browser, signer, ledgerPath }: { browser: Browser; screen: Screen; signer: Signer; ledgerPath: string },
  step: string,
  click: () => Promise<void>,
): Promise<{ address: Address; result: 'sent' | 'skipped' }> {
  const from = signer.sends.length;
  const { result, send } = await sendOnce({
    step,
    chain: 'C',
    path: ledgerPath,
    landed: async (prev) => !!prev?.outputs?.address && (await cHasCode(output(prev, 'address') as Address)),
    send: async () => {
      await click();
      const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction');
      const receipt = await waitForCTx(tx.hash as Hex);
      if (!receipt.contractAddress) throw new Error(`${step}: the receipt of ${tx.hash} has no contract address.`);
      return { txIds: [tx.hash], outputs: { address: getAddress(receipt.contractAddress) } };
    },
    confirm: async (sent) =>
      chainShows(`code at ${output(sent, 'address')}`, () => cHasCode(output(sent, 'address') as Address)),
  });
  const address = getAddress(output(send, 'address'));
  note(`${step}: ${address} (${result})`);
  return { address, result };
}

/** The review list of the questionnaire: the step labels of generateSteps.ts getStepLabel, in flow order. */
function reviewSteps(validatorType: CreateL1ValidatorType): string[] {
  const create = [
    'Create Subnet',
    'Deploy Validator Manager',
    'Proxy Setup',
    'Initialize Validator Manager',
    'Create Chain',
    'Docker Node Setup',
    'Convert to L1',
    'Initialize Validator Set',
  ];
  if (validatorType === 'poa') return create;
  return [
    ...create,
    'Deploy ERC20 Token (Optional)',
    'Deploy ERC20 Staking Manager',
    'Deploy Reward Calculator',
    'Initialize Staking Manager',
    'Enable Minting',
    'Transfer Ownership → Staking Manager',
  ];
}

/**
 * Adds a mock validator on the 'API Response' tab of the validator list (Convert to L1, Add Validator): its
 * info.getNodeID response in 'Paste the JSON response below:', then 'Add Validator'. The card of the validator opens;
 * its header is a button named by the NodeID.
 */
export async function addValidatorFromJson(screen: Screen, mock: MockValidator): Promise<void> {
  await screen.getByRole('tab', 'API Response').click();
  await screen.getByRole('textbox', /^Paste the JSON response/).fill(nodeCredentialsJson(mock));
  await screen.getByRole('button', 'Add Validator').click();
  await expect(screen.getByRole('button', mock.nodeID)).toHaveAttribute('aria-expanded', 'true');
}

// The fields of a CreateChainTx that the test checks (platform.getTx, JSON encoding). A node that has not seen the tx
// answers 'not found', which chainShows reads as not yet.
const pCreateChainTx = (txId: string) => pTxJson<{ subnetID: string; vmID: string }>(txId);

/** The create members for one test file. The returned state fills as the members run. */
export function createL1Flow(options: CreateL1Options): CreateL1Flow {
  const { validatorType, ledgerPath: path, runId, seedPrefix, beforeStart, uxChecks = false } = options;
  const state: CreateL1State = {};
  const seed = (label: string) => (seedPrefix ? `${runId} ${seedPrefix} ${label}` : `${runId} ${label}`);

  const deploy = async ({ browser, screen, wallet }: ChainFixtures, step: string, click: () => Promise<void>) =>
    (await deployFromButton({ browser, screen, signer: wallet.signer, ledgerPath: path }, step, click)).address;

  const answerQuestionnaire = async (fixtures: ChainFixtures) => {
    const { app, browser, screen, wallet } = fixtures;
    await beforeStart?.(fixtures);
    // A run makes a new L1. The last run's ledger moves to archive/, where teardown.ts still finds it.
    archiveLedger(path);
    updateLedger((ledger) => {
      ledger.runId = runId;
      ledger.baseUrl = app.baseUrl;
      ledger.l1.managerChain = 'C';
    }, path);
    await assertFuji();
    note(`run ${runId} (${validatorType}), wallet C ${wallet.signer.address}, P ${wallet.signer.pChainAddress}`);

    await openAsReturningVisitor(app, browser, CREATE);
    await connectCore(screen);

    await expect(screen.getByRole('heading', 'Choose a setup')).toBeVisible();
    await screen.getByRole('button', /^Advanced setup/).click();
    await screen.getByRole('button', 'Continue').click();

    // A card's name is its title, its description and, on some cards, 'Recommended'. The picked card is pressed.
    const answer = async (question: string, card: RegExp) => {
      await expect(screen.getByRole('heading', question)).toBeVisible();
      await screen.getByRole('button', card).click();
      await expect(screen.getByRole('button', card)).toHaveAttribute('aria-pressed', 'true');
      await screen.getByRole('button', 'Continue').click();
    };
    // Pick the validator type first: picking it resets the manager location (CreateL1Questionnaire.tsx). PoS-ERC20
    // sets it to the C-Chain, PoA to the L1; the next answer picks the C-Chain for both.
    await answer('Validator management', validatorType === 'poa' ? /^Proof of Authority/ : /^Proof of Stake \(ERC20\)/);
    await answer('Validator Manager location', /^On C-Chain/);
    await answer('Interoperability', /^Enable cross-chain messaging/);
    // The ownership question shows for PoA on the C-Chain only.
    if (validatorType === 'poa') await answer('Contract ownership', /^Single wallet/);
    await answer('Infrastructure', /^Docker/);

    await expect(screen.getByRole('heading', 'Review your setup')).toBeVisible();
    // The banner shows when the wallet is on mainnet. The wallet is on Fuji.
    await expect(screen.getByText('We recommend starting on Fuji testnet', { exact: false })).toBeHidden();
    for (const step of reviewSteps(validatorType)) {
      await expect(screen.getByText(step, { exact: true }).first()).toBeVisible();
    }
    if (validatorType === 'poa') {
      // The PoS steps are not in a PoA flow.
      await expect(screen.getByText('Deploy ERC20 Staking Manager', { exact: true })).toHaveCount(0);
    }
    await screen.getByRole('button', 'Start deployment').click();
    await browser.waitForURL(/\/console\/create-l1\/create-subnet$/, { timeout: 60_000 });
  };

  const createSubnet = async ({ browser, screen, wallet }: ChainFixtures) => {
    const { signer } = wallet;
    await expect(toolHeading(screen, 'Create Subnet')).toBeVisible();
    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'create-subnet',
      chain: 'P',
      path,
      landed: async (prev) => !!prev?.txIds[0] && (await pSubnet(prev.txIds[0])) !== null,
      send: async () => {
        await screen.getByRole('button', 'Create Subnet').click();
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
    state.subnetId = subnetId;
    setL1({ subnetId }, path);
    note(`subnet ${subnetId} (${result})`);

    // The subnet ID is the CreateSubnetTx ID. The wallet's P-Chain address is its only owner.
    const subnet = await chainShows('the P-Chain lists the subnet', () => pSubnet(subnetId));
    expect(subnet?.controlKeys).toEqual([signer.pChainAddress]);
    expect(subnet?.threshold).toBe('1');
    if (result === 'sent') {
      await shownPChainTxId(browser, screen, 'Create Subnet success', 'Subnet ID (CreateSubnetTx)', subnetId);
      // One subnet per run: the page offers no second Create Subnet.
      await expect(screen.getByRole('button', 'Create Subnet')).toBeDisabled();
    }
  };

  const deployValidatorManager = async (fixtures: ChainFixtures) => {
    const { browser, screen } = fixtures;
    await clickNext(screen, browser, /\/console\/create-l1\/deploy-validator-manager$/);
    await expect(toolHeading(screen, 'Deploy Validator Contracts')).toBeVisible();

    state.validatorMessages = await deploy(fixtures, 'deploy-validator-messages', () =>
      screen.getByRole('button', 'Deploy Library').click(),
    );
    await waitForPage(browser, 'Deploy Library success', screen.getByRole('button', 'Redeploy library'));
    await expect(screen.getByText(new RegExp(`^${state.validatorMessages}$`, 'i'))).toBeVisible();

    state.validatorManager = await deploy(fixtures, 'deploy-validator-manager', () =>
      screen.getByRole('button', 'Deploy Contract').click(),
    );
    await waitForPage(browser, 'Deploy Contract success', screen.getByRole('button', 'Redeploy manager'));
    await expect(screen.getByText(new RegExp(`^${state.validatorManager}$`, 'i'))).toBeVisible();
    setL1(
      { validatorMessagesLibrary: state.validatorMessages, validatorManagerImplementation: state.validatorManager },
      path,
    );
  };

  const deployProxy = async (fixtures: ChainFixtures) => {
    const { browser, screen } = fixtures;
    const implementation = need(state.validatorManager, 'the ValidatorManager address');
    const subnetId = need(state.subnetId, 'the subnet ID');
    await clickNext(screen, browser, /\/console\/create-l1\/proxy-setup$/);
    await expect(toolHeading(screen, 'Proxy Setup')).toBeVisible();

    // On the C-Chain the 'Deploy New Proxy' section opens by itself once the wallet chain is known.
    const deployAdmin = screen.getByRole('button', 'Deploy ProxyAdmin');
    await expect(deployAdmin).toBeEnabled({ timeout: 60_000 });
    const proxyAdmin = await deploy(fixtures, 'deploy-proxy-admin', () => deployAdmin.click());
    state.proxyAdmin = proxyAdmin;
    // The ProxyAdmin step shows a check and the address cut to 10 characters, and its button is gone.
    const savedAdmin = screen.getByText(new RegExp(`^${proxyAdmin.slice(0, 10)}\\.\\.\\.$`, 'i'));
    await expect(savedAdmin).toBeVisible({ timeout: 60_000 });
    await expect(deployAdmin).toHaveCount(0);

    if (uxChecks) {
      // The page keeps the ProxyAdmin that it deployed, for this chain and L1, so a reload between the two deploys
      // does not ask for a second one.
      const { proxyAdmin: saved } = (await readStore(browser, CREATE_STORE)) as {
        proxyAdmin?: { address: string; evmChainId: number; subnetId: string } | null;
      };
      expect(saved && getAddress(saved.address), 'the store keeps the ProxyAdmin').toBe(proxyAdmin);
      expect(saved?.evmChainId).toBe(43113);
      expect(saved?.subnetId).toBe(subnetId);
      await browser.reload();
      await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
      await expect(toolHeading(screen, 'Proxy Setup')).toBeVisible();
      await expect(savedAdmin).toBeVisible({ timeout: 60_000 });
      await expect(deployAdmin).toHaveCount(0);
      note(`the page kept ProxyAdmin ${proxyAdmin} across a reload`);
    }

    // The proxy button takes the ValidatorManager as its implementation. A string name is exact, so 'Deploy Proxy'
    // does not match 'Deploy ProxyAdmin'.
    const deployProxyButton = screen.getByRole('button', 'Deploy Proxy');
    await expect(screen.getByRole('textbox', 'Implementation address')).toHaveValue(
      new RegExp(`^${implementation}$`, 'i'),
      { timeout: 60_000 },
    );
    await expect(deployProxyButton).toBeEnabled({ timeout: 60_000 });
    state.proxy = await deploy(fixtures, 'deploy-proxy', () => deployProxyButton.click());
    setL1({ proxyAdmin, validatorManager: state.proxy }, path);

    await waitForPage(browser, 'Proxy Setup success', screen.getByText('Proxy is up to date'));
    // EIP-1967: the proxy points at the ValidatorManager, and the ProxyAdmin administers it.
    const proxy = state.proxy;
    await expect.poll(() => cSlotAddress(proxy, EIP1967.implementation), CHAIN_POLL).toBe(implementation);
    await expect.poll(() => cSlotAddress(proxy, EIP1967.admin), CHAIN_POLL).toBe(state.proxyAdmin);
    // The next steps take the manager address from the create store: it is the proxy now. The ProxyAdmin record
    // goes once the proxy is deployed.
    const store = await readStore(browser, CREATE_STORE);
    expect(getAddress(String(store.managerAddress))).toBe(state.proxy);
    expect(store.proxyAdmin ?? null, 'the store drops the ProxyAdmin record after the proxy deploy').toBeNull();
  };

  const initializeValidatorManager = async ({ browser, screen, wallet }: ChainFixtures) => {
    const { signer } = wallet;
    const proxy = need(state.proxy, 'the proxy address');
    const subnetId = need(state.subnetId, 'the subnet ID');
    await clickNext(screen, browser, /\/console\/create-l1\/initialize-manager$/);
    await expect(toolHeading(screen, 'Initialize Validator Manager')).toBeVisible();

    // Initialize binds the manager to the subnet for good: check the subnet before the click.
    await waitForPage(browser, 'Initialize status', screen.getByText('Ready to initialize'), 90_000);
    await expect(screen.getByRole('textbox', 'Subnet ID')).toHaveValue(subnetId);

    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'initialize-validator-manager',
      chain: 'C',
      path,
      landed: async () => (await managerSubnetId(proxy)) === subnetId,
      send: async () => {
        await screen.getByRole('button', 'Initialize Contract').click();
        const tx = await waitForSend(browser, signer, from, 'eth_sendTransaction');
        await waitForCTx(tx.hash as Hex);
        return { txIds: [tx.hash] };
      },
    });
    if (result === 'sent') {
      // The page names the tx: 'Contract initialized. Transaction hash:' and the hash.
      await waitForPage(browser, 'Initialize success', screen.getByText(/^Contract initialized/));
      await expect(screen.getByText(send.txIds[0], { exact: true })).toBeVisible();
    } else {
      await waitForPage(browser, 'Initialize status', screen.getByText('Contract already initialized'));
    }
    await expect.poll(() => managerSubnetId(proxy), CHAIN_POLL).toBe(subnetId);
    await expect.poll(() => managerOwner(proxy), CHAIN_POLL).toBe(signer.address);
  };

  const createChain = async ({ browser, screen, wallet }: ChainFixtures) => {
    const { signer } = wallet;
    const subnetId = need(state.subnetId, 'the subnet ID');
    await clickNext(screen, browser, /\/console\/create-l1\/create-chain$/);
    await expect(toolHeading(screen, 'Create Chain')).toBeVisible();

    // The button shows once the default genesis is valid.
    const create = screen.getByRole('button', 'Create Chain');
    await waitForPage(browser, 'Create Chain button', create, 60_000);
    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'create-chain',
      chain: 'P',
      path,
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
    state.blockchainId = blockchainId;
    setL1({ blockchainId }, path);
    note(`chain ${blockchainId} (${result})`);

    // The blockchain ID is the CreateChainTx ID. The P-Chain holds the chain on this run's subnet, with subnet-evm.
    const created = await chainShows('the P-Chain holds the CreateChainTx', () => pCreateChainTx(blockchainId));
    expect(created.subnetID).toBe(subnetId);
    expect(created.vmID).toBe(SUBNET_EVM_VM_ID);
    if (result === 'sent') {
      const label = /^Chain ".*" created \(CreateChainTx ID\)$/;
      await shownPChainTxId(browser, screen, 'Create Chain success', label, blockchainId);
      await expect(create).toBeDisabled();
    }
  };

  const skipDockerSetup = async ({ browser, screen }: ChainFixtures) => {
    // The test runs no node: the mock validators need none. 'Next' is not gated on this step.
    await clickNext(screen, browser, /\/console\/create-l1\/docker-setup$/);
    await expect(toolHeading(screen, 'L1 Node Setup with Docker')).toBeVisible();
  };

  const convertToL1 = async ({ browser, screen, wallet }: ChainFixtures) => {
    const { signer } = wallet;
    const subnetId = need(state.subnetId, 'the subnet ID');
    const proxy = need(state.proxy, 'the proxy address');
    const v0 = createMockValidator({ label: 'V0', seed: seed('V0') });
    state.v0 = v0;
    const v0ValidationId = initialValidationId(subnetId, 0);
    state.v0ValidationId = v0ValidationId;
    upsertValidator(
      'V0',
      {
        nodeId: v0.nodeID,
        validationId: v0ValidationId,
        subnetId,
        weight: V0_WEIGHT.toString(),
        balance: V0_BALANCE_NAVAX.toString(),
        blsPublicKey: v0.publicKey,
        state: 'initial',
      },
      path,
    );

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
    await expect(screen.getByRole('textbox', 'Manager Chain ID')).toHaveValue(FUJI.cBlockchainId);
    await expect(screen.getByRole('textbox', 'Manager Contract Address')).toHaveValue(new RegExp(`^${proxy}$`, 'i'));

    await addValidatorFromJson(screen, v0);
    const weight = screen.getByRole('spinbutton', 'Consensus Weight');
    const balance = screen.getByRole('spinbutton', 'Validator Balance (P-Chain AVAX)');
    await expect(weight).toHaveValue(V0_WEIGHT.toString());
    // fill, not typed keys: the field converts each value to nAVAX at once.
    await balance.fill(V0_BALANCE_AVAX);
    await expect(balance).toHaveValue(V0_BALANCE_AVAX);
    await expect(screen.getByText('Checking the manager address on the C-Chain...')).toBeHidden({ timeout: 60_000 });

    const from = signer.sends.length;
    const { result, send } = await sendOnce({
      step: 'convert-to-l1',
      chain: 'P',
      path,
      inputs: { nodeId: v0.nodeID, weight: V0_WEIGHT.toString(), balance: V0_BALANCE_NAVAX.toString() },
      landed: () => pIsL1(subnetId),
      send: async () => {
        await screen.getByRole('button', 'Convert to L1').click();
        const tx = await waitForSend(browser, signer, from, 'pvm.ConvertSubnetToL1Tx');
        return { txIds: [tx.hash] };
      },
      confirm: async (sent) => {
        await waitForPTx(sent.txIds[0]);
        await chainShows('the P-Chain shows the L1', () => pIsL1(subnetId));
        return true;
      },
    });
    finishSend('convert-to-l1', { status: 'landed', glacierLagMs }, path);
    state.conversionTxId = send.txIds[0];
    setL1({ conversionTxId: state.conversionTxId }, path);
    note(`conversion ${state.conversionTxId} (${result})`);

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

    if (result === 'sent') {
      // The page names the tx under 'ConvertSubnetToL1Tx ID', and the button says the subnet is converted.
      const shown = await shownPChainTxId(
        browser,
        screen,
        'Convert success',
        'ConvertSubnetToL1Tx ID',
        state.conversionTxId,
      );
      await expect(screen.getByRole('button', 'Converted to L1')).toBeDisabled();
      expect((await readStore(browser, CREATE_STORE)).convertToL1TxId, 'the create store').toBe(shown);
    }
  };

  const initializeValidatorSet = async ({ browser, screen, wallet }: ChainFixtures) => {
    const { signer } = wallet;
    const subnetId = need(state.subnetId, 'the subnet ID');
    const proxy = need(state.proxy, 'the proxy address');
    const v0 = need(state.v0, 'mock validator V0');
    const v0ValidationId = need(state.v0ValidationId, 'the V0 validation ID');
    const conversionTxId = need(state.conversionTxId, 'the conversion tx');
    await clickNext(screen, browser, /\/console\/create-l1\/init-validator-set$/);
    await expect(toolHeading(screen, 'Initialize Validator Set')).toBeVisible();
    const subnetField = screen.getByRole('textbox', 'L1 Subnet ID');
    const conversionField = screen.getByRole('textbox', 'Conversion Tx ID (P-Chain)');
    await expect(subnetField).toHaveValue(subnetId);
    await expect(conversionField).toHaveValue(conversionTxId, { timeout: 60_000 });

    if (uxChecks) {
      // A blockchain ID in the Subnet ID field: the page says that it is not a Subnet ID and asks the wallet for
      // nothing. The subnet ID again brings the conversion back.
      const blockchainId = need(state.blockchainId, 'the blockchain ID');
      const notFound = screen.getByText(SUBNET_NOT_FOUND, { exact: true });
      const sends = signer.sends.length;
      await subnetField.fill(blockchainId);
      await expect(notFound).toBeVisible({ timeout: 60_000 });
      await subnetField.fill(subnetId);
      await expect(notFound).toBeHidden({ timeout: 60_000 });
      await expect(conversionField).toHaveValue(conversionTxId, { timeout: 60_000 });
      expect(signer.sends.length, 'the wallet sent nothing for the wrong ID').toBe(sends);
    }

    let attempts = 0;
    const firstSend = signer.sends.length;
    await sendOnce({
      step: 'init-validator-set',
      chain: 'C',
      path,
      landed: () => managerIsValidatorSetInitialized(proxy),
      send: async () => {
        const result = await deliverWithRetry({
          label: 'Initialize Validator Set',
          log: note,
          landed: () => managerIsValidatorSetInitialized(proxy),
          // The page keeps its signature and reuses it on each 'Initialize Validator Set' click. A retry clicks
          // 'Re-aggregate signatures': it drops the signature and starts a new aggregation at once, so the test does
          // not click 'Aggregate Signatures' after it.
          aggregate: async (attempt) => {
            const aggregateButton = screen.getByRole('button', 'Aggregate Signatures');
            const aggregated = screen.getByText('Signature aggregated');
            if (attempt > 1) {
              const again = screen.getByRole('button', 'Re-aggregate signatures');
              await clickAndSettle(browser, 'Re-aggregate signatures', aggregateButton, aggregated, 300_000, () =>
                again.click(),
              );
            } else {
              await clickAndSettle(browser, 'Aggregate Signatures', aggregateButton, aggregated);
            }
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
            await waitForPage(
              browser,
              'Initialize Validator Set success',
              screen.getByText('Validator set initialized'),
            );
          },
        });
        attempts = result.attempts;
        note(`Initialize Validator Set: ${result.attempts} attempt(s). ${result.errors.join('; ')}`);
        return { txIds: signer.sends.slice(firstSend).map((s) => s.hash) };
      },
    });
    finishSend('init-validator-set', { status: 'landed', attempts }, path);

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
    upsertValidator('V0', { state: 'registered' }, path);
    // The signing subnet is the Primary Network for a C-Chain manager.
    expect(await screen.getByText(/^subnet: /).textContent()).toContain(PRIMARY_NETWORK.slice(0, 12));
  };

  const minutes = (n: number) => n * 60_000;
  const steps: CreateL1Step[] = [
    { title: 'answers the create-L1 questionnaire', timeoutMs: minutes(5), run: answerQuestionnaire },
    { title: 'creates the subnet', timeoutMs: minutes(5), run: createSubnet },
    { title: 'deploys the validator manager contracts', timeoutMs: minutes(8), run: deployValidatorManager },
    { title: 'deploys the proxy', timeoutMs: minutes(8), run: deployProxy },
    { title: 'initializes the validator manager', timeoutMs: minutes(6), run: initializeValidatorManager },
    { title: 'creates the chain', timeoutMs: minutes(6), run: createChain },
    { title: 'skips the Docker node setup', timeoutMs: minutes(2), run: skipDockerSetup },
    { title: 'converts the subnet to an L1 with mock validator V0', timeoutMs: minutes(20), run: convertToL1 },
    { title: 'initializes the validator set', timeoutMs: minutes(25), run: initializeValidatorSet },
  ];
  return { state, steps };
}
