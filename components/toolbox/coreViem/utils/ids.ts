import { fromBytes } from "viem";
import { utils } from "@avalabs/avalanchejs";

/**
 * Parses an Avalanche NodeID string to its hex representation without the prefix and checksum
 * @param nodeID The NodeID string (e.g. "NodeID-...")
 * @returns The hex string representation without the prefix and checksum
 */
export const parseNodeID = (nodeID: string): string => {
  const nodeIDWithoutPrefix = nodeID.replace("NodeID-", "");
  const decodedID = utils.base58.decode(nodeIDWithoutPrefix);
  const nodeIDHex = fromBytes(decodedID, 'hex');
  const nodeIDHexTrimmed = nodeIDHex.slice(0, -8);
  return nodeIDHexTrimmed;
};

/**
 * Converts a P-Chain address from bech32 format to hex bytes
 * @param address The P-Chain address in bech32 format (e.g., "P-avax1..." or "P-fuji1...")
 *                or already in hex format (e.g., "0x...")
 * @returns The hex string representation of the address
 * @throws Error if the address format is invalid
 */
export const parsePChainAddress = (address: string): `0x${string}` => {
  if (!address) {
    throw new Error('P-Chain address is required');
  }

  // If already hex format, return as-is
  if (address.startsWith('0x')) {
    return address as `0x${string}`;
  }

  // Convert from bech32 (P-avax1... or P-fuji1...) to hex
  try {
    const addressBytes = utils.bech32ToBytes(address);
    return fromBytes(addressBytes, 'hex') as `0x${string}`;
  } catch (e) {
    throw new Error(`Invalid P-Chain address format: ${address}. Expected bech32 format (e.g., P-avax1... or P-fuji1...)`);
  }
};
