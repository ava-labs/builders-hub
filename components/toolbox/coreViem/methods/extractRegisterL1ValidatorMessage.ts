import { WalletClient } from "viem";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { networkIDs, utils } from "@avalabs/avalanchejs";

interface RegisterL1ValidatorMessagePayload {
  codecID: number;
  typeID: number;
  subnetID: Uint8Array;
  nodeID: Uint8Array;
  blsPublicKey: Uint8Array;
  expiry: bigint;
  remainingBalanceOwner: {
    threshold: number;
    addresses: Uint8Array[];
  };
  disableOwner: {
    threshold: number;
    addresses: Uint8Array[];
  };
  weight: bigint;
}

interface UnsignedTx {
  networkID: number;
  blockchainID: string;
  outputs: any[];
  inputs: any[];
  memo: string;
  message?: string;
}

interface Transaction {
  unsignedTx: UnsignedTx;
  credentials: any[];
  id: string;
}

interface TransactionResult {
  tx: Transaction;
  encoding: string;
}

interface RegisterMessageResponse {
  result: TransactionResult;
}

type ExtractRegisterL1ValidatorMessageParams = {
  txId: string;
}

type ExtractRegisterL1ValidatorMessageResponse = {
  message: string;
  subnetID: string;
  nodeID: string;
  blsPublicKey: string;
  expiry: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
}

/**
 * Extracts RegisterL1ValidatorMessage from a P-Chain RegisterL1ValidatorTx
 * @param client - The wallet client
 * @param params - Parameters containing the transaction ID
 * @returns The extracted registration message data
 */
export async function extractRegisterL1ValidatorMessage(
  client: WalletClient<any, any, any, CoreWalletRpcSchema>,
  { txId }: ExtractRegisterL1ValidatorMessageParams
): Promise<ExtractRegisterL1ValidatorMessageResponse> {
  const isTestnetMode = await isTestnet(client);
  const rpcEndpoint = getRPCEndpoint(isTestnetMode);
  const networkId = isTestnetMode ? networkIDs.FujiID : networkIDs.MainnetID;

  // Fetch the P-Chain transaction
  const response = await fetch(rpcEndpoint + "/ext/bc/P", {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'platform.getTx',
      params: {
        txID: txId,
        encoding: 'json'
      },
      id: 1
    })
  });

  const data = await response.json() as RegisterMessageResponse;

  if (!data?.result?.tx?.unsignedTx) {
    console.log('txId', txId);
    console.log('data', data);
    throw new Error("Invalid transaction data, are you sure this is a RegisterL1ValidatorTx?");
  }

  const unsignedTx = data.result.tx.unsignedTx;

  // Extract the WarpMessage from the transaction
  if (!unsignedTx.message) {
    console.log('Transaction structure:', JSON.stringify(unsignedTx, null, 2));
    throw new Error("Transaction does not contain a WarpMessage");
  }

  // Parse the WarpMessage to extract the AddressedCall
  const warpMessageBytes = Buffer.from(utils.hexToBuffer(unsignedTx.message));
  const addressedCallBytes = extractPayloadFromWarpMessage(warpMessageBytes);

  // Extract the actual RegisterL1ValidatorMessage payload from the AddressedCall
  const registerL1ValidatorPayload = extractPayloadFromAddressedCall(addressedCallBytes);
  if (!registerL1ValidatorPayload) {
    throw new Error("Failed to extract RegisterL1ValidatorMessage payload from AddressedCall");
  }

  // Parse the RegisterL1ValidatorMessage from the payload
  const parsedData = parseRegisterL1ValidatorMessage(registerL1ValidatorPayload);

  // Create the RegisterL1ValidatorMessage payload for return
  const payload: RegisterL1ValidatorMessagePayload = {
    codecID: 0x0000, // Hardcoded as per spec
    typeID: 0x00000001, // RegisterL1ValidatorMessage type ID
    subnetID: parsedData.subnetID,
    nodeID: parsedData.nodeID,
    blsPublicKey: parsedData.blsPublicKey,
    expiry: parsedData.expiry,
    remainingBalanceOwner: parsedData.remainingBalanceOwner,
    disableOwner: parsedData.disableOwner,
    weight: parsedData.weight
  };

  // Pack the payload into bytes
  const packedMessageBytes = packRegisterL1ValidatorMessage(payload);

  return {
    message: utils.bufferToHex(Buffer.from(Array.from(packedMessageBytes))),
    subnetID: utils.bufferToHex(Buffer.from(Array.from(parsedData.subnetID))),
    nodeID: utils.bufferToHex(Buffer.from(Array.from(parsedData.nodeID))),
    blsPublicKey: utils.bufferToHex(Buffer.from(Array.from(parsedData.blsPublicKey))),
    expiry: parsedData.expiry,
    weight: parsedData.weight,
    networkId
  };
}

