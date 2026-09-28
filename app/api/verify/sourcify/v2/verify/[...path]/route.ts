import { after, NextRequest, NextResponse } from "next/server";
import { getClientId } from "@/lib/mcp-rate-limit";
import { isAddress, knownChain } from "@/lib/verification/chains";
import { submitVerification } from "@/lib/verification/service";
import { customCodeFor, jobResponse } from "@/lib/verification/sourcify-api";
import { findVerified, getJob } from "@/lib/verification/store";

/*
 * Two Sourcify endpoints share this prefix and so have to share a route:
 *
 *   POST /api/verify/sourcify/v2/verify/{chainId}/{address}   submit
 *   GET  /api/verify/sourcify/v2/verify/{verificationId}      poll
 *
 * Next.js will not accept two differently-named dynamic segments in the
 * same position, hence the catch-all and the manual dispatch on depth.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function error(status: number, customCode: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ customCode, message, errorId: crypto.randomUUID() }, { status, headers });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length !== 2) {
    return error(404, "not_found", "Expected /v2/verify/{chainId}/{address}.");
  }

  const [chainIdRaw, addressRaw] = path;
  const chainId = Number(chainIdRaw);
  const address = addressRaw.toLowerCase();

  if (!Number.isInteger(chainId) || chainId <= 0 || !knownChain(chainId)) {
    return error(404, "unsupported_chain", `Chain ${chainIdRaw} is not supported by this verifier.`);
  }
  if (!isAddress(address)) {
    return error(400, "invalid_parameter", "Not a contract address.");
  }

  let body: {
    stdJsonInput?: unknown;
    compilerVersion?: string;
    contractIdentifier?: string;
    creationTransactionHash?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error(400, "missing_or_invalid_source", "Body must be JSON.");
  }

  if (!body.compilerVersion || !body.contractIdentifier) {
    return error(
      400,
      "missing_or_invalid_source",
      "compilerVersion and contractIdentifier are both required.",
    );
  }

  const result = await submitVerification({
    chainId,
    address,
    stdJsonInput: body.stdJsonInput,
    compilerVersion: body.compilerVersion,
    contractIdentifier: body.contractIdentifier,
    clientId: getClientId(request),
  });

  if (!result.ok) {
    const status =
      result.code === "already_verified"
        ? 409
        : result.code === "rate_limited"
          ? 429
          : result.code === "unsupported_chain" || result.code === "contract_not_deployed"
            ? 404
            : result.code === "internal_error"
              ? 500
              : 400;
    return error(
      status,
      customCodeFor(result.code),
      result.message,
      result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined,
    );
  }

  after(result.run);

  return NextResponse.json({ verificationId: result.jobId }, { status: 202 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length !== 1) {
    return error(404, "not_found", "Expected /v2/verify/{verificationId}.");
  }

  const job = await getJob(path[0]);
  if (!job) {
    return error(404, "not_found", "Unknown verification id.");
  }

  const verified = job.status === "succeeded" ? await findVerified(job.chainId, job.address) : null;
  // 200 even for a failed verification: the job ran, and its outcome is
  // the payload. Only an unknown id is an HTTP error here.
  return NextResponse.json(await jobResponse(job, verified));
}
