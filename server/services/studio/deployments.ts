import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma, type StudioDeployment, type StudioProject } from '@prisma/client';
import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex,
} from 'viem';
import {
  boundNetwork,
  loadBlueprint,
  loadRegistry,
  resolveDeep,
  resolveRef,
  type BlueprintManifest,
  type BlueprintStep,
  type NetworkEntry,
} from '@/lib/blueprints';
import {
  PlanError,
  bindingsOf,
  checksAfter,
  coerceArg,
  encodeCcipExtraArgs,
  evaluateExpectation,
  findFunction,
  firstReturn,
  outputsFromRead,
  outputsFromReceipt,
  outputsFromResult,
  pendingStep,
  prepareCheck,
  prepareStep,
  toJsonValue,
  type Artifact,
  type ArtifactMap,
  type DeploymentContext,
  type StepStates,
} from '@/lib/studio/executor';
import type { CustomPlanInput, ProposeDeploymentInput, ReportStepInput } from '@/types/studio';
import { customManifest } from './custom-plans';
import { prisma } from '@/prisma/prisma';
import { latestBuild, openBlocking, type StoredContract } from './builds';
import { filesHash } from './files';
import {
  bindQuickL1Result,
  markRelayerRunning,
  publicClient,
  recordRegistry,
  rpcUrlOf,
  type L1Binding,
  type RuntimeBindings,
} from './chain';
import { StudioError } from './errors';
import { getOwnedProject } from './projects';
import { findRelayer } from './relayers';
import {
  QUICK_L1_UNAVAILABLE,
  assertLaunchQuota,
  convertedFailure,
  evidenceOf,
  NODE_WAIT_MS,
  conversionTxOf,
  registerLaunchedNodes,
  failureOf,
  progressOf,
  quickL1Available,
  quickL1Job,
  quickL1Request,
  recoverLiveL1,
  recoveryNote,
  startQuickL1,
  stepsOf,
  type JobStep,
} from './quick-l1';

/** The blueprint that finishes ICM on an L1 whose launch stopped early; its registry is recorded on the project. */
export const ICM_SETUP_BLUEPRINT = 'l1-icm-setup';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const now = () => new Date().toISOString();

interface Plan {
  manifest: BlueprintManifest;
  /** The runtime bindings frozen when the deployment was proposed. */
  runtime: Record<string, Partial<NetworkEntry>>;
}

export interface CheckResult {
  description: string;
  after: string;
  passed: boolean;
  actual?: unknown;
  error?: string;
  at: string;
}

/* ------------------------------ artifacts ------------------------------ */

const artifactCache = new Map<string, Artifact>();

function repoArtifact(rel: string): Artifact {
  if (!/^contracts\/[A-Za-z0-9_\-/]+\.json$/.test(rel) || rel.split('/').includes('..'))
    throw new StudioError(500, `Bad artifact path ${rel}`);
  let artifact = artifactCache.get(rel);
  if (!artifact) {
    const raw = JSON.parse(fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), rel), 'utf8')) as {
      abi: Abi;
      bytecode?: string | { object?: string; linkReferences?: Artifact['linkReferences'] };
      linkReferences?: Artifact['linkReferences'];
    };
    const code = typeof raw.bytecode === 'string' ? raw.bytecode : raw.bytecode?.object;
    artifact = {
      abi: raw.abi,
      bytecode: code ? ((code.startsWith('0x') ? code : `0x${code}`) as Hex) : undefined,
      linkReferences:
        (typeof raw.bytecode === 'object' ? raw.bytecode?.linkReferences : undefined) ?? raw.linkReferences,
    };
    artifactCache.set(rel, artifact);
  }
  return artifact;
}

export function artifactsFor(manifest: BlueprintManifest, contracts: StoredContract[]): ArtifactMap {
  const map: ArtifactMap = {};
  for (const contract of manifest.contracts) {
    if (contract.artifact) {
      map[contract.name] = repoArtifact(contract.artifact);
    } else {
      const built = contracts.find((c) => c.name === contract.name && c.file.startsWith('contracts/'));
      if (built) map[contract.name] = { abi: built.abi as Abi, bytecode: built.bytecode };
    }
  }
  return map;
}

/* ------------------------------- loading ------------------------------- */

export async function loadDeployment(userId: string, projectId: string, deploymentId: string) {
  const project = await getOwnedProject(userId, projectId);
  const deployment = await prisma.studioDeployment.findFirst({
    where: { id: deploymentId, project_id: project.id },
    include: { build: true },
  });
  if (!deployment) throw new StudioError(404, 'Deployment not found');
  return { project, deployment };
}

export const planOf = (deployment: StudioDeployment) => deployment.plan as unknown as Plan;

function contextOf(deployment: StudioDeployment, signer?: string): DeploymentContext {
  const plan = planOf(deployment);
  return {
    manifest: plan.manifest,
    registry: loadRegistry(),
    networks: deployment.networks as Record<string, string>,
    params: (deployment.params ?? {}) as Record<string, unknown>,
    runtime: plan.runtime,
    signer: (deployment.signer ?? signer) as Hex | undefined,
    states: (deployment.steps ?? {}) as unknown as StepStates,
  };
}

function clientFor(dc: DeploymentContext, role: string) {
  return publicClient(rpcUrlOf(dc.networks[role], dc.runtime));
}

function explorerFor(dc: DeploymentContext, role: string): string | null {
  const key = dc.networks[role];
  return (key && boundNetwork(dc.registry, key, bindingsOf(dc))?.explorerUrl) || null;
}

/** Saves only if nobody else advanced the deployment since it was read. */
async function save(deployment: StudioDeployment, data: Prisma.StudioDeploymentUpdateManyMutationInput) {
  const { count } = await prisma.studioDeployment.updateMany({
    where: { id: deployment.id, updated_at: deployment.updated_at },
    data,
  });
  if (count === 0)
    throw new StudioError(409, 'The deployment changed in another tab. Refresh and continue.', 'conflict');
  return prisma.studioDeployment.findUniqueOrThrow({ where: { id: deployment.id }, include: { build: true } });
}

/* ------------------------------- propose ------------------------------- */

