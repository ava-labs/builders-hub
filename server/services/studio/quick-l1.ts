import 'server-only';
import { getAddress, isAddress, isHash } from 'viem';
import {
  MANAGED_NODES_PRODUCTION_URL,
  ManagedTestnetNodesServiceURLs,
} from '@/app/api/managed-testnet-nodes/constants';
import { NODE_TTL_MS } from '@/app/api/managed-testnet-nodes/utils';
import { nodeIdFromHex } from '@/lib/studio/l1';
import {
  DEFAULT_PRECOMPILES,
  DEPLOYMENT_STEPS,
  ERC20_POS_ONLY_STEPS,
  MANAGED_RELAYER_ONLY_STEPS,
  STEP_LABEL,
  type ClientDeployRequest,
  type DeploymentJob,
  type DeploymentStep,
  type PrecompileConfig,
  type TxRecord,
} from '@/lib/quick-l1/types';
import { checkRateLimit } from '@/lib/rateLimit';
import { prisma } from '@/prisma/prisma';
import { probeChainId, publicClient, rpcUrlOf } from './chain';
import { StudioError } from './errors';

/*
 * Starts and follows Quick L1 jobs for the Studio runner, against the same
 * upstream service as /api/quick-l1/*, but with the real session user rather
 * than the development placeholder those routes use. The service signs every
 * P-Chain and C-Chain transaction itself; the builder's wallet is the owner.
 */

/** Without the upstream service the console falls back to an in-memory mock, which Studio never uses: nothing would be deployed. */
export const quickL1Available = () => Boolean(process.env.QUICK_L1_SERVICE_URL);

export const QUICK_L1_UNAVAILABLE =
  "Quick L1 isn't connected on this server, so Studio can't launch a real L1. Set QUICK_L1_SERVICE_URL, QUICK_L1_INTERNAL_SECRET and BUILDER_HUB_URL and restart the server, or use an L1 you already have under Networks.";

function upstream(): { base: string; secret: string } | null {
  const base = process.env.QUICK_L1_SERVICE_URL?.replace(/\/$/, '');
  if (!base) return null;
  const secret = process.env.QUICK_L1_INTERNAL_SECRET;
  if (!secret) throw new StudioError(503, 'QUICK_L1_INTERNAL_SECRET is not configured on this server');
  return { base, secret };
}

/**
 * The service's schema takes real booleans only, and plan parameters can
 * arrive as the strings a form or the chat saved. Unset means its default.
 */
function flag(value: unknown, name: string): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new StudioError(400, `${name} must be true or false, not ${JSON.stringify(value)}`);
}

/** Same checks as /api/quick-l1/deploy, whose chain-name rule mirrors avalanchego's CreateChainTx. */
export function quickL1Request(inputs: Record<string, unknown>): ClientDeployRequest {
  const chainName = String(inputs.chainName ?? '').trim();
  if (!/^[a-zA-Z0-9 ]{1,64}$/.test(chainName)) {
    throw new StudioError(400, 'The chain name must be 1-64 ASCII letters, digits or spaces');
  }
  const tokenSymbol = String(inputs.tokenSymbol ?? '').trim();
  if (!tokenSymbol) throw new StudioError(400, 'Set a token symbol for the L1');
  const owner = String(inputs.ownerEvmAddress ?? '');
  if (!isAddress(owner, { strict: false })) throw new StudioError(400, 'The L1 owner must be an EVM address');
  const mode = String((inputs.validatorMode as { type?: unknown } | undefined)?.type ?? 'poa');
  if (mode !== 'poa' && mode !== 'erc20-pos') throw new StudioError(400, 'validatorMode must be "poa" or "erc20-pos"');
  const raw = (inputs.precompiles ?? {}) as Record<string, unknown>;
  const precompiles: PrecompileConfig = {};
  for (const key of Object.keys(DEFAULT_PRECOMPILES) as (keyof PrecompileConfig)[]) {
    const value = flag(raw[key], `precompiles.${key}`);
    if (value !== undefined) precompiles[key] = value;
  }
  const enableManagedRelayer = flag(inputs.enableManagedRelayer, 'managedRelayer') ?? false;
  if (enableManagedRelayer && precompiles.interoperability === false) {
    throw new StudioError(400, 'The managed relayer needs interoperability enabled');
  }
  return {
    chainName,
    tokenSymbol,
    ownerEvmAddress: getAddress(owner) as `0x${string}`,
    network: 'fuji',
    validatorMode: { type: mode },
    precompiles,
    enableManagedRelayer,
  };
}

