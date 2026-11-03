import { describe, expect, it } from 'vitest';
import {
  concat,
  createPublicClient,
  custom,
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionResult,
  hexToBigInt,
  hexToBytes,
  parseAbiItem,
  sha256,
  toHex,
  type Abi,
  type Hex,
  type PublicClient,
} from 'viem';
import { marshalRegisterMessageJustification } from '@avalanche-sdk/interchain/warp';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import {
  findRegistrationJustification,
  justificationFromRegisterMessage,
  lastBlockAtOrBefore,
  LOG_WINDOW_BLOCKS,
  readAddressedCallPayload,
} from '@/components/toolbox/utils/registrationJustification';

// Validator V1 of the nightly Console chain test, tier1, on Fuji (run 40657322229, 2026-10-28). The P-Chain
// RegisterL1ValidatorTx 888e5ax1Xe3YrELgn5KoFoJPjsWM8v7GwY8AfhDpBBbUg2SwN holds REGISTER_MESSAGE. The C-Chain initiate
// tx INITIATE_TX (block 60141864) emitted WARP_LOG and the manager's InitiatedValidatorRegistration.
const VALIDATION_ID = '0x6e67f57807b673618ef7ca3e12dd4564b5b22e08fb3f42b312999f578edc0572';
const SUBNET_ID = '7DBvK68VHBFXGVWruQHcb4Ltn1uaLf8NPCXqpMjgEb9CPGeJA';
const SUBNET_ID_HEX = '0x0e19d3cdbaf2ab373fdbbb44b3804bb31895e92c825d688c24a1d46d64fb6190';
const MANAGER = '0x37f7684bc983575929ad859db621ce28c5eee1b9';
const INITIATE_TX = '0x03137e1965b1d40fa21b70dcb1108b2ebeadaa7b085a68b14c3905e41e0c48a0';
const COMPLETE_TX = `0x${'cc'.repeat(32)}` as const;
const REGISTER_MESSAGE =
  '0x0000000000010e19d3cdbaf2ab373fdbbb44b3804bb31895e92c825d688c24a1d46d64fb6190000000146e2df2b222af77bab6947a5431daf81d682b9364b3065692c362c155afd54961fec26c6e08b1b0f7a784e15dd714be90378b1c2e237c8916bb6f2a214c571dc9d9a645ba000000006ae3056c00000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c9900000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c99000000000000000a';
const WARP_LOG = {
  address: '0x0200000000000000000000000000000000000005',
  topics: [
    '0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d',
    '0x00000000000000000000000037f7684bc983575929ad859db621ce28c5eee1b9',
    '0x81d07cbbc6cc4174de2850858feebe4c7ffcdbadcb17c4b372550723693e8620',
  ],
  data: '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001020000000000057fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5000000d80000000000010000001437f7684bc983575929ad859db621ce28c5eee1b9000000b60000000000010e19d3cdbaf2ab373fdbbb44b3804bb31895e92c825d688c24a1d46d64fb6190000000146e2df2b222af77bab6947a5431daf81d682b9364b3065692c362c155afd54961fec26c6e08b1b0f7a784e15dd714be90378b1c2e237c8916bb6f2a214c571dc9d9a645ba000000006ae3056c00000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c9900000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c99000000000000000a000000000000000000000000000000000000000000000000000000000000',
} as const;
const EXPECTED = marshalRegisterMessageJustification(hexToBytes(REGISTER_MESSAGE));

const ABI = ValidatorManagerABI.abi as Abi;
const SEND_WARP_MESSAGE_EVENT = parseAbiItem(
  'event SendWarpMessage(address indexed sourceAddress, bytes32 indexed unsignedMessageID, bytes message)',
);

// The mock chain: one block every 2 s from GENESIS_TIME.
const GENESIS_TIME = 1_600_000_000n;
const LATEST = 60_200_000n;
const timestampOf = (block: bigint) => GENESIS_TIME + block * 2n;

interface MockChain {
  initiateBlock: bigint;
  completeBlock: bigint;
  /** getValidator(...).startTime. Default: the completion block's timestamp. */
  startTime?: bigint;
  /** REGISTRATION_EXPIRY_LENGTH. Default 1 day. */
  expiryLength?: bigint;
  /** The widest eth_getLogs range the RPC answers, both ends counted. The public C-Chain RPC: 100. */
  maxLogBlocks?: bigint;
}

