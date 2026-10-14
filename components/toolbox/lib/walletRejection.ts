// The one text for a request that the user rejected in the wallet. Every Console tool shows it, for EVM and P-Chain
// requests: parseContractError, parsePChainError and classifyEvmTxError (the Activity panel) return it.

/** The text of a wallet rejection. It tells the user what to do next. */
export const WALLET_REJECTED_TEXT =
  'You rejected the request in your wallet. To continue, click the button again and approve the request.';

/**
 * The text of a failed request: `prefix` (for example 'Transaction failed: '), then `message`. A wallet rejection is
 * not a failure, so its text shows with no prefix.
 */
export function failureText(prefix: string, message: string): string {
  return message === WALLET_REJECTED_TEXT ? message : `${prefix}${message}`;
}
