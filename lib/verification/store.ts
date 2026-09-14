import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/prisma/prisma";
import { blobService } from "@/server/services/blob";
import type { MatchLevel } from "./match";

/* ------------------------------------------------------------------ */
/* Persistence for verification results and jobs.                      */
/*                                                                     */
/* Postgres holds what a lookup needs to answer immediately — match     */
/* level, name, compiler, ABI. The standard JSON input goes to Blob     */
/* because it carries every source file and routinely runs to           */
/* megabytes, and because nothing on the hot path needs to read it.     */
/* ------------------------------------------------------------------ */

export type JobStatus = "pending" | "running" | "succeeded" | "failed";

export interface StoredVerification {
  chainId: number;
  address: string;
  match: MatchLevel;
  name: string | null;
  compilerVersion: string | null;
  language: string;
  abi: unknown[] | null;
  metadata: Record<string, unknown> | null;
  constructorArguments: string | null;
  stdJsonBlobUrl: string | null;
  verifiedAt: Date;
}

/** Identifies a submission by its content, so an identical resubmission
 *  can be answered from the previous attempt instead of recompiling. */
export function payloadHash(input: {
  chainId: number;
  address: string;
  stdJsonInput: unknown;
  compilerVersion: string;
  contractIdentifier: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.chainId,
        input.address.toLowerCase(),
        input.compilerVersion,
        input.contractIdentifier,
        JSON.stringify(input.stdJsonInput),
      ].join("\u0000"),
    )
    .digest("hex");
}

function toStored(row: {
  chain_id: number;
  address: string;
  match: string;
  name: string | null;
  compiler_version: string | null;
  language: string;
  abi: unknown;
  metadata: unknown;
  constructor_arguments: string | null;
  std_json_blob_url: string | null;
  verified_at: Date;
}): StoredVerification {
  return {
    chainId: row.chain_id,
    address: row.address,
    match: row.match === "exact_match" ? "exact_match" : "match",
    name: row.name,
    compilerVersion: row.compiler_version,
    language: row.language,
    abi: Array.isArray(row.abi) ? (row.abi as unknown[]) : null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null,
    constructorArguments: row.constructor_arguments,
    stdJsonBlobUrl: row.std_json_blob_url,
    verifiedAt: row.verified_at,
  };
}

export async function findVerified(chainId: number, address: string): Promise<StoredVerification | null> {
  try {
    const row = await prisma.verifiedContract.findUnique({
      where: { chain_id_address: { chain_id: chainId, address: address.toLowerCase() } },
    });
    return row ? toStored(row) : null;
  } catch (error) {
    // A database blip must not make a verified contract look unverified to
    // the explorer; callers fall back to upstream Sourcify.
    console.error("[verification] lookup failed", error);
    return null;
  }
}

export async function isVerified(chainId: number, address: string): Promise<boolean> {
  return (await findVerified(chainId, address)) !== null;
}

