import 'server-only';
import { keccak256 } from 'viem';
import { compileSources, type StandardJsonInput } from '@/lib/studio/compile';
import { knownChain } from '@/lib/verification/chains';
import { submitVerification } from '@/lib/verification/service';
import { findVerified, getJob } from '@/lib/verification/store';
import { prisma } from '@/prisma/prisma';
import type { StoredContract } from './builds';
import { loadDeployment, viewOf } from './deployments';
import { StudioError } from './errors';
import { filesHash } from './files';

/*
 * Verifies a deployment's contracts on the Builder Hub verifier, the one the
 * explorer reads. The verifier needs the exact Standard JSON input the
 * bytecode came from; builds don't store it, so it is rebuilt from the
 * project's sources, and only while those are the sources the deployment's
 * build compiled (same files hash, same bytecode). Contracts deployed from
 * Ava Labs' published artifacts have no sources here and are left to their
 * own repositories.
 */

type Deployed = ReturnType<typeof viewOf>['deployed'][number];

export type VerificationState =
  | { status: 'verified'; match: string; verifiedAt: string }
  | { status: 'unverified' }
  | { status: 'unsupported'; reason: string }
  | { status: 'artifact'; reason: string };

async function stateOf(d: Deployed): Promise<VerificationState> {
  if (d.source === 'artifact') {
    return {
      status: 'artifact',
      reason: "Deployed from Ava Labs' published build; its sources live in that repository, not in this project.",
    };
  }
  if (d.chainId === null || !knownChain(d.chainId)) {
    return {
      status: 'unsupported',
      reason:
        "The Builder Hub verifier only covers chains in its catalog. Download the Standard JSON input and verify on this chain's own explorer.",
    };
  }
  const verified = await findVerified(d.chainId, d.address);
  return verified
    ? { status: 'verified', match: verified.match, verifiedAt: verified.verifiedAt.toISOString() }
    : { status: 'unverified' };
}

export async function verificationStates(userId: string, projectId: string, deploymentId: string) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  const view = viewOf(deployment);
  return Promise.all(view.deployed.map(async (d) => ({ stepId: d.stepId, ...(await stateOf(d)) })));
}

/** The exact input the deployed bytecode was compiled from, or an error saying why it can't be rebuilt. */
export async function standardJsonFor(userId: string, projectId: string, deploymentId: string, stepId: string) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  const d = viewOf(deployment).deployed.find((c) => c.stepId === stepId);
  if (!d) throw new StudioError(404, "That step didn't deploy a contract in this deployment");
  if (d.source === 'artifact' || !d.file) {
    throw new StudioError(400, "This contract comes from a published artifact, not from this project's sources");
  }

  const files = await prisma.studioFile.findMany({
    where: { project_id: deployment.project_id, path: { startsWith: 'contracts/' } },
    select: { path: true, content: true, sha256: true },
  });
  const solidity = files.filter((f) => f.path.endsWith('.sol'));
  if (filesHash(solidity) !== deployment.build.files_hash) {
    throw new StudioError(
      409,
      "The contracts changed after this deployment's build, so Studio can't rebuild the exact sources it deployed. Verify from the version you deployed, or deploy the current build and verify that.",
    );
  }
  const compiled = await compileSources(Object.fromEntries(solidity.map((f) => [f.path, f.content])));
  const rebuilt = compiled.contracts.find((c) => c.file === d.file && c.name === d.contract);
  const stored = (deployment.build.contracts as unknown as StoredContract[]).find(
    (c) => c.file === d.file && c.name === d.contract,
  );
  if (!compiled.ok || !rebuilt || !stored || keccak256(rebuilt.bytecode) !== stored.bytecodeHash) {
    throw new StudioError(
      409,
      "Rebuilding the deployed sources didn't reproduce the deployed bytecode, so there is nothing exact to verify",
    );
  }
  return {
    contract: d,
    input: forVerification(compiled.input),
    compilerVersion: compiled.compiler,
    contractIdentifier: `${d.file}:${d.contract}`,
  };
}

/**
 * The build's input with the outputs a verifier needs. Matching blanks the
 * constructor-written immutables using `immutableReferences`, which the build
 * doesn't ask for; output selection isn't part of the metadata, so the
 * bytecode is unchanged.
 */
export function forVerification(input: StandardJsonInput): StandardJsonInput {
  return {
    ...input,
    settings: {
      ...input.settings,
      outputSelection: {
        '*': {
          '*': [
            'abi',
            'metadata',
            'evm.bytecode.object',
            'evm.bytecode.linkReferences',
            'evm.deployedBytecode.object',
            'evm.deployedBytecode.immutableReferences',
            'evm.deployedBytecode.linkReferences',
            'evm.methodIdentifiers',
          ],
        },
      },
    },
  };
}

export type StartedVerification =
  | { status: 'verified'; match: string }
  | { status: 'submitted'; jobId: string; run: () => Promise<void> };

export async function startVerification(
  userId: string,
  projectId: string,
  deploymentId: string,
  stepId: string,
): Promise<StartedVerification> {
  const { contract, input, compilerVersion, contractIdentifier } = await standardJsonFor(
    userId,
    projectId,
    deploymentId,
    stepId,
  );
  const state = await stateOf(contract);
  if (state.status === 'verified') return { status: 'verified', match: state.match };
  if (state.status !== 'unverified') throw new StudioError(400, state.reason);

  const result = await submitVerification({
    chainId: contract.chainId!,
    address: contract.address,
    stdJsonInput: input,
    compilerVersion,
    contractIdentifier,
    clientId: `studio:${userId}`,
  });
  if (!result.ok) {
    if (result.code === 'already_verified') {
      const verified = await findVerified(contract.chainId!, contract.address);
      return { status: 'verified', match: verified?.match ?? 'match' };
    }
    throw new StudioError(result.code === 'rate_limited' ? 429 : 400, result.message);
  }
  return { status: 'submitted', jobId: result.jobId, run: result.run };
}

/** A submitted job, only for a contract of this deployment. */
export async function verificationJob(userId: string, projectId: string, deploymentId: string, jobId: string) {
  const { deployment } = await loadDeployment(userId, projectId, deploymentId);
  const job = await getJob(jobId);
  const ours = viewOf(deployment).deployed.some(
    (d) => job && d.chainId === job.chainId && d.address.toLowerCase() === job.address.toLowerCase(),
  );
  if (!job || !ours) throw new StudioError(404, 'Verification job not found');
  return { status: job.status, match: job.match, error: job.error };
}
