// The Stake page's texts for a stake that cannot go (Stake.tsx): a stake above the P-Chain balance, and the errors of
// the SDK and the wallet for an AddPermissionlessValidatorTx or an AddAutoRenewedValidatorTx.

import { formatUnits } from 'viem';
import { toNanoAvax } from '@/components/toolbox/coreViem/utils/units';
import { classifyEvmTxError } from '@/components/toolbox/lib/evmErrors';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';

/** The text when the SDK cannot read the BLS public key (avalanchejs: 'Cannot find square root'). */
export const INVALID_BLS_KEY_TEXT = 'The BLS public key is not valid. Copy it again from info.getNodeID.';

/** True when the user rejected the request in the wallet. */
export function isWalletRejection(err: unknown): boolean {
  return classifyEvmTxError(err).kind === 'user-rejected';
}

/** The balance in AVAX as the texts write it: no float noise, and 0 for a balance that is not known. */
function balanceText(pChainBalanceAvax: number): string {
  const balance = Number.isFinite(pChainBalanceAvax) && pChainBalanceAvax > 0 ? pChainBalanceAvax : 0;
  return formatUnits(toNanoAvax(balance), 9);
}

/** The text when the stake is more than the unlocked P-Chain balance (in AVAX). */
export function overBalanceText(pChainBalanceAvax: number): string {
  return (
    `The stake is more than your P-Chain balance (${balanceText(pChainBalanceAvax)} AVAX). ` +
    'Move AVAX to the P-Chain with the C-Chain to P-Chain bridge.'
  );
}

/** The text when the stake is not more than the P-Chain balance, but the stake and the tx fee together are. */
export function overBalanceWithFeeText(pChainBalanceAvax: number): string {
  return (
    `The stake and the transaction fee are more than your P-Chain balance (${balanceText(pChainBalanceAvax)} AVAX). ` +
    'Enter a smaller stake, or move AVAX to the P-Chain with the C-Chain to P-Chain bridge.'
  );
}

/**
 * The form error when the stake is more than the P-Chain balance, or null. A balance of 0 is not known yet (the
 * wallet store starts at 0), so the form does not check it: the SDK's error then gives the same text.
 */
export function stakeBalanceError(stakeAvax: number, pChainBalanceAvax: number): string | null {
  if (!Number.isFinite(pChainBalanceAvax) || pChainBalanceAvax <= 0) return null;
  return stakeAvax > pChainBalanceAvax ? overBalanceText(pChainBalanceAvax) : null;
}

/**
 * The page's text for an error of a stake tx. Other errors keep their own text. For the SDK's insufficient-funds
 * error, a stake above the balance gets the stake text, and any other stake (the form allows a stake up to the balance)
 * gets the text for the stake and the fee.
 */
export function stakeTxErrorText(err: unknown, stakeAvax: number, pChainBalanceAvax: number): string {
  if (isWalletRejection(err)) return WALLET_REJECTED_TEXT;
  const message = err instanceof Error ? err.message : String(err);
  if (/insufficient funds/i.test(message)) {
    return stakeAvax > pChainBalanceAvax
      ? overBalanceText(pChainBalanceAvax)
      : overBalanceWithFeeText(pChainBalanceAvax);
  }
  if (/square root/i.test(message)) return INVALID_BLS_KEY_TEXT;
  return message;
}
