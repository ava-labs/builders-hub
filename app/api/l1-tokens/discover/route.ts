import { NextRequest, NextResponse } from 'next/server';
import { tryGetIcttTransfers } from '@/lib/ictt/transfers-cache';

// Base58 (CB58) blockchain IDs. Avalanche's are typically 49 chars, but
// we allow a generous range so a future format change doesn't break us.
// The alphabet excludes 0, O, I, l to avoid ambiguity. Lower bound 32
// rejects obviously-too-short values without being so strict that we
// reject legitimate IDs we haven't seen.
const BLOCKCHAIN_ID_RE = /^[1-9A-HJ-NP-Za-km-z]{32,60}$/;

interface DiscoverResponse {
  /** Lower-cased, 0x-prefixed ERC-20-candidate addresses. The client
   *  validates each on-chain via `symbol()` before treating it as a
   *  real token — many of these will be bridge contracts rather than
   *  the wrapped-asset token itself, but the validation step filters
   *  them transparently. */
  addresses: string[];
  /** Surfaced when idx6 was unreachable and we have no cached payload.
   *  The client should treat addresses as empty and continue. */
  warning?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<DiscoverResponse>> {
  const { searchParams } = new URL(request.url);
  const blockchainId = searchParams.get('blockchainId');

  if (!blockchainId || !BLOCKCHAIN_ID_RE.test(blockchainId)) {
    return NextResponse.json(
      { addresses: [], warning: 'Invalid or missing blockchainId' },
      { status: 400 },
    );
  }

  const transfers = await tryGetIcttTransfers();
  if (!transfers) {
    return NextResponse.json({
      addresses: [],
      warning: 'ICTT index unavailable',
    });
  }

  // For any transfer route where the L1 sits on either end, include both
  // the bridge contract and the underlying coin address as candidates.
  // The on-chain `symbol()` probe in `useL1TokenBalances` drops anything
  // that isn't a live ERC-20 on this L1, so we don't need to crack which
  // side of the bridge each address represents.
  const candidates = new Set<string>();
  for (const transfer of transfers) {
    const involvesL1 =
      transfer.homeChainBlockchainId === blockchainId ||
      transfer.remoteChainBlockchainId === blockchainId;
    if (!involvesL1) continue;

    if (transfer.contractAddress) {
      candidates.add(transfer.contractAddress.toLowerCase());
    }
    if (transfer.coinAddress) {
      candidates.add(transfer.coinAddress.toLowerCase());
    }
  }

  return NextResponse.json(
    { addresses: Array.from(candidates) },
    {
      headers: {
        // Same 24h client cache as /api/ictt-stats — the underlying data
        // changes slowly and a hard refresh always hits the shared 36h
        // server cache (which the client cache can't bypass anyway).
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