/** The same burst limit /api/quick-l1/deploy applies, since Studio calls the service directly rather than through that route. */
const LAUNCH_LIMIT =
  process.env.NODE_ENV === 'development'
    ? { windowMs: 60_000, maxRequests: 1000 }
    : { windowMs: 60_000, maxRequests: 5 };

export function assertLaunchQuota(userId: string) {
  const result = checkRateLimit(`studio-quick-l1:${userId}`, LAUNCH_LIMIT);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new StudioError(429, `Too many L1 launches in a minute. Try again in ${seconds}s.`);
  }
}

/** A validation report as "field: problem" pairs, whether it came as zod issues, a field map or text. */
function issuesOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 300);
  if (Array.isArray(value)) {
    const lines = value
      .map((i) => {
        const issue = i as { path?: unknown[]; message?: string };
        return issue.message ? `${(issue.path ?? []).join('.') || 'request'}: ${issue.message}` : null;
      })
      .filter(Boolean);
    return lines.length ? lines.slice(0, 5).join('; ') : null;
  }
  if (typeof value === 'object') {
    const obj = value as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    const fields = Object.entries(obj.fieldErrors ?? (value as Record<string, unknown>))
      .filter(([, v]) => Array.isArray(v) && v.length)
      .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`);
    const all = [...(obj.formErrors ?? []), ...fields];
    return all.length ? all.slice(0, 5).join('; ') : null;
  }
  return null;
}

export async function startQuickL1(userId: string, request: ClientDeployRequest): Promise<string> {
  const service = upstream();
  if (!service) throw new StudioError(503, QUICK_L1_UNAVAILABLE, 'quick_l1_unavailable');

  const builderHubUrl =
    process.env.BUILDER_HUB_URL ?? (process.env.VERCEL_ENV === 'production' ? 'https://build.avax.network' : undefined);
  if (!builderHubUrl) throw new StudioError(503, 'BUILDER_HUB_URL is not configured on this server');
  const res = await fetch(`${service.base}/deploy`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-quick-l1-secret': service.secret,
      'x-builder-hub-url': builderHubUrl,
    },
    body: JSON.stringify({ ...request, userId }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    jobId?: string;
    error?: string;
    message?: string;
    details?: unknown;
    issues?: unknown;
  };
  if (!res.ok || typeof payload.jobId !== 'string') {
    const reason = payload.error ?? payload.message ?? `Quick L1 answered ${res.status}`;
    const details = issuesOf(payload.issues ?? payload.details);
    throw new StudioError(
      res.status >= 500 ? 502 : 400,
      `Quick L1 rejected the launch: ${reason}${details ? ` (${details})` : ''}`,
    );
  }
  return payload.jobId;
}

export async function quickL1Job(userId: string, jobId: string): Promise<DeploymentJob | null> {
  const service = upstream();
  if (!service) throw new StudioError(503, QUICK_L1_UNAVAILABLE, 'quick_l1_unavailable');
  const res = await fetch(`${service.base}/status/${encodeURIComponent(jobId)}`, {
    cache: 'no-store',
    headers: { 'x-quick-l1-secret': service.secret, 'x-user-id': userId },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new StudioError(502, `Quick L1 status answered ${res.status}`);
  return (await res.json()) as DeploymentJob;
}

export function progressOf(job: DeploymentJob): string {
  const current = job.currentStep ? STEP_LABEL[job.currentStep] : 'Queued';
  return `${current} (${job.completedSteps.length} steps done)`;
}

const RELAYER_STEPS: readonly DeploymentStep[] = ['reserving-relayer', 'attaching-relayer', 'starting-relayer'];

/**
 * The job failed after the subnet was converted to an L1, so the chain exists.
 * Everything after that is setup around it (ICM registry, bridge, relayer),
 * and a slow node or a flaky host there shouldn't cost the builder the L1.
 */
export function convertedFailure(job: DeploymentJob): boolean {
  return job.status === 'failed' && job.completedSteps.includes('initializing-validator-set');
}

/** A managed relayer was requested and the job never got it started. */
export function relayerNotStarted(job: DeploymentJob): boolean {
  return !!job.request.enableManagedRelayer && !job.completedSteps.includes('starting-relayer');
}

/** The steps this job runs: the pipeline minus what its options switch off. */
function plannedSteps(job: DeploymentJob): DeploymentStep[] {
  const off = new Set<DeploymentStep>([
    ...(job.request?.enableManagedRelayer ? [] : MANAGED_RELAYER_ONLY_STEPS),
    ...(job.request?.validatorMode?.type === 'erc20-pos' ? [] : ERC20_POS_ONLY_STEPS),
  ]);
  return DEPLOYMENT_STEPS.filter((s) => !off.has(s));
}

/**
 * Setup steps that hadn't finished when a converted job stopped: what follows
 * the conversion, plus the relayer steps that run alongside it.
 */
export function unfinishedSteps(job: DeploymentJob): DeploymentStep[] {
  const converted = DEPLOYMENT_STEPS.indexOf('initializing-validator-set');
  return plannedSteps(job).filter(
    (s) => !job.completedSteps.includes(s) && (DEPLOYMENT_STEPS.indexOf(s) > converted || RELAYER_STEPS.includes(s)),
  );
}

export type JobTx = { label: string | null; chain: TxRecord['chain']; hash: string; url: string | null };
export type JobStep = { label: string; status: 'done' | 'current' | 'pending' | 'failed'; txs?: JobTx[] };

export const NODE_WAIT_LABEL = 'Waiting for the validator node to be healthy';

/** How long Studio keeps waiting for the node after a post-conversion failure before handing back to the builder. */
export const NODE_WAIT_MS = 15 * 60_000;

function txOf(step: DeploymentStep, tx: TxRecord): JobTx {
  return {
    label: tx.label && tx.label !== STEP_LABEL[step] ? tx.label : null,
    chain: tx.chain,
    hash: tx.hash,
    url: tx.chain === 'l1' ? null : `/explorer/${tx.network}/${tx.chain}/tx/${tx.hash}`,
  };
}

/**
 * Every step of the job with where it stands and the transactions it signed,
 * for the same checklist the deploy runner shows. `waitingForNode` adds the
 * wait Studio runs itself before the first step that failed on the new chain.
 */
export function stepsOf(job: DeploymentJob, opts: { waitingForNode?: boolean } = {}): JobStep[] {
  const steps: JobStep[] = plannedSteps(job).map((s) => {
    const txs = (job.evidence ?? []).filter((e) => e.step === s).flatMap((e) => e.txs.map((tx) => txOf(s, tx)));
    return {
      label: STEP_LABEL[s],
      status: job.completedSteps.includes(s)
        ? 'done'
        : job.currentStep === s
          ? job.status === 'failed'
            ? 'failed'
            : 'current'
          : 'pending',
      ...(txs.length > 0 ? { txs } : {}),
    };
  });
  if (!opts.waitingForNode) return steps;
  const at = steps.findIndex((s) => s.status === 'failed');
  steps.splice(at === -1 ? steps.length : at, 0, { label: NODE_WAIT_LABEL, status: 'current' });
  return steps;
}

/**
 * Why a job failed, in the builder's terms. The service's own report stays at
 * the end. A failed job returns no chain details even when the L1 is already
 * live, so this is only shown when Studio couldn't confirm the chain itself.
 */
export function failureOf(job: DeploymentJob): string {
  const report = job.error ?? 'no reason given';
  const step = job.currentStep;
  if (!step) return `Quick L1 failed: ${report}`;
  const where = `"${STEP_LABEL[step]}"`;
  const converted = convertedFailure(job);
  if (RELAYER_STEPS.includes(step)) {
    return (
      `${converted ? 'Quick L1 created and converted your L1, but the' : 'The'} managed ICM relayer it runs for the chain never came up, ` +
      `so it stopped at ${where}${converted ? " without returning the chain's details" : ''}. ` +
      `That's on Quick L1's relayer host, not in your settings. Service report: ${report}`
    );
  }
  if (converted) {
    return `Quick L1 created and converted your L1 but stopped at ${where}, and Studio couldn't reach the new chain to confirm it yet. Service report: ${report}`;
  }
  return `Quick L1 stopped at ${where}: ${report}`;
}

