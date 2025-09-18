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
