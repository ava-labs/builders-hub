import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/prisma/prisma';
import { getUserId, jsonError, jsonOk } from '@/app/api/managed-testnet-nodes/utils';
import { isValidAvalancheId } from '@/lib/console/l1-upgrade-selection';
import { parseUpgradeJson } from '@/lib/console/upgrade-json';

type PutSnapshotBody = {
  subnetId?: string;
  blockchainId?: string;
  chainName?: string | null;
  rpcUrl?: string | null;
  upgradeJson?: unknown;
  source?: string;
  status?: string;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const subnetId = searchParams.get('subnetId');
  const blockchainId = searchParams.get('blockchainId');
  if (!subnetId || !blockchainId) {
    return jsonError(400, 'subnetId and blockchainId are required');
  }
  if (!isValidAvalancheId(subnetId) || !isValidAvalancheId(blockchainId)) {
    return jsonError(400, 'subnetId and blockchainId must be valid Avalanche CB58 IDs');
  }

  const snapshot = await prisma.l1UpgradeSnapshot.findUnique({
    where: {
      user_id_subnet_id_blockchain_id: {
        user_id: userId!,
        subnet_id: subnetId,
        blockchain_id: blockchainId,
      },
    },
  });

  return jsonOk({ snapshot });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  let body: PutSnapshotBody;
  try {
    body = (await request.json()) as PutSnapshotBody;
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const { subnetId, blockchainId } = body;
  if (!subnetId || !blockchainId) {
    return jsonError(400, 'subnetId and blockchainId are required');
  }
  if (!isValidAvalancheId(subnetId) || !isValidAvalancheId(blockchainId)) {
    return jsonError(400, 'subnetId and blockchainId must be valid Avalanche CB58 IDs');
  }

  const upgradeJson = body.upgradeJson;
  const parsed = parseUpgradeJson(typeof upgradeJson === 'string' ? upgradeJson : JSON.stringify(upgradeJson ?? {}));
  if (!parsed.config || parsed.error) {
    return jsonError(400, parsed.error || 'Invalid upgrade.json');
  }

  const snapshot = await prisma.l1UpgradeSnapshot.upsert({
    where: {
      user_id_subnet_id_blockchain_id: {
        user_id: userId!,
        subnet_id: subnetId,
        blockchain_id: blockchainId,
      },
    },
    create: {
      user_id: userId!,
      subnet_id: subnetId,
      blockchain_id: blockchainId,
      chain_name: body.chainName ?? null,
      rpc_url: body.rpcUrl ?? null,
      upgrade_json: parsed.config as Prisma.InputJsonObject,
      source: body.source ?? 'builder',
      status: body.status ?? 'draft',
    },
    update: {
      chain_name: body.chainName ?? null,
      rpc_url: body.rpcUrl ?? null,
      upgrade_json: parsed.config as Prisma.InputJsonObject,
      source: body.source ?? 'builder',
      status: body.status ?? 'draft',
    },
  });

  return jsonOk({ snapshot });
}