/** What to tell the builder when the L1 was kept although the job did not finish. */
export function recoveryNote(job: DeploymentJob): string {
  const left = unfinishedSteps(job).map((s) => STEP_LABEL[s]);
  const step = job.currentStep ? `"${STEP_LABEL[job.currentStep]}"` : 'a later step';
  return (
    `Quick L1 stopped at ${step} after creating and converting your L1, which is live and bound to this project. ` +
    (left.length > 0 ? `Not finished: ${left.join(', ')}. ` : '') +
    (relayerNotStarted(job)
      ? "Without its managed ICM relayer, messages between it and the C-Chain aren't delivered until a relayer serves both. "
      : '') +
    (left.length > 0 ? 'Finish ICM setup, under Networks, deploys the registry and points you to the relayer. ' : '') +
    `Service report: ${job.error ?? 'no reason given'}`
  );
}

const CB58_ID = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/;

export type RecoveredL1 = {
  subnetId: string;
  blockchainId: string;
  evmChainId: number;
  rpcUrl: string;
  validatorManagerAddress: `0x${string}` | null;
  nodeId: string | null;
  interop?: { icmRegistryAddress: `0x${string}` | null; tokenRemoteAddress: `0x${string}` | null };
};

/**
 * The chain a post-conversion failure leaves behind. A failed job carries no
 * result, so this rebuilds one from what the server can check itself: the IDs
 * are the service's CreateSubnetTx and CreateChainTx, the RPC is the managed
 * node that answers for that chain, and addresses come from on-chain
 * transactions. Null when the chain can't be confirmed.
 */
