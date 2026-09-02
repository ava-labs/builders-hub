import { classifyRpcUrlForPage } from './rpcUrl';

/**
 * Classifies EVM transaction failures into the distinct problems users
 * keep conflating (issue #4450): the WALLET's stored RPC being unreachable
 * (gas estimation happens in the wallet, not the page), the PAGE's RPC
 * being unreachable (often mixed content), a receipt wait that timed out
 * (NOT a failure: the tx may have landed), an actual revert, and a wallet
 * rejection. The EVM twin of parsePChainError.
 */

export type EvmTxErrorKind =
  | 'wallet-rpc-unreachable'
  | 'rpc-unreachable'
  | 'receipt-timeout'
  | 'reverted'
  | 'user-rejected'
  | 'unknown';

export interface ClassifiedEvmTxError {
  kind: EvmTxErrorKind;
  message: string;
  txHash?: `0x${string}`;
}

function extractHash(err: unknown, message: string): `0x${string}` | undefined {
  const fromField = (err as { hash?: unknown })?.hash;
  if (typeof fromField === 'string' && /^0x[0-9a-fA-F]{64}$/.test(fromField)) {
    return fromField as `0x${string}`;
  }
  const fromMessage = message.match(/0x[0-9a-fA-F]{64}/);
  return fromMessage ? (fromMessage[0] as `0x${string}`) : undefined;
}

export function classifyEvmTxError(
  err: unknown,
  ctx: { rpcUrl?: string; pageProtocol?: string } = {},
): ClassifiedEvmTxError {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  const code = (err as { code?: unknown })?.code;

  // Core's extension-side text: with a json-rpc account, gas estimation
  // runs in the WALLET against the wallet's own stored RPC. The page never
  // called eth_estimateGas, so pointing users at the page's URL would lie.
  if (/unable to calculate gas limit/i.test(message)) {
    return {
      kind: 'wallet-rpc-unreachable',
      message:
        'Your wallet could not reach the RPC URL it has stored for this chain (gas estimation happens inside ' +
        "the wallet). Open the wallet's network settings (Core: Settings > Networks > this chain) and point " +
        'the RPC URL at a reachable node, then retry.',
    };
  }

  if (
    name === 'WaitForTransactionReceiptTimeoutError' ||
    /timed out while waiting for (the )?transaction/i.test(message)
  ) {
    const txHash = extractHash(err, message);
    return {
      kind: 'receipt-timeout',
      message:
        `Timed out waiting for confirmation of transaction${txHash ? ` ${txHash}` : ''}. It may still have ` +
        'landed: check the hash in the explorer before retrying, or the same action may run twice.',
      txHash,
    };
  }

  if (code === 4001 || /user rejected|user denied/i.test(message)) {
    return { kind: 'user-rejected', message: 'Transaction rejected in the wallet.' };
  }

  if (/execution reverted|transaction reverted|reverted with/i.test(message)) {
    return { kind: 'reverted', message };
  }

  if (/failed to fetch|fetch failed|network error|load failed|econn|socket hang up/i.test(message)) {
    const base = `Could not reach your L1's RPC${ctx.rpcUrl ? ` at ${ctx.rpcUrl}` : ''} from this page.`;
    const mixed =
      ctx.rpcUrl !== undefined &&
      ctx.pageProtocol !== undefined &&
      classifyRpcUrlForPage(ctx.rpcUrl, ctx.pageProtocol) === 'mixed-content';
    return {
      kind: 'rpc-unreachable',
      message: mixed
        ? `${base} Browsers block http:// requests to remote hosts from an https page (mixed content). Put an HTTPS reverse proxy in front of the node and use that URL here.`
        : `${base} Check that the node is running and the URL is correct.`,
    };
  }

  return { kind: 'unknown', message };
}
