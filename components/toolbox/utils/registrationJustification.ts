import {
  BaseError,
  decodeEventLog,
  hexToBytes,
  parseAbiItem,
  sha256,
  toHex,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import {
  getRegistrationJustification,
  marshalRegisterMessageJustification,
  WARP_PRECOMPILE_ADDRESS,
  WARP_MESSAGE_TOPIC,
} from '@avalanche-sdk/interchain/warp';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';

const SEND_WARP_MESSAGE_EVENT = parseAbiItem(
  'event SendWarpMessage(address indexed sourceAddress, bytes32 indexed unsignedMessageID, bytes message)',
);

/** The public C-Chain RPC answers eth_getLogs for at most 100 blocks, both ends counted, and rejects a wider range. */
export const LOG_WINDOW_BLOCKS = 100n;

/**
 * The log search budget assumes a block every 2 s. The C-Chain makes blocks faster (Fuji every 1.4 to 1.8 s, mainnet
 * about every 1 s, 2026-10), so of a 1-day expiry the budget covers about 17 to 22 h on Fuji and 12 h on mainnet.
 */
const BUDGET_BLOCK_SECONDS = 2n;

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
 * Build the justification for the registration of `validationId` from the RegisterL1ValidatorMessage that the
 * P-Chain RegisterL1ValidatorTx holds. The validation ID is the sha256 of that message, so the message of another
 * registration of the same node does not match.
 */
export function justificationFromRegisterMessage(registerMessageHex: Hex, validationId: Hex): Uint8Array {
  const payload = hexToBytes(registerMessageHex);
  const messageValidationId = sha256(payload);
  if (messageValidationId !== validationId.toLowerCase()) {
    throw new Error(
      `The P-Chain transaction belongs to another registration of this node. Its message has validation ID ${messageValidationId}, but the validator manager has validation ID ${validationId} for the node. Enter the P-Chain transaction of the current registration.`,
    );
  }
  return marshalRegisterMessageJustification(payload);
}

/** The RegisterL1ValidatorMessage for `validationId` from the warp log of this receipt, or null. */
function registerMessageInReceipt(receipt: TransactionReceipt, validationId: Hex): Uint8Array | null {
  const target = validationId.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== WARP_PRECOMPILE_ADDRESS.toLowerCase()) continue;
    if (log.topics[0]?.toLowerCase() !== WARP_MESSAGE_TOPIC) continue;
    const { args } = decodeEventLog({ abi: [SEND_WARP_MESSAGE_EVENT], data: log.data, topics: log.topics });
    const payload = readAddressedCallPayload(hexToBytes(args.message));
    if (payload && sha256(payload) === target) return payload;
  }
  return null;
}

/**
 * The last block at or before `timestamp`, from block 0 to `head`, the latest block that the caller read. The search
 * never reads `head` again by number: behind a load balancer, the node that answers can be a block behind the node
 * that gave `head`, and then has no such block. The public RPC rate-limits bursts, so the search keeps the block reads
 * few. It steps back from `head`, 16 times further each read, until it passes `timestamp`. Then, as blocks come at a
 * nearly even rate, it guesses the block from the timestamps at the ends of the range, and halves the range after a
 * guess that did not. That reads about half the blocks of a plain halving search, and never more than
 * 2 * log2(head.number) + 8.
 */
export async function lastBlockAtOrBefore(
  publicClient: PublicClient,
  timestamp: bigint,
  head: { number: bigint; timestamp: bigint },
): Promise<bigint> {
  const timestampOf = async (blockNumber: bigint) => (await publicClient.getBlock({ blockNumber })).timestamp;
  let [hi, hiTime] = [head.number, head.timestamp];
  if (hiTime <= timestamp) return hi;
  let lo = hi;
  let loTime = hiTime;
  for (let back = 1024n; loTime > timestamp && lo > 0n; back *= 16n) {
    [hi, hiTime] = [lo, loTime];
    lo = hi > back ? hi - back : 0n;
    loTime = await timestampOf(lo);
  }
  if (loTime > timestamp) return lo;

  // Invariant: loTime <= timestamp < hiTime.
  let interpolate = true;
  while (hi - lo > 1n) {
    const span = hi - lo;
    let mid = lo + span / 2n;
    if (interpolate) {
      mid = lo + ((timestamp - loTime) * span) / (hiTime - loTime);
      if (mid <= lo) mid = lo + 1n;
      if (mid >= hi) mid = hi - 1n;
    }
    const midTime = await timestampOf(mid);
    if (midTime <= timestamp) [lo, loTime] = [mid, midTime];
    else [hi, hiTime] = [mid, midTime];
    interpolate = (hi - lo) * 2n <= span;
  }
  return lo;
}

/**
 * Walk back from the block where the registration completed, LOG_WINDOW_BLOCKS per eth_getLogs, and read the
 * RegisterL1ValidatorMessage from the tx that emitted the manager's event for `validationId`.
 *
 * completeValidatorRegistration sets startTime, so the initiate tx is in an earlier block. The P-Chain accepts a
 * registration only until its expiry, REGISTRATION_EXPIRY_LENGTH after the initiate tx, so the walk stops after
 * ceil(REGISTRATION_EXPIRY_LENGTH / BUDGET_BLOCK_SECONDS / LOG_WINDOW_BLOCKS) + 1 calls. It finds no message for a
 * registration that was completed long after the P-Chain accepted it.
 */