export async function proposeDeployment(
  userId: string,
  projectId: string,
  input: ProposeDeploymentInput,
  options: {
    stage?: 'testnet' | 'production';
    buildId?: string;
    promotionId?: string;
    runtime?: Record<string, Partial<NetworkEntry>>;
  } = {},
) {
  const stage = options.stage ?? 'testnet';
  const project = await getOwnedProject(userId, projectId);
  if (!project.blueprint_ids.includes(input.blueprintId))
    throw new StudioError(400, `Add the ${input.blueprintId} blueprint to the project first`);
  const { manifest } = loadBlueprint(input.blueprintId);
  const registry = loadRegistry();

  const networks: Record<string, string> = {};
  for (const [role, spec] of Object.entries(manifest.networks)) {
    const chosen = input.networks?.[role] ?? (project.networks as Record<string, string>)[role] ?? spec.default;
    if (!spec.allowed.includes(chosen))
      throw new StudioError(400, `${chosen} is not allowed for ${role}; use one of ${spec.allowed.join(', ')}`);
    const testnet = registry.networks[chosen]?.testnet === true;
    if (stage === 'testnet' && !testnet)
      throw new StudioError(400, `${chosen} is not a testnet. Production goes through Migrate to production.`);
    if (stage === 'production' && testnet && chosen !== 'l1') throw new StudioError(400, `${chosen} is a testnet`);
    networks[role] = chosen;
  }

  const merged = { ...(project.params as Record<string, unknown>), ...input.params };
  const params = Object.fromEntries(
    manifest.params.filter((p) => merged[p.name] !== undefined).map((p) => [p.name, merged[p.name]]),
  );
  const missing = manifest.params
    .filter((p) => p.default === undefined && params[p.name] === undefined)
    .map((p) => p.name);
  if (missing.length) throw new StudioError(400, `Set ${missing.join(', ')} before deploying`);

  return createProposal(project, manifest, { networks, params, blueprintId: input.blueprintId, stage, options });
}

/**
 * A testnet plan for the project's own contracts, written by the agent or the
 * builder instead of taken from a blueprint. It needs the same passing build
 * and audit as a blueprint plan, and every step is checked against that build.
 */
export async function proposeCustomDeployment(userId: string, projectId: string, input: CustomPlanInput) {
  const project = await getOwnedProject(userId, projectId);
  const build = await latestBuild(project.id, { ok: true });
  if (!build) throw new StudioError(409, 'Build the project first: compile and audit it, then plan the deployment');
  const manifest = customManifest(input, build.contracts as unknown as StoredContract[], loadRegistry());
  return createProposal(project, manifest, {
    networks: input.networks,
    params: {},
    blueprintId: null,
    stage: 'testnet',
    options: { buildId: build.id },
  });
}

/** The gates every plan passes, blueprint or custom: a passing build and audit, and bound chains. */
async function createProposal(
  project: Awaited<ReturnType<typeof getOwnedProject>>,
  manifest: BlueprintManifest,
  {
    networks,
    params,
    blueprintId,
    stage,
    options,
  }: {
    networks: Record<string, string>;
    params: Record<string, unknown>;
    blueprintId: string | null;
    stage: 'testnet' | 'production';
    options: { buildId?: string; promotionId?: string; runtime?: Record<string, Partial<NetworkEntry>> };
  },
) {
  const registry = loadRegistry();
  const compiles = manifest.contracts.some((c) => c.source);
  let build = options.buildId
    ? await prisma.studioBuild.findFirst({ where: { id: options.buildId, project_id: project.id } })
    : await latestBuild(project.id, { ok: true });
  if (!build && !compiles) {
    // Artifact-only blueprints compile nothing; the deployment still points at a build record.
    build = await prisma.studioBuild.create({
      data: {
        project_id: project.id,
        files_hash: filesHash([]),
        compiler: '',
        ok: true,
        diagnostics: [],
        contracts: [],
      },
    });
  }
  if (!build?.ok) throw new StudioError(409, 'Build the project first');
  const contracts = build.contracts as unknown as StoredContract[];
  const absent = manifest.contracts
    .filter((c) => c.source && !contracts.some((b) => b.name === c.name))
    .map((c) => c.name);
  if (absent.length) throw new StudioError(409, `The latest build has no ${absent.join(', ')}`);

  if (compiles) {
    const audit = await prisma.studioAuditReport.findFirst({
      where: { build_id: build.id },
      orderBy: { created_at: 'desc' },
    });
    if (!audit) throw new StudioError(409, 'Audit this build before deploying it');
    const open = openBlocking(audit.findings as never, audit.acknowledged as never);
    if (open.length)
      throw new StudioError(
        409,
        `${open.length} critical or high audit finding${open.length === 1 ? ' is' : 's are'} open`,
        'audit_blocked',
      );
  }

  const runtime = options.runtime ?? ((project.runtime ?? {}) as RuntimeBindings)[stage] ?? {};
  for (const key of new Set(Object.values(networks))) {
    if (registry.networks[key]?.rpcUrl == null && !runtime[key]?.rpcUrl) {
      throw new StudioError(
        409,
        `Bind your ${stage} L1 ${stage === 'production' ? 'in the Production tab' : 'under Networks'} first`,
        'l1_unbound',
      );
    }
  }

  const plan: Plan = { manifest, runtime };
  return prisma.studioDeployment.create({
    data: {
      project_id: project.id,
      build_id: build.id,
      stage,
      blueprint_id: blueprintId,
      networks,
      params: json(params),
      plan: json(plan),
      promotion_id: options.promotionId,
    },
  });
}

/* ------------------------------ advancing ------------------------------ */

export type NextAction =
  | {
      kind: 'tx';
      stepId: string;
      title: string;
      chainId: number;
      network: string;
      production: boolean;
      request: { to?: Address; data: Hex; value: string };
      display: { contract: string; function?: string; args: unknown[] };
    }
  | { kind: 'pending'; stepId: string; title: string; txHash: Hex }
  | {
      kind: 'manual';
      stepId: string;
      title: string;
      detail: string;
      link?: string;
      canConfirm: boolean;
      canSkip: boolean;
      /** Set for steps the browser can run itself (eERC proofs), with what it needs. */
      browser?: { action: string; chainId: number; inputs: Record<string, unknown> };
    }
  | {
      kind: 'wait';
      stepId: string;
      title: string;
      detail: string;
      link?: string;
      retryInMs: number;
      progress?: JobStep[];
    }
  | { kind: 'blocked'; stepId: string; title: string; detail: string; canSkip: boolean }
  | {
      kind: 'confirm-production';
      stepId: string;
      title: string;
      chainId: number;
      network: string;
      request: { to?: Address; data: Hex; value: string };
      display: { contract: string; function?: string; args: unknown[] };
    }
  | { kind: 'done'; status: string };

