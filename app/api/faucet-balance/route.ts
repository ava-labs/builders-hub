import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, defineChain } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';

const FAUCET_C_CHAIN_ADDRESS = process.env.FAUCET_C_CHAIN_ADDRESS;
const FAUCET_P_CHAIN_ADDRESS = process.env.FAUCET_P_CHAIN_ADDRESS;

// Log config status on startup (once)
if (!FAUCET_C_CHAIN_ADDRESS) {
  console.warn('[faucet-balance] FAUCET_C_CHAIN_ADDRESS not configured');
}
if (!FAUCET_P_CHAIN_ADDRESS) {
  console.warn('[faucet-balance] FAUCET_P_CHAIN_ADDRESS not configured');
}

interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceFormatted: string;
  symbol: string;
  faucetAddress: string;
}

interface FaucetBalanceResponse {
  success: boolean;
  pChain?: {
    balance: string;
    balanceFormatted: string;
    faucetAddress: string;
  };
  evmChains?: ChainBalance[];
  message?: string;
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
  });
}

async function getPChainBalance(): Promise<{ balance: string; balanceFormatted: string } | null> {
  if (!FAUCET_P_CHAIN_ADDRESS) return null;

  try {
    // Use JSON-RPC API directly for proper typing
    const response = await fetch('https://api.avax-test.network/ext/bc/P', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'platform.getBalance',
        params: {
          addresses: [FAUCET_P_CHAIN_ADDRESS],
        },
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Failed to fetch P-chain balance');
    }

    const balanceNAvax = BigInt(data.result.balance);
    const balanceAvax = Number(balanceNAvax) / 1e9;

    return {
      balance: balanceNAvax.toString(),
      balanceFormatted: balanceAvax.toFixed(2),
    };
  } catch (error) {
    console.error('Failed to fetch P-Chain balance:', error);
    return null;
  }
}

async function getEVMChainBalance(chain: L1ListItem): Promise<ChainBalance | null> {
  if (!FAUCET_C_CHAIN_ADDRESS) return null;

  try {
    const viemChain = createViemChain(chain);
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(),
    });

    const balance = await publicClient.getBalance({
      address: FAUCET_C_CHAIN_ADDRESS as `0x${string}`,
    });

    return {
      chainId: chain.evmChainId,
      chainName: chain.name,
      balance: balance.toString(),
      balanceFormatted: parseFloat(formatEther(balance)).toFixed(2),
      symbol: chain.coinName,
      faucetAddress: FAUCET_C_CHAIN_ADDRESS,
    };
  } catch (error) {
    console.error(`Failed to fetch balance for chain ${chain.name}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<FaucetBalanceResponse>> {
  try {
    // Get list of chains with faucet support
    const testnetStore = getL1ListStore(true);
    const chainsWithFaucet = testnetStore.getState().l1List.filter(
      (chain: L1ListItem) => chain.hasBuilderHubFaucet
    );

    // Fetch all balances in parallel
    const [pChainResult, ...evmResults] = await Promise.all([
      getPChainBalance(),
      ...chainsWithFaucet.map((chain: L1ListItem) => getEVMChainBalance(chain)),
    ]);

    const evmChains = evmResults.filter((result): result is ChainBalance => result !== null);

    return NextResponse.json({
      success: true,
      pChain: pChainResult ? {
        ...pChainResult,
        faucetAddress: FAUCET_P_CHAIN_ADDRESS!,
      } : undefined,
      evmChains,
    });
  } catch (error) {
    console.error('Faucet balance error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch balances' },
      { status: 500 }
    );
  }
}
