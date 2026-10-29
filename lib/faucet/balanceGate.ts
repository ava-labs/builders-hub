import { parseEther, parseUnits } from 'viem';

/**
 * The faucet routes refuse a drip to an address that already holds more than these amounts. The routes read the
 * balance before they reserve a claim, so a refused drip records no claim and uses none of the daily limit.
 */

/** 1 AVAX on the C-Chain, in wei. */
export const C_CHAIN_MAX_BALANCE_WEI = parseEther('1');

/** 1 native token on an L1 that /api/evm-chain-faucet serves, in wei. It matches the L1 list's faucet threshold. */
export const L1_MAX_BALANCE_WEI = parseEther('1');

/** 0.5 AVAX unlocked on the P-Chain, in nAVAX. */
export const P_CHAIN_MAX_BALANCE_NAVAX = parseUnits('0.5', 9);

/** The HTTP status of a refused drip: the request is valid, and the server refuses it. */
export const BALANCE_GATE_STATUS = 403;

/** The message of a refused drip. `max` is the limit in whole tokens, as the user reads it. */
export function balanceGateMessage(max: string, symbol: string): string {
  return `This address holds more than ${max} ${symbol}. The faucet sends ${symbol} only to an address that holds ${max} ${symbol} or less.`;
}

/** The message when the route cannot read the balance. The route then sends nothing. */
export const BALANCE_READ_FAILED_MESSAGE = 'The faucet cannot read the balance of this address. Try again later.';