/** When one of an ensure-relayer step's chains is an L1 whose Quick L1 relayer never came up, says so. */
function relayerDownFor(dc: DeploymentContext, step: BlueprintStep): string | null {
  const chains = Array.isArray(step.inputs?.chains) ? (step.inputs.chains as unknown[]) : [];
  const roles = chains.map((ref) => (typeof ref === 'string' ? /^\$net\.([\w-]+)$/.exec(ref)?.[1] : undefined));
  const l1 = roles.some((role) => role && dc.networks[role] === 'l1')
    ? (dc.runtime?.l1 as L1Binding | undefined)
    : undefined;
  if (l1?.relayer !== 'not-running') return null;
  return `Quick L1's managed relayer for ${l1.name ?? 'your L1'} never came up, so nothing relays between these chains yet.`;
}

const MANUAL_GUIDANCE: Record<string, { detail: string; link?: string }> = {
  'icm.ensure-relayer': {
    detail:
      'Make sure an ICM relayer serves both chains of this step. On Fuji, the managed relayer covers any pair you add to it.',
    link: '/console/testnet-infra/icm-relayer',
  },
  'eerc.register': {
    detail:
      "Studio registers the signing wallet's eERC key itself, in this browser. This account isn't the deployment's signer, so register it from its own wallet in the eERC console, then mark this done. Keys and proofs never leave the device.",
    link: '/console/encrypted-erc/register',
  },
  'eerc.private-mint': {
    detail:
      "Studio generates the mint proof in this browser and mints when the deployment signs as the token's owner. It stopped here, so check that the owner and the recipient are registered, then press Continue to try again.",
  },
  'eerc.deposit': {
    detail:
      "Studio approves and encrypts the deposit in this browser with the deployment's signer. It stopped here; check the token balance, then press Continue to try again.",
  },
  'eerc.transfer': {
    detail:
      "Studio generates the transfer proof in this browser with the deployment's signer. It stopped here; check that the recipient has a private account and the balance covers it, then press Continue.",
  },
  'eerc.withdraw': {
    detail:
      "Studio generates the withdrawal proof in this browser with the deployment's signer. It stopped here; check the private balance covers it, then press Continue.",
  },
  'eerc.decrypt-balance': {
    detail:
      "Studio decrypts the signer's balance in this browser. Another account's balance can only be read by that account's own wallet, so skip this step for it.",
  },
};

/** Offchain actions Studio's browser runner performs itself: eERC keys and proofs never leave the browser. */
const BROWSER_ACTIONS = new Set([
  'eerc.register',
  'eerc.private-mint',
  'eerc.deposit',
  'eerc.transfer',
  'eerc.withdraw',
  'eerc.decrypt-balance',
]);

/**
 * Checks what the browser reports for an eERC step against the chain: a registration must show on the
 * Registrar, and a mint or deposit must be a mined, successful call from the signer to the token. A
 * decrypted balance is the builder's own private reading; nothing on-chain can confirm it.
 */
async function verifyBrowserAction(
  dc: DeploymentContext,
  step: BlueprintStep,
  inputs: Record<string, unknown>,
  report: { txHash?: string; outputs?: Record<string, string> },
): Promise<{ txHash?: Hex; blockNumber?: string; outputs?: Record<string, unknown> }> {
  const signer = dc.signer;
  if (!signer) throw new StudioError(409, 'This deployment has no signer yet');
  if (step.action === 'eerc.register') {
    const registrar = getAddress(String(inputs.registrar));
    const account = getAddress(String(inputs.account));
    const { abi } = repoArtifact('contracts/encrypted-erc/compiled/Registrar.json');
    const data = encodeFunctionData({ abi, functionName: 'isUserRegistered', args: [account] });
    const result = await ethCall(dc, step.network, { to: registrar, data });
    if (decodeFunctionResult({ abi, functionName: 'isUserRegistered', data: result }) !== true)
      throw new StudioError(400, `${account} is not registered on the Registrar yet`, 'not_registered');
    return { txHash: report.txHash as Hex | undefined };
  }
  if (step.action === 'eerc.decrypt-balance') {
    const balance = report.outputs?.balance;
    if (balance === undefined || !/^\d+$/.test(balance))
      throw new StudioError(400, 'Report the decrypted balance in cents');
    return { outputs: outputsFromResult(step, { balance }) };
  }
  if (!report.txHash) throw new StudioError(400, 'This step needs the transaction it sent');
  const hash = report.txHash as Hex;
  const client = clientFor(dc, step.network);
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash }).catch(() => null),
    client.getTransactionReceipt({ hash }).catch(() => null),
  ]);
  if (!tx || !receipt)
    throw new StudioError(409, 'That transaction is not mined yet; try again in a moment', 'not_mined');
  const target = getAddress(String(inputs.encryptedERC));
  if (getAddress(tx.from) !== getAddress(signer) || !tx.to || getAddress(tx.to) !== target)
    throw new StudioError(400, 'That transaction is not a call from the signer to this token', 'tx_mismatch');
  if (receipt.status !== 'success') throw new StudioError(400, 'The transaction reverted', 'tx_reverted');
  return { txHash: hash, blockNumber: receipt.blockNumber.toString() };
}

async function ethCall(dc: DeploymentContext, role: string, call: { to: Address; data: Hex }): Promise<Hex> {
  const { data } = await clientFor(dc, role).call({ to: call.to, data: call.data });
  if (!data) throw new PlanError(`${call.to} returned no data; is the contract deployed on this chain?`);
  return data;
}