/**
 * A viem client over a mock RPC that, like the public C-Chain RPC, rejects eth_getLogs over `maxLogBlocks`. Like a
 * load balancer whose nodes lag each other by a block, it answers 'latest' with block LATEST but has no block LATEST
 * by number.
 */
function mockClient(chain: MockChain) {
  const { initiateBlock, completeBlock, expiryLength = 86_400n, maxLogBlocks = LOG_WINDOW_BLOCKS } = chain;
  const startTime = chain.startTime ?? timestampOf(completeBlock);
  const logRanges: [bigint, bigint][] = [];
  const methods: string[] = [];
  const blockReads: (bigint | 'latest')[] = [];
  const receipts: Hex[] = [];

  const managerLog = (blockNumber: bigint, transactionHash: Hex) => ({
    address: MANAGER,
    topics: [`0x${'11'.repeat(32)}`, VALIDATION_ID],
    data: '0x',
    blockNumber: toHex(blockNumber),
    blockHash: `0x${'00'.repeat(32)}`,
    transactionHash,
    transactionIndex: '0x0',
    logIndex: '0x0',
    removed: false,
  });
  const receipt = (transactionHash: Hex, blockNumber: bigint, logs: object[]) => ({
    blockHash: `0x${'00'.repeat(32)}`,
    blockNumber: toHex(blockNumber),
    contractAddress: null,
    cumulativeGasUsed: '0x1',
    effectiveGasPrice: '0x1',
    from: `0x${'00'.repeat(20)}`,
    gasUsed: '0x1',
    logs,
    logsBloom: `0x${'0'.repeat(512)}`,
    status: '0x1',
    to: MANAGER,
    transactionHash,
    transactionIndex: '0x0',
    type: '0x2',
  });

  async function request({ method, params }: { method: string; params?: any }): Promise<unknown> {
    methods.push(method);
    switch (method) {
      case 'eth_getBlockByNumber': {
        blockReads.push(params[0] === 'latest' ? 'latest' : hexToBigInt(params[0]));
        const number = params[0] === 'latest' ? LATEST : hexToBigInt(params[0]);
        if (params[0] !== 'latest' && number >= LATEST) return null;
        return { number: toHex(number), hash: toHex(number, { size: 32 }), timestamp: toHex(timestampOf(number)) };
      }
      case 'eth_call': {
        const { functionName } = decodeFunctionData({ abi: ABI, data: params[0].data });
        if (functionName === 'REGISTRATION_EXPIRY_LENGTH') {
          return encodeFunctionResult({ abi: ABI, functionName, result: expiryLength });
        }
        if (functionName === 'getValidator') {
          return encodeFunctionResult({
            abi: ABI,
            functionName,
            result: {
              status: startTime === 0n ? 1 : 2,
              nodeID: '0x6e2df2b222af77bab6947a5431daf81d682b9364',
              startingWeight: 10n,
              sentNonce: 0n,
              receivedNonce: 0n,
              weight: 10n,
              startTime,
              endTime: 0n,
            },
          });
        }
        throw new Error(`unexpected eth_call ${functionName}`);
      }
      case 'eth_getLogs': {
        const { address, fromBlock, toBlock, topics } = params[0];
        const from = hexToBigInt(fromBlock);
        const to = hexToBigInt(toBlock);
        logRanges.push([from, to]);
        if (to - from + 1n > maxLogBlocks) {
          throw Object.assign(
            new Error(
              `block range too large: total block range in this request exceeds the maximum of ${maxLogBlocks} blocks`,
            ),
            { code: -32602 },
          );
        }
        expect(address.toLowerCase()).toBe(MANAGER);
        expect(topics).toEqual([null, VALIDATION_ID]);
        return [managerLog(initiateBlock, INITIATE_TX), managerLog(completeBlock, COMPLETE_TX)].filter(
          (log) => hexToBigInt(log.blockNumber) >= from && hexToBigInt(log.blockNumber) <= to,
        );
      }
      case 'eth_getTransactionReceipt': {
        const [hash] = params;
        receipts.push(hash);
        if (hash === INITIATE_TX) {
          return receipt(INITIATE_TX, initiateBlock, [
            { ...managerLog(initiateBlock, INITIATE_TX), ...WARP_LOG, logIndex: '0x0' },
            { ...managerLog(initiateBlock, INITIATE_TX), logIndex: '0x1' },
          ]);
        }
        if (hash === COMPLETE_TX) return receipt(COMPLETE_TX, completeBlock, [managerLog(completeBlock, COMPLETE_TX)]);
        return null;
      }
      default:
        throw new Error(`unexpected ${method}`);
    }
  }

  const client = createPublicClient({ transport: custom({ request }, { retryCount: 0 }) });
  return { client, logRanges, methods, blockReads, receipts };
}

