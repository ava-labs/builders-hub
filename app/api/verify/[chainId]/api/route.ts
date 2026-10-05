import { NextRequest } from "next/server";
import { handleEtherscanApi } from "@/lib/verification/etherscan-api";

/*
 * Etherscan-compatible verification for one chain, the shape Hardhat 2's
 * `customChains[].urls.apiURL` and Foundry's `--verifier-url` expect:
 *
 *   https://build.avax.network/api/verify/43114/api
 *
 * Compilation happens inside this function (in a worker), so it gets the
 * duration backstop and the larger memory profile. The 180-second compile
 * timeout in solc.ts is the real ceiling; maxDuration only catches the
 * case where everything around the compile also goes slowly.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  return handleEtherscanApi(request, chainId);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  return handleEtherscanApi(request, chainId);
}