async function runChecks(
  dc: DeploymentContext,
  stepId: string,
  artifacts: ArtifactMap,
  previous: CheckResult[],
): Promise<CheckResult[]> {
  const results = previous.filter((r) => r.after !== stepId);
  for (const check of checksAfter(dc.manifest, stepId)) {
    try {
      const prepared = prepareCheck(dc, check, artifacts);
      const actual = firstReturn(prepared.fn, prepared.abi, await ethCall(dc, check.network, prepared.call));
      results.push({
        description: check.description,
        after: stepId,
        passed: evaluateExpectation(actual, check.expect, dc),
        actual: toJsonValue(actual),
        at: now(),
      });
    } catch (error) {
      results.push({
        description: check.description,
        after: stepId,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        at: now(),
      });
    }
  }
  return results;
}

async function messageReceived(dc: DeploymentContext, step: BlueprintStep, messageId: unknown): Promise<boolean> {
  const messenger = resolveRef(`$net.${step.network}.teleporter.messenger`, dc.registry, bindingsOf(dc)) as Address;
  const { abi } = repoArtifact('contracts/icm-contracts/compiled/TeleporterMessenger.json');
  const fn = findFunction(abi, 'messageReceived', 1);
  const data = encodeFunctionData({
    abi,
    functionName: fn.name,
    args: [coerceArg(messageId, fn.inputs[0], 'messageID')],
  });
  const result = await ethCall(dc, step.network, { to: getAddress(messenger), data });
  return (
    decodeFunctionResult({ abi, functionName: fn.name, data: result } as Parameters<typeof decodeFunctionResult>[0]) ===
    true
  );
}

async function finalize(deployment: StudioDeployment & { build: unknown }, checks: CheckResult[]) {
  const status = checks.every((c) => c.passed) ? 'succeeded' : 'failed';
  const saved = await save(deployment, { status, completed_at: new Date(), checks: json(checks) });
  if (saved.promotion_id && saved.stage === 'production') {
    await prisma.studioPromotion.update({
      where: { id: saved.promotion_id },
      data: { status: status === 'succeeded' ? 'completed' : 'failed' },
    });
    if (status === 'succeeded')
      await prisma.studioProject.update({ where: { id: saved.project_id }, data: { stage: 'production' } });
  }
  return saved;
}

/**
 * Advances through everything the server can do alone (reads, checks,
 * skips, extraArgs encoding, delivery waits) and stops at the first thing
 * that needs the builder: a transaction to sign, a manual confirmation, or
 * a wait that has not finished.
 */
