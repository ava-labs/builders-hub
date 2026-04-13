import type { NextRequest } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { z } from 'zod';
import {
  withApi,
  successResponse,
  BadRequestError,
  InternalError,
  RateLimitError,
  EVM_ADDRESS_REGEX,
  validateQuery,
} from '@/lib/api';
import { checkAndReserveFaucetClaim, completeFaucetClaim, cancelFaucetClaim } from '@/lib/faucet/rateLimit';
import { withChainLock, getNextNonce, withNonceRetry } from '@/lib/faucet/nonceManager';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { checkAndAwardConsoleBadges } from '@/server/services/consoleBadge/consoleBadgeService';
import type { AwardedConsoleBadge } from '@/server/services/consoleBadge/types';

const RPC_TIMEOUT_MS = 30_000;

const querySchema = z.object({
  address: z
    .string()
    .min(1, 'Destination address is required')
    .regex(EVM_ADDRESS_REGEX, { message: 'Invalid Ethereum address format' }),
  chainId: z
    .string()
    .min(1, 'Chain ID is required')
    .regex(/^\d+$/, { message: 'Invalid chain ID format' })
    .transform(Number),
});

function findSupportedChain(chainId: number): L1ListItem | undefined {
  const testnetStore = getL1ListStore(true);
  return testnetStore
    .getState()
    .l1List.find((chain: L1ListItem) => chain.evmChainId === chainId && chain.hasBuilderHubFaucet);
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
    blockExplorers: l1Data.explorerUrl ? { default: { name: 'Explorer', url: l1Data.explorerUrl } } : undefined,
  });
}

async function transferEVMTokens(
  privateKey: string,
  sourceAddress: string,
  destinationAddress: string,
  chainId: number,
  amount: string,
): Promise<{ txHash: string }> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const l1Data = findSupportedChain(chainId);
  if (!l1Data) {
    throw new BadRequestError(`Chain ${chainId} does not support BuilderHub faucet`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const viemChain = createViemChain(l1Data);
    const fetchOptions = { signal: controller.signal };
    const walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: http(undefined, { fetchOptions }),
    });
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(undefined, { fetchOptions }),
    });

    const balance = await publicClient.getBalance({ address: sourceAddress as `0x${string}` });
    const amountToSend = parseEther(amount);

    if (balance < amountToSend) {
      throw new InternalError(`Insufficient faucet balance on ${l1Data.name}`);
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
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
    const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

    if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
      throw new InternalError('Server not properly configured');
    }

    const { address: destinationAddress, chainId: parsedChainId } = validateQuery(req, querySchema);

    const supportedChain = findSupportedChain(parsedChainId);
    if (!supportedChain) {
      throw new BadRequestError(`Chain ${parsedChainId} does not support BuilderHub faucet`);
    }

    if (destinationAddress.toLowerCase() === FAUCET_ADDRESS.toLowerCase()) {
      throw new BadRequestError('Cannot send tokens to the faucet address');
    }

    const dripAmount = (supportedChain.faucetThresholds?.dripAmount || 3).toString();
    const normalizedChainId = parsedChainId.toString();

    const reservationResult = await checkAndReserveFaucetClaim(
      session.user.id,
      'evm',
      destinationAddress,
      dripAmount,
      normalizedChainId,
    );

    if (!reservationResult.allowed) {
      throw new RateLimitError(reservationResult.reason);
    }

    const claimId = reservationResult.claimId!;

    let txHash: string;
    try {
      const tx = await transferEVMTokens(
        SERVER_PRIVATE_KEY,
        FAUCET_ADDRESS,
        destinationAddress,
        parsedChainId,
        dripAmount,
      );
      txHash = tx.txHash;
    } catch (error) {
      await cancelFaucetClaim(claimId);
      if (error instanceof InternalError || error instanceof BadRequestError) {
        throw error;
      }
      throw new InternalError('Faucet transaction failed');
    }

    await completeFaucetClaim(claimId, txHash);

    let awardedBadges: AwardedConsoleBadge[] = [];
    try {
      awardedBadges = await checkAndAwardConsoleBadges(session.user.id, 'faucet_claim');
    } catch {
      // Badge check is non-critical; swallow failures
    }

    return successResponse({
      txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: dripAmount,
      chainId: parsedChainId,
      awardedBadges,
    });
  },
  { auth: true },
);
