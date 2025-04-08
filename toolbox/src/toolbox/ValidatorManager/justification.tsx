import { parseAbiItem, type PublicClient } from 'viem';
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
function extractAddressedCall(messageBytes: Uint8Array): Uint8Array {
  try {
    // console.log(`Parsing UnsignedMessage of length: ${messageBytes.length} bytes`);
    
    if (messageBytes.length < 42) { // 2 + 4 + 32 + 4 = minimum 42 bytes
      // console.log('UnsignedMessage too short');
      return new Uint8Array();
    }
    
    // const codecVersion = (messageBytes[0] << 8) | messageBytes[1];
    
    // const networkIDBytes = messageBytes.slice(2, 6);
    // console.log(`Raw networkID bytes: 0x${Buffer.from(networkIDBytes).toString('hex')}`);
    // const networkID = (messageBytes[2] << 24) | 
    //                   (messageBytes[3] << 16) | 
    //                   (messageBytes[4] << 8) | 
    //                   messageBytes[5];
    
    // console.log(`UnsignedMessage -> codecVersion: ${codecVersion}, NetworkID: ${networkID}`);
    
    // const sourceChainIDBytes = messageBytes.slice(6, 38);
    // console.log(`Raw sourceChainID bytes: 0x${Buffer.from(sourceChainIDBytes).toString('hex')}`);
    // try {
    //   let sourceChainIDStr = utils.base58check.encode(Buffer.from(sourceChainIDBytes));
    //   console.log(`UnsignedMessage -> SourceChainID: ${sourceChainIDStr}`);
    // } catch (e) {
    //   console.log('Could not encode sourceChainID from UnsignedMessage');
    // }
    
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

// Define the ABI for the SendWarpMessage event
const sendWarpMessageEventAbi = parseAbiItem(
  'event SendWarpMessage(address indexed sourceAddress, bytes32 indexed unsignedMessageID, bytes message)'
);

/**
 * Gets the registration justification for a specific validator node by querying logs 
 * from the Warp Messenger address, decoding the SendWarpMessage event, extracting 
 * the unsigned message bytes, parsing the message chain (UnsignedMessage -> AddressedCall -> Payload),
 * and returning the raw UnsignedMessage hex data if the payload's nodeID matches the target.
 * 
 * @param nodeID - The node ID of the validator to get the justification for (e.g., "NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg")
 * @param publicClient - The Viem public client to use for querying
 * @returns The raw hex string (`0x...`) of the UnsignedMessage corresponding to the validator's registration, or null if not found.
 */
export async function GetRegistrationJustification(
  nodeID: string, 
  publicClient: PublicClient
): Promise<`0x${string}` | null> {  
  const WARP_ADDRESS = '0x0200000000000000000000000000000000000005' as const;
  
  try {
    const warpLogs = await publicClient.getLogs({
      address: WARP_ADDRESS,
      event: sendWarpMessageEventAbi, 
      fromBlock: 'earliest',
      toBlock: 'latest',
    });
    
    // console.log(`Found ${warpLogs.length} SendWarpMessage logs. Searching for nodeID: ${nodeID}`);
    
    if (warpLogs.length === 0) {
      // console.log('No SendWarpMessage logs found');
      return null;
    }
        
    for (const log of warpLogs) {
      try {
        // console.log(`\n----- Processing log from tx ${log.transactionHash} -----`);
        const decodedArgs = log.args as { sourceAddress?: `0x${string}`, unsignedMessageID?: `0x${string}`, message?: `0x${string}` };

        const unsignedMessageHex = decodedArgs.message;

        if (!unsignedMessageHex) {
          // console.log('Could not find "message" argument in decoded log data. Skipping.');
           continue;
        }

        const unsignedMessageBytes = utils.hexToBuffer(unsignedMessageHex);
                
        const addressedCall = extractAddressedCall(unsignedMessageBytes);
        
        if (addressedCall.length === 0) {
          continue;
        }

        // --- AddressedCall Parsing ---
        if (addressedCall.length < 14) { 
          continue;
        }

        // const acCodecVersion = (addressedCall[0] << 8) | addressedCall[1];
        const acTypeID = (addressedCall[2] << 24) |
                        (addressedCall[3] << 16) |
                        (addressedCall[4] << 8) |
                        addressedCall[5];

        const REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID = 1; 
        if (acTypeID !== REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID) {
           continue;
        }

        const sourceAddrLen = (addressedCall[6] << 24) |
                             (addressedCall[7] << 16) |
                             (addressedCall[8] << 8) |
                             addressedCall[9];
        
        const payloadLenPos = 10 + sourceAddrLen;
        if (payloadLenPos + 4 > addressedCall.length) {
          continue;
        }

        const payloadLen = (addressedCall[payloadLenPos] << 24) |
                          (addressedCall[payloadLenPos + 1] << 16) |
                          (addressedCall[payloadLenPos + 2] << 8) |
                          addressedCall[payloadLenPos + 3];
        
        if (payloadLen <= 0 || payloadLenPos + 4 + payloadLen > addressedCall.length) {
          continue;
        }

        const payload = addressedCall.slice(payloadLenPos + 4, payloadLenPos + 4 + payloadLen);
        // --- End of AddressedCall Parsing ---
                
        try {
          const validationData = parseRegisterL1ValidatorMessage(payload);
          // console.log(`Successfully parsed validation data for nodeID: ${validationData.nodeID}`);
          
          if (validationData.nodeID === nodeID) {
            console.log(`Found justification for ${nodeID}: ${unsignedMessageHex}`); // Log the final justification
            return unsignedMessageHex; 
          }
        } catch (error) {
          // Ignore errors here, likely means it wasn't a RegisterL1ValidatorMessage payload we could parse
        }
      } catch (error) {
        // Log errors during the processing of a specific log entry, but continue
        console.error(`Error processing log entry for tx ${log.transactionHash}:`, error);
      }
    }
    
    console.log(`No matching registration log found for nodeID ${nodeID}.`);
    return null;

  } catch (error) {
    // Log errors related to the overall log fetching/decoding process
    console.error(`Error fetching or decoding logs for nodeID ${nodeID}:`, error);
    return null;
  }
}