/**
 * Extracts the payload bytes from an AddressedCall byte array.
 * Assumes AddressedCall structure:
 * - TypeID (4 bytes, starting at index 2)
 * - Source Address Length (4 bytes, starting at index 6)
 * - Source Address (variable)
 * - Payload Length (4 bytes, starting after source address)
 * - Payload (variable)
 *
 * @param addressedCall - The AddressedCall bytes.
 * @returns The extracted payload as a Buffer, or null if parsing fails or data is insufficient.
 */
function extractPayloadFromAddressedCall(addressedCall: Buffer): Buffer | null {
  try {
    // Need at least 10 bytes for TypeID and Source Address Length.
    if (addressedCall.length < 10) {
      return null;
    }

    // Source Address Length starts at index 6
    const sourceAddrLen = (addressedCall[6] << 24) | (addressedCall[7] << 16) | (addressedCall[8] << 8) | addressedCall[9];
    if (sourceAddrLen < 0) {
      return null;
    }

    // Position where Payload Length starts
    const payloadLenPos = 10 + sourceAddrLen;

    // Check if we have enough bytes to read Payload Length
    if (payloadLenPos + 4 > addressedCall.length) {
      return null;
    }

    // Read Payload Length
    const payloadLen = (addressedCall[payloadLenPos] << 24) |
      (addressedCall[payloadLenPos + 1] << 16) |
      (addressedCall[payloadLenPos + 2] << 8) |
      addressedCall[payloadLenPos + 3];

    // Check if payload length is valid
    if (payloadLen <= 0) {
      return null;
    }

    const payloadStartPos = payloadLenPos + 4;
    const payloadEndPos = payloadStartPos + payloadLen;

    // Check if payload extends beyond data bounds
    if (payloadEndPos > addressedCall.length) {
      return null;
    }

    // Extract Payload
    const payloadBytes = addressedCall.slice(payloadStartPos, payloadEndPos);
    return payloadBytes;

  } catch (error) {
    console.error('Error extracting payload from AddressedCall:', error);
    return null;
  }
}

/**
 * Extracts the payload from a WarpMessage (UnsignedMessage structure)
 * Based on justification.tsx extractAddressedCall function
 * UnsignedMessage structure:
 * - codecVersion (uint16 - 2 bytes)
 * - networkID (uint32 - 4 bytes) 
 * - sourceChainID (32 bytes)
 * - message length (uint32 - 4 bytes)
 * - message (the variable-length bytes we want)
 * @param warpMessageBytes - The complete WarpMessage bytes
 * @returns The payload bytes
 */
function extractPayloadFromWarpMessage(warpMessageBytes: Buffer): Buffer {
  if (warpMessageBytes.length < 42) { // 2 + 4 + 32 + 4 = minimum 42 bytes
    throw new Error('WarpMessage too short');
  }

  // Skip codecVersion (2 bytes) + networkID (4 bytes) + sourceChainID (32 bytes) = 38 bytes
  // Then read message length (4 bytes)
  const messageLength = (warpMessageBytes[38] << 24) |
    (warpMessageBytes[39] << 16) |
    (warpMessageBytes[40] << 8) |
    warpMessageBytes[41];

  if (messageLength <= 0 || 42 + messageLength > warpMessageBytes.length) {
    throw new Error('Invalid message length or message extends beyond WarpMessage data bounds');
  }

  // Extract the message payload starting at byte 42
  return warpMessageBytes.slice(42, 42 + messageLength);
}

