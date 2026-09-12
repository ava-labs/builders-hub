import "server-only";
import { after, NextRequest, NextResponse } from "next/server";
import { getClientId } from "@/lib/mcp-rate-limit";
import { knownChain, isAddress } from "./chains";
import { submitVerification, type StandardJsonInput } from "./service";
import { findVerified, getJob, readStandardJsonInput } from "./store";

/* ------------------------------------------------------------------ */
/* The Etherscan-compatible surface.                                   */
/*                                                                     */
/* This is the interoperability workhorse: `hardhat verify` reaches it */
/* through customChains (Hardhat 2) or chainDescriptors (Hardhat 3),   */
/* and `forge verify-contract` through --verifier custom. None of      */
/* those tools can be changed to suit us, so the response strings      */
/* below are load-bearing — hardhat-verify decides whether a           */
/* verification passed by matching "Pass - Verified" and friends.      */
/*                                                                     */
/* The apikey parameter is accepted and ignored. Tooling insists on    */
/* sending one, and gating on it would only mean issuing keys to       */
/* everybody; abuse is handled by the controls in limits.ts instead.   */
/* ------------------------------------------------------------------ */

/** Exactly what hardhat-verify pattern-matches on. Do not reword. */
const PENDING = "Pending in queue";
const PASS = "Pass - Verified";
const FAIL = "Fail - Unable to verify";
const ALREADY_VERIFIED = "Contract source code already verified";
const NOT_VERIFIED = "Contract source code not verified";

function ok(result: unknown, message = "OK") {
  return NextResponse.json({ status: "1", message, result });
}

function notOk(result: string, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(
    { status: "0", message: "NOTOK", result },
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

type Params = { get: (key: string) => string | null };

function mergedParams(body: URLSearchParams | null, query: URLSearchParams): Params {
  return {
    get: (key: string) => {
      // Case-insensitive: tooling is inconsistent about `apiKey` vs `apikey`
      // and `evmVersion` vs `evmversion`.
      const lookup = (source: URLSearchParams) => {
        const direct = source.get(key);
        if (direct !== null) return direct;
        for (const [k, v] of source.entries()) {
          if (k.toLowerCase() === key.toLowerCase()) return v;
        }
        return null;
      };
      return (body ? lookup(body) : null) ?? lookup(query);
    },
  };
}

async function readBody(request: NextRequest): Promise<URLSearchParams | null> {
  if (request.method !== "POST") return null;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(json)) {
        params.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
      return params;
    }
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const params = new URLSearchParams();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") params.set(key, value);
      }
      return params;
    }
    return new URLSearchParams(await request.text());
  } catch {
    return null;
  }
}

/**
 * Etherscan wraps Standard JSON in an extra pair of braces so its own UI
 * can tell the formats apart. Tools vary; accept either.
 */
function unwrapSourceCode(source: string): string {
  const trimmed = source.trim();
  return trimmed.startsWith("{{") && trimmed.endsWith("}}") ? trimmed.slice(1, -1) : trimmed;
}

function normalizeConstructorArgs(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^0x/i, "");
  return trimmed.length ? trimmed : null;
}

/**
 * One handler for both the per-chain route (chain in the path, Hardhat 2
 * customChains style) and the v2 route (chain in `chainid`, Etherscan V2
 * style). Everything else about them is identical.
 */
export async function handleEtherscanApi(
  request: NextRequest,
  chainIdFromPath?: string,
): Promise<NextResponse> {
  const query = request.nextUrl.searchParams;
  const body = await readBody(request);
  const params = mergedParams(body, query);

  const chainIdRaw = chainIdFromPath ?? params.get("chainid") ?? params.get("chainId");
  const chainId = Number(chainIdRaw);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return notOk("Missing or invalid chainid");
  }
  if (!knownChain(chainId)) {
    return notOk(`Chain ${chainId} is not supported by this verifier`);
  }

  const action = (params.get("action") ?? "").toLowerCase();

  switch (action) {
    case "verifysourcecode":
      return verifySourceCode(request, chainId, params);
    case "checkverifystatus":
      return checkVerifyStatus(params);
    case "getsourcecode":
      return getSourceCode(chainId, params);
    case "getabi":
      return getAbi(chainId, params);
    default:
      return notOk(
        "Unsupported action. This verifier implements verifysourcecode, checkverifystatus, getsourcecode and getabi.",
      );
  }
}