const find = (client: ReturnType<typeof mockClient>['client'], initiateTxHash?: Hex) =>
  findRegistrationJustification({
    validationId: VALIDATION_ID,
    subnetId: SUBNET_ID,
    publicClient: client,
    validatorManager: MANAGER,
    initiateTxHash,
  });

/** Every range is at most 100 blocks, both ends counted, and each starts one block below the one before. */
function expectContiguousWindows(ranges: [bigint, bigint][], anchor: bigint) {
  let to = anchor;
  for (const [from, end] of ranges) {
    expect(end).toBe(to);
    expect(end - from + 1n).toBeLessThanOrEqual(LOG_WINDOW_BLOCKS);
    to = from - 1n;
  }
}

describe('justificationFromRegisterMessage', () => {
  it('builds the 185-byte justification from the 10-28 P-Chain message, which hashes to the validation ID', () => {
    expect(sha256(hexToBytes(REGISTER_MESSAGE))).toBe(VALIDATION_ID);
    const justification = justificationFromRegisterMessage(REGISTER_MESSAGE, VALIDATION_ID);
    expect(justification.length).toBe(185);
    expect(justification).toEqual(EXPECTED);
  });

  it('gives the same bytes as the C-Chain warp log of the initiate tx', () => {
    const { args } = decodeEventLog({
      abi: [SEND_WARP_MESSAGE_EVENT],
      data: WARP_LOG.data,
      topics: [...WARP_LOG.topics],
    });
    const fromLog = marshalRegisterMessageJustification(readAddressedCallPayload(hexToBytes(args.message))!);
    expect(justificationFromRegisterMessage(REGISTER_MESSAGE, VALIDATION_ID)).toEqual(fromLog);
  });

  it('names a P-Chain tx of another registration of the node, and shows the contract validation ID', () => {
    const contractId = `0x${'ab'.repeat(32)}` as const;
    expect(() => justificationFromRegisterMessage(REGISTER_MESSAGE, contractId)).toThrow(
      `The P-Chain transaction belongs to another registration of this node. Its message has validation ID ${VALIDATION_ID}, but the validator manager has validation ID ${contractId} for the node.`,
    );
  });
});

