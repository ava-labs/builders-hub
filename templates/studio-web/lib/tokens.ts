import { erc20Abi, formatUnits, isAddress } from 'viem';
import type { Config } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { studioConfig } from './studio.config';
import type { StudioToken } from './studio-types';

const MAX_CANDIDATES = 60;

/** The tokens the app knows for a chain: the project's own ERC-20s and the registry's (USDC, WAVAX, ...). */
export function tokenList(chainId: number): StudioToken[] {
  return studioConfig.tokens[chainId] ?? [];
}

/** An address's non-zero ERC-20 balances over the token list, read straight from the chain's RPC. */
export async function tokenBalances(config: Config, address: string, chainId: number) {
  if (!isAddress(address)) throw new Error('Pass an EVM address');
  const client = getPublicClient(config as never, { chainId } as never) as
    | ReturnType<typeof getPublicClient>
    | undefined;
  if (!client) throw new Error(`No RPC is configured for chain ${chainId}`);

  const rows = await Promise.all(
    tokenList(chainId)
      .slice(0, MAX_CANDIDATES)
      .map(async (token) => {
        try {
          const balance = await client.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          });
          if (balance === 0n) return null;
          const [decimals, symbol] = await Promise.all([
            token.decimals ??
              client.readContract({ address: token.address, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
            token.symbol ??
              client.readContract({ address: token.address, abi: erc20Abi, functionName: 'symbol' }).catch(() => null),
          ]);
          return {
            address: token.address,
            symbol,
            name: token.name,
            decimals: Number(decimals),
            balance: balance.toString(),
            formatted: formatUnits(balance, Number(decimals)),
            logoURI: token.logoURI,
          };
        } catch {
          return null;
        }
      }),
  );
  return { source: 'rpc' as const, balances: rows.filter((row) => row !== null) };
}
