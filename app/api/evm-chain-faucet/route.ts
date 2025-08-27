import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';

const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;
const FIXED_AMOUNT = '3';

if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
  console.error('necessary environment variables for EVM chain faucets are not set');
}

const echoTestnet = defineChain({
  id: 173750,
  name: 'Echo L1',
  nativeCurrency: {
    decimals: 18,
    name: 'ECH',
    symbol: 'ECH',
  },
  rpcUrls: {
    default: {
      http: ['https://subnets.avax.network/echo/testnet/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://subnets.avax.network/echo/testnet' },
  },
});

const dispatchTestnet = defineChain({
  id: 779672,
  name: 'Dispatch L1',
  nativeCurrency: {
    decimals: 18,
    name: 'DIS',
    symbol: 'DIS',
  },
  rpcUrls: {
    default: {
      http: ['https://subnets.avax.network/dispatch/testnet/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://subnets.avax.network/dispatch/testnet' },
  },
});

const SUPPORTED_CHAINS = {
  43113: { chain: avalancheFuji, name: 'C-Chain (Fuji)', symbol: 'AVAX' },
  173750: { chain: echoTestnet, name: 'Echo L1', symbol: 'ECH' },
  779672: { chain: dispatchTestnet, name: 'Dispatch L1', symbol: 'DIS' },
} as const;

type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

interface TransferResponse {
  success: boolean;
  txHash?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amount?: string;
  chainId?: number;
  chainName?: string;
  message?: string;
}

async function transferEVMTokens(
  sourcePrivateKey: string,
  sourceAddress: string,
  destinationAddress: string,
  chainId: SupportedChainId
): Promise<{ txHash: string }> {
  const chainConfig = SUPPORTED_CHAINS[chainId];
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const account = privateKeyToAccount(sourcePrivateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http()
  });

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http()
  });

  const balance = await publicClient.getBalance({
    address: sourceAddress as `0x${string}`
  });
  
  const amountToSend = parseEther(FIXED_AMOUNT);
  
  if (balance < amountToSend) {
    throw new Error(`Insufficient faucet balance on ${chainConfig.name}`);
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
    
    if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
      return NextResponse.json(
        { success: false, message: 'Server not properly configured' },
        { status: 500 }
      );
    }
      
    const searchParams = request.nextUrl.searchParams;
    const destinationAddress = searchParams.get('address');
    const chainId = searchParams.get('chainId');

    if (!destinationAddress) {
      return NextResponse.json(
        { success: false, message: 'Destination address is required' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { success: false, message: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const parsedChainId = parseInt(chainId) as SupportedChainId;
    if (!SUPPORTED_CHAINS[parsedChainId]) {
      return NextResponse.json(
        { success: false, message: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return NextResponse.json(
        { success: false, message: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }
    
    if (destinationAddress.toLowerCase() === FAUCET_ADDRESS?.toLowerCase()) {
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
    const chainId = parseInt(searchParams.get('chainId')!) as SupportedChainId;
    const chainConfig = SUPPORTED_CHAINS[chainId];
    
    const tx = await transferEVMTokens(
      SERVER_PRIVATE_KEY!,
      FAUCET_ADDRESS!,
      destinationAddress,
      chainId
    );

    const response: TransferResponse = {
      success: true,
      txHash: tx.txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: FIXED_AMOUNT,
      chainId,
      chainName: chainConfig.name
    };
        
    return NextResponse.json(response);
      
  } catch (error) {
    console.error('EVM chain transfer failed:', error);
        
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

  const chainId = request.nextUrl.searchParams.get('chainId');
  const rateLimitHandler = rateLimit(handleFaucetRequest, {
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 1,
    identifier: async (req: NextRequest) => {
      const session = await import('@/lib/auth/authSession').then(mod => mod.getAuthSession());
      if (!session) throw new Error('Authentication required');
      const userId = session.user.id;
      return `${userId}-${chainId}`;
    }
  });
 
  return rateLimitHandler(request);
}