export async function recoverLiveL1(userId: string, job: DeploymentJob): Promise<RecoveredL1 | null> {
  if (!convertedFailure(job)) return null;
  const hashes = (step: DeploymentStep, chain: TxRecord['chain']) =>
    job.evidence
      .find((e) => e.step === step)
      ?.txs.filter((tx) => tx.chain === chain)
      .map((tx) => tx.hash) ?? [];
  const [subnetId] = hashes('creating-subnet', 'p-chain');
  const [blockchainId] = hashes('creating-chain', 'p-chain');
  if (!subnetId || !blockchainId || !CB58_ID.test(subnetId) || !CB58_ID.test(blockchainId)) return null;

  const node = await prisma.nodeRegistration.findFirst({
    where: { user_id: userId, blockchain_id: blockchainId, status: 'active' },
    orderBy: { created_at: 'desc' },
  });
  // Quick L1 can run the validator on either managed node service, whichever one this server is configured for.
  const candidates = [
    ...new Set([
      node?.rpc_url,
      ManagedTestnetNodesServiceURLs.rpcEndpoint(blockchainId),
      `${MANAGED_NODES_PRODUCTION_URL}/ext/bc/${blockchainId}/rpc`,
    ]),
  ].filter((url): url is string => !!url);
  const answers = await Promise.all(
    candidates.map(async (rpcUrl) => ({ rpcUrl, evmChainId: await probeChainId(rpcUrl) })),
  );
  const live = answers.find((a): a is { rpcUrl: string; evmChainId: number } => a.evmChainId !== null);
  if (!live) return null;

  const l1 = publicClient(live.rpcUrl);
  const cChain = publicClient(rpcUrlOf('fuji-c-chain', undefined));
  const deployedBy = async (step: DeploymentStep) => {
    const [hash] = hashes(step, 'l1');
    if (!hash || !isHash(hash)) return null;
    const receipt = await l1.getTransactionReceipt({ hash }).catch(() => null);
    return receipt?.contractAddress ? (getAddress(receipt.contractAddress) as `0x${string}`) : null;
  };
  // initializeValidatorSet is called on the Validator Manager itself.
  const [managerCall] = [
    ...hashes('initializing-validator-set', 'c-chain'),
    ...hashes('initializing-manager', 'c-chain'),
  ];
  const [validatorManagerAddress, icmRegistryAddress, tokenRemoteAddress] = await Promise.all([
    managerCall && isHash(managerCall)
      ? cChain
          .getTransaction({ hash: managerCall })
          .then((tx) => (tx.to ? (getAddress(tx.to) as `0x${string}`) : null))
          .catch(() => null)
      : null,
    deployedBy('deploying-icm-registry'),
    deployedBy('deploying-token-remote'),
  ]);

  return {
    subnetId,
    blockchainId,
    evmChainId: live.evmChainId,
    rpcUrl: live.rpcUrl,
    validatorManagerAddress,
    nodeId: node?.node_id ?? null,
    interop: job.request.enableManagedRelayer ? { icmRegistryAddress, tokenRemoteAddress } : undefined,
  };
}

