import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { PROOF_MAX_AGE_MS } from "@/lib/profile/walletEip712";

const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export class WalletOwnershipProofError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "WalletOwnershipProofError";
  }
}

export interface WalletOwnershipProofChallenge {
  nonce: string;
  issuedAt: string;
}

export interface WalletOwnershipProofPayload {
  userId: string;
  walletAddress: string;
  issuedAt: string;
  nonce: string;
  signature: string;
}

type WalletOwnershipProofClient = Pick<Prisma.TransactionClient, "walletOwnershipProof">;

function normalizeWalletAddress(address: string): string {
  const trimmed = address.trim();
  if (!WALLET_ADDRESS_REGEX.test(trimmed)) {
    throw new WalletOwnershipProofError("Invalid wallet address.", 400);
  }

  return trimmed.toLowerCase();
}

export async function issueWalletOwnershipProof(
  userId: string,
  walletAddress: string,
): Promise<WalletOwnershipProofChallenge> {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + PROOF_MAX_AGE_MS);
  const nonce = randomBytes(32).toString("hex");

  await prisma.walletOwnershipProof.create({
    data: {
      userId,
      walletAddress: normalizedWalletAddress,
      nonce,
      issuedAt,
      expiresAt,
    },
  });

  return {
    nonce,
    issuedAt: issuedAt.toISOString(),
  };
}

export async function confirmWalletOwnershipProof(
  proof: WalletOwnershipProofPayload,
  client: WalletOwnershipProofClient = prisma,
): Promise<void> {
  const normalizedWalletAddress = normalizeWalletAddress(proof.walletAddress);
  const confirmed = await client.walletOwnershipProof.updateMany({
    where: {
      nonce: proof.nonce,
      userId: proof.userId,
      walletAddress: normalizedWalletAddress,
      attemptedAt: { not: null },
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
      signature: proof.signature,
    },
  });

  if (confirmed.count !== 1) {
    throw new WalletOwnershipProofError("Wallet ownership proof could not be confirmed.", 400);
  }
}

export async function claimWalletOwnershipProof(
  proof: Omit<WalletOwnershipProofPayload, "signature">,
  client: WalletOwnershipProofClient = prisma,
): Promise<void> {
  const normalizedWalletAddress = normalizeWalletAddress(proof.walletAddress);
  const proofRecord = await client.walletOwnershipProof.findUnique({
    where: { nonce: proof.nonce },
  });

  if (!proofRecord) {
    throw new WalletOwnershipProofError("Wallet ownership proof not found.", 400);
  }

  if (proofRecord.userId !== proof.userId) {
    throw new WalletOwnershipProofError("Wallet ownership proof does not match the authenticated user.", 403);
  }

  if (proofRecord.walletAddress !== normalizedWalletAddress) {
    throw new WalletOwnershipProofError("Wallet ownership proof does not match the wallet address.", 400);
  }

  const issuedAt = new Date(proof.issuedAt);
  if (Number.isNaN(issuedAt.getTime()) || proofRecord.issuedAt.getTime() !== issuedAt.getTime()) {
    throw new WalletOwnershipProofError("Wallet ownership proof has invalid issuance data.", 400);
  }

  if (proofRecord.expiresAt.getTime() < Date.now()) {
    throw new WalletOwnershipProofError("Wallet ownership proof has expired. Please reconnect your wallet.", 400);
  }

  const updated = await client.walletOwnershipProof.updateMany({
    where: {
      nonce: proof.nonce,
      userId: proof.userId,
      walletAddress: normalizedWalletAddress,
      attemptedAt: null,
      usedAt: null,
    },
    data: {
      attemptedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    throw new WalletOwnershipProofError("Wallet ownership proof could not be claimed. Please reconnect your wallet.", 400);
  }
}
