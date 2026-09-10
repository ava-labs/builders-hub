import "server-only";
import { getDeployedCode, isAddress, knownChain } from "./chains";
import { acquireCompileSlot, ADDRESS_ATTEMPT_QUOTA, consumeQuota, SUBMIT_QUOTA } from "./limits";
import { listCompiledContracts, matchDeployedBytecode, splitContractIdentifier } from "./match";
import { CompileError, compileStandardJson, fatalErrors, MAX_INPUT_BYTES, toCompilerInput } from "./solc";
import {
  completeJob,
  createJob,
  findJobByPayload,
  findVerified,
  getJob,
  markJobRunning,
  payloadHash,
  saveVerification,
  type VerificationJobRecord,
} from "./store";
import { invalidateContract, mirrorToSourcify } from "@/lib/sourcify";

/* ------------------------------------------------------------------ */
/* Verification, end to end.                                           */
/*                                                                     */
/* Submission is deliberately front-loaded with cheap checks: address   */
/* shape, known chain, caller quota, already-verified, deployed code,   */
/* seen-this-exact-payload. Every one of them is there to reach a       */
/* decision before the expensive part, because the expensive part is    */
/* the whole attack surface.                                           */
/* ------------------------------------------------------------------ */

export interface StandardJsonInput {
  language?: string;
  sources?: Record<string, { content?: string; urls?: string[] }>;
  settings?: {
    libraries?: Record<string, Record<string, string>>;
    [key: string]: unknown;
  };
}

export interface SubmitInput {
  chainId: number;
  address: string;
  stdJsonInput: unknown;
  compilerVersion: string;
  contractIdentifier: string;
  constructorArguments?: string | null;
  /** Rate-limiting bucket for the caller, from the request. */
  clientId: string;
}

export type SubmitRejection = {
  ok: false;
  code:
    | "invalid_address"
    | "unsupported_chain"
    | "invalid_input"
    | "input_too_large"
    | "unsupported_language"
    | "already_verified"
    | "contract_not_deployed"
    | "rate_limited"
    | "internal_error";
  message: string;
  retryAfterSeconds?: number;
};

export interface SubmitAccepted {
  ok: true;
  jobId: string;
  /** True when an identical payload was already tried: `run` is a no-op
   *  and the job already carries that earlier outcome. */
  deduplicated: boolean;
  /**
   * The compile, bound to this submission. Callers hand it to `after()`
   * rather than assembling the payload a second time — the background run
   * and the accepted submission can then never disagree about what was
   * submitted.
   */
  run: () => Promise<void>;
}

export type SubmitResult = SubmitAccepted | SubmitRejection;

/** How long a submit waits for a compile slot before giving up. Keeping
 *  the caller's request short matters less than not failing a legitimate
 *  verification the moment someone else is compiling. */
const SLOT_WAIT_MS = 30_000;
const SLOT_POLL_MS = 2_000;

function looksLikeStandardJson(value: unknown): value is StandardJsonInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sources = (value as StandardJsonInput).sources;
  if (!sources || typeof sources !== "object") return false;
  return Object.keys(sources).length > 0;
}


/**
 * Validate and enqueue a verification. Returns as soon as the job exists;
 * the compile happens in the background and is polled for.
 */
export async function submitVerification(input: SubmitInput): Promise<SubmitResult> {
  const address = input.address.toLowerCase();

  if (!isAddress(address)) {
    return { ok: false, code: "invalid_address", message: "Not a contract address." };
  }

  const chain = knownChain(input.chainId);
  if (!chain) {
    return {
      ok: false,
      code: "unsupported_chain",
      message: `Chain ${input.chainId} is not one we can verify against. It needs to be in the Builder Hub chain catalog with a public RPC.`,
    };
  }

  if (!looksLikeStandardJson(input.stdJsonInput)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Expected a Solidity Standard JSON input with a non-empty `sources` object.",
    };
  }

  const language = input.stdJsonInput.language ?? "Solidity";
  if (language !== "Solidity") {
    return {
      ok: false,
      code: "unsupported_language",
      message: `Only Solidity is supported; this input declares ${language}.`,
    };
  }

  // Everything downstream — the hash, the compile, what gets stored — uses
  // the reduced input, so the thing we verified is the thing we kept.
  const stdJsonInput = toCompilerInput(input.stdJsonInput);

  const serialized = JSON.stringify(stdJsonInput);
  if (Buffer.byteLength(serialized) > MAX_INPUT_BYTES) {
    return {
      ok: false,
      code: "input_too_large",
      message: `Standard JSON input exceeds the ${Math.round(MAX_INPUT_BYTES / 1024 / 1024)} MB limit.`,
    };
  }

  if (!splitContractIdentifier(input.contractIdentifier)) {
    return {
      ok: false,
      code: "invalid_input",
      message: 'The contract name must be fully qualified, as "contracts/Token.sol:Token".',
    };
  }

  const quota = await consumeQuota(`submit:${input.clientId}`, SUBMIT_QUOTA);
  if (!quota.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: "Too many verification requests. Try again shortly.",
      retryAfterSeconds: quota.retryAfterSeconds,
    };
  }

  if (await findVerified(input.chainId, address)) {
    return { ok: false, code: "already_verified", message: "This contract is already verified." };
  }

  // Nothing to compare against means nothing to verify — and it forces an
  // attacker to actually deploy something before they can cost us a compile.
  const code = await getDeployedCode(input.chainId, address);
  if (!code) {
    return {
      ok: false,
      code: "contract_not_deployed",
      message: `No contract code at ${address} on ${chain.name}.`,
    };
  }

  const hash = payloadHash({
    chainId: input.chainId,
    address,
    stdJsonInput,
    compilerVersion: input.compilerVersion,
    contractIdentifier: input.contractIdentifier,
  });

  // Someone retrying the same failing payload gets the same answer back
  // without a second compile.
  const previous = await findJobByPayload(hash);
  if (previous) {
    return { ok: true, jobId: previous.id, deduplicated: true, run: async () => {} };
  }

  const addressQuota = await consumeQuota(`address:${input.chainId}:${address}`, ADDRESS_ATTEMPT_QUOTA);
  if (!addressQuota.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: "Too many verification attempts for this contract. Try again later.",
      retryAfterSeconds: addressQuota.retryAfterSeconds,
    };
  }

  try {
    const job = await createJob({
      chainId: input.chainId,
      address,
      contractIdentifier: input.contractIdentifier,
      compilerVersion: input.compilerVersion,
      payloadHash: hash,
    });
    return {
      ok: true,
      jobId: job.id,
      deduplicated: false,
      run: () =>
        runVerificationJob(job.id, {
          chainId: input.chainId,
          address,
          stdJsonInput,
          compilerVersion: input.compilerVersion,
          contractIdentifier: input.contractIdentifier,
          constructorArguments: input.constructorArguments ?? null,
          payloadHash: hash,
        }),
    };
  } catch (error) {
    console.error("[verification] could not create job", error);
    return { ok: false, code: "internal_error", message: "Could not start verification." };
  }
}