/**
 * Parses a RegisterL1ValidatorMessage from payload bytes
 * RegisterL1ValidatorMessage structure:
 * - codecID (uint16, 2 bytes)
 * - typeID (uint32, 4 bytes) 
 * - subnetID (32 bytes)
 * - nodeID length (uint32, 4 bytes)
 * - nodeID (variable length)
 * - blsPublicKey (48 bytes)
 * - expiry (uint64, 8 bytes)
 * - remainingBalanceOwner (PChainOwner structure)
 * - disableOwner (PChainOwner structure)
 * - weight (uint64, 8 bytes)
 * @param payloadBytes - The payload bytes to parse
 * @returns The parsed registration data
 */
function parseRegisterL1ValidatorMessage(payloadBytes: Buffer): {
  subnetID: Uint8Array;
  nodeID: Uint8Array;
  blsPublicKey: Uint8Array;
  expiry: bigint;
  remainingBalanceOwner: {
    threshold: number;
    addresses: Uint8Array[];
  };
  disableOwner: {
    threshold: number;
    addresses: Uint8Array[];
  };
  weight: bigint;
} {
  console.log(`Parsing RegisterL1ValidatorMessage of length: ${payloadBytes.length} bytes`);
  console.log(`Raw payload hex: 0x${payloadBytes.toString('hex')}`);

  if (payloadBytes.length < 94) { // Minimum: 2 + 4 + 32 + 4 + 0 + 48 + 8 + 8 + 8 + 8 = 122 bytes (but nodeID can be 0 length)
    throw new Error(`RegisterL1ValidatorMessage too short: ${payloadBytes.length} bytes, expected at least 94`);
  }

  const view = new DataView(payloadBytes.buffer, payloadBytes.byteOffset, payloadBytes.byteLength);
  let offset = 0;

  // codecID (uint16, 2 bytes)
  const codecID = view.getUint16(offset, false); // big-endian
  console.log(`codecID: 0x${codecID.toString(16)}`);
  offset += 2;

  // typeID (uint32, 4 bytes) 
  const typeID = view.getUint32(offset, false); // big-endian
  console.log(`typeID: 0x${typeID.toString(16)}`);
  offset += 4;

  // subnetID (32 bytes)
  const subnetID = new Uint8Array(payloadBytes.slice(offset, offset + 32));
  console.log(`subnetID: 0x${Buffer.from(subnetID).toString('hex')}`);
  offset += 32;

  // nodeID length (uint32, 4 bytes)
  const nodeIDLength = view.getUint32(offset, false); // big-endian
  console.log(`nodeIDLength: ${nodeIDLength}`);
  offset += 4;

  // nodeID (variable length)
  const nodeID = new Uint8Array(payloadBytes.slice(offset, offset + nodeIDLength));
  console.log(`nodeID: 0x${Buffer.from(nodeID).toString('hex')}`);
  offset += nodeIDLength;

  // blsPublicKey (48 bytes)
  const blsPublicKey = new Uint8Array(payloadBytes.slice(offset, offset + 48));
  console.log(`blsPublicKey: 0x${Buffer.from(blsPublicKey).toString('hex')}`);
  offset += 48;

  // expiry (uint64, 8 bytes)
  const expiry = view.getBigUint64(offset, false); // big-endian
  console.log(`expiry: ${expiry}`);
  offset += 8;

  // Parse PChainOwner for remainingBalanceOwner
  const remainingBalanceOwner = parsePChainOwner(payloadBytes, offset);
  offset += getPChainOwnerSize(remainingBalanceOwner);

  // Parse PChainOwner for disableOwner
  const disableOwner = parsePChainOwner(payloadBytes, offset);
  offset += getPChainOwnerSize(disableOwner);

  // weight (uint64, 8 bytes)
  const weight = view.getBigUint64(offset, false); // big-endian
  console.log(`weight: ${weight}`);

  return {
    subnetID,
    nodeID,
    blsPublicKey,
    expiry,
    remainingBalanceOwner,
    disableOwner,
    weight
  };
}

