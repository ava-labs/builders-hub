import { parseAbiItem, type PublicClient, bytesToHex, hexToBytes } from 'viem';
import { parseRegisterL1ValidatorMessage } from '../../coreViem/utils/convertWarp';
import { utils } from '@avalabs/avalanchejs';

/**
 * Extracts the addressedCall from an unsignedWarpMessage
 * 
 * UnsignedMessage structure from convertWarp.ts:
 * - codecVersion (uint16 - 2 bytes)
 * - networkID (uint32 - 4 bytes)
 * - sourceChainID (32 bytes)
 * - message length (uint32 - 4 bytes)
 * - message (the variable-length bytes we want)
 * 
 * @param messageBytes - The raw unsignedWarpMessage bytes
 * @returns The extracted message (addressedCall)
 */
export function extractAddressedCall(messageBytes: Uint8Array): Uint8Array {
  try {
    // console.log(`Parsing UnsignedMessage of length: ${messageBytes.length} bytes`);
    
    if (messageBytes.length < 42) { // 2 + 4 + 32 + 4 = minimum 42 bytes
      // console.log('UnsignedMessage too short');
      return new Uint8Array();
    }
    
    const codecVersion = (messageBytes[0] << 8) | messageBytes[1];
    
    const networkIDBytes = messageBytes.slice(2, 6);
    console.log(`Raw networkID bytes: 0x${Buffer.from(networkIDBytes).toString('hex')}`);
    const networkID = (messageBytes[2] << 24) | 
                      (messageBytes[3] << 16) | 
                      (messageBytes[4] << 8) | 
                      messageBytes[5];
    
    console.log(`UnsignedMessage -> codecVersion: ${codecVersion}, NetworkID: ${networkID}`);
    
    const sourceChainIDBytes = messageBytes.slice(6, 38);
    console.log(`Raw sourceChainID bytes: 0x${Buffer.from(sourceChainIDBytes).toString('hex')}`);
    try {
      let sourceChainIDStr = utils.base58check.encode(Buffer.from(sourceChainIDBytes));
      console.log(`UnsignedMessage -> SourceChainID: ${sourceChainIDStr}`);
    } catch (e) {
      console.log('Could not encode sourceChainID from UnsignedMessage');
    }
    
    const messageLength = (messageBytes[38] << 24) | 
                          (messageBytes[39] << 16) | 
                          (messageBytes[40] << 8) | 
                          messageBytes[41];
    
    // console.log(`UnsignedMessage -> AddressedCall length: ${messageLength} bytes`);
        
    if (messageLength <= 0 || 42 + messageLength > messageBytes.length) {
      // console.log('Invalid message length or message extends beyond UnsignedMessage data bounds');
      return new Uint8Array();
    }
    
    const addressedCall = messageBytes.slice(42, 42 + messageLength);
    // console.log(`Extracted AddressedCall of length ${addressedCall.length} bytes`);
    
    return addressedCall;
  } catch (error) {
    console.error('Error extracting addressedCall from UnsignedMessage:', error);
    return new Uint8Array();
  }
}

/**
 * Encodes a non-negative integer into Protobuf Varint format.
 * @param value - The non-negative integer to encode.
 * @returns A Uint8Array containing the Varint bytes.
 */
function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7; // Use unsigned right shift
  }
  bytes.push(value);
  return new Uint8Array(bytes);
}

// Define the ABI for the SendWarpMessage event
const sendWarpMessageEventAbi = parseAbiItem(
  'event SendWarpMessage(address indexed sourceAddress, bytes32 indexed unsignedMessageID, bytes message)'
);

/**
 * Gets the marshalled L1ValidatorRegistrationJustification protobuf bytes for a specific 
 * validator node. It queries logs, finds the corresponding RegisterL1ValidatorMessage payload,
 * and manually constructs the protobuf message with that payload in the 
 * 'register_l1_validator_message' field (field number 2).
 * 
 * @param nodeID - The node ID of the validator to get the justification for (e.g., "NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg")
 * @param publicClient - The Viem public client to use for querying
 * @returns The marshalled L1ValidatorRegistrationJustification bytes as a Uint8Array, or null if not found.
 */
export async function GetRegistrationJustification( 
  nodeID: string, 
  publicClient: PublicClient
): Promise<Uint8Array | null> {  // Return type is now Uint8Array | null
  const WARP_ADDRESS = '0x0200000000000000000000000000000000000005' as const;
  
  try {
    const warpLogs = await publicClient.getLogs({
      address: WARP_ADDRESS,
      event: sendWarpMessageEventAbi, 
      fromBlock: 'earliest',
      toBlock: 'latest',
    });
        
    if (warpLogs.length === 0) {
      return null;
    }
        
    for (const log of warpLogs) {
      try {
        const decodedArgs = log.args as { sourceAddress?: `0x${string}`, unsignedMessageID?: `0x${string}`, message?: `0x${string}` };
        const fullMessageHex = decodedArgs.message; 

        if (!fullMessageHex) {
           continue;
        }

        const unsignedMessageBytes = utils.hexToBuffer(fullMessageHex); // Assuming hexToBuffer returns Uint8Array
        const addressedCall = extractAddressedCall(unsignedMessageBytes);
        
        if (addressedCall.length === 0) continue;
        if (addressedCall.length < 14) continue;

        const acTypeID = (addressedCall[2] << 24) | (addressedCall[3] << 16) | (addressedCall[4] << 8) | addressedCall[5];
        const REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID = 1; 
        if (acTypeID !== REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID) continue;

        const sourceAddrLen = (addressedCall[6] << 24) | (addressedCall[7] << 16) | (addressedCall[8] << 8) | addressedCall[9];
        const payloadLenPos = 10 + sourceAddrLen;
        if (payloadLenPos + 4 > addressedCall.length) continue;

        const payloadLen = (addressedCall[payloadLenPos] << 24) | (addressedCall[payloadLenPos + 1] << 16) | (addressedCall[payloadLenPos + 2] << 8) | addressedCall[payloadLenPos + 3];
        if (payloadLen <= 0 || payloadLenPos + 4 + payloadLen > addressedCall.length) continue;

        const payloadBytes = addressedCall.slice(payloadLenPos + 4, payloadLenPos + 4 + payloadLen);
                        
        try {
          const validationData = parseRegisterL1ValidatorMessage(payloadBytes);

          if (validationData.nodeID === nodeID) {
            // Construct the L1ValidatorRegistrationJustification protobuf message manually
            
            // Tag for field number 2, wire type 2 (length-delimited) = 0x12
            const tag = new Uint8Array([0x12]); 
            
            // Length of the payloadBytes as Varint
            const lengthVarint = encodeVarint(payloadBytes.length);
            
            // Concatenate: Tag + Length + Payload
            const marshalledJustification = new Uint8Array(tag.length + lengthVarint.length + payloadBytes.length);
            marshalledJustification.set(tag, 0);
            marshalledJustification.set(lengthVarint, tag.length);
            marshalledJustification.set(payloadBytes, tag.length + lengthVarint.length);

            console.log(`Found and marshalled justification for ${nodeID}`); 
            return marshalledJustification; // <-- Return the final bytes
          }
        } catch (error) {
          // Ignore parsing errors, continue searching
        }
      } catch (error) {
        console.error(`Error processing log entry for tx ${log.transactionHash}:`, error);
      }
    }
    
    console.log(`No matching registration log found for nodeID ${nodeID}.`);
    return null;

  } catch (error) {
    console.error(`Error fetching or decoding logs for nodeID ${nodeID}:`, error);
    return null;
  }
}
