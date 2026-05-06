import { NextRequest, NextResponse } from 'next/server';
import {
  PChainNetwork,
  getBlockByHeight,
  getBlock,
  pchainRpc,
  type PChainBlock,
} from '@/lib/pchain/rpc';
import { decodePChainTx, getTxTypeDescription, type DecodedTransaction } from '@/lib/pchain/txDecoder';

// ============================================================================
// Types
// ============================================================================

interface BlockDetail {
  height: number;
  blockId: string;
  parentId: string;
  timestamp?: string;
  timestampUnix?: number;
  txCount: number;
  transactions: TransactionDetail[];
}

interface TransactionDetail {
  txId: string;
  type: string;
  typeDescription: string;
  decoded: DecodedTransaction;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    
    // Get network from query params (default to mainnet)
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network: PChainNetwork = networkParam === 'fuji' ? 'fuji' : 'mainnet';

    let block: PChainBlock;

    // Check if blockId is a number (height) or a string (block ID)
    const heightMatch = blockId.match(/^\d+$/);
    
    if (heightMatch) {
      // Fetch by height
      const height = parseInt(blockId, 10);
      block = await getBlockByHeight(height, network);
    } else {
      // Fetch by block ID (CB58 encoded)
      block = await getBlock(blockId, network);
    }

    // Get all transactions from block (handle both single tx and txs array)
    const allTxs = block.txs || (block.tx ? [block.tx] : []);
    
    // Decode all transactions in the block
    const transactions: TransactionDetail[] = allTxs.map((tx) => {
      const decoded = decodePChainTx(tx);
      return {
        txId: tx.id || decoded.txId || '',
        type: decoded.type,
        typeDescription: getTxTypeDescription(decoded.type),
        decoded,
      };
    });

    // Build timestamp if available
    let timestamp: string | undefined;
    let timestampUnix: number | undefined;
    if (block.time) {
      timestampUnix = block.time;
      timestamp = new Date(block.time * 1000).toISOString();
    }

    const blockDetail: BlockDetail = {
      height: block.height,
      blockId: block.id || blockId,
      parentId: block.parentID,
      timestamp,
      timestampUnix,
      txCount: transactions.length,
      transactions,
    };

    return NextResponse.json(blockDetail);
  } catch (error) {
    console.error('P-Chain block detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch block' },
      { status: 500 }
    );
  }
}