async function findRegisterMessageInLogs(
  publicClient: PublicClient,
  validatorManager: Address,
  validationId: Hex,
): Promise<Uint8Array> {
  const abi = ValidatorManagerABI.abi as Abi;
  const [validator, expiryLength, head] = await Promise.all([
    publicClient.readContract({ address: validatorManager, abi, functionName: 'getValidator', args: [validationId] }),
    publicClient.readContract({ address: validatorManager, abi, functionName: 'REGISTRATION_EXPIRY_LENGTH' }),
    publicClient.getBlock({ blockTag: 'latest' }),
  ]);
  const { startTime } = validator as { startTime: bigint };
  if (startTime === 0n) {
    throw new Error(
      `The validator manager ${validatorManager} has no completed registration for validation ID ${validationId}, so the search for its registration message has no start block.`,
    );
  }

  const anchor = await lastBlockAtOrBefore(publicClient, startTime, head);
  const windowSeconds = BUDGET_BLOCK_SECONDS * LOG_WINDOW_BLOCKS;
  const maxCalls = ((expiryLength as bigint) + windowSeconds - 1n) / windowSeconds + 1n;
  for (let to = anchor, calls = 1n; ; calls++) {
    const from = to >= LOG_WINDOW_BLOCKS - 1n ? to - (LOG_WINDOW_BLOCKS - 1n) : 0n;
    // Raw request because viem's getLogs only filters by topic through a typed event. Every ValidatorManager event
    // keys on validationID as its first indexed topic.
    const logs = await publicClient
      .request({
        method: 'eth_getLogs',
        params: [
          { address: validatorManager, fromBlock: toHex(from), toBlock: toHex(to), topics: [null, validationId] },
        ],
      })
      .catch((err: unknown) => {
        const reason =
          err instanceof BaseError ? err.details || err.shortMessage : err instanceof Error ? err.message : String(err);
        throw new Error(`eth_getLogs for blocks ${from} to ${to} failed: ${reason}`, { cause: err });
      });

    // eth_getLogs returns logs in block order, so the oldest tx in the window comes first: the initiate tx, when the
    // window holds it. The window can also hold the completion tx, which sends no registration message.
    const txHashes = [...new Set(logs.map((log) => log.transactionHash).filter((h): h is Hex => !!h))];
    for (const hash of txHashes) {
      const payload = registerMessageInReceipt(await publicClient.getTransactionReceipt({ hash }), validationId);
      if (payload) return payload;
    }

    if (from === 0n || calls >= maxCalls) {
      const completedAt = new Date(Number(startTime) * 1000).toISOString();
      throw new Error(
        `No registration message for validation ID ${validationId} in the logs of validator manager ${validatorManager}, blocks ${from} to ${anchor}: the ${calls} calls of ${LOG_WINDOW_BLOCKS} blocks before the registration completed at ${completedAt}.`,
      );
    }
    to = from - 1n;
  }
}

export interface FindRegistrationJustificationArgs {
  validationId: Hex;
  /** The L1's subnet ID (CB58), for the bootstrap validators. */
  subnetId: string;
  publicClient: PublicClient;
  /** The ValidatorManager that sent the registration message. For PoS, the manager under the staking manager. */
  validatorManager: Address;
  /** The initiateValidatorRegistration tx, when the caller has it. Then no log search is needed. */
  initiateTxHash?: Hex;
}

/**
 * Build the L1ValidatorRegistrationJustification that the P-Chain needs to sign L1ValidatorRegistration(false), the
 * acknowledgement of a removal or of an expired registration. A bootstrap validator's justification is its subnet
 * ID and index. Any other validator's is its RegisterL1ValidatorMessage, which this reads from the initiate tx.
 *
 * Throws when it finds no message, and on any RPC error: a rejected query is never reported as a missing message.
 */
export async function findRegistrationJustification({
  validationId,
  subnetId,
  publicClient,
  validatorManager,
  initiateTxHash,
}: FindRegistrationJustificationArgs): Promise<Uint8Array> {
  // maxLogChunks: 0 limits the SDK to the bootstrap-validator check (no RPC calls).
  const bootstrap = await getRegistrationJustification(validationId, subnetId, publicClient, { maxLogChunks: 0 });
  if (bootstrap) return bootstrap;

  if (initiateTxHash) {
    const receipt = await publicClient.getTransactionReceipt({ hash: initiateTxHash });
    const payload = registerMessageInReceipt(receipt, validationId);
    if (!payload) {
      throw new Error(`Transaction ${initiateTxHash} sent no registration message for validation ID ${validationId}.`);
    }
    return marshalRegisterMessageJustification(payload);
  }

  return marshalRegisterMessageJustification(
    await findRegisterMessageInLogs(publicClient, validatorManager, validationId),
  );
}
