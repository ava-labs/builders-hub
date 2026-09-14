import { NextRequest } from "next/server";
import { handleEtherscanApi } from "@/lib/verification/etherscan-api";

/*
 * The same Etherscan-compatible API in its V2 shape, where the chain
 * travels in a `chainid` query parameter instead of the path:
 *
 *   https://build.avax.network/api/verify/v2/api?chainid=43114
 *
 * This is what Hardhat 3's chainDescriptors produces. The static `v2`
 * segment takes precedence over the sibling [chainId] route, so both
 * spellings coexist on the same tree.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleEtherscanApi(request);
}

export async function POST(request: NextRequest) {
  return handleEtherscanApi(request);
}
