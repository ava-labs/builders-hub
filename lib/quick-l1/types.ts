/**
 * Shared types for the Basic L1 Setup (one-click deploy) feature.
 *
 * The real implementation will live in a separate Railway microservice.
 * This repo either:
 *   1. Runs the mock orchestrator locally (when QUICK_L1_SERVICE_URL is unset)
 *   2. Proxies the same payload/response shape to Railway (when set)
 *
 * Keep these types stable — the Railway service must match them exactly.
 */

export type DeploymentStep =
  | 'creating-subnet'
  | 'creating-chain'
  | 'provisioning-node'
  | 'waiting-for-bootstrap'
  | 'converting-to-l1'
  | 'deploying-validator-manager'
  | 'initializing-manager'
  | 'initializing-validator-set'
  | 'transferring-ownership';

export type DeploymentStatus = 'pending' | 'running' | 'complete' | 'failed';

/**
 * The ordered list of steps every deployment walks through. Frontend
 * progress tracker renders this in order; the orchestrator advances one
 * at a time. Any reordering must stay in sync across repos.
 */
export const DEPLOYMENT_STEPS: DeploymentStep[] = [
  'creating-subnet',
  'creating-chain',
  'provisioning-node',
  'waiting-for-bootstrap',
  'converting-to-l1',
  'deploying-validator-manager',
  'initializing-manager',
  'initializing-validator-set',
  'transferring-ownership',
];

/** Human-readable label for each step (shown in the UI). */
export const STEP_LABEL: Record<DeploymentStep, string> = {
  'creating-subnet': 'Creating Subnet',
  'creating-chain': 'Creating Chain',
  'provisioning-node': 'Provisioning Validator Node',
  'waiting-for-bootstrap': 'Waiting for Node Bootstrap',
  'converting-to-l1': 'Converting Subnet to L1',
  'deploying-validator-manager': 'Deploying Validator Manager',
  'initializing-manager': 'Initializing Validator Manager',
  'initializing-validator-set': 'Initializing Validator Set',
  'transferring-ownership': 'Transferring Ownership',
};

/**
 * Input payload from the intake form — POSTed to /api/quick-l1/deploy.
 */
export interface DeployRequest {
  chainName: string;
  tokenSymbol: string;
  /** EVM address that will own the Validator Manager + receive genesis alloc. */
  ownerEvmAddress: `0x${string}`;
  /** P-Chain address (bech32) that will own the Subnet after handoff. */
  ownerPChainAddress?: string;
  /** Network — only 'fuji' supported in MVP. */
  network: 'fuji';
}

/**
 * Response from POST /api/quick-l1/deploy.
 */
export interface DeployResponse {
  jobId: string;
}

/**
 * A single on-chain transaction produced by a deployment step. Steps
 * like `waiting-for-bootstrap` produce none; `deploying-validator-manager`
 * typically produces several (library, implementation, proxy).
 */
export interface TxRecord {
  /** P-Chain tx id (base58) or EVM tx hash (0x-prefixed hex). */
  hash: string;
  /** Which chain the tx landed on — determines the explorer URL. */
  chain: 'p-chain' | 'c-chain' | 'l1';
  network: 'fuji' | 'mainnet';
  /** Optional short label (e.g. "ValidatorMessages library"). */
  label?: string;
  /** ISO-8601 timestamp of submission. */
  timestamp: string;
}

/**
 * Per-step record of what happened — surfaced in the progress UI so
 * users can follow each tx live. Keep this ordered to match
 * DEPLOYMENT_STEPS order.
 */
export interface StepEvidence {
  step: DeploymentStep;
  txs: TxRecord[];
}

/**
 * Full job state — returned from GET /api/quick-l1/status/:jobId.
 * Frontend polls this every ~2s.
 */
export interface DeploymentJob {
  jobId: string;
  status: DeploymentStatus;
  /** The step currently running (or the last-completed step if status='complete'). */
  currentStep: DeploymentStep | null;
  /** Steps that have finished (in order). */
  completedSteps: DeploymentStep[];
  /** Optional human-readable detail (e.g. tx hash, node ID). */
  statusDetail?: string;
  /** Per-step tx evidence. Steps without txs (e.g. bootstrap wait) still get an entry with an empty txs array once they complete. */
  evidence: StepEvidence[];
  /** Final deployment details — populated only when status='complete'. */
  result?: DeploymentResult;
  /** Populated only when status='failed'. */
  error?: string;
  /** Original request — echoed back for display. */
  request: DeployRequest;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentResult {
  subnetId: string;
  blockchainId: string;
  evmChainId: number;
  rpcUrl: string;
  validatorManagerAddress: `0x${string}`;
  /** NodeID of the provisioned validator (for display). */
  nodeId: string;
}