export async function nextAction(
  userId: string,
  projectId: string,
  deploymentId: string,
  signer: string,
  { confirmProduction = false } = {},
): Promise<NextAction> {
  let { deployment } = await loadDeployment(userId, projectId, deploymentId);
  if (deployment.status === 'succeeded' || deployment.status === 'failed' || deployment.status === 'cancelled') {
    return { kind: 'done', status: deployment.status };
  }
  if (deployment.signer && getAddress(deployment.signer) !== getAddress(signer)) {
    throw new StudioError(
      409,
      `This deployment is signed by ${deployment.signer}. Switch to that wallet to continue.`,
      'wrong_signer',
    );
  }
  if (!deployment.signer || deployment.status === 'proposed') {
    deployment = await save(deployment, { signer: getAddress(signer), status: 'running' });
  }

  for (let guard = 0; guard < 25; guard++) {
    const dc = contextOf(deployment);
    const artifacts = artifactsFor(dc.manifest, deployment.build.contracts as unknown as StoredContract[]);
    const states = { ...dc.states };
    const checks = (deployment.checks ?? []) as unknown as CheckResult[];
    const step = pendingStep(dc);
    if (!step) return { kind: 'done', status: (await finalize(deployment, checks)).status };

    const state = states[step.id];
    if (state?.status === 'sent' && state.txHash)
      return { kind: 'pending', stepId: step.id, title: step.title, txHash: state.txHash };

    let prepared;
    try {
      prepared = prepareStep(dc, step, artifacts);
    } catch (error) {
      if (!(error instanceof PlanError)) throw error;
      return { kind: 'blocked', stepId: step.id, title: step.title, detail: error.message, canSkip: !!step.optional };
    }

    const record = async (next: StepStates[string], extraChecks?: CheckResult[]) => {
      states[step.id] = next;
      const dcAfter = { ...dc, states };
      const results =
        next.status === 'done'
          ? await runChecks(dcAfter, step.id, artifacts, extraChecks ?? checks)
          : (extraChecks ?? checks);
      deployment = await save(deployment, { steps: json(states), checks: json(results) });
    };

    switch (prepared.kind) {
      case 'skip':
        await record({ status: 'skipped', reason: prepared.reason, at: now() });
        continue;

      case 'read': {
        try {
          const result = await ethCall(dc, step.network, prepared.call);
          await record({
            status: 'done',
            chainId: prepared.chainId,
            outputs: outputsFromRead(step, prepared.fn, prepared.abi, result),
            at: now(),
          });
          continue;
        } catch (error) {
          return {
            kind: 'blocked',
            stepId: step.id,
            title: step.title,
            detail: error instanceof Error ? error.message : String(error),
            canSkip: !!step.optional,
          };
        }
      }

      case 'offchain': {
        if (step.action === 'ccip.encode-extra-args') {
          const gasLimit = BigInt(String(prepared.inputs.gasLimit ?? '200000'));
          await record({
            status: 'done',
            chainId: prepared.chainId,
            outputs: outputsFromResult(step, { extraArgs: encodeCcipExtraArgs(gasLimit) }),
            at: now(),
          });
          continue;
        }
        if (step.action === 'quick-l1.deploy') {
          if (!quickL1Available())
            return {
              kind: 'blocked',
              stepId: step.id,
              title: step.title,
              detail: QUICK_L1_UNAVAILABLE,
              canSkip: false,
            };
          try {
            const request = quickL1Request(prepared.inputs);
            assertLaunchQuota(userId);
            const jobId = await startQuickL1(userId, request);
            await record({
              status: 'done',
              chainId: prepared.chainId,
              outputs: outputsFromResult(step, { jobId }),
              at: now(),
            });
            continue;
          } catch (error) {
            if (!(error instanceof StudioError)) throw error;
            return {
              kind: 'blocked',
              stepId: step.id,
              title: step.title,
              detail: error.message,
              canSkip: !!step.optional,
            };
          }
        }
        const guidance = MANUAL_GUIDANCE[step.action ?? ''] ?? {
          detail: step.notes ?? 'Complete this step outside the Studio.',
        };
        let detail = guidance.detail;
        if (step.action === 'icm.ensure-relayer') {
          // Checked against the builder's managed relayers; a self-hosted relayer is still confirmed by hand.
          const chains = (
            Array.isArray(prepared.inputs.chains) ? prepared.inputs.chains : []
          ) as Partial<NetworkEntry>[];
          const ids = chains.map((c) => c?.blockchainId).filter((id): id is string => typeof id === 'string');
          const nameOf = (id: string) => chains.find((c) => c?.blockchainId === id)?.name ?? id;
          const check = ids.length === chains.length && ids.length > 0 ? await findRelayer(userId, ids) : null;
          if (check?.status === 'serving') {
            await record({ status: 'done', chainId: prepared.chainId, at: now() });
            const l1 = dc.runtime?.l1 as L1Binding | undefined;
            if (
              deployment.stage === 'testnet' &&
              l1?.relayer === 'not-running' &&
              Object.values(dc.networks).includes('l1')
            ) {
              try {
                await markRelayerRunning(userId, deployment.project_id, 'testnet');
              } catch {
                // The step is done either way; the Networks tab mark clears on the next check.
              }
            }
            continue;
          }
          const found =
            check?.status === 'unhealthy'
              ? check.unreachable
                ? `Your managed relayer ${check.relayerId.slice(0, 10)}… serves both chains, but the relayer service cannot reach it, so it is not running. Restart it under ICM Relayer; if it stays unreachable, create a new one there with both chains, then press Continue.`
                : `Your managed relayer ${check.relayerId.slice(0, 10)}… serves both chains but is not healthy. Restart it or check its gas under ICM Relayer, then press Continue.`
              : check?.status === 'missing'
                ? `None of your managed relayers serves ${check.missing.map(nameOf).join(' and ')}. Create one under ICM Relayer with both chains and fund it, then press Continue; Studio checks again.`
                : check?.status === 'unavailable'
                  ? `Studio could not check your managed relayers: ${check.reason}.`
                  : '';
          detail = [relayerDownFor(dc, step), found, 'If you run your own relayer for both chains, mark this done.']
            .filter(Boolean)
            .join(' ');
        }
        return {
          kind: 'manual',
          stepId: step.id,
          title: step.title,
          ...guidance,
          detail,
          canConfirm: !step.outputs || Object.keys(step.outputs).length === 0,
          canSkip: !!step.optional,
          ...(BROWSER_ACTIONS.has(step.action ?? '')
            ? {
                browser: {
                  action: step.action!,
                  chainId: prepared.chainId,
                  inputs: toJsonValue(prepared.inputs) as Record<string, unknown>,
                },
              }
            : {}),
        };
      }

      case 'wait': {
        const wait = step.wait!;
        const started = state?.at ? Date.parse(state.at) : Date.now();
        if (!state) {
          states[step.id] = { status: 'sent', at: new Date(started).toISOString() };
          deployment = await save(deployment, { steps: json(states) });
        }
        const timedOut = Date.now() - started > (wait.timeoutMinutes ?? 30) * 60_000;
        if (wait.for === 'icm-delivery') {
          const delivered = await messageReceived(dc, step, prepared.id).catch(() => false);
          if (delivered) {
            await record({ status: 'done', chainId: prepared.chainId, at: now() });
            continue;
          }
          const network = dc.registry.networks[dc.networks[step.network]]?.testnet === false ? 'mainnet' : 'fuji';
          const link = `https://build.avax.network/explorer/${network}/icm/${String(prepared.id)}`;
          // Past the timeout it keeps waiting, just less often: a relayer fixed later still delivers the same message.
          return {
            kind: 'wait',
            stepId: step.id,
            title: step.title,
            detail: timedOut
              ? `Not delivered after ${wait.timeoutMinutes ?? 30} minutes. Delivery needs a healthy relayer that serves both chains; check it under ICM Relayer. Studio keeps checking every 15 seconds.`
              : 'Waiting for the relayer to deliver the ICM message.',
            link,
            retryInMs: timedOut ? 15_000 : 5_000,
          };
        }
        if (wait.for === 'ccip-delivery') {
          const link = `https://ccip.chain.link/msg/${String(prepared.id)}`;
          const attached = checksAfter(dc.manifest, step.id);
          if (attached.length > 0) {
            const results = await runChecks(
              { ...dc, states: { ...states, [step.id]: { status: 'done', at: now() } } },
              step.id,
              artifacts,
              checks,
            );
            if (results.filter((r) => r.after === step.id).every((r) => r.passed)) {
              states[step.id] = { status: 'done', chainId: prepared.chainId, at: now() };
              deployment = await save(deployment, { steps: json(states), checks: json(results) });
              continue;
            }
          }
          return timedOut || attached.length === 0
            ? {
                kind: 'manual',
                stepId: step.id,
                title: step.title,
                detail: 'Confirm once the CCIP explorer shows the message as executed.',
                link,
                canConfirm: true,
                canSkip: !!step.optional,
              }
            : {
                kind: 'wait',
                stepId: step.id,
                title: step.title,
                detail:
                  'Waiting for CCIP to execute the message on the destination chain. On Sepolia chains this waits for finality.',
                link,
                retryInMs: 15_000,
              };
        }
        if (!quickL1Available())
          return { kind: 'blocked', stepId: step.id, title: step.title, detail: QUICK_L1_UNAVAILABLE, canSkip: false };
        const job = await quickL1Job(userId, String(prepared.id));
        if (!job)
          return {
            kind: 'blocked',
            stepId: step.id,
            title: step.title,
            detail: 'Quick L1 has no record of this job.',
            canSkip: false,
          };
        const registerNodes = (l1: { subnetId: string; blockchainId: string; rpcUrl: string }) => {
          const conversionTx = conversionTxOf(
            job.evidence
              .filter((e) => e.step === 'converting-to-l1')
              .flatMap((e) => e.txs.map((tx) => ({ ...tx, label: tx.label ?? 'ConvertSubnetToL1Tx' }))),
          );
          const launchedAt = new Date(Date.parse(job.createdAt) || Date.now());
          return conversionTx
            ? registerLaunchedNodes(userId, {
                ...l1,
                chainName: job.request.chainName,
                conversionTx,
                launchedAt,
              }).catch(() => 0)
            : 0;
        };
        if (job.status === 'failed') {
          const recovered = await recoverLiveL1(userId, job).catch(() => null);
          if (recovered) {
            await bindQuickL1Result(deployment.project_id, job, recovered);
            await registerNodes(recovered);
            await record({
              status: 'done',
              chainId: prepared.chainId,
              outputs: outputsFromResult(step, recovered),
              evidence: evidenceOf(job),
              progress: stepsOf(job),
              warning: recoveryNote(job),
              at: now(),
            });
            continue;
          }
          // A fresh managed node can take minutes to serve the new chain, and Quick L1 doesn't wait for it before the L1-side deploys.
          const failedAt = Date.parse(job.updatedAt);
          if (convertedFailure(job) && Date.now() - failedAt < NODE_WAIT_MS) {
            return {
              kind: 'wait',
              stepId: step.id,
              title: step.title,
              detail:
                'Your L1 is created and converted, but Quick L1 stopped and its validator node isn\u2019t serving the chain yet. Studio checks every 10 seconds; once the node answers it keeps the L1 and lists what is left to finish.',
              retryInMs: 10_000,
              progress: stepsOf(job, { waitingForNode: true }),
            };
          }
          const reason = failureOf(job);
          await record({
            status: 'failed',
            error: reason,
            evidence: evidenceOf(job),
            progress: stepsOf(job),
            at: now(),
          });
          const next = convertedFailure(job) ? 'Continue checks the chain again.' : 'Plan the launch again.';
          return { kind: 'blocked', stepId: step.id, title: step.title, detail: `${reason}. ${next}`, canSkip: false };
        }
        if (job.status === 'complete' && job.result) {
          await bindQuickL1Result(deployment.project_id, job);
          await registerNodes(job.result);
          await record({
            status: 'done',
            chainId: prepared.chainId,
            outputs: outputsFromResult(step, job.result as unknown as Record<string, unknown>),
            evidence: evidenceOf(job),
            progress: stepsOf(job),
            at: now(),
          });
          continue;
        }
        return timedOut
          ? {
              kind: 'manual',
              stepId: step.id,
              title: step.title,
              detail: `Quick L1 is still at ${progressOf(job)}.`,
              canConfirm: false,
              canSkip: false,
            }
          : {
              kind: 'wait',
              stepId: step.id,
              title: step.title,
              detail: `${progressOf(job)}. Quick L1 signs these transactions itself.`,
              retryInMs: 3_000,
              progress: stepsOf(job),
            };
      }

      case 'tx': {
        if (step.function === 'acceptOwnership' && prepared.request.to) {
          const owner = await ethCall(dc, step.network, { to: prepared.request.to, data: '0x8da5cb5b' }).catch(
            () => undefined,
          );
          if (owner && owner.length >= 66 && getAddress(`0x${owner.slice(-40)}`) === getAddress(deployment.signer!)) {
            await record({ status: 'skipped', reason: 'the signer already owns it', at: now() });
            continue;
          }
        }
        const tx = {
          stepId: step.id,
          title: step.title,
          chainId: prepared.chainId,
          network: dc.networks[step.network],
          request: { to: prepared.request.to, data: prepared.request.data, value: prepared.request.value.toString() },
          display: {
            contract: prepared.display.contract,
            function: prepared.display.function,
            args: toJsonValue(prepared.display.args) as unknown[],
          },
        };
        if (deployment.stage === 'production' && !confirmProduction) return { kind: 'confirm-production', ...tx };
        return { kind: 'tx', production: deployment.stage === 'production', ...tx };
      }
    }
  }
  throw new StudioError(500, 'The deployment did not settle; refresh and try again');
}