async function waitForCompileSlot() {
  const deadline = Date.now() + SLOT_WAIT_MS;
  for (;;) {
    const slot = await acquireCompileSlot();
    if (slot) return slot;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, SLOT_POLL_MS));
  }
}

/**
 * Compile, compare, and record the outcome. Called in the background after
 * the submit response has already gone out, so it never throws at anyone:
 * every failure is written to the job for the poller to read.
 */
export async function runVerificationJob(
  jobId: string,
  input: {
    chainId: number;
    address: string;
    stdJsonInput: StandardJsonInput;
    compilerVersion: string;
    contractIdentifier: string;
    constructorArguments?: string | null;
    payloadHash: string;
  },
): Promise<void> {
  const address = input.address.toLowerCase();

  const slot = await waitForCompileSlot();
  if (!slot) {
    await completeJob(jobId, {
      errorCode: "queue_full",
      error: "The verification queue is full right now. Submit again in a few minutes.",
    });
    return;
  }

  try {
    await markJobRunning(jobId);

    const code = await getDeployedCode(input.chainId, address);
    if (!code) {
      await completeJob(jobId, {
        errorCode: "contract_not_deployed",
        error: `No contract code at ${address}.`,
      });
      return;
    }

    const { output, longVersion } = await compileStandardJson({
      stdJsonInput: input.stdJsonInput,
      compilerVersion: input.compilerVersion,
    });

    const errors = fatalErrors(output);
    if (errors.length) {
      await completeJob(jobId, {
        errorCode: "compiler_error",
        error: errors.map((e) => e.formattedMessage ?? e.message).join("\n\n"),
      });
      return;
    }

    if (!listCompiledContracts(output).length) {
      await completeJob(jobId, {
        errorCode: "compiler_error",
        error:
          "The compiler produced no contracts. Check that settings.outputSelection asks for abi, metadata and evm.deployedBytecode.",
      });
      return;
    }

    const result = matchDeployedBytecode({
      output,
      identifier: input.contractIdentifier,
      onchainCode: code,
      libraries: input.stdJsonInput.settings?.libraries,
    });

    if (!result.matched) {
      await completeJob(jobId, { errorCode: result.code, error: result.message });
      return;
    }

    let metadata: Record<string, unknown> | null = null;
    if (result.metadata) {
      try {
        metadata = JSON.parse(result.metadata) as Record<string, unknown>;
      } catch {
        /* metadata is a nicety, not a requirement */
      }
    }

    await saveVerification({
      chainId: input.chainId,
      address,
      match: result.level,
      name: splitContractIdentifier(input.contractIdentifier)?.name ?? null,
      compilerVersion: longVersion,
      language: "Solidity",
      abi: result.abi,
      metadata,
      constructorArguments: input.constructorArguments ?? null,
      stdJsonInput: input.stdJsonInput,
      payloadHash: input.payloadHash,
    });

    // The explorer caches "unverified" answers; drop that so the contract
    // shows up as soon as the caller looks at it.
    invalidateContract(input.chainId, address);

    await completeJob(jobId, { match: result.level });

    // Publish to the public archive last, and never let it affect the
    // outcome above: the verification is already recorded and reported, and
    // whether a third party also accepted it is not the submitter's problem.
    await mirrorToSourcify({
      chainId: input.chainId,
      address,
      stdJsonInput: input.stdJsonInput,
      compilerVersion: longVersion,
      contractIdentifier: input.contractIdentifier,
    });
  } catch (error) {
    const isCompileError = error instanceof CompileError;
    if (!isCompileError) console.error("[verification] job failed", error);
    await completeJob(jobId, {
      errorCode: isCompileError ? error.code : "internal_error",
      error: isCompileError ? error.message : "Verification failed unexpectedly.",
    });
  } finally {
    await slot.release();
  }
}

/** A job plus, when it succeeded, the contract it produced. */
export async function readJob(id: string): Promise<VerificationJobRecord | null> {
  return getJob(id);
}
