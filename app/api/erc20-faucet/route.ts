import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, createPublicClient, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getAuthSession } from '@/lib/auth/authSession';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';
import { withChainLock, getNextNonce, withNonceRetry } from '@/lib/faucet/nonceManager';
import { createFaucetViemChain, findFaucetChain } from '@/lib/faucet/evmChain';
import {
  ERC20_FAUCET_ABI,
  WRAPPED_NATIVE_FAUCET_ABI,
  WRAPPED_NATIVE_GAS_RESERVE,
  findERC20FaucetToken,
  getERC20ClaimScope,
  getERC20DripAmount,
} from '@/lib/faucet/erc20';
import type { ERC20FaucetToken, L1ListItem } from '@/components/toolbox/stores/l1ListStore';

const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
  console.error('necessary environment variables for ERC-20 faucets are not set');
}

const account = SERVER_PRIVATE_KEY ? privateKeyToAccount(SERVER_PRIVATE_KEY as `0x${string}`) : null;

async function transferERC20Tokens(
  chain: L1ListItem,
  token: ERC20FaucetToken,
  destinationAddress: `0x${string}`,
  amount: bigint
): Promise<{ txHash: string; wrapTxHash?: string }> {
  if (!account || !FAUCET_ADDRESS) {
    throw new Error('Wallet not initialized');
  }

  const faucetAddress = FAUCET_ADDRESS as `0x${string}`;
  const viemChain = createFaucetViemChain(chain);
  const walletClient = createWalletClient({ account, chain: viemChain, transport: http() });
  const publicClient = createPublicClient({ chain: viemChain, transport: http() });

  return withChainLock(chain.evmChainId, async () => {
    let wrapTxHash: `0x${string}` | undefined;

    const tokenBalance = await publicClient.readContract({
      address: token.address,
      abi: ERC20_FAUCET_ABI,
      functionName: 'balanceOf',
      args: [faucetAddress],
    });

    if (tokenBalance < amount) {
      if (token.kind !== 'wrapped-native') {
        throw new Error(`Insufficient faucet ${token.symbol} balance on ${chain.name}`);
      }

      // Wrapped-native tokens are minted on demand from the faucet's own native
      // balance, keeping a reserve so later drips on this chain can still pay gas.
      const shortfall = amount - tokenBalance;
      const nativeBalance = await publicClient.getBalance({ address: faucetAddress });
      if (nativeBalance < shortfall + WRAPPED_NATIVE_GAS_RESERVE) {
        throw new Error(`Insufficient faucet ${chain.coinName} balance to wrap ${token.symbol} on ${chain.name}`);
      }

      wrapTxHash = await withNonceRetry(async () => {
        const nonce = await getNextNonce(publicClient, faucetAddress);
        return walletClient.writeContract({
          address: token.address,
          abi: WRAPPED_NATIVE_FAUCET_ABI,
          functionName: 'deposit',
          value: shortfall,
          nonce,
        });
      });

      const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapTxHash });
      if (wrapReceipt.status !== 'success') {
        throw new Error(`Wrapping ${chain.coinName} into ${token.symbol} failed`);
      }
    }

    const txHash = await withNonceRetry(async () => {
      const nonce = await getNextNonce(publicClient, faucetAddress);
      return walletClient.writeContract({
        address: token.address,
        abi: ERC20_FAUCET_ABI,
        functionName: 'transfer',
        args: [destinationAddress, amount],
        nonce,
      });
    });

    return { txHash, wrapTxHash };
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    let body: { address?: unknown; chainId?: unknown; tokenAddress?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const destinationAddress = typeof body.address === 'string' ? body.address : null;
    const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress : null;
    const chainIdParam =
      typeof body.chainId === 'string' || typeof body.chainId === 'number'
        ? String(body.chainId)
        : null;

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

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, message: 'Token address is required' },
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

    const supportedChain = findFaucetChain(parsedChainId);
    if (!supportedChain) {
      return NextResponse.json(
        { success: false, message: `Chain ${parsedChainId} does not support BuilderHub faucet` },
        { status: 400 }
      );
    }

    const token = findERC20FaucetToken(supportedChain, tokenAddress);
    if (!token) {
      return NextResponse.json(
        { success: false, message: `Token ${tokenAddress} is not supported by the ${supportedChain.name} faucet` },
        { status: 400 }
      );
    }

    if (!isAddress(destinationAddress)) {
      return NextResponse.json(
        { success: false, message: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    if (destinationAddress.toLowerCase() === FAUCET_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'Cannot send tokens to the faucet address' },
        { status: 400 }
      );
    }

    const drip = getERC20DripAmount(token);
    const claimScope = getERC20ClaimScope(parsedChainId, token.address);

    const reservationResult = await checkAndReserveFaucetClaim(
      session.user.id,
      'erc20',
      destinationAddress,
      drip.formatted,
      claimScope
    );

    if (!reservationResult.allowed) {
      return NextResponse.json(
        { success: false, message: reservationResult.reason },
        { status: 429 }
      );
    }

    claimId = reservationResult.claimId!;

    const tx = await transferERC20Tokens(
      supportedChain,
      token,
      destinationAddress as `0x${string}`,
      drip.raw
    );

    await completeFaucetClaim(claimId, tx.txHash);

    return NextResponse.json({
      success: true,
      txHash: tx.txHash,
      wrapTxHash: tx.wrapTxHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: drip.formatted,
      chainId: parsedChainId,
      token: {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
      },
    });

  } catch (error) {
    console.error('ERC-20 faucet error:', error);

    if (claimId) {
      await cancelFaucetClaim(claimId);
    }

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to complete transfer' },
      { status: 500 }
    );
  }
}
