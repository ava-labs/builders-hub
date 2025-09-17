import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';

const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
  console.error('necessary environment variables for EVM chain faucets are not set');
}

// Helper function to find a testnet chain that supports BuilderHub faucet
function findSupportedChain(chainId: number): L1ListItem | undefined {
  const testnetStore = getL1ListStore(true);

  return testnetStore.getState().l1List.find(
    (chain: L1ListItem) => chain.evmChainId === chainId && chain.hasBuilderHubFaucet
  );
}

function createViemChain(l1Data: L1ListItem) {
  if (l1Data.evmChainId === 43113) {
    return avalancheFuji;
  }

  return defineChain({
    id: l1Data.evmChainId,
    name: l1Data.name,
    nativeCurrency: {
      decimals: 18,
      name: l1Data.coinName,
      symbol: l1Data.coinName,
    },
    rpcUrls: {
      default: {
        http: [l1Data.rpcUrl],
      },
    },
    blockExplorers: l1Data.explorerUrl ? {
      default: { name: 'Explorer', url: l1Data.explorerUrl },
    } : undefined,
  });
}

const account = SERVER_PRIVATE_KEY ? privateKeyToAccount(SERVER_PRIVATE_KEY as `0x${string}`) : null;

interface TransferResponse {
  success: boolean;
  txHash?: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amount?: string;
  chainId?: number;
  message?: string;
}

async function transferEVMTokens(
  sourceAddress: string,
  destinationAddress: string,
  chainId: number,
  amount: string
): Promise<{ txHash: string }> {
  if (!account) {
    throw new Error('Wallet not initialized');
  }

  const l1Data = findSupportedChain(chainId);
  if (!l1Data) {
    throw new Error(`ChainID ${chainId} is not supported by Builder Hub Faucet`);
  }

  const viemChain = createViemChain(l1Data);
  const walletClient = createWalletClient({ account, chain: viemChain, transport: http() });
  const publicClient = createPublicClient({ chain: viemChain, transport: http() });

  const balance = await publicClient.getBalance({
    address: sourceAddress as `0x${string}`
  });

  const amountToSend = parseEther(amount);

  if (balance < amountToSend) {
    throw new Error(`Insufficient faucet balance on ${l1Data.name}`);
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

    const parsedChainId = parseInt(chainId);
    const supportedChain = findSupportedChain(parsedChainId);
    if (!supportedChain) {
      return NextResponse.json(
        { success: false, message: `Chain ${chainId} does not support BuilderHub faucet` },
        { status: 400 }
      );
    }

    if (!isAddress(destinationAddress)) {
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
    const chainId = parseInt(searchParams.get('chainId')!);
    const supportedChain = findSupportedChain(chainId);
    const dripAmount = (supportedChain?.dripAmount || 3).toString();

    const tx = await transferEVMTokens(
      FAUCET_ADDRESS!,
      destinationAddress,
      chainId,
      dripAmount
    );

    const response: TransferResponse = {
      success: true,
      txHash: tx.txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: dripAmount,
      chainId
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
    identifier: async (_req: NextRequest) => {
      const session = await import('@/lib/auth/authSession').then(mod => mod.getAuthSession());
      if (!session) throw new Error('Authentication required');
      const userId = session.user.id;
      return `${userId}-${chainId}`;
    }
  });

  return rateLimitHandler(request);
}
