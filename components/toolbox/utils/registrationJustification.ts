import { decodeEventLog, hexToBytes, parseAbiItem, sha256, type Hex, type PublicClient } from 'viem';
import {
  getRegistrationJustification,
  marshalRegisterMessageJustification,
  WARP_PRECOMPILE_ADDRESS,
  WARP_MESSAGE_TOPIC,
} from '@avalanche-sdk/interchain/warp';

const SEND_WARP_MESSAGE_EVENT = parseAbiItem(
  'event SendWarpMessage(address indexed sourceAddress, bytes32 indexed unsignedMessageID, bytes message)',
);

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

/**
 * Extract the AddressedCall payload from an unsigned warp message.
 *
 * Layout: codec(2) networkID(4) sourceChainID(32) len(4) addressedCall,
 * where addressedCall = codec(2) typeID(4) len(4) sourceAddress len(4) payload.
 */
export function readAddressedCallPayload(unsignedMessage: Uint8Array): Uint8Array | null {
  let offset = 2 + 4 + 32;
  if (unsignedMessage.length < offset + 4) return null;
  const addressedCallLen = readU32(unsignedMessage, offset);
  offset += 4;
  const addressedCall = unsignedMessage.subarray(offset, offset + addressedCallLen);
  if (addressedCall.length !== addressedCallLen || addressedCall.length < 10) return null;

  let acOffset = 2 + 4;
  const sourceAddressLen = readU32(addressedCall, acOffset);
  acOffset += 4 + sourceAddressLen;
  if (addressedCall.length < acOffset + 4) return null;
  const payloadLen = readU32(addressedCall, acOffset);
  acOffset += 4;
  const payload = addressedCall.subarray(acOffset, acOffset + payloadLen);
  return payload.length === payloadLen ? payload : null;
}

/**
 * Find the RegisterL1ValidatorMessage for `validationIdHex` by looking up the
 * ValidatorManager events indexed on that validation ID, then reading the warp
 * log from the transaction that emitted them.
 */
async function findRegisterMessageByValidationId(
  validationIdHex: Hex,
  publicClient: PublicClient,
): Promise<Uint8Array | null> {
  // Raw request because viem's getLogs only filters by topic through a typed event.
  // Every ValidatorManager event keys on validationID as its first indexed topic.
  const logs = await publicClient.request({
    method: 'eth_getLogs',
    params: [{ fromBlock: '0x0', toBlock: 'latest', topics: [null, validationIdHex] }],
  });

  const target = validationIdHex.toLowerCase();
  const txHashes = [...new Set(logs.map((log) => log.transactionHash).filter((h): h is Hex => !!h))];
  for (const hash of txHashes) {
    const receipt = await publicClient.getTransactionReceipt({ hash });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== WARP_PRECOMPILE_ADDRESS.toLowerCase()) continue;
      if (log.topics[0]?.toLowerCase() !== WARP_MESSAGE_TOPIC) continue;
      const { args } = decodeEventLog({ abi: [SEND_WARP_MESSAGE_EVENT], data: log.data, topics: log.topics });
      const payload = readAddressedCallPayload(hexToBytes(args.message));
      if (payload && sha256(payload) === target) return payload;
    }
  }
  return null;
}

/**
 * Build the L1ValidatorRegistrationJustification for a validation ID.
 *
 * The SDK's getRegistrationJustification only scans the most recent ~200k blocks
 * of warp logs, so validators registered earlier than that come back null. This
 * checks bootstrap validators first, then does an indexed lookup by validation ID
 * across the whole chain, and only falls back to the SDK's backwards scan if the
 * RPC rejects the full-range query.
 */
export async function findRegistrationJustification(
  validationIdHex: string,
  subnetId: string,
  publicClient: PublicClient,
): Promise<Uint8Array | null> {
  // maxLogChunks: 0 limits the SDK to the bootstrap-validator check (no RPC calls).
  const bootstrap = await getRegistrationJustification(validationIdHex, subnetId, publicClient, { maxLogChunks: 0 });
  if (bootstrap) return bootstrap;

  try {
    const payload = await findRegisterMessageByValidationId(validationIdHex as Hex, publicClient);
    if (payload) return marshalRegisterMessageJustification(payload);
  } catch (err) {
    console.warn('Indexed justification lookup failed, falling back to log scan:', err);
  }

  return getRegistrationJustification(validationIdHex, subnetId, publicClient);
}