/** Records a step from what the chain says, never from what the browser claims. */
export async function reportStep(userId: string, projectId: string, deploymentId: string, input: ReportStepInput) {
  let { deployment } = await loadDeployment(userId, projectId, deploymentId);
  const dc = contextOf(deployment);
  const step = pendingStep(dc);
  if (!step || step.id !== input.stepId) throw new StudioError(409, 'That step is not the next one', 'out_of_order');
  const artifacts = artifactsFor(dc.manifest, deployment.build.contracts as unknown as StoredContract[]);
  const states = { ...dc.states };
  let checks = (deployment.checks ?? []) as unknown as CheckResult[];

  if (input.kind === 'skip') {
    if (!step.optional) throw new StudioError(400, 'Only optional steps can be skipped');
    states[step.id] = { status: 'skipped', reason: input.reason, at: now() };
  } else if (input.kind === 'offchain') {
    if (step.kind !== 'offchain' || !BROWSER_ACTIONS.has(step.action ?? ''))
      throw new StudioError(400, 'This step is not one the browser runs');
    const prepared = prepareStep(dc, step, artifacts);
    if (prepared.kind !== 'offchain') throw new StudioError(400, 'This step is not one the browser runs');
    const verified = await verifyBrowserAction(dc, step, prepared.inputs, input);
    states[step.id] = { status: 'done', chainId: prepared.chainId, ...verified, at: now() };
  } else if (input.kind === 'confirm') {
    const manualAction = step.kind === 'offchain' && step.action !== 'ccip.encode-extra-args';
    const manualWait = step.kind === 'wait' && step.wait?.for !== 'icm-delivery';
    if (!manualAction && !manualWait) throw new StudioError(400, 'This step completes on its own');
    if (step.outputs && Object.keys(step.outputs).length > 0)
      throw new StudioError(400, 'This step produces outputs, so it cannot be confirmed by hand');
    states[step.id] = { status: 'done', at: now() };
  } else {
    const prepared = prepareStep(dc, step, artifacts);
    if (prepared.kind !== 'tx') throw new StudioError(400, 'This step does not take a transaction');
    const client = clientFor(dc, step.network);
    const hash = input.txHash as Hex;
    const tx = await client.getTransaction({ hash }).catch(() => null);
    if (!tx) {
      states[step.id] = { status: 'sent', chainId: prepared.chainId, txHash: hash, at: now() };
      deployment = await save(deployment, { steps: json(states) });
      return { status: 'pending' as const, deployment };
    }
    const matches =
      !!dc.signer &&
      getAddress(tx.from) === getAddress(dc.signer) &&
      (tx.to ? getAddress(tx.to) : undefined) === prepared.request.to &&
      tx.input.toLowerCase() === prepared.request.data.toLowerCase() &&
      tx.value === prepared.request.value &&
      (tx.chainId === undefined || tx.chainId === prepared.chainId);
    if (!matches) throw new StudioError(400, 'That transaction is not the one this step prepared', 'tx_mismatch');

    const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
    if (!receipt) {
      states[step.id] = { status: 'sent', chainId: prepared.chainId, txHash: hash, at: now() };
      deployment = await save(deployment, { steps: json(states) });
      return { status: 'pending' as const, deployment };
    }
    if (receipt.status !== 'success') {
      states[step.id] = {
        status: 'failed',
        chainId: prepared.chainId,
        txHash: hash,
        error: 'The transaction reverted',
        at: now(),
      };
    } else {
      try {
        states[step.id] = {
          status: 'done',
          chainId: prepared.chainId,
          txHash: hash,
          address: step.kind === 'deploy' ? (receipt.contractAddress ?? undefined) : undefined,
          blockNumber: receipt.blockNumber.toString(),
          outputs: outputsFromReceipt(step, receipt, artifacts),
          at: now(),
        };
      } catch (error) {
        states[step.id] = {
          status: 'failed',
          chainId: prepared.chainId,
          txHash: hash,
          error: error instanceof Error ? error.message : String(error),
          at: now(),
        };
      }
    }
  }

  if (states[step.id]?.status === 'done') checks = await runChecks({ ...dc, states }, step.id, artifacts, checks);
  deployment = await save(deployment, { steps: json(states), checks: json(checks) });

  // A registry deployed to finish an L1's ICM setup becomes the project's registry for that L1, once its checks pass.
  const registry = states[step.id]?.address;
  if (
    registry &&
    deployment.blueprint_id === ICM_SETUP_BLUEPRINT &&
    step.id === 'deploy-registry' &&
    checks.filter((c) => c.after === step.id).every((c) => c.passed)
  ) {
    await recordRegistry(deployment.project_id, deployment.stage === 'production' ? 'production' : 'testnet', registry);
  }
  return { status: states[step.id]?.status ?? 'pending', deployment };
}

