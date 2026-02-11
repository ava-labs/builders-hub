import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { getAuthSession } from '@/lib/auth/authSession';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';
import { withChainLock, getNextNonce, withNonceRetry } from '@/lib/faucet/nonceManager';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';

const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
  console.error('necessary environment variables for EVM chain faucets are not set');
}

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
      default: { http: [l1Data.rpcUrl] },
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

  const balance = await publicClient.getBalance({ address: sourceAddress as `0x${string}` });
  const amountToSend = parseEther(amount);

  if (balance < amountToSend) {
    throw new Error(`Insufficient faucet balance on ${l1Data.name}`);
  }

  return withChainLock(chainId, async () => {
    return withNonceRetry(async () => {
      const nonce = await getNextNonce(publicClient, sourceAddress as `0x${string}`);
      const txHash = await walletClient.sendTransaction({
        to: destinationAddress as `0x${string}`,
        value: amountToSend,
        nonce,
      });
      return { txHash };
    });
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let claimId: string | null = null;
  
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
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
    const chainIdParam = searchParams.get('chainId');

    if (!destinationAddress) {
      return NextResponse.json(
        { success: false, message: 'Destination address is required' },
        { status: 400 }
      );
    }

    if (!chainIdParam) {
      return NextResponse.json(
        { success: false, message: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const parsedChainId = parseInt(chainIdParam, 10);
    if (isNaN(parsedChainId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid chain ID format' },
        { status: 400 }
      );
    }
    
    const normalizedChainId = parsedChainId.toString();

    const supportedChain = findSupportedChain(parsedChainId);
    if (!supportedChain) {
      return NextResponse.json(
        { success: false, message: `Chain ${normalizedChainId} does not support BuilderHub faucet` },
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

    const dripAmount = (supportedChain.faucetThresholds?.dripAmount || 3).toString();

    const reservationResult = await checkAndReserveFaucetClaim(
      session.user.id,
      'evm',
      destinationAddress,
      dripAmount,
      normalizedChainId
    );

    if (!reservationResult.allowed) {
      return NextResponse.json(
        { success: false, message: reservationResult.reason },
        { status: 429 }
      );
    }

    claimId = reservationResult.claimId!;

    const tx = await transferEVMTokens(
      FAUCET_ADDRESS,
      destinationAddress,
      parsedChainId,
      dripAmount
    );

    await completeFaucetClaim(claimId, tx.txHash);

    return NextResponse.json({
      success: true,
      txHash: tx.txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: dripAmount,
      chainId: parsedChainId
    });

  } catch (error) {
    console.error('EVM chain faucet error:', error);

    if (claimId) {
      await cancelFaucetClaim(claimId);
    }

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to complete transfer' },
      { status: 500 }
    );
  }
}
