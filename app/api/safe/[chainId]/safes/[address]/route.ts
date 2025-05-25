import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { chainId: string; address: string } }
) {
  try {
    const { chainId, address } = params;
    
    // Get the transaction service URL for this chain
    const chainsResponse = await fetch('https://wallet-client.ash.center/v1/chains');
    if (!chainsResponse.ok) {
      throw new Error('Failed to fetch chains configuration');
    }
    
    const chainsData = await chainsResponse.json();
    const supportedChain = chainsData.results.find((chain: any) => chain.chainId === chainId);
    
    if (!supportedChain) {
      return NextResponse.json(
        { error: `Chain ${chainId} is not supported` },
        { status: 400 }
      );
    }
    
    const baseUrl = supportedChain.transactionService;
    const safeUrl = `${baseUrl}/api/v1/safes/${address}/`;
    
    console.log('Fetching Safe info from:', safeUrl);
    
    const response = await fetch(safeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Safe not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching Safe info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Safe information' },
      { status: 500 }
    );
  }
} 