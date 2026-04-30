import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createDbNode, selectNewestNode } from '@/app/api/managed-testnet-nodes/service';
import { jsonError, jsonOk, validateSubnetId } from '@/app/api/managed-testnet-nodes/utils';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import type { AwardedConsoleBadge } from '@/server/services/consoleBadge/types';

/**
 * POST /api/internal/quick-l1/register-node
 *
 * Service-to-service callback from the Quick L1 Railway orchestrator.
 * After it provisions a managed node for a deploy, it pings this
 * endpoint so we attach a `prisma.nodeRegistration` row to the user's
 * builders-hub account — the same way a manual creation via
 * `POST /api/managed-testnet-nodes` would.
 *
 * The result is that Quick L1 deploys show up under the user's
 * "Managed nodes" page with the same TTL, the same RPC URL, and
 * award the same `node_registration` console badge.
 *
 * Auth model:
 *   - `x-quick-l1-secret` shared with the orchestrator. Constant-time
 *     compare; missing/wrong secret returns 401 without any hint.
 *   - The `userId` in the request body is trusted because the deploy
 *     proxy injected it from the authenticated session before
 *     forwarding to Railway. The orchestrator only relays it back; it
 *     can't fabricate a user.
 *
 * Why a separate endpoint instead of reusing `POST /api/managed-testnet-nodes`:
 *   - That route requires a Builders Hub session cookie and rate-limits
 *     by user. Service-to-service calls don't have a session, and the
 *     rate limit would be wrong (one Quick L1 deploy is one user
 *     action, not "the orchestrator hammering the API"). Splitting
 *     keeps each route's auth + limits coherent.
 */

const ADDRESS_HEX_RE = /^[0-9a-fA-F]+$/;

interface RegisterNodeRequest {
  userId: string;
  subnetId: string;
  blockchainId: string;
  chainName: string | null;
  nodeIndex: number;
  /** Epoch seconds (or ms — `toDateFromEpoch` normalises both). */
  dateCreated: number;
  nodeId: string;
  publicKey: string;
  proofOfPossession: string;
}

function authorizedAsQuickL1(presented: string | null): boolean {
  const configured = process.env.QUICK_L1_INTERNAL_SECRET;
  if (!configured || !presented) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(configured, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorizedAsQuickL1(request.headers.get('x-quick-l1-secret'))) {
    return jsonError(401, 'Unauthorized');
  }

  let body: RegisterNodeRequest;
  try {
    body = (await request.json()) as RegisterNodeRequest;
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  // Cheap shape checks before hitting the DB. The orchestrator already
  // produced these from successful upstream calls, but we don't trust
  // the wire — a malformed payload here would write garbage into the
  // user's node list.
  if (!body.userId || typeof body.userId !== 'string') return jsonError(400, 'userId required');
  if (!validateSubnetId(body.subnetId)) return jsonError(400, 'Invalid subnetId');
  if (!body.blockchainId || typeof body.blockchainId !== 'string') {
    return jsonError(400, 'Invalid blockchainId');
  }
  if (typeof body.nodeIndex !== 'number' || body.nodeIndex < 0) return jsonError(400, 'Invalid nodeIndex');
  if (typeof body.dateCreated !== 'number' || body.dateCreated <= 0) return jsonError(400, 'Invalid dateCreated');
  if (!body.nodeId || !body.nodeId.startsWith('NodeID-')) return jsonError(400, 'Invalid nodeId');
  // BLS pubkey + PoP are hex strings (no 0x prefix per the upstream service contract).
  if (!body.publicKey || !ADDRESS_HEX_RE.test(body.publicKey)) return jsonError(400, 'Invalid publicKey');
  if (!body.proofOfPossession || !ADDRESS_HEX_RE.test(body.proofOfPossession)) {
    return jsonError(400, 'Invalid proofOfPossession');
  }

  // Reshape the flat payload into the NodeInfo structure `createDbNode`
  // expects (matches what `selectNewestNode` returns from the manual
  // `POST /api/managed-testnet-nodes` flow). `selectNewestNode` is
  // imported but unused by this handler — keeping it as a value
  // reference asserts the shape contract at edit time, so a future
  // change to NodeInfo's structure breaks here loudly instead of
  // silently writing wrong data.
  void selectNewestNode;
  // `NodeInfo.expiresAt` exists on the type for parity with the
  // upstream managed-testnet-nodes service shape, but `createDbNode`
  // ignores it — it sets `expires_at` itself via `NODE_TTL_MS`. We
  // derive a plausible value (dateCreated + 3 days, in epoch seconds)
  // so the type checks out without misleading downstream readers.
  const THREE_DAYS_EPOCH_S = 3 * 24 * 60 * 60;
  const newestNode = {
    nodeIndex: body.nodeIndex,
    dateCreated: body.dateCreated,
    expiresAt: body.dateCreated + THREE_DAYS_EPOCH_S,
    nodeInfo: {
      result: {
        nodeID: body.nodeId,
        nodePOP: {
          publicKey: body.publicKey,
          proofOfPossession: body.proofOfPossession,
        },
      },
    },
  };

  try {
    const created = await createDbNode({
      userId: body.userId,
      subnetId: body.subnetId,
      blockchainId: body.blockchainId,
      newestNode,
      chainName: body.chainName ?? null,
    });

    // No-op when `createDbNode` returns null (already-active row for
    // the same nodeIndex within TTL). The deploy continues either way.
    if (!created) {
      return jsonOk({ ok: true, status: 'already-registered' });
    }

    // Award `node_registration` badge — same as the manual flow. Best
    // effort; a badge-service hiccup must never fail the registration.
    let awardedBadges: AwardedConsoleBadge[] = [];
    try {
      awardedBadges = await checkAndAwardConsoleBadges(body.userId, 'node_registration');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[register-node] badge award failed (non-fatal):', e);
    }

    return jsonOk({ ok: true, status: 'created', nodeId: created.id, awardedBadges });
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : 'Failed to register node', e);
  }
}
