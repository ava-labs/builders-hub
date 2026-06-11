import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";
import { withAuth, RouteParams } from "@/lib/protectedRoute";
import {
  issueWalletOwnershipProof,
  WalletOwnershipProofError,
} from "@/server/services/profile/wallet-proof.service";

const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

async function parseWalletAddress(req: NextRequest): Promise<string | NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const walletAddress = (rawBody as Record<string, unknown>).walletAddress;
  if (typeof walletAddress !== "string" || !WALLET_ADDRESS_REGEX.test(walletAddress.trim())) {
    return NextResponse.json({ error: "Valid walletAddress is required." }, { status: 400 });
  }

  return walletAddress.trim();
}

export const POST = withAuth<RouteParams<{ id: string }>>(async (
  req: NextRequest,
  { params },
  session: Session,
) => {
  try {
    const id = (await params).id;

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    if (session.user.id !== id) {
      return NextResponse.json(
        { error: "Forbidden: you can only request proofs for your own profile." },
        { status: 403 },
      );
    }

    const walletAddress = await parseWalletAddress(req);
    if (walletAddress instanceof NextResponse) {
      return walletAddress;
    }

    const proof = await issueWalletOwnershipProof(session.user.id, walletAddress);
    return NextResponse.json(proof);
  } catch (error) {
    console.error("Error in POST /api/profile/extended/[id]/wallet-proof:", error);

    if (error instanceof WalletOwnershipProofError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
