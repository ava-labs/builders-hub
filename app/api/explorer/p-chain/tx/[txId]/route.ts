import { NextRequest, NextResponse } from 'next/server';
import {
  PChainNetwork,
  getTx,
  getTxStatus,
} from '@/lib/pchain/rpc';
import { 
  decodePChainTx, 
  getTxTypeDescription, 
  getTxTypeColor,
  formatTxSummary,
  type DecodedTransaction 
} from '@/lib/pchain/txDecoder';

// ============================================================================
// Types
// ============================================================================

interface TransactionDetailResponse {
  txId: string;
  status: string;
  statusReason?: string;
  type: string;
  typeDescription: string;
  typeColor: string;
  summary: string;
  decoded: DecodedTransaction;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const { txId } = await params;
    
    // Get network from query params (default to mainnet)
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network: PChainNetwork = networkParam === 'fuji' ? 'fuji' : 'mainnet';

    // Fetch transaction and status in parallel
    const [tx, statusResult] = await Promise.all([
      getTx(txId, network),
      getTxStatus(txId, network),
    ]);

    // Decode the transaction
    const decoded = decodePChainTx(tx);
    decoded.txId = txId;

    const response: TransactionDetailResponse = {
      txId,
      status: statusResult.status,
      statusReason: statusResult.reason,
      type: decoded.type,
      typeDescription: getTxTypeDescription(decoded.type),
      typeColor: getTxTypeColor(decoded.type),
      summary: formatTxSummary(decoded),
      decoded,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('P-Chain transaction detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}

