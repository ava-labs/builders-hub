import { utils } from "@avalabs/avalanchejs";
import { fromBytes } from "viem";

// Parses a NodeID- string to a hex string without the prefix and last 8 bytes
const parseNodeID = (nodeID: string) => {
  const nodeIDWithoutPrefix = nodeID.replace("NodeID-", "");
  const decodedID = utils.base58.decode(nodeIDWithoutPrefix);
  const nodeIDHex = fromBytes(decodedID, "hex");
  const nodeIDHexTrimmed = nodeIDHex.slice(0, -8);
  return nodeIDHexTrimmed;
};

export { parseNodeID };
