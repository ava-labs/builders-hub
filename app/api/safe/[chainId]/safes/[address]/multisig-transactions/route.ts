import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { chainId: string; address: string } }
) {
  try {
    const { chainId, address } = params;
    const { searchParams } = new URL(request.url);
    
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
    
    // Build the URL with query parameters
    const queryString = searchParams.toString();
    const transactionUrl = `${baseUrl}/api/v1/safes/${address}/multisig-transactions/${queryString ? `?${queryString}` : ''}`;
    
    console.log('Fetching Safe transactions from:', transactionUrl);
    
    const response = await fetch(transactionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching Safe transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Safe transactions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { chainId: string; address: string } }
) {
  try {
    const { chainId, address } = params;
    
    console.log('=== POST /api/safe/[chainId]/safes/[address]/multisig-transactions ===');
    console.log('Chain ID:', chainId);
    console.log('Safe Address:', address);
    
    let body;
    try {
      body = await request.json();
      console.log('Received request body:', JSON.stringify(body, null, 2));
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['to', 'value', 'data', 'operation', 'nonce', 'contractTransactionHash', 'sender', 'signature'];
    const missingFields = requiredFields.filter(field => body[field] === undefined || body[field] === null);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get the transaction service URL for this chain
    console.log('Fetching chains configuration...');
    let chainsResponse;
    try {
      chainsResponse = await fetch('https://wallet-client.ash.center/v1/chains');
      if (!chainsResponse.ok) {
        throw new Error(`Chains API responded with ${chainsResponse.status}: ${chainsResponse.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch chains configuration:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chains configuration' },
        { status: 503 }
      );
    }
    
    let chainsData;
    try {
      chainsData = await chainsResponse.json();
      console.log('Chains data received, count:', chainsData.results?.length || 0);
    } catch (error) {
      console.error('Failed to parse chains response:', error);
      return NextResponse.json(
        { error: 'Invalid response from chains API' },
        { status: 503 }
      );
    }
    
    const supportedChain = chainsData.results?.find((chain: any) => chain.chainId === chainId);
    
    if (!supportedChain) {
      console.error('Chain not supported:', chainId);
      console.log('Available chains:', chainsData.results?.map((c: any) => c.chainId));
      return NextResponse.json(
        { error: `Chain ${chainId} is not supported` },
        { status: 400 }
      );
    }
    
    const baseUrl = supportedChain.transactionService;
    const proposeUrl = `${baseUrl}/api/v1/safes/${address}/multisig-transactions/`;
    
    console.log('Transaction service URL:', baseUrl);
    console.log('Full propose URL:', proposeUrl);
    console.log('Request payload:', JSON.stringify(body, null, 2));
    
    let response;
    try {
      response = await fetch(proposeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      console.log('Safe API response status:', response.status);
      console.log('Safe API response headers:', Object.fromEntries(response.headers.entries()));
    } catch (error) {
      console.error('Network error calling Safe API:', error);
      return NextResponse.json(
        { error: 'Network error connecting to Safe transaction service' },
        { status: 503 }
      );
    }

    const responseText = await response.text();
    console.log('Raw response body:', responseText);

    if (!response.ok) {
      console.error('Error response status:', response.status);
      console.error('Error response body:', responseText);
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = responseText;
      }
      
      return NextResponse.json(
        { 
          error: `HTTP ${response.status}: ${response.statusText}`, 
          details: errorDetails,
          requestBody: body
        },
        { status: response.status }
      );
    }

    // Handle successful response
    let data;
    if (responseText.trim() === '') {
      // Safe API returns 201 with empty body for successful proposals
      console.log('Transaction proposed successfully (empty response)');
      data = { success: true, message: 'Transaction proposed successfully' };
    } else {
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        console.error('Failed to parse success response:', error);
        return NextResponse.json(
          { error: 'Invalid JSON response from Safe API', details: responseText },
          { status: 502 }
        );
      }
    }
    
    console.log('Success response:', data);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('=== UNEXPECTED ERROR IN POST HANDLER ===');
    console.error('Error type:', (error as any)?.constructor?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    return NextResponse.json(
      { error: 'Failed to propose Safe transaction', details: (error as Error)?.message },
      { status: 500 }
    );
  }
} 