/**
 * In-memory mock orchestrator for Basic L1 Setup.
 *
 * Stands in for the real Railway microservice until it's built. Keeps
 * jobs in a module-level Map that advances through the scripted step
 * sequence on a timer. Zero persistence — jobs evaporate on dev-server
 * restart, which is fine for design reviews and UX iteration.
 *
 * The API routes call into this module when `QUICK_L1_SERVICE_URL` is
 * not set in env. Once Railway is live, we swap to proxying and this
 * file stays as a dev-only fallback.
 */

import type {
  DeployRequest,
  DeploymentJob,
  DeploymentStep,
  DeploymentResult,
  InteropResult,
  TxRecord,
} from './types';
import { DEFAULT_PRECOMPILES, DEPLOYMENT_STEPS, INTEROP_ONLY_STEPS } from './types';

/**
 * Per-step delay in ms. Tuned to feel real without making demos tedious —
 * bootstrap gets the longest slot because that's where the real service
 * will actually wait. Total runtime ~25s with interop off, ~45s on.
 */
const STEP_DELAYS_MS: Record<DeploymentStep, number> = {
  'creating-subnet': 2500,
  'deploying-validator-manager': 3500,
  'initializing-manager': 2000,
  'reserving-relayer': 800,
  'creating-chain': 2500,
  'provisioning-node': 3000,
  'converting-to-l1': 2500,
  'initializing-validator-set': 2000,
  'deploying-token-home': 3000,
  'deploying-icm-registry': 2000,
  'deploying-token-remote': 2000,
  'starting-relayer': 1500,
  'registering-remote': 2500,
  'bridging-initial-tokens': 3500,
};

/**
 * Detail string shown under the current step (e.g. fake tx hashes).
 * Purely cosmetic — gives users something to read while each step runs.
 */
const STEP_DETAIL: Record<DeploymentStep, (job: DeploymentJob) => string> = {
  'creating-subnet': () => 'Submitting subnet creation tx to P-Chain…',
  'deploying-validator-manager': () => 'Deploying ValidatorMessages + ValidatorManager on C-Chain…',
  'initializing-manager': (job) =>
    `Calling initialize() on Validator Manager — owner set to ${job.request.ownerEvmAddress}`,
  'reserving-relayer': () => 'Reserving ICM relayer key for L1 genesis alloc…',
  'creating-chain': () => 'Building genesis and submitting chain creation tx…',
  'provisioning-node': () => 'Requesting a managed validator node on Fuji…',
  'converting-to-l1': () => 'Submitting convertSubnetToL1Tx with validator credentials…',
  'initializing-validator-set': () => 'Aggregating Warp signatures and seeding the initial validator set…',
  'deploying-token-home': () => 'Deploying MockUSDC + ERC20TokenHome on Fuji C-Chain…',
  'deploying-icm-registry': () => 'Deploying TeleporterRegistry on the new L1…',
  'deploying-token-remote': () => 'Deploying ERC20TokenRemote on the new L1…',
  'starting-relayer': () => 'Attaching chain configs to the reserved relayer…',
  'registering-remote': () =>
    'Calling registerWithHome on L1 and waiting for the Home to record the remote…',
  'bridging-initial-tokens': (job) =>
    `Bridging 100 MockUSDC to ${job.request.ownerEvmAddress} on L1…`,
};

const jobs = new Map<string, DeploymentJob>();