/** The standard JSON input behind a verification, fetched from Blob. */
export async function readStandardJsonInput(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveVerification(input: {
  chainId: number;
  address: string;
  match: MatchLevel;
  name: string | null;
  compilerVersion: string;
  language: string;
  abi: unknown[];
  metadata: Record<string, unknown> | null;
  constructorArguments: string | null;
  stdJsonInput: unknown;
  payloadHash: string;
}): Promise<StoredVerification> {
  const address = input.address.toLowerCase();

  // Only reached after a match, so this never stores a stranger's rejected
  // upload. The hash in the key keeps re-verification from colliding with
  // an existing object.
  let blobUrl: string | null = null;
  try {
    const body = JSON.stringify(input.stdJsonInput);
    const file = new File([body], "standard-input.json", { type: "application/json" });
    const upload = await blobService.uploadFile(
      file,
      `contract-verification/${input.chainId}/${address}/${input.payloadHash.slice(0, 16)}.json`,
    );
    blobUrl = upload.url;
  } catch (error) {
    // Losing the sources is bad but not disqualifying: the ABI and the
    // match are what the explorer needs to keep working.
    console.error("[verification] could not store sources", error);
  }

  const row = await prisma.verifiedContract.upsert({
    where: { chain_id_address: { chain_id: input.chainId, address } },
    create: {
      chain_id: input.chainId,
      address,
      match: input.match,
      name: input.name,
      compiler_version: input.compilerVersion,
      language: input.language,
      abi: input.abi as never,
      metadata: (input.metadata ?? undefined) as never,
      constructor_arguments: input.constructorArguments,
      std_json_blob_url: blobUrl,
    },
    update: {
      match: input.match,
      name: input.name,
      compiler_version: input.compilerVersion,
      language: input.language,
      abi: input.abi as never,
      metadata: (input.metadata ?? undefined) as never,
      constructor_arguments: input.constructorArguments,
      std_json_blob_url: blobUrl,
      verified_at: new Date(),
    },
  });

  return toStored(row);
}

/* --------------------------------- jobs -------------------------------- */

export interface VerificationJobRecord {
  id: string;
  chainId: number;
  address: string;
  status: JobStatus;
  match: MatchLevel | null;
  errorCode: string | null;
  error: string | null;
  contractName: string | null;
  compilerVersion: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

function toJob(row: {
  id: string;
  chain_id: number;
  address: string;
  status: string;
  match: string | null;
  error_code: string | null;
  error: string | null;
  contract_name: string | null;
  compiler_version: string | null;
  created_at: Date;
  completed_at: Date | null;
}): VerificationJobRecord {
  return {
    id: row.id,
    chainId: row.chain_id,
    address: row.address,
    status: row.status as JobStatus,
    match: row.match === "exact_match" || row.match === "match" ? row.match : null,
    errorCode: row.error_code,
    error: row.error,
    contractName: row.contract_name,
    compilerVersion: row.compiler_version,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function createJob(input: {
  chainId: number;
  address: string;
  contractIdentifier: string;
  compilerVersion: string;
  payloadHash: string;
}): Promise<VerificationJobRecord> {
  const row = await prisma.verificationJob.create({
    data: {
      chain_id: input.chainId,
      address: input.address.toLowerCase(),
      status: "pending",
      contract_name: input.contractIdentifier,
      compiler_version: input.compilerVersion,
      payload_hash: input.payloadHash,
    },
  });
  return toJob(row);
}

export async function getJob(id: string): Promise<VerificationJobRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const row = await prisma.verificationJob.findUnique({ where: { id } });
    return row ? toJob(row) : null;
  } catch (error) {
    console.error("[verification] job lookup failed", error);
    return null;
  }
}

/** The most recent completed job for an identical payload, if any. */
export async function findJobByPayload(hash: string): Promise<VerificationJobRecord | null> {
  try {
    const row = await prisma.verificationJob.findFirst({
      where: { payload_hash: hash, status: { in: ["succeeded", "failed"] } },
      orderBy: { created_at: "desc" },
    });
    return row ? toJob(row) : null;
  } catch {
    return null;
  }
}

export async function markJobRunning(id: string): Promise<void> {
  await prisma.verificationJob.update({ where: { id }, data: { status: "running" } }).catch(() => {});
}

export async function completeJob(
  id: string,
  result: { match: MatchLevel } | { errorCode: string; error: string },
): Promise<void> {
  const data =
    "match" in result
      ? { status: "succeeded", match: result.match, completed_at: new Date() }
      : { status: "failed", error_code: result.errorCode, error: result.error.slice(0, 4000), completed_at: new Date() };
  await prisma.verificationJob.update({ where: { id }, data }).catch((error: unknown) => {
    console.error("[verification] could not record job outcome", error);
  });
}

/** Jobs whose worker never reported back — an instance can be recycled
 *  mid-compile, and a job stuck at "running" forever would leave the
 *  caller polling something that will never answer. */
export async function failStalledJobs(olderThanMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs);
  await prisma.verificationJob
    .updateMany({
      where: { status: { in: ["pending", "running"] }, created_at: { lt: cutoff } },
      data: {
        status: "failed",
        error_code: "worker_lost",
        error: "Verification did not finish. Submit it again.",
        completed_at: new Date(),
      },
    })
    .catch(() => {});
}

export async function deleteJobsOlderThan(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.verificationJob.deleteMany({ where: { created_at: { lt: cutoff } } });
  return count;
}
