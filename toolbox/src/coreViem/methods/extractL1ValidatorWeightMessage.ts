import { WalletClient } from "viem";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { networkIDs, utils } from "@avalabs/avalanchejs";

interface L1ValidatorWeightMessagePayload {
  codecID: number;
  typeID: number;
  validationID: Uint8Array;
  nonce: bigint;
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

interface WeightMessageResponse {
  result: TransactionResult;
}

export type ExtractL1ValidatorWeightMessageParams = {
  txId: string;
}

export type ExtractL1ValidatorWeightMessageResponse = {
  message: string;
  validationID: string;
  nonce: bigint;
  weight: bigint;
  networkId: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
}

/**
 * Extracts L1ValidatorWeightMessage from a P-Chain SetL1ValidatorWeightTx
 * @param client - The wallet client
 * @param params - Parameters containing the transaction ID
 * @returns The extracted weight message data
 */
export async function extractL1ValidatorWeightMessage(
  client: WalletClient<any, any, any, CoreWalletRpcSchema>, 
  { txId }: ExtractL1ValidatorWeightMessageParams
): Promise<ExtractL1ValidatorWeightMessageResponse> {
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

  const data = await response.json() as WeightMessageResponse;

  if (!data?.result?.tx?.unsignedTx) {
    console.log('txId', txId);
    console.log('data', data);
    throw new Error("Invalid transaction data, are you sure this is a SetL1ValidatorWeightTx?");
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
  
  // Extract the actual L1ValidatorWeightMessage payload from the AddressedCall
  const l1ValidatorWeightPayload = extractPayloadFromAddressedCall(addressedCallBytes);
  if (!l1ValidatorWeightPayload) {
    throw new Error("Failed to extract L1ValidatorWeightMessage payload from AddressedCall");
  }
  
  // Parse the L1ValidatorWeightMessage from the payload
  const parsedData = parseL1ValidatorWeightMessage(l1ValidatorWeightPayload);

  // Create the L1ValidatorWeightMessage payload for return
  const payload: L1ValidatorWeightMessagePayload = {
    codecID: 0x0000, // Hardcoded as per spec
    typeID: 0x00000003, // L1ValidatorWeightMessage type ID
    validationID: parsedData.validationID,
    nonce: parsedData.nonce,
    weight: parsedData.weight
  };

  // Pack the payload into bytes
  const packedMessageBytes = packL1ValidatorWeightMessage(payload);

  return {
    message: utils.bufferToHex(Buffer.from(Array.from(packedMessageBytes))),
    validationID: utils.bufferToHex(Buffer.from(Array.from(parsedData.validationID))),
    nonce: parsedData.nonce,
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
 * Parses an L1ValidatorWeightMessage from payload bytes
 * L1ValidatorWeightMessage structure:
 * - codecID (uint16, 2 bytes)
 * - typeID (uint32, 4 bytes) 
 * - validationID (32 bytes)
 * - nonce (uint64, 8 bytes)
 * - weight (uint64, 8 bytes)
 * @param payloadBytes - The payload bytes to parse
 * @returns The parsed validation data
 */
function parseL1ValidatorWeightMessage(payloadBytes: Buffer): {
  validationID: Uint8Array;
  nonce: bigint;
  weight: bigint;
} {
  console.log(`Parsing L1ValidatorWeightMessage of length: ${payloadBytes.length} bytes`);
  console.log(`Raw payload hex: 0x${payloadBytes.toString('hex')}`);

  if (payloadBytes.length < 54) { // 2 + 4 + 32 + 8 + 8 = 54 bytes minimum
    throw new Error(`L1ValidatorWeightMessage too short: ${payloadBytes.length} bytes, expected at least 54`);
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

  // validationID (32 bytes)
  const validationID = new Uint8Array(payloadBytes.slice(offset, offset + 32));
  console.log(`validationID: 0x${Buffer.from(validationID).toString('hex')}`);
  offset += 32;

  // nonce (uint64, 8 bytes)
  const nonce = view.getBigUint64(offset, false); // big-endian
  console.log(`nonce: ${nonce}`);
  offset += 8;

  // weight (uint64, 8 bytes)
  const weight = view.getBigUint64(offset, false); // big-endian
  console.log(`weight: ${weight}`);

  return {
    validationID,
    nonce,
    weight
  };
}

/**
 * Packs an L1ValidatorWeightMessage payload into bytes
 * @param payload - The payload to pack
 * @returns The packed message bytes
 */
function packL1ValidatorWeightMessage(payload: L1ValidatorWeightMessagePayload): Uint8Array {
  const buffer = new ArrayBuffer(54); // Total size: 2 + 4 + 32 + 8 + 8 = 54 bytes
  const view = new DataView(buffer);
  let offset = 0;

  // codecID (uint16, 2 bytes)
  view.setUint16(offset, payload.codecID, false); // big-endian
  offset += 2;

  // typeID (uint32, 4 bytes)
  view.setUint32(offset, payload.typeID, false); // big-endian
  offset += 4;

  // validationID (32 bytes)
  const uint8Array = new Uint8Array(buffer);
  uint8Array.set(payload.validationID, offset);
  offset += 32;

  // nonce (uint64, 8 bytes)
  view.setBigUint64(offset, payload.nonce, false); // big-endian
  offset += 8;

  // weight (uint64, 8 bytes)
  view.setBigUint64(offset, payload.weight, false); // big-endian

  return uint8Array;
}
