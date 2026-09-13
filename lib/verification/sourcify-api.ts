import "server-only";
import type { StoredVerification, VerificationJobRecord } from "./store";
import { readStandardJsonInput } from "./store";
import type { StandardJsonInput } from "./service";

/* ------------------------------------------------------------------ */
/* The Sourcify v2-compatible surface.                                 */
/*                                                                     */
/* Hardhat 3's verify plugin will talk to any server that speaks this  */
/* protocol — point `verify.sourcify.apiUrl` at us and the rest of the */
/* plugin works unchanged. It calls exactly three endpoints: contract  */
/* lookup, verification submit, and job status.                        */
/*                                                                     */
/* Note the deliberate asymmetry with Etherscan's protocol: job status */
/* is always HTTP 200 and carries the outcome in the body, because a   */
/* failed verification is a successful request about a failure.        */
/* ------------------------------------------------------------------ */

/** Sourcify's error vocabulary, as far as we can produce it. */
const CUSTOM_CODES: Record<string, string> = {
  invalid_address: "invalid_parameter",
  unsupported_chain: "unsupported_chain",
  invalid_input: "missing_or_invalid_source",
  input_too_large: "missing_or_invalid_source",
  unsupported_language: "unsupported_language",
  already_verified: "already_verified",
  contract_not_deployed: "contract_not_deployed",
  rate_limited: "too_many_requests",
  internal_error: "internal_error",
  compiler_error: "compiler_error",
  unknown_compiler_version: "invalid_compiler_version",
  compiler_unavailable: "internal_error",
  compilation_timeout: "compilation_timeout",
  compiler_crashed: "internal_error",
  contract_not_found: "invalid_compilation_target",
  no_bytecode: "invalid_compilation_target",
  unlinked_libraries: "missing_or_invalid_source",
  no_match: "no_match",
  queue_full: "too_many_requests",
  worker_lost: "internal_error",
};

export function customCodeFor(code: string): string {
  return CUSTOM_CODES[code] ?? "internal_error";
}

export interface ContractFields {
  all: boolean;
  requested: Set<string>;
}

/** `?fields=abi,compilation` or `?fields=all`. */
export function parseFields(value: string | null): ContractFields {
  const parts = (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return { all: parts.includes("all"), requested: new Set(parts) };
}

function wants(fields: ContractFields, name: string): boolean {
  return fields.all || fields.requested.has(name);
}

/**
 * A verified contract in Sourcify's response shape. The envelope (match,
 * address, chain, timestamps) is always present; everything expensive is
 * opt-in through `fields`, which is what keeps the explorer's per-address
 * lookups from dragging whole source trees around.
 */
export async function contractResponse(
  verified: StoredVerification,
  fields: ContractFields,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    match: verified.match,
    creationMatch: null,
    runtimeMatch: verified.match,
    chainId: String(verified.chainId),
    address: verified.address,
    verifiedAt: verified.verifiedAt.toISOString(),
    matchId: `${verified.chainId}:${verified.address}`,
  };

  if (wants(fields, "abi")) body.abi = verified.abi ?? [];
  if (wants(fields, "metadata")) body.metadata = verified.metadata;
  if (wants(fields, "compilation")) {
    body.compilation = {
      language: verified.language,
      compiler: "solc",
      compilerVersion: verified.compilerVersion,
      name: verified.name,
      fullyQualifiedName: verified.name,
    };
  }

  const needsInput = wants(fields, "sources") || wants(fields, "stdJsonInput");
  if (needsInput && verified.stdJsonBlobUrl) {
    const input = (await readStandardJsonInput(verified.stdJsonBlobUrl)) as StandardJsonInput | null;
    if (input) {
      if (wants(fields, "sources")) body.sources = input.sources ?? {};
      if (wants(fields, "stdJsonInput")) body.stdJsonInput = input;
    }
  }

  return body;
}

/** Job status. `isJobCompleted` is what a poller loops on. */
export async function jobResponse(
  job: VerificationJobRecord,
  verified: StoredVerification | null,
): Promise<Record<string, unknown>> {
  const done = job.status === "succeeded" || job.status === "failed";

  const body: Record<string, unknown> = {
    isJobCompleted: done,
    verificationId: job.id,
    jobStartTime: job.createdAt.toISOString(),
    ...(job.completedAt ? { jobFinishTime: job.completedAt.toISOString() } : {}),
    contract: {
      match: job.status === "succeeded" ? job.match : null,
      chainId: String(job.chainId),
      address: job.address,
    },
  };

  if (job.status === "failed") {
    body.error = {
      customCode: customCodeFor(job.errorCode ?? "internal_error"),
      message: job.error ?? "Verification failed.",
      errorId: job.id,
    };
  }

  if (job.status === "succeeded" && verified) {
    body.contract = await contractResponse(verified, { all: false, requested: new Set(["compilation"]) });
  }

  return body;
}
