import { formatUnits, isAddress, parseAbi, parseUnits } from 'viem';
import type { ERC20FaucetToken, L1ListItem } from '@/components/toolbox/stores/l1ListStore';

export const ERC20_FAUCET_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

export const WRAPPED_NATIVE_FAUCET_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function deposit() payable',
]);

/**
 * Native balance the faucet keeps back when wrapping on demand so it can
 * still pay gas for subsequent drips on the same chain.
 */
export const WRAPPED_NATIVE_GAS_RESERVE = parseUnits('0.05', 18);

/**
 * Rate-limit scope stored in `FaucetClaim.chain_id` for ERC-20 claims. The
 * token address is folded in so each token on a chain has its own daily
 * allowance, independent of the native-coin faucet for that chain.
 */
export function getERC20ClaimScope(chainId: number | string, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

export function findERC20FaucetToken(
  chain: Pick<L1ListItem, 'erc20Faucets'> | undefined,
  tokenAddress: string
): ERC20FaucetToken | undefined {
  if (!chain?.erc20Faucets || !isAddress(tokenAddress)) return undefined;
  const wanted = tokenAddress.toLowerCase();
  return chain.erc20Faucets.find((token) => token.address.toLowerCase() === wanted);
}

export function getERC20DripAmount(token: ERC20FaucetToken): { raw: bigint; formatted: string } {
  const formatted = token.faucetThresholds.dripAmount.toString();
  return { raw: parseUnits(formatted, token.decimals), formatted };
}

export function formatERC20Balance(balance: bigint, decimals: number, fractionDigits = 2): string {
  return parseFloat(formatUnits(balance, decimals)).toFixed(fractionDigits);
}
