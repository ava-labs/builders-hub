/**
 * EIP-3091 compliant URL utilities
 * https://eips.ethereum.org/EIPS/eip-3091
 * 
 * Standard URL format:
 * - /block/{blockNumber} - block number as decimal
 * - /tx/{txHash} - transaction hash as lowercase hex with 0x prefix
 * - /address/{address} - address as lowercase hex with 0x prefix
 */

/**
 * Normalize block number for EIP-3091 URL
 * Ensures block number is decimal (not hex)
 */
export function normalizeBlockNumber(blockNumber: string | number): string {
  if (typeof blockNumber === 'number') {
    return blockNumber.toString();
  }
  // If it's hex, convert to decimal
  if (blockNumber.startsWith('0x')) {
    return parseInt(blockNumber, 16).toString();
  }
  return blockNumber;
}

/**
 * Normalize transaction hash for EIP-3091 URL
 * Ensures hash is lowercase hex with 0x prefix
 */
export function normalizeTxHash(txHash: string): string {
  if (!txHash) return '';
  // Ensure lowercase and 0x prefix
  const normalized = txHash.toLowerCase();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

/**
 * Normalize address for EIP-3091 URL
 * Ensures address is lowercase hex with 0x prefix
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  // Ensure lowercase and 0x prefix
  const normalized = address.toLowerCase();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

/**
 * Build EIP-3091 compliant block URL
 */
export function buildBlockUrl(basePath: string, blockNumber: string | number): string {
  return `${basePath}/block/${normalizeBlockNumber(blockNumber)}`;
}

/**
 * Build EIP-3091 compliant transaction URL
 */
export function buildTxUrl(basePath: string, txHash: string): string {
  return `${basePath}/tx/${normalizeTxHash(txHash)}`;
}

/**
 * Build EIP-3091 compliant address URL
 */
export function buildAddressUrl(basePath: string, address: string): string {
  return `${basePath}/address/${normalizeAddress(address)}`;
}