const FUJI_P_CHAIN = 'https://api.avax-test.network/ext/bc/P';
const BLS_HEX = /^0x[0-9a-fA-F]+$/;

/** The conversion transaction among a launch's P-Chain transactions, as the job or a saved step records them. */
export function conversionTxOf(txs: { label: string | null; chain: string; hash: string }[]): string | null {
  const tx = txs.find(
    (t) =>
      t.chain === 'p-chain' && /ConvertSubnetToL1|Converting Subnet to L1/i.test(t.label ?? '') && CB58_ID.test(t.hash),
  );
  return tx?.hash ?? null;
}

/**
 * Adds the launch's validator nodes to the builder's Testnet Nodes. Quick L1
 * does this through a callback to BUILDER_HUB_URL, which never reaches a
 * server it can't call (a local one, or another deployment's database), so
 * Studio writes the same rows from the ConvertSubnetToL1Tx on the P-Chain:
 * each validator's NodeID, BLS key and proof of possession. The managed
 * service's node index isn't on-chain, so the rows can be removed from the
 * account but not deleted on the service from that page. Returns how many
 * rows it added.
 */
export async function registerLaunchedNodes(
  userId: string,
  launch: {
    subnetId: string;
    blockchainId: string;
    rpcUrl: string;
    chainName: string | null;
    conversionTx: string;
    launchedAt: Date;
  },
): Promise<number> {
  if (!CB58_ID.test(launch.subnetId) || !CB58_ID.test(launch.blockchainId) || !CB58_ID.test(launch.conversionTx))
    return 0;
  const res = await fetch(FUJI_P_CHAIN, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'platform.getTx',
      params: { txID: launch.conversionTx, encoding: 'json' },
    }),
    cache: 'no-store',
  });
  if (!res.ok) return 0;
  const body = (await res.json().catch(() => null)) as {
    result?: {
      tx?: {
        unsignedTx?: {
          subnetID?: string;
          validators?: { nodeID?: string; signer?: { publicKey?: string; proofOfPossession?: string } }[];
        };
      };
    };
  } | null;
  const tx = body?.result?.tx?.unsignedTx;
  if (!tx || tx.subnetID !== launch.subnetId) return 0;

  const existing = await prisma.nodeRegistration.findMany({
    where: { user_id: userId, blockchain_id: launch.blockchainId, status: 'active' },
    select: { node_id: true },
  });
  const known = new Set(existing.map((n) => n.node_id));
  let added = 0;
  for (const v of tx.validators ?? []) {
    const nodeId = nodeIdFromHex(v.nodeID ?? '');
    const publicKey = v.signer?.publicKey ?? '';
    const proofOfPossession = v.signer?.proofOfPossession ?? '';
    if (!nodeId || known.has(nodeId) || !BLS_HEX.test(publicKey) || !BLS_HEX.test(proofOfPossession)) continue;
    await prisma.nodeRegistration.create({
      data: {
        user_id: userId,
        subnet_id: launch.subnetId,
        blockchain_id: launch.blockchainId,
        node_id: nodeId,
        public_key: publicKey,
        proof_of_possession: proofOfPossession,
        rpc_url: launch.rpcUrl,
        chain_name: launch.chainName,
        created_at: launch.launchedAt,
        expires_at: new Date(launch.launchedAt.getTime() + NODE_TTL_MS),
        status: 'active',
      },
    });
    known.add(nodeId);
    added++;
  }
  return added;
}

/** The transactions the Quick L1 service signed, linked to the Builder Hub explorer where it serves the chain. */
export function evidenceOf(job: DeploymentJob) {
  return job.evidence.flatMap((e) =>
    e.txs.map((tx) => ({ ...txOf(e.step, tx), label: tx.label ?? STEP_LABEL[e.step] })),
  );
}