/** Generate a mock jobId. Real service should use cuid/uuid. */
function genJobId(): string {
  return `mock_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/** Plausible-looking fake P-Chain tx id (base58-ish, 49 chars). */
function fakePChainTxId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let out = '';
  for (let i = 0; i < 49; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Plausible-looking fake EVM tx hash (0x + 64 hex). */
function fakeEvmTxHash(): `0x${string}` {
  const hex = '0123456789abcdef';
  let out = '0x';
  for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out as `0x${string}`;
}

/**
 * Scripted tx evidence per step. Real backend (quick-l1 Railway service)
 * produces these for real via @avalanche-sdk/client + viem; the mock
 * emits plausible fakes so the progress UI can exercise the same render
 * path end to end.
 */
function makeTxsForStep(step: DeploymentStep, network: 'fuji' | 'mainnet'): TxRecord[] {
  const now = new Date().toISOString();
  switch (step) {
    case 'creating-subnet':
      return [{ hash: fakePChainTxId(), chain: 'p-chain', network, label: 'CreateSubnetTx', timestamp: now }];
    case 'deploying-validator-manager':
      return [
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'ValidatorMessages library', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'ValidatorManager', timestamp: now },
      ];
    case 'initializing-manager':
      return [{ hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'initialize()', timestamp: now }];
    case 'reserving-relayer':
      return []; // Upstream HTTP call — no on-chain tx.
    case 'creating-chain':
      return [{ hash: fakePChainTxId(), chain: 'p-chain', network, label: 'CreateChainTx', timestamp: now }];
    case 'provisioning-node':
      return []; // Managed-node HTTP call — no on-chain tx.
    case 'converting-to-l1':
      return [{ hash: fakePChainTxId(), chain: 'p-chain', network, label: 'ConvertSubnetToL1Tx', timestamp: now }];
    case 'initializing-validator-set':
      return [{ hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'initializeValidatorSet()', timestamp: now }];
    case 'deploying-token-home':
      return [
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'Deploy MockUSDC', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'Deploy ERC20TokenHome', timestamp: now },
      ];
    case 'deploying-icm-registry':
      return [{ hash: fakeEvmTxHash(), chain: 'l1', network, label: 'Deploy TeleporterRegistry', timestamp: now }];
    case 'deploying-token-remote':
      return [{ hash: fakeEvmTxHash(), chain: 'l1', network, label: 'Deploy ERC20TokenRemote', timestamp: now }];
    case 'starting-relayer':
      return []; // Upstream HTTP call — no on-chain tx.
    case 'registering-remote':
      return [{ hash: fakeEvmTxHash(), chain: 'l1', network, label: 'registerWithHome()', timestamp: now }];
    case 'bridging-initial-tokens':
      return [
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'Mint MockUSDC', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'Approve TokenHome', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'c-chain', network, label: 'Send → L1', timestamp: now },
      ];
  }
}

/** Plausible-looking fake EVM address (0x + 40 hex). */
function fakeEvmAddress(): `0x${string}` {
  const hex = '0123456789abcdef';
  let out = '0x';
  for (let i = 0; i < 40; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out as `0x${string}`;
}

/** Generate a deterministic-ish mock result once the deployment is complete. */
function mockResult(req: DeployRequest): DeploymentResult {
  const evmChainId = 100000 + Math.floor(Math.random() * 899999);
  // Fake base58 / hex strings just long enough to look convincing in the UI.
  const subnetId = `mock${Math.random().toString(36).slice(2, 14)}subnet`;
  const blockchainId = `mock${Math.random().toString(36).slice(2, 14)}chain`;
  const nodeId = `NodeID-${Math.random().toString(36).slice(2, 10).toUpperCase()}Mock`;
  const base: DeploymentResult = {
    subnetId,
    blockchainId,
    evmChainId,
    rpcUrl: `https://mock-rpc.fuji.network/bc/${blockchainId}/rpc`,
    validatorManagerAddress: fakeEvmAddress(),
    nodeId,
  };
  const interopOn = req.precompiles?.interoperability ?? DEFAULT_PRECOMPILES.interoperability;
  if (!interopOn) return base;
  const interop: InteropResult = {
    relayerAddress: fakeEvmAddress(),
    mockUsdcAddress: fakeEvmAddress(),
    tokenHomeAddress: fakeEvmAddress(),
    icmRegistryAddress: fakeEvmAddress(),
    tokenRemoteAddress: fakeEvmAddress(),
    bridgedAmount: (100n * 10n ** 18n).toString(),
  };
  return { ...base, interop };
}

/**
 * Kick off the step-by-step progression. Setters run on setTimeout
 * chains — simple but adequate for dev mocks. Real backend will do the
 * actual @avalanche-sdk/client + viem work.
 */
function runMockLifecycle(jobId: string) {
  const initialJob = jobs.get(jobId);
  if (!initialJob) return;
  // Mirror the real orchestrator: drop interop-only steps when the user
  // has disabled `interoperability` on the precompile config.
  const interopOn =
    initialJob.request.precompiles?.interoperability ?? DEFAULT_PRECOMPILES.interoperability;
  const steps: DeploymentStep[] = interopOn
    ? [...DEPLOYMENT_STEPS]
    : DEPLOYMENT_STEPS.filter((s) => !INTEROP_ONLY_STEPS.includes(s));

  const advance = (stepIdx: number) => {
    const job = jobs.get(jobId);
    if (!job) return; // Job was deleted (dev reload)

    if (stepIdx >= steps.length) {
      const completed: DeploymentJob = {
        ...job,
        status: 'complete',
        currentStep: steps[steps.length - 1]!,
        completedSteps: [...steps],
        statusDetail: 'Deployment complete',
        result: mockResult(job.request),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(jobId, completed);
      return;
    }

    const step = steps[stepIdx]!;
    const prevStep = stepIdx > 0 ? steps[stepIdx - 1]! : null;

    // When we transition off a step, emit its tx evidence. Emitting on
    // transition (rather than up-front) matches how real chains behave:
    // the tx gets the "it happened" stamp once the step completes.
    const evidence = job.evidence.slice();
    if (prevStep && !evidence.some((e) => e.step === prevStep)) {
      evidence.push({ step: prevStep, txs: makeTxsForStep(prevStep, job.request.network) });
    }

    const updated: DeploymentJob = {
      ...job,
      status: 'running',
      currentStep: step,
      completedSteps: steps.slice(0, stepIdx),
      statusDetail: STEP_DETAIL[step](job),
      evidence,
      updatedAt: new Date().toISOString(),
    };
    jobs.set(jobId, updated);

    setTimeout(() => advance(stepIdx + 1), STEP_DELAYS_MS[step]);
  };

  // Fire-and-forget. In production we'd log; here the mock just advances.
  setTimeout(() => advance(0), 500);
}

/**
 * Start a new deployment. Returns the jobId immediately — progression
 * happens on a background timer chain.
 */
export function startMockDeployment(request: DeployRequest): { jobId: string } {
  const jobId = genJobId();
  const now = new Date().toISOString();
  const job: DeploymentJob = {
    jobId,
    status: 'pending',
    currentStep: null,
    completedSteps: [],
    evidence: [],
    request,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(jobId, job);
  runMockLifecycle(jobId);
  return { jobId };
}

export function getMockJob(jobId: string): DeploymentJob | null {
  return jobs.get(jobId) ?? null;
}
