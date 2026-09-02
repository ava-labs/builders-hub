import { createPublicClient, custom, type TransactionReceipt } from 'viem';
import { useWalletStore } from '../stores/walletStore';
import { resolveActiveWalletProvider } from './walletProvider';
import { classifyEvmTxError } from './evmErrors';

/**
 * Receipt reads through the WALLET's transport.
 *
 * The page's RPC reads can be blocked (mixed content) or misconfigured
 * while the wallet's are not: the wallet is a browser extension with its
 * own RPC config, exempt from the page's mixed-content policy. Right after
 * the wallet sent a transaction, its transport is the one connection that
 * demonstrably reaches the chain, so it is the honest place for a final
 * "did it actually land?" check before reporting anything to the user.
 */
export async function getReceiptViaWalletTransport(hash: `0x${string}`): Promise<TransactionReceipt | null> {
  try {
    const walletType = useWalletStore.getState().walletType;
    const provider = await resolveActiveWalletProvider({ walletType });
    if (!provider) return null;
    const client = createPublicClient({ transport: custom(provider) });
    return await client.getTransactionReceipt({ hash });
  } catch {
    // Includes viem's ReceiptNotFound: "no receipt" and "couldn't ask" both
    // mean the caller cannot claim anything happened.
    return null;
  }
}

/** The honest unknown outcome: never the word "failed". */
export class ReceiptUnknownError extends Error {
  readonly txHash: `0x${string}`;
  constructor(txHash: `0x${string}`) {
    super(
      `Couldn't confirm transaction ${txHash} within the timeout. It may still have landed: check the hash ` +
        'in the explorer before retrying, or the same action may run twice.',
    );
    this.name = 'ReceiptUnknownError';
    this.txHash = txHash;
  }
}

/**
 * Page-client receipt wait with a wallet-transport rescue. A timeout or an
 * unreachable page RPC is NOT a failure verdict: the transaction may have
 * landed. Resolves with the receipt when either side can produce it;
 * throws ReceiptUnknownError when neither can; rethrows real failures
 * (reverts, rejections) untouched.
 */
export async function waitForReceiptWithWalletFallback(
  pageClient: { waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<TransactionReceipt> },
  hash: `0x${string}`,
  opts: { rescue?: (hash: `0x${string}`) => Promise<TransactionReceipt | null> } = {},
): Promise<TransactionReceipt> {
  const { rescue = getReceiptViaWalletTransport } = opts;
  try {
    return await pageClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    const kind = classifyEvmTxError(err).kind;
    if (kind !== 'receipt-timeout' && kind !== 'rpc-unreachable') throw err;
    const rescued = await rescue(hash);
    if (rescued) return rescued;
    throw new ReceiptUnknownError(hash);
  }
}