describe('findRegistrationJustification', () => {
  it('finds the message in the first 100-block window back from the completion block', async () => {
    const { client, logRanges, methods, receipts } = mockClient({
      initiateBlock: 60_141_864n,
      completeBlock: 60_141_876n,
    });
    expect(await find(client)).toEqual(EXPECTED);
    expect(logRanges).toEqual([[60_141_777n, 60_141_876n]]);
    // 2 contract reads, the head, a few block reads for the completion block, 1 eth_getLogs and 1 receipt: the
    // window holds the initiate and the completion tx, and the older one, the initiate tx, is read first.
    expect(methods.filter((m) => m === 'eth_getBlockByNumber').length).toBeLessThanOrEqual(8);
    expect(receipts).toEqual([INITIATE_TX]);
  });

  it('reads the head block once, by tag, so a node one block behind does not fail the search', async () => {
    const { client, methods, blockReads } = mockClient({ initiateBlock: 60_141_864n, completeBlock: 60_141_876n });
    expect(await find(client)).toEqual(EXPECTED);
    expect(blockReads.filter((b) => b === 'latest')).toHaveLength(1);
    expect(blockReads).not.toContain(LATEST);
    expect(methods).not.toContain('eth_blockNumber');
  });

  it('walks back 100 blocks per call, both ends counted, to a message 13 windows back', async () => {
    const completeBlock = 60_141_864n + 1_234n;
    const { client, logRanges, receipts } = mockClient({ initiateBlock: 60_141_864n, completeBlock });
    expect(await find(client)).toEqual(EXPECTED);
    expect(logRanges).toHaveLength(13);
    expectContiguousWindows(logRanges, completeBlock);
    // The first window holds only the completion tx.
    expect(receipts).toEqual([COMPLETE_TX, INITIATE_TX]);
  });

  it('throws the RPC error of a rejected query, and does not return null', async () => {
    // An RPC with a 50-block cap rejects the first 100-block window.
    const { client, logRanges } = mockClient({
      initiateBlock: 60_141_864n,
      completeBlock: 60_141_876n,
      maxLogBlocks: 50n,
    });
    await expect(find(client)).rejects.toThrow(
      'eth_getLogs for blocks 60141777 to 60141876 failed: block range too large: total block range in this request exceeds the maximum of 50 blocks',
    );
    expect(logRanges).toHaveLength(1);
  });

  it('stops after ceil(REGISTRATION_EXPIRY_LENGTH / 2 s / 100) + 1 calls and throws', async () => {
    // A 1-day expiry: 433 calls cover 43,300 blocks. The initiate tx is older.
    const completeBlock = 60_141_864n + 50_000n;
    const { client, logRanges } = mockClient({ initiateBlock: 60_141_864n, completeBlock });
    await expect(find(client)).rejects.toThrow(
      `No registration message for validation ID ${VALIDATION_ID} in the logs of validator manager ${MANAGER}, blocks ${completeBlock - 43_299n} to ${completeBlock}: the 433 calls of 100 blocks before the registration completed at ${new Date(Number(timestampOf(completeBlock)) * 1000).toISOString()}.`,
    );
    expect(logRanges).toHaveLength(433);
    expectContiguousWindows(logRanges, completeBlock);
  });

  it('throws for a registration that never completed: there is no start block', async () => {
    const { client, logRanges } = mockClient({ initiateBlock: 60_141_864n, completeBlock: 60_141_876n, startTime: 0n });
    await expect(find(client)).rejects.toThrow(/has no completed registration for validation ID/);
    expect(logRanges).toHaveLength(0);
  });

  it('reads the initiate tx when the caller has it, with no log search', async () => {
    const { client, logRanges } = mockClient({ initiateBlock: 60_141_864n, completeBlock: 60_141_876n });
    expect(await find(client, INITIATE_TX)).toEqual(EXPECTED);
    expect(logRanges).toHaveLength(0);
  });

  it('throws when the given tx sent no registration message for the validation ID', async () => {
    const { client } = mockClient({ initiateBlock: 60_141_864n, completeBlock: 60_141_876n });
    await expect(find(client, COMPLETE_TX)).rejects.toThrow(
      `Transaction ${COMPLETE_TX} sent no registration message for validation ID ${VALIDATION_ID}.`,
    );
  });

  it('builds a bootstrap validator justification with no RPC call', async () => {
    const bootstrapId = sha256(concat([SUBNET_ID_HEX, '0x00000000']));
    const { client, methods } = mockClient({ initiateBlock: 1n, completeBlock: 2n });
    const justification = await findRegistrationJustification({
      validationId: bootstrapId,
      subnetId: SUBNET_ID,
      publicClient: client,
      validatorManager: MANAGER,
    });
    // L1ValidatorRegistrationJustification.convert_subnet_to_l1_tx_data { subnet_id, index 0 }
    expect(toHex(justification)).toBe(`0x0a240a20${SUBNET_ID_HEX.slice(2)}1000`);
    expect(methods).toEqual([]);
  });
});

describe('lastBlockAtOrBefore', () => {
  // Like the C-Chain: block 0 at time 0, then uneven block times, with equal timestamps and 60 s pauses, and a slower
  // rate in the last 20,000 blocks.
  const times: bigint[] = [0n];
  for (let i = 1, t = 1_600_000_000n; i <= 100_000; i++) {
    t += [0n, 1n, 2n, 2n, 3n, 60n][i % 6] + (i > 80_000 ? 5n : 0n);
    times.push(t);
  }
  const hi = BigInt(times.length - 1);
  const reads: bigint[] = [];
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      reads.push(blockNumber);
      return { timestamp: times[Number(blockNumber)] };
    },
  } as unknown as PublicClient;
  const lastAtOrBefore = (target: bigint) => BigInt(times.findLastIndex((t) => t <= target));

  it('finds the last block at or before each time, in at most 2 * log2(head) + 8 reads, none of the head', async () => {
    const head = { number: hi, timestamp: times[Number(hi)] };
    const targets = [0n, 1_599_999_999n, times[100_000], times[100_000] + 10n];
    for (let i = 1; i < times.length; i += 997) targets.push(times[i] - 1n, times[i], times[i] + 1n);
    for (const target of targets) {
      reads.length = 0;
      expect(await lastBlockAtOrBefore(client, target, head)).toBe(lastAtOrBefore(target));
      expect(reads.length).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(Number(hi))) + 8);
      expect(reads).not.toContain(hi);
    }
  });
});
