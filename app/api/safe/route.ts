import { NextRequest, NextResponse } from 'next/server';
import SafeApiKit from '@safe-global/api-kit';
import { getAddress, isAddress } from 'viem';

interface ChainConfig {
  chainId: string;
  chainName: string;
  transactionService: string;
  [key: string]: any;
}

const getSupportedChain = async (chainId: string): Promise<{ txServiceUrl: string; shortName: string }> => {
  try {
    const response = await fetch('https://wallet-client.ash.center/v1/chains', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    const supportedChain = data.results.find((chain: ChainConfig) => chain.chainId === chainId);
    if (!supportedChain) {
      throw new Error(`Chain ${chainId} is not supported for Ash L1 Multisig operations`);
    }
    
    let txServiceUrl = supportedChain.transactionService;
    if (!txServiceUrl.endsWith('/api') && !txServiceUrl.includes('/api/')) {
      txServiceUrl = txServiceUrl.endsWith('/') ? txServiceUrl + 'api' : txServiceUrl + '/api';
    }
    
    return {
      txServiceUrl,
      shortName: supportedChain.shortName
    };
  } catch (error) {
    throw new Error(`Failed to fetch supported chains: ${(error as Error).message}`);
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, chainId, safeAddress, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    // Get transaction service URL and chain info
    const chainInfo = await getSupportedChain(chainId);

    // Initialize Safe API Kit
    const apiKit = new SafeApiKit({ 
      chainId: BigInt(chainId),
      txServiceUrl: chainInfo.txServiceUrl
    });

    switch (action) {
      case 'getSafeInfo': {
        const safeInfo = await apiKit.getSafeInfo(safeAddress);
        return NextResponse.json({ success: true, data: safeInfo });
      }

      case 'getNextNonce': {
        const nonce = await apiKit.getNextNonce(safeAddress);
        return NextResponse.json({ success: true, data: { nonce: Number(nonce) } });
      }

      case 'proposeTransaction': {
        const { proposalData } = params;
        
        if (!proposalData) {
          return NextResponse.json(
            { error: 'Missing proposalData' },
            { status: 400 }
          );
        }

        // Ensure addresses are properly formatted
        const formattedProposalData = {
          ...proposalData,
          safeAddress: getAddress(proposalData.safeAddress),
          senderAddress: getAddress(proposalData.senderAddress),
          safeTransactionData: {
            ...proposalData.safeTransactionData,
            to: getAddress(proposalData.safeTransactionData.to),
            nonce: Number(proposalData.safeTransactionData.nonce),
          }
        };

        await apiKit.proposeTransaction(formattedProposalData);
        return NextResponse.json({ success: true, data: { proposed: true } });
      }

      case 'getPendingTransactions': {
        const transactions = await apiKit.getPendingTransactions(safeAddress);
        return NextResponse.json({ success: true, data: transactions });
      }

      case 'getTransaction': {
        const { safeTxHash } = params;
        if (!safeTxHash) {
          return NextResponse.json(
            { error: 'Missing safeTxHash' },
            { status: 400 }
          );
        }
        
        const transaction = await apiKit.getTransaction(safeTxHash);
        return NextResponse.json({ success: true, data: transaction });
      }

      case 'getSafesByOwner': {
        const { ownerAddress } = params;
        if (!ownerAddress) {
          return NextResponse.json(
            { error: 'Missing ownerAddress' },
            { status: 400 }
          );
        }

        const safesByOwner = await apiKit.getSafesByOwner(getAddress(ownerAddress));
        return NextResponse.json({ success: true, data: safesByOwner });
      }

      case 'getAllSafesInfo': {
        const { safeAddresses } = params;
        if (!safeAddresses || !Array.isArray(safeAddresses)) {
          return NextResponse.json(
            { error: 'Missing safeAddresses array' },
            { status: 400 }
          );
        }

        // Fetch info for multiple safes
        const safeInfos: Record<string, any> = {};
        const errors: Record<string, string> = {};

        for (const safeAddress of safeAddresses) {
          try {
            const safeInfo = await apiKit.getSafeInfo(getAddress(safeAddress));
            safeInfos[safeAddress] = safeInfo;
          } catch (error) {
            errors[safeAddress] = (error as Error).message;
          }
        }

        return NextResponse.json({ 
          success: true, 
          data: { 
            safeInfos, 
            errors: Object.keys(errors).length > 0 ? errors : undefined 
          } 
        });
      }

      case 'getAshWalletUrl': {
        if (!safeAddress) {
          return NextResponse.json(
            { error: 'Missing safeAddress' },
            { status: 400 }
          );
        }

        // Get chain info to get the shortName
        const chainInfo = await getSupportedChain(chainId);
        const ashWalletUrl = `https://wallet.ash.center/transactions/queue?safe=${chainInfo.shortName}:${safeAddress}`;
        
        return NextResponse.json({ 
          success: true, 
          data: { 
            url: ashWalletUrl,
            shortName: chainInfo.shortName
          } 
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Safe API error:', error);
    return NextResponse.json(
      { error: `Safe operation failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 