export async function cancelDeployment(userId: string, projectId: string, deploymentId: string) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  if (deployment.status === 'succeeded' || deployment.status === 'failed')
    throw new StudioError(409, 'This deployment already finished');
  return save(deployment, { status: 'cancelled', completed_at: new Date() });
}

/* -------------------------------- views -------------------------------- */

export async function deploymentView(userId: string, projectId: string, deploymentId: string) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  return viewOf(deployment);
}

/**
 * Adds the validator nodes of a finished Quick L1 launch to the builder's
 * Testnet Nodes, for launches that bound their L1 before Studio registered
 * nodes itself. Idempotent: nodes already listed are left alone.
 */
export async function registerDeploymentNodes(userId: string, projectId: string, deploymentId: string) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  const states = (deployment.steps ?? {}) as unknown as StepStates;
  const params = (deployment.params ?? {}) as Record<string, unknown>;
  let added = 0;
  for (const step of planOf(deployment).manifest.steps) {
    if (step.kind !== 'wait' || step.wait?.for !== 'quick-l1-job') continue;
    const state = states[step.id];
    const outputs = (state?.outputs ?? {}) as Record<string, unknown>;
    const conversionTx = conversionTxOf(state?.evidence ?? []);
    const [subnetId, blockchainId, rpcUrl] = [outputs.subnetId, outputs.blockchainId, outputs.rpcUrl];
    if (state?.status !== 'done' || !conversionTx) continue;
    if (typeof subnetId !== 'string' || typeof blockchainId !== 'string' || typeof rpcUrl !== 'string') continue;
    added += await registerLaunchedNodes(userId, {
      subnetId,
      blockchainId,
      rpcUrl,
      chainName: typeof params.chainName === 'string' ? params.chainName : null,
      conversionTx,
      launchedAt: new Date(Date.parse(state.at) || Date.now()),
    });
  }
  return { added };
}

/** A value as the plan shows it: strings as written, everything else compact JSON. */
function show(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(toJsonValue(value)) ?? String(value);
}

/**
 * A step argument as the builder will see it signed. References that resolve
 * today (parameters, networks, the signer) are replaced by their value; ones that
 * only exist once an earlier step ran, such as `$out.deploy.address`, stay as written.
 */
function showArg(arg: unknown, dc: DeploymentContext): string {
  try {
    return show(resolveDeep(arg, dc.registry, bindingsOf(dc)));
  } catch {
    return show(arg);
  }
}

