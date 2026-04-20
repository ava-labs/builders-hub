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
  | 'deploying-validator-manager'
  | 'initializing-manager'
  | 'reserving-relayer'
  | 'creating-chain'
  | 'provisioning-node'
  | 'attaching-relayer'
  | 'converting-to-l1'
  | 'initializing-validator-set'
  | 'deploying-icm-registry'
  | 'deploying-token-remote'
  | 'registering-remote'
  | 'starting-relayer'
  | 'bridging-initial-tokens';

export type DeploymentStatus = 'pending' | 'running' | 'complete' | 'failed';

/**
 * The ordered list of steps every deployment may walk through. Frontend
 * progress tracker renders this in order; the orchestrator advances one
 * at a time. Any reordering must stay in sync with the `quick-l1`
 * Railway service.
 *
 * The last 6 steps only run when the request has
 * `precompiles.interoperability` enabled — they bootstrap ICM + ICTT
 * so the user gets a bridged MockUSDC on the new L1 out of the box.
 * Hide them from progress UI when interop is off.
 *
 * `reserving-relayer` runs *before* `creating-chain` because the
 * relayer's EVM address is baked into L1 genesis alloc.
 *
 * Validator Manager is deployed on **C-Chain**, not on the new L1 —
 * that's why convert-to-L1 happens after the manager's contract
 * address is known + initialized.
 *
 * `attaching-relayer` sits *after* `initializing-validator-set` so the
 * relayer boots against a live L1 RPC + a proper P-Chain-registered
 * validator set. Booting earlier stranded register messages on the
 * v1.7.5 "subscribe-timeout skips historical scan" bug.
 */
export const DEPLOYMENT_STEPS: DeploymentStep[] = [
  'creating-subnet',
  'deploying-validator-manager',
  'initializing-manager',
  'reserving-relayer',
  'creating-chain',
  'provisioning-node',
  'converting-to-l1',
  'initializing-validator-set',
  'attaching-relayer',
  'deploying-icm-registry',
  'deploying-token-remote',
  'registering-remote',
  'starting-relayer',
  'bridging-initial-tokens',
];

/** Subset of steps that only run when `precompiles.interoperability` is true. */
export const INTEROP_ONLY_STEPS: readonly DeploymentStep[] = [
  'reserving-relayer',
  'attaching-relayer',
  'deploying-icm-registry',
  'deploying-token-remote',
  'registering-remote',
  'starting-relayer',
  'bridging-initial-tokens',
];

/** Human-readable label for each step (shown in the UI). */
export const STEP_LABEL: Record<DeploymentStep, string> = {
  'creating-subnet': 'Creating Subnet',
  'deploying-validator-manager': 'Deploying Validator Manager (C-Chain)',
  'initializing-manager': 'Initializing Validator Manager',
  'reserving-relayer': 'Reserving ICM Relayer',
  'creating-chain': 'Creating Chain',
  'provisioning-node': 'Provisioning Validator Node',
  'attaching-relayer': 'Booting ICM Relayer (parallel)',
  'converting-to-l1': 'Converting Subnet to L1',
  'initializing-validator-set': 'Initializing Validator Set',
  'deploying-icm-registry': 'Deploying ICM Registry (L1)',
  'deploying-token-remote': 'Deploying TokenRemote (L1)',
  'registering-remote': 'Registering TokenRemote with TokenHome',
  'starting-relayer': 'Starting ICM Relayer',
  'bridging-initial-tokens': 'Bridging MockUSDC to L1',
};

/**
 * Genesis precompile configuration. All optional — the Railway service
 * applies sensible defaults when a field is omitted (see DEFAULT_PRECOMPILES
 * below). Each toggle corresponds to a Subnet-EVM precompile; when enabled
 * the precompile's admin list is seeded with `ownerEvmAddress`.
 */
export interface PrecompileConfig {
  /** Mint native token at runtime. Admins control who can mint. */
  nativeMinter?: boolean;
  /** Adjust dynamic fee config at runtime without a network upgrade. */
  feeManager?: boolean;
  /** Redirect base fee to a recipient instead of burning it. */
  rewardManager?: boolean;
  /** Warp messaging precompile + Teleporter (ICM) messenger preinstall. */
  interoperability?: boolean;
  /** Allow-list gating for `tx.from` — only listed addresses can send txs. */
  txAllowList?: boolean;
  /** Allow-list gating for contract deployment. */
  contractDeployerAllowList?: boolean;
}

/** Defaults for Basic Setup when the user doesn't override. Keep Warp +
 * native minter on so the chain can mint and interop out of the box. */
export const DEFAULT_PRECOMPILES: Required<PrecompileConfig> = {
  nativeMinter: true,
  feeManager: false,
  rewardManager: false,
  interoperability: true,
  txAllowList: false,
  contractDeployerAllowList: false,
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
  /** Optional precompile overrides — merged with DEFAULT_PRECOMPILES. */
  precompiles?: PrecompileConfig;
  /**
   * Builders Hub userId. Injected server-side by `/api/quick-l1/deploy`
   * from the authenticated session — clients should not set this.
   * Required — quick-l1 rejects deploys without it, so every L1 ends up
   * linked to a real builders-hub account.
   */
  userId: string;
}

/**
 * The shape the frontend sends to `/api/quick-l1/deploy`. userId is
 * excluded here because it's injected by the proxy from the session —
 * clients can't set it. Use this in the `useStartDeployment` hook and
 * any React component constructing a deploy request.
 */
export type ClientDeployRequest = Omit<DeployRequest, 'userId'>;

/**
 * Response from POST /api/quick-l1/deploy.
 */
export interface DeployResponse {
  jobId: string;
}

/**
 * A single on-chain transaction produced by a deployment step.
 * `provisioning-node` produces none (HTTP call, no tx);
 * `deploying-validator-manager` produces two (ValidatorMessages lib +
 * ValidatorManager contract — no proxy).
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
  /** Per-step tx evidence. Steps without txs (e.g. provisioning-node) still get an entry with an empty txs array once they complete. */
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
  /** Validator Manager contract address on **C-Chain** (deployed directly, no proxy). */
  validatorManagerAddress: `0x${string}`;
  /** NodeID of the provisioned validator (for display). */
  nodeId: string;
  /**
   * ICM/ICTT artifacts — only populated when `interoperability` is on.
   * `undefined` means the feature was disabled for this deploy.
   */
  interop?: InteropResult;
}

export interface InteropResult {
  /** EVM address of the managed ICM relayer, pre-funded via L1 genesis. */
  relayerAddress: `0x${string}`;
  /** MockUSDC ERC20 deployed on Fuji C-Chain. Mintable by the service. */
  mockUsdcAddress: `0x${string}`;
  /** ERC20TokenHome on Fuji C-Chain, pointing at MockUSDC. */
  tokenHomeAddress: `0x${string}`;
  /** TeleporterRegistry on the new L1, constructed with messenger v1. */
  icmRegistryAddress: `0x${string}`;
  /** ERC20TokenRemote on the new L1, pointing at TokenHome on C-Chain. */
  tokenRemoteAddress: `0x${string}`;
  /** Amount of MockUSDC (base units) sent to the owner on L1. */
  bridgedAmount: string;
}
