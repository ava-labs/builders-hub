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

import type { DeployRequest, DeploymentJob, DeploymentStep, DeploymentResult, TxRecord } from './types';
import { DEPLOYMENT_STEPS } from './types';

/**
 * Per-step delay in ms. Tuned to feel real without making demos tedious —
 * bootstrap gets the longest slot because that's where the real service
 * will actually wait. Total runtime ~25s.
 */
const STEP_DELAYS_MS: Record<DeploymentStep, number> = {
  'creating-subnet': 2500,
  'creating-chain': 2500,
  'provisioning-node': 3000,
  'waiting-for-bootstrap': 6000,
  'converting-to-l1': 2500,
  'deploying-validator-manager': 3500,
  'initializing-manager': 2000,
  'initializing-validator-set': 2000,
  'transferring-ownership': 1500,
};

/**
 * Detail string shown under the current step (e.g. fake tx hashes).
 * Purely cosmetic — gives users something to read while each step runs.
 */
const STEP_DETAIL: Record<DeploymentStep, (job: DeploymentJob) => string> = {
  'creating-subnet': () => 'Submitting subnet creation tx to P-Chain…',
  'creating-chain': () => 'Building genesis and submitting chain creation tx…',
  'provisioning-node': () => 'Requesting a managed validator node on Fuji…',
  'waiting-for-bootstrap': () => 'Node syncing Primary Network headers — this usually takes ~60s',
  'converting-to-l1': () => 'Submitting convertSubnetToL1Tx with validator credentials…',
  'deploying-validator-manager': () => 'Deploying ValidatorMessages + ValidatorManager + proxy…',
  'initializing-manager': () => 'Calling initialize() on Validator Manager proxy…',
  'initializing-validator-set': () => 'Seeding the initial validator set…',
  'transferring-ownership': (job) => `Handing Subnet + Validator Manager control to ${job.request.ownerEvmAddress}`,
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
 * Scripted tx evidence per step. Real backend (opensource-avacloud)
 * produces these for real via avalanche-cli + cast; the mock emits
 * plausible fakes so the progress UI can exercise the same render
 * path end to end.
 */
function makeTxsForStep(step: DeploymentStep, network: 'fuji' | 'mainnet'): TxRecord[] {
  const now = new Date().toISOString();
  switch (step) {
    case 'creating-subnet':
      return [{ hash: fakePChainTxId(), chain: 'p-chain', network, label: 'CreateSubnetTx', timestamp: now }];
    case 'creating-chain':
      return [{ hash: fakePChainTxId(), chain: 'p-chain', network, label: 'CreateChainTx', timestamp: now }];
    case 'provisioning-node':
    case 'waiting-for-bootstrap':
      return []; // Builder-Hub API / health poll — no user-visible tx
    case 'converting-to-l1':
      return [{ hash: fakePChainTxId(), chain: 'p-chain', network, label: 'ConvertSubnetToL1Tx', timestamp: now }];
    case 'deploying-validator-manager':
      return [
        { hash: fakeEvmTxHash(), chain: 'l1', network, label: 'ValidatorMessages library', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'l1', network, label: 'ValidatorManager implementation', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'l1', network, label: 'TransparentUpgradeableProxy', timestamp: now },
      ];
    case 'initializing-manager':
      return [{ hash: fakeEvmTxHash(), chain: 'l1', network, label: 'initialize()', timestamp: now }];
    case 'initializing-validator-set':
      return [{ hash: fakeEvmTxHash(), chain: 'l1', network, label: 'initializeValidatorSet()', timestamp: now }];
    case 'transferring-ownership':
      return [
        { hash: fakePChainTxId(), chain: 'p-chain', network, label: 'TransferSubnetOwnershipTx', timestamp: now },
        { hash: fakeEvmTxHash(), chain: 'l1', network, label: 'ValidatorManager.transferOwnership()', timestamp: now },
      ];
  }
}

/** Generate a deterministic-ish mock result once the deployment is complete. */
function mockResult(req: DeployRequest): DeploymentResult {
  const evmChainId = 100000 + Math.floor(Math.random() * 899999);
  // Fake base58 / hex strings just long enough to look convincing in the UI.
  const subnetId = `mock${Math.random().toString(36).slice(2, 14)}subnet`;
  const blockchainId = `mock${Math.random().toString(36).slice(2, 14)}chain`;
  const nodeId = `NodeID-${Math.random().toString(36).slice(2, 10).toUpperCase()}Mock`;
  return {
    subnetId,
    blockchainId,
    evmChainId,
    rpcUrl: `https://mock-rpc.fuji.network/bc/${blockchainId}/rpc`,
    validatorManagerAddress: `0x${Math.random().toString(16).slice(2, 10).padEnd(40, '0')}` as `0x${string}`,
    nodeId,
  };
}

/**
 * Kick off the step-by-step progression. Setters run on setTimeout
 * chains — simple but adequate for dev mocks. Real backend will do the
 * actual avalanche.js / viem work.
 */
function runMockLifecycle(jobId: string) {
  const advance = (stepIdx: number) => {
    const job = jobs.get(jobId);
    if (!job) return; // Job was deleted (dev reload)

    if (stepIdx >= DEPLOYMENT_STEPS.length) {
      const completed: DeploymentJob = {
        ...job,
        status: 'complete',
        currentStep: DEPLOYMENT_STEPS[DEPLOYMENT_STEPS.length - 1]!,
        completedSteps: [...DEPLOYMENT_STEPS],
        statusDetail: 'Deployment complete',
        result: mockResult(job.request),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(jobId, completed);
      return;
    }

    const step = DEPLOYMENT_STEPS[stepIdx]!;
    const prevStep = stepIdx > 0 ? DEPLOYMENT_STEPS[stepIdx - 1]! : null;

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
      completedSteps: DEPLOYMENT_STEPS.slice(0, stepIdx),
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
