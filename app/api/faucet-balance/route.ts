import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, defineChain } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { pvm, Context, utils } from "@avalabs/avalanchejs";
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
    const pvmApi = new pvm.PVMApi("https://api.avax-test.network");
    const { utxos } = await pvmApi.getUTXOs({ addresses: [FAUCET_P_CHAIN_ADDRESS] });

    // Sum up all UTXO amounts
    let totalNAvax = BigInt(0);
    for (const utxo of utxos) {
      const output = utxo.output;
      if ('amount' in output) {
        totalNAvax += output.amount();
      }
    }

    const balanceAvax = Number(totalNAvax) / 1e9;
    return {
      balance: totalNAvax.toString(),
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
      ...chainsWithFaucet.map(chain => getEVMChainBalance(chain)),
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
