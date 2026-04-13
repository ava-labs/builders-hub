import { createPublicClient, http, defineChain, formatEther } from 'viem';
import { withApi, successResponse, ForbiddenError, InternalError } from '@/lib/api';

const DEVNET_RPC_URL = 'https://api.avax-dev.network/ext/bc/C/rpc';
const DEVNET_CHAIN_ID = 43117;

const devnetCChain = defineChain({
  id: DEVNET_CHAIN_ID,
  name: 'Avalanche Devnet C-Chain',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: {
    default: { http: [DEVNET_RPC_URL] },
  },
});

export const GET = withApi(
  async (_req, { session }) => {
    const FAUCET_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;

    const email = session.user?.email || '';
    if (!email.endsWith('@avalabs.org')) {
      throw new ForbiddenError('Restricted to @avalabs.org accounts');
    }

    if (!FAUCET_ADDRESS) {
      throw new InternalError('Faucet not configured');
    }

    const publicClient = createPublicClient({
      chain: devnetCChain,
      transport: http(DEVNET_RPC_URL),
    });

    const balanceWei = await publicClient.getBalance({
      address: FAUCET_ADDRESS as `0x${string}`,
    });

    const balance = formatEther(balanceWei);

    return successResponse({ balance, address: FAUCET_ADDRESS });
  },
  { auth: true },
);
