import type { NextRequest } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';
import {
  withApi,
  successResponse,
  BadRequestError,
  ForbiddenError,
  InternalError,
  EVM_ADDRESS_REGEX,
  validateQuery,
} from '@/lib/api';

const DEVNET_RPC_URL = 'https://api.avax-dev.network/ext/bc/C/rpc';
const DEVNET_CHAIN_ID = 43117;
const DRIP_AMOUNT = '2';

const devnetCChain = defineChain({
  id: DEVNET_CHAIN_ID,
  name: 'Avalanche Devnet C-Chain',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: {
    default: { http: [DEVNET_RPC_URL] },
  },
});

const querySchema = z.object({
  address: z
    .string()
    .min(1, 'Valid EVM address is required')
    .regex(EVM_ADDRESS_REGEX, { message: 'Valid EVM address is required' }),
});

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const SERVER_PRIVATE_KEY = process.env.FAUCET_C_CHAIN_PRIVATE_KEY;
    const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

    const email = session.user?.email || '';
    if (!email.endsWith('@avalabs.org')) {
      throw new ForbiddenError('Devnet faucet is restricted to @avalabs.org accounts');
    }

    if (!SERVER_PRIVATE_KEY || !FAUCET_ADDRESS) {
      throw new InternalError('Faucet not configured');
    }

    const { address: destinationAddress } = validateQuery(req, querySchema);

    if (destinationAddress.toLowerCase() === FAUCET_ADDRESS.toLowerCase()) {
      throw new BadRequestError('Cannot send tokens to the faucet address');
    }

    const account = privateKeyToAccount(SERVER_PRIVATE_KEY as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: devnetCChain,
      transport: http(DEVNET_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: devnetCChain,
      transport: http(DEVNET_RPC_URL),
    });

    const balance = await publicClient.getBalance({ address: FAUCET_ADDRESS as `0x${string}` });
    const amountToSend = parseEther(DRIP_AMOUNT);

    if (balance < amountToSend) {
      throw new InternalError('Insufficient faucet balance on devnet');
    }

    const nonce = await publicClient.getTransactionCount({
      address: FAUCET_ADDRESS as `0x${string}`,
    });

    let txHash: string;
    try {
      // Simple native transfer is always 21000 gas.
      // Hardcoded to skip eth_estimateGas which fails on the devnet RPC.
      txHash = await walletClient.sendTransaction({
        to: destinationAddress as `0x${string}`,
        value: amountToSend,
        gas: 21000n,
        nonce,
      });
    } catch {
      throw new InternalError('Faucet transaction failed');
    }

    return successResponse({
      txHash,
      sourceAddress: FAUCET_ADDRESS,
      destinationAddress,
      amount: DRIP_AMOUNT,
      chainId: DEVNET_CHAIN_ID,
    });
  },
  { auth: true },
);