async function verifySourceCode(
  request: NextRequest,
  chainId: number,
  params: Params,
): Promise<NextResponse> {
  const address = (params.get("contractaddress") ?? "").trim();
  if (!isAddress(address)) return notOk("Invalid contract address");

  const codeformat = (params.get("codeformat") ?? "").trim();
  if (codeformat && codeformat !== "solidity-standard-json-input") {
    return notOk(
      `Unsupported codeformat "${codeformat}". Submit solidity-standard-json-input — Hardhat and Foundry produce it by default.`,
    );
  }

  const sourceCode = params.get("sourceCode") ?? params.get("sourcecode");
  if (!sourceCode) return notOk("Missing sourceCode");

  let stdJsonInput: StandardJsonInput;
  try {
    stdJsonInput = JSON.parse(unwrapSourceCode(sourceCode)) as StandardJsonInput;
  } catch {
    return notOk(
      "sourceCode is not valid JSON. This verifier only accepts Standard JSON input, not flattened sources.",
    );
  }

  const contractIdentifier = (params.get("contractname") ?? "").trim();
  if (!contractIdentifier) return notOk("Missing contractname");

  const compilerVersion = (params.get("compilerversion") ?? "").trim();
  if (!compilerVersion) return notOk("Missing compilerversion");

  const result = await submitVerification({
    chainId,
    address,
    stdJsonInput,
    compilerVersion,
    contractIdentifier,
    constructorArguments:
      normalizeConstructorArgs(params.get("constructorArguments")) ??
      // Etherscan's own docs have carried this typo for years and tools copied it.
      normalizeConstructorArgs(params.get("constructorArguements")),
    clientId: getClientId(request),
  });

  if (!result.ok) {
    if (result.code === "already_verified") return notOk(ALREADY_VERIFIED);
    if (result.code === "rate_limited") {
      return notOk(result.message, {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds ?? 60) },
      });
    }
    return notOk(result.message);
  }

  // Compile after the GUID is on its way back, which is the flow the
  // protocol describes: submit returns a receipt, not a result.
  after(result.run);

  return ok(result.jobId);
}

async function checkVerifyStatus(params: Params): Promise<NextResponse> {
  const guid = (params.get("guid") ?? "").trim();
  if (!guid) return notOk("Missing guid");

  const job = await getJob(guid);
  if (!job) return notOk("Unknown verification id");

  switch (job.status) {
    case "pending":
    case "running":
      return notOk(PENDING);
    case "succeeded":
      return ok(PASS);
    default:
      return notOk(`${FAIL}. ${job.error ?? ""}`.trim());
  }
}

async function getSourceCode(chainId: number, params: Params): Promise<NextResponse> {
  const address = (params.get("address") ?? "").trim();
  if (!isAddress(address)) return notOk("Invalid address format");

  const verified = await findVerified(chainId, address);
  if (!verified) {
    // Etherscan answers "OK" with an empty record rather than an error, and
    // tooling keys off the ABI field to decide the contract is unverified.
    return ok([
      {
        SourceCode: "",
        ABI: NOT_VERIFIED,
        ContractName: "",
        CompilerVersion: "",
        OptimizationUsed: "",
        Runs: "",
        ConstructorArguments: "",
        EVMVersion: "Default",
        Library: "",
        LicenseType: "",
        Proxy: "0",
        Implementation: "",
        SwarmSource: "",
      },
    ]);
  }

  const settings = await compilerSettings(verified.stdJsonBlobUrl);

  return ok([
    {
      SourceCode: settings.sourceCode,
      ABI: JSON.stringify(verified.abi ?? []),
      ContractName: verified.name ?? "",
      CompilerVersion: verified.compilerVersion ? `v${verified.compilerVersion}` : "",
      OptimizationUsed: settings.optimizerEnabled ? "1" : "0",
      Runs: String(settings.runs ?? ""),
      ConstructorArguments: verified.constructorArguments ?? "",
      EVMVersion: settings.evmVersion ?? "Default",
      Library: "",
      LicenseType: "",
      Proxy: "0",
      Implementation: "",
      SwarmSource: "",
    },
  ]);
}

/** Compiler settings as Etherscan reports them, read back out of the
 *  stored Standard JSON input. */
async function compilerSettings(blobUrl: string | null): Promise<{
  sourceCode: string;
  optimizerEnabled: boolean;
  runs: number | null;
  evmVersion: string | null;
}> {
  const empty = { sourceCode: "", optimizerEnabled: false, runs: null, evmVersion: null };
  if (!blobUrl) return empty;

  const input = (await readStandardJsonInput(blobUrl)) as StandardJsonInput | null;
  if (!input) return empty;

  const settings = (input.settings ?? {}) as {
    optimizer?: { enabled?: boolean; runs?: number };
    evmVersion?: string;
  };
  return {
    // Double-brace wrapped, which is how Etherscan marks Standard JSON.
    sourceCode: `{${JSON.stringify(input)}}`,
    optimizerEnabled: settings.optimizer?.enabled === true,
    runs: settings.optimizer?.runs ?? null,
    evmVersion: settings.evmVersion ?? null,
  };
}

async function getAbi(chainId: number, params: Params): Promise<NextResponse> {
  const address = (params.get("address") ?? "").trim();
  if (!isAddress(address)) return notOk("Invalid address format");

  const verified = await findVerified(chainId, address);
  if (!verified?.abi) return notOk(NOT_VERIFIED);
  return ok(JSON.stringify(verified.abi));
}