export function viewOf(deployment: StudioDeployment & { build: { contracts: unknown } }) {
  const dc = contextOf(deployment);
  const artifacts = artifactsFor(dc.manifest, deployment.build.contracts as unknown as StoredContract[]);
  const link = (role: string, kind: 'tx' | 'address', value?: string) => {
    const base = explorerFor(dc, role);
    return base && value ? `${base}/${kind}/${value}` : null;
  };
  const isFn = (abi: Abi, names: string[]) =>
    abi.filter((item): item is AbiFunction => item.type === 'function' && names.includes(item.name));

  // What a wallet needs to switch to, or add, each chain in the plan.
  const chains: Record<
    number,
    {
      name: string;
      rpcUrl: string | null;
      explorerUrl: string | null;
      nativeCurrency: { name: string; symbol: string; decimals: number };
      testnet: boolean;
      faucets: Record<string, string>;
    }
  > = {};
  for (const role of Object.keys(dc.networks)) {
    try {
      const entry = boundNetwork(dc.registry, dc.networks[role], bindingsOf(dc));
      if (!entry || typeof entry.evmChainId !== 'number') continue;
      const currency = entry.nativeCurrency ?? { symbol: 'ETH', decimals: 18 };
      chains[entry.evmChainId] = {
        name: entry.name,
        rpcUrl: entry.rpcUrl ?? null,
        explorerUrl: entry.explorerUrl ?? null,
        nativeCurrency: { name: currency.symbol, symbol: currency.symbol, decimals: currency.decimals },
        testnet: entry.testnet !== false,
        faucets: entry.faucets ?? {},
      };
    } catch {
      /* unbound role */
    }
  }

  return {
    chains,
    id: deployment.id,
    stage: deployment.stage,
    status: deployment.status,
    blueprintId: deployment.blueprint_id,
    networks: deployment.networks as Record<string, string>,
    params: deployment.params as Record<string, unknown>,
    signer: deployment.signer,
    promotionId: deployment.promotion_id,
    createdAt: deployment.created_at,
    completedAt: deployment.completed_at,
    steps: dc.manifest.steps.map((s) => {
      const state = dc.states[s.id];
      return {
        id: s.id,
        title: s.title,
        kind: s.kind,
        role: s.network,
        network: dc.networks[s.network],
        optional: !!s.optional,
        state: state ?? null,
        txUrl: link(s.network, 'tx', state?.txHash),
        addressUrl: link(s.network, 'address', state?.address),
        detail: {
          signer: s.signer ?? null,
          contract: s.contract ?? null,
          function: s.function ?? null,
          target: s.target ? showArg(s.target, dc) : null,
          args: (s.args ?? []).map((arg) => showArg(arg, dc)),
          value: s.value === undefined ? null : showArg(s.value, dc),
          action: s.action ?? null,
          wait: s.wait ? s.wait.for : null,
          outputs: Object.keys(s.outputs ?? {}),
          skipIf: s.skipIf ? `${s.skipIf.value} is ${show(s.skipIf.equals)}` : null,
          notes: s.notes ?? null,
        },
      };
    }),
    plan: {
      title: dc.manifest.title,
      description: dc.manifest.description,
      prerequisites: dc.manifest.prerequisites,
      review: dc.manifest.review,
      params: dc.manifest.params.map((p) => {
        const supplied = dc.params[p.name];
        const resolved = bindingsOf(dc).params?.[p.name];
        return {
          name: p.name,
          description: p.description,
          value: resolved === undefined ? null : show(resolved),
          source: supplied !== undefined ? 'set' : p.default !== undefined ? 'default' : 'missing',
        };
      }),
      contracts: dc.manifest.contracts.map((c) => ({
        name: c.name,
        description: c.description,
        audited: !!c.artifact,
      })),
      checks: dc.manifest.checks.map((c) => ({ description: c.description, after: c.after })),
    },
    checks: (deployment.checks ?? []) as unknown as CheckResult[],
    /** Every contract this deployment created, with its full ABI: what a frontend and the verifier work from. */
    deployed: dc.manifest.steps.flatMap((s) => {
      const address = dc.states[s.id]?.address;
      if (s.kind !== 'deploy' || !s.contract || !address) return [];
      const manifestContract = dc.manifest.contracts.find((c) => c.name === s.contract);
      const built = (deployment.build.contracts as unknown as StoredContract[]).find(
        (c) => c.name === s.contract && c.file.startsWith('contracts/'),
      );
      let chainId: number | null = null;
      try {
        chainId = boundNetwork(dc.registry, dc.networks[s.network], bindingsOf(dc))?.evmChainId ?? null;
      } catch {
        /* unbound */
      }
      return [
        {
          stepId: s.id,
          contract: s.contract,
          network: dc.networks[s.network],
          chainId,
          address,
          addressUrl: link(s.network, 'address', address),
          txHash: dc.states[s.id]?.txHash ?? null,
          abi: (artifacts[s.contract]?.abi ?? []) as Abi,
          source: manifestContract?.artifact ? ('artifact' as const) : ('build' as const),
          file: manifestContract?.artifact ? null : (built?.file ?? null),
        },
      ];
    }),
    contracts: dc.manifest.panel.map((panel) => {
      const deployStep = dc.manifest.steps.find((s) => s.id === panel.step)!;
      const abi = artifacts[deployStep.contract!]?.abi ?? [];
      const address = dc.states[panel.step]?.address ?? null;
      let chainId: number | null = null;
      try {
        chainId = boundNetwork(dc.registry, dc.networks[deployStep.network], bindingsOf(dc))?.evmChainId ?? null;
      } catch {
        /* unbound */
      }
      return {
        stepId: panel.step,
        contract: deployStep.contract!,
        network: dc.networks[deployStep.network],
        chainId,
        address,
        addressUrl: link(deployStep.network, 'address', address ?? undefined),
        read: isFn(abi, panel.read),
        write: isFn(abi, panel.write),
      };
    }),
  };
}

export type DeploymentView = ReturnType<typeof viewOf>;

/** A panel read, run on the server so the RPC stays one the server chose. */
export async function panelRead(
  userId: string,
  projectId: string,
  deploymentId: string,
  input: { stepId: string; function: string; args: unknown[] },
) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  const dc = contextOf(deployment);
  const panel = dc.manifest.panel.find((p) => p.step === input.stepId);
  if (!panel || !panel.read.includes(input.function))
    throw new StudioError(400, "That function is not in this contract's read panel");
  const deployStep = dc.manifest.steps.find((s) => s.id === input.stepId)!;
  const address = dc.states[input.stepId]?.address;
  if (!address) throw new StudioError(409, 'This contract is not deployed yet');
  const { abi } = artifactsFor(dc.manifest, deployment.build.contracts as unknown as StoredContract[])[
    deployStep.contract!
  ];
  const fn = findFunction(abi, input.function, input.args.length);
  const args = fn.inputs.map((param, i) => coerceArg(input.args[i], param, param.name || `#${i}`));
  const data = encodeFunctionData({ abi, functionName: fn.name, args });
  const result = await ethCall(dc, deployStep.network, { to: address, data });
  const decoded = decodeFunctionResult({ abi, functionName: fn.name, data: result } as Parameters<
    typeof decodeFunctionResult
  >[0]);
  return { result: toJsonValue(decoded) };
}

export type { StudioProject };