/**
 * Parses a PChainOwner structure from payload bytes at a given offset
 * PChainOwner structure:
 * - threshold (uint32, 4 bytes)
 * - addresses length (uint32, 4 bytes)
 * - addresses (variable length, 20 bytes each)
 */
function parsePChainOwner(payloadBytes: Buffer, offset: number): {
  threshold: number;
  addresses: Uint8Array[];
} {
  const view = new DataView(payloadBytes.buffer, payloadBytes.byteOffset, payloadBytes.byteLength);

  // threshold (uint32, 4 bytes)
  const threshold = view.getUint32(offset, false); // big-endian
  offset += 4;

  // addresses length (uint32, 4 bytes)
  const addressesLength = view.getUint32(offset, false); // big-endian
  offset += 4;

  // addresses (20 bytes each)
  const addresses: Uint8Array[] = [];
  for (let i = 0; i < addressesLength; i++) {
    const address = new Uint8Array(payloadBytes.slice(offset, offset + 20));
    addresses.push(address);
    offset += 20;
  }

  return {
    threshold,
    addresses
  };
}

/**
 * Gets the size in bytes of a PChainOwner structure
 */
function getPChainOwnerSize(owner: { threshold: number; addresses: Uint8Array[] }): number {
  return 4 + 4 + (owner.addresses.length * 20); // threshold + length + addresses
}

/**
 * Packs a RegisterL1ValidatorMessage payload into bytes
 * @param payload - The payload to pack
 * @returns The packed message bytes
 */
function packRegisterL1ValidatorMessage(payload: RegisterL1ValidatorMessagePayload): Uint8Array {
  // Calculate total size
  const nodeIDLength = payload.nodeID.length;
  const remainingBalanceOwnerSize = getPChainOwnerSize(payload.remainingBalanceOwner);
  const disableOwnerSize = getPChainOwnerSize(payload.disableOwner);

  const totalSize = 2 + 4 + 32 + 4 + nodeIDLength + 48 + 8 + remainingBalanceOwnerSize + disableOwnerSize + 8;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8Array = new Uint8Array(buffer);
  let offset = 0;

  // codecID (uint16, 2 bytes)
  view.setUint16(offset, payload.codecID, false); // big-endian
  offset += 2;

  // typeID (uint32, 4 bytes)
  view.setUint32(offset, payload.typeID, false); // big-endian
  offset += 4;

  // subnetID (32 bytes)
  uint8Array.set(payload.subnetID, offset);
  offset += 32;

  // nodeID length (uint32, 4 bytes)
  view.setUint32(offset, nodeIDLength, false); // big-endian
  offset += 4;

  // nodeID (variable length)
  uint8Array.set(payload.nodeID, offset);
  offset += nodeIDLength;

  // blsPublicKey (48 bytes)
  uint8Array.set(payload.blsPublicKey, offset);
  offset += 48;

  // expiry (uint64, 8 bytes)
  view.setBigUint64(offset, payload.expiry, false); // big-endian
  offset += 8;

  // remainingBalanceOwner
  offset += packPChainOwner(payload.remainingBalanceOwner, uint8Array, view, offset);

  // disableOwner
  offset += packPChainOwner(payload.disableOwner, uint8Array, view, offset);

  // weight (uint64, 8 bytes)
  view.setBigUint64(offset, payload.weight, false); // big-endian

  return uint8Array;
}

/**
 * Packs a PChainOwner structure into bytes at a given offset
 */
function packPChainOwner(
  owner: { threshold: number; addresses: Uint8Array[] },
  uint8Array: Uint8Array,
  view: DataView,
  offset: number
): number {
  const startOffset = offset;

  // threshold (uint32, 4 bytes)
  view.setUint32(offset, owner.threshold, false); // big-endian
  offset += 4;

  // addresses length (uint32, 4 bytes)
  view.setUint32(offset, owner.addresses.length, false); // big-endian
  offset += 4;

  // addresses (20 bytes each)
  for (const address of owner.addresses) {
    uint8Array.set(address, offset);
    offset += 20;
  }

  return offset - startOffset;
}
