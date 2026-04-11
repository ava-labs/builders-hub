import { decodeAbiParameters, type TransactionReceipt } from 'viem';

export const WARP_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000005' as const;
export const WARP_MESSAGE_TOPIC = '0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d' as const;

/**
 * Extract the unsigned warp message from an EVM transaction receipt.
 * Looks for the warp precompile SendWarpMessage event, falls back to logs[1] then logs[0].
 */
export function extractWarpMessageFromReceipt(receipt: TransactionReceipt): string {
  if (!receipt.logs || receipt.logs.length === 0) {
    throw new Error("Failed to get warp message from transaction receipt.");
  }

  let extractedWarpMessage: string | null = null;

  const warpEventLog = receipt.logs.find((log) => {
    return log && log.address && log.address.toLowerCase() === WARP_PRECOMPILE_ADDRESS.toLowerCase() &&
      log.topics && log.topics[0] && log.topics[0].toLowerCase() === WARP_MESSAGE_TOPIC.toLowerCase();
  });

  if (warpEventLog && warpEventLog.data) {
    try {
      const [decodedMessage] = decodeAbiParameters(
        [{ type: 'bytes', name: 'message' }],
        warpEventLog.data as `0x${string}`
      );
      extractedWarpMessage = decodedMessage as string;
    } catch {
      extractedWarpMessage = warpEventLog.data;
    }
  } else if (receipt.logs.length > 1 && receipt.logs[1].data) {
    try {
      const [decodedMessage] = decodeAbiParameters(
        [{ type: 'bytes', name: 'message' }],
        receipt.logs[1].data as `0x${string}`
      );
      extractedWarpMessage = decodedMessage as string;
    } catch {
      extractedWarpMessage = receipt.logs[1].data;
    }
  } else if (receipt.logs[0].data) {
    try {
      const [decodedMessage] = decodeAbiParameters(
        [{ type: 'bytes', name: 'message' }],
        receipt.logs[0].data as `0x${string}`
      );
      extractedWarpMessage = decodedMessage as string;
    } catch {
      extractedWarpMessage = receipt.logs[0].data;
    }
  }

  if (!extractedWarpMessage) {
    throw new Error("Could not extract warp message from transaction.");
  }

  return extractedWarpMessage;
}

/**
 * Validate and clean a transaction hash string.
 * Returns a properly typed `0x${string}` or null if invalid.
 */
export function validateAndCleanTxHash(hash: string): `0x${string}` | null {
  if (!hash) return null;
  const cleanHash = hash.trim().toLowerCase();
  if (!cleanHash.startsWith('0x')) return null;
  if (cleanHash.length !== 66) return null;
  return cleanHash as `0x${string}`;
}
