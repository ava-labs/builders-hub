import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji, avalanche } from 'viem/chains';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';

const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
const FAUCET_C_CHAIN_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;
const FIXED_AMOUNT = '2';

if (!SERVER_PRIVATE_KEY || !FAUCET_C_CHAIN_ADDRESS) {
  console.error('necessary environment variables for C-Chain faucet are not set');
}

interface TransferResponse {
  success: boolean;
  txHash?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amount?: string;
  message?: string;
}

async function transferCChainAVAX(
  sourcePrivateKey: string,
  sourceAddress: string,
  destinationAddress: string,
  isTestnet: boolean
): Promise<{ txHash: string }> {
  const chain = isTestnet ? avalancheFuji : avalanche; 
  const account = privateKeyToAccount(sourcePrivateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http()
  });

  const publicClient = createPublicClient({
    chain,
    transport: http()
  });

  const balance = await publicClient.getBalance({
    address: sourceAddress as `0x${string}`
  });
  
  const amountToSend = parseEther(FIXED_AMOUNT);
  
  if (balance < amountToSend) {
    throw new Error('Insufficient faucet balance');
  }

  const txHash = await walletClient.sendTransaction({
    to: destinationAddress as `0x${string}`,
    value: amountToSend,
  });

  return { txHash };
}

async function validateFaucetRequest(request: NextRequest): Promise<NextResponse | null> {
  try {
    const session = await getAuthSession();    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (!SERVER_PRIVATE_KEY || !FAUCET_C_CHAIN_ADDRESS) {
      return NextResponse.json(
        { success: false, message: 'Server not properly configured' },
        { status: 500 }
      );
    }
      
    const searchParams = request.nextUrl.searchParams;
    const destinationAddress = searchParams.get('address');

    if (!destinationAddress) {
      return NextResponse.json(
        { success: false, message: 'Destination address is required' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return NextResponse.json(
        { success: false, message: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }
    
    if (destinationAddress.toLowerCase() === FAUCET_C_CHAIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'Cannot send tokens to the faucet address' },
        { status: 400 }
      );
    }
    return null;
  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to validate request' 
      },
      { status: 500 }
    );
  }
}

async function handleFaucetRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const destinationAddress = searchParams.get('address')!;
    const isTestnet = true;
    
    const tx = await transferCChainAVAX(
      SERVER_PRIVATE_KEY!,
      FAUCET_C_CHAIN_ADDRESS!,
      destinationAddress,
      isTestnet
    );

    const response: TransferResponse = {
      success: true,
      txHash: tx.txHash,
      sourceAddress: FAUCET_C_CHAIN_ADDRESS,
      destinationAddress,
      amount: FIXED_AMOUNT
    };
        
    return NextResponse.json(response);
      
  } catch (error) {
    console.error('C-Chain transfer failed:', error);
        
    const response: TransferResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to complete transfer'
    };
        
    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const validationResponse = await validateFaucetRequest(request);

  if (validationResponse) {
    return validationResponse;
  }

  const rateLimitHandler = rateLimit(handleFaucetRequest, {
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 1
  });
 
  return rateLimitHandler(request);
} 