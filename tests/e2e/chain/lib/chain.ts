// Public chain reads for the Console chain tests: the Fuji P-Chain and C-Chain RPC, the Validator Manager on the
// C-Chain, and Glacier. A test checks the chain with these after each transaction and before each send, and
// teardown.ts and preflight.ts use them too.
//
// Rules:
//   - Public endpoints only: api.avax-test.network and glacier-api.avax.network. Never an internal or dedicated node.
//   - At most 2 requests per second from one process: every request waits for its slot (MIN_GAP_MS). The wallet
//     signer (chain/wallet/signer.ts) sends through throttledFetch, so its calls share the slot.
//   - The first HTTP 429 stops every later request of the process with RateLimitedError, the signer's too. A poll
//     does not retry it.
//   - Fuji only. assertFuji() checks the network before a send, and keyAddresses() derives Fuji addresses only.

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { secp256k1, utils } from '@avalabs/avalanchejs';
import { createPublicClient, custom, getAddress, type Address, type Hex, type TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';

export const FUJI = {
  networkId: 5,
  hrp: 'fuji',
  cChainId: 43113,
  api: 'https://api.avax-test.network',
  pRpc: 'https://api.avax-test.network/ext/bc/P',
  cRpc: 'https://api.avax-test.network/ext/bc/C/rpc',
  // The C-Chain's Avalanche API: avax.issueTx and avax.getAtomicTx for the atomic txs (ExportTx and ImportTx).
  cAvax: 'https://api.avax-test.network/ext/bc/C/avax',
  infoRpc: 'https://api.avax-test.network/ext/info',
  glacier: 'https://glacier-api.avax.network/v1/networks/fuji',
  // The P-Chain blockchain ID and the Primary Network subnet ID are both the empty ID.
  pBlockchainId: '11111111111111111111111111111111LpoYY',
  primaryNetworkId: '11111111111111111111111111111111LpoYY',
  cBlockchainId: 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp',
  avaxAssetId: 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK',
} as const;

/** nAVAX per AVAX on the P-Chain. */
export const NANO_AVAX = 1_000_000_000n;

// ---------------------------------------------------------------------------------------------------------------------
// Requests: one slot every 500 ms per process, one retry, and a stop at the first 429.
// ---------------------------------------------------------------------------------------------------------------------

const MIN_GAP_MS = 500;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_000;

let nextSlot = 0;
let rateLimited: string | undefined;
let rpcId = 0;

/** The public API answered HTTP 429. Every later request of the process fails with this error too. */
export class RateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/** A JSON-RPC error answer. viem reads `code` and `data` from it. */
export class RpcError extends Error {
  code: number;
  data: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}

/** True when the error, or an error in its `cause` chain, is a RateLimitedError. viem wraps the errors it gets. */
export function isRateLimited(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e instanceof RateLimitedError) return true;
  }
  return false;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > now) await sleep(at - now);
}

// A network error or an HTTP 5xx gets one more try after 1 s, in a new slot: one node behind the load balancer can
// fail and the next answer. An HTTP 429 is never retried: it stops the process (more requests make the ban longer).
async function send(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    if (rateLimited) throw new RateLimitedError(rateLimited);
    await waitForSlot();
    let res: Response | undefined;
    let failure: unknown;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      failure = error;
    }
    if (res?.status === 429) {
      rateLimited = `${new URL(url).host} answered HTTP 429. This process sends no more requests to the public API.`;
      throw new RateLimitedError(rateLimited);
    }
    if (res && (res.status < 500 || attempt === 2)) return res;
    if (attempt === 2) throw failure;
    await res?.body?.cancel();
    await sleep(RETRY_DELAY_MS);
  }
}

/** fetch through the slot, the retry and the 429 stop above. The wallet signer sends every request with it. */
export const throttledFetch = (url: string, init?: RequestInit): Promise<Response> => send(url, init);

/** One JSON-RPC call to a public endpoint. */
export async function jsonRpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const res = await send(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} from ${new URL(url).host}`);
  const body = (await res.json()) as { result?: T; error?: { code: number; message: string; data?: unknown } };
  if (body.error) throw new RpcError(body.error.code, `${method}: ${body.error.message}`, body.error.data);
  return body.result as T;
}

/** One GET to Glacier. Returns null for HTTP 404. */
async function glacierGet<T>(path: string): Promise<T | null> {
  const res = await send(`${FUJI.glacier}${path}`, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Glacier ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------------------------------------------------

export interface PollOptions {
  /** Default 180 s. */
  timeoutMs?: number;
  /** Default 5 s. Never below 500 ms. */
  intervalMs?: number;
}

/**
 * Calls `read` until it returns a value that is not null, undefined or false, and returns that value with the time it
 * took. A RateLimitedError stops the poll at once. Another error is kept and named in the timeout error, because a
 * public API can fail for one request and answer the next.
 */
export async function pollUntil<T>(
  label: string,
  read: () => Promise<T | null | undefined | false>,
  { timeoutMs = 180_000, intervalMs = 5_000 }: PollOptions = {},
): Promise<{ value: T; waitedMs: number }> {
  const start = Date.now();
  const interval = Math.max(intervalMs, MIN_GAP_MS);
  let lastError: unknown;
  for (;;) {
    try {
      const value = await read();
      if (value !== null && value !== undefined && value !== false) return { value, waitedMs: Date.now() - start };
    } catch (error) {
      if (isRateLimited(error)) throw error;
      lastError = error;
    }
    if (Date.now() - start + interval > timeoutMs) {
      const why = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
      throw new Error(`${label}: not true after ${Math.round(timeoutMs / 1000)} s.${why}`);
    }
    await sleep(interval);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// IDs and keys
// ---------------------------------------------------------------------------------------------------------------------

/** The 32 bytes of a CB58 ID (a tx, subnet, blockchain or validation ID). */
function cb58ToBytes(id: string): Uint8Array {
  return utils.base58check.decode(id);
}

function cb58ToHex(id: string): Hex {
  return `0x${Buffer.from(cb58ToBytes(id)).toString('hex')}`;
}

export function hexToCb58(hex: string): string {
  return utils.base58check.encode(Uint8Array.from(Buffer.from(hex.replace(/^0x/i, ''), 'hex')));
}

/** The 20 bytes of a NodeID-... string, as hex. The Validator Manager takes this form. */
function nodeIdToHex(nodeId: string): Hex {
  return cb58ToHex(nodeId.replace(/^NodeID-/, ''));
}

/** Accepts a validation ID as CB58 or as 0x hex, and returns hex. */
export function validationIdToHex(validationId: string): Hex {
  return /^0x[0-9a-f]{64}$/i.test(validationId) ? (validationId as Hex) : cb58ToHex(validationId);
}

/**
 * The validation ID of the validator at `index` of a ConvertSubnetToL1Tx: SHA-256 of the 32-byte subnet ID and the
 * index as a 4-byte big-endian integer (ACP-77; avalanchego ids.ID.Append).
 */
export function initialValidationId(subnetId: string, index: number): string {
  const indexBytes = Buffer.alloc(4);
  indexBytes.writeUInt32BE(index);
  const digest = createHash('sha256').update(cb58ToBytes(subnetId)).update(indexBytes).digest();
  return utils.base58check.encode(Uint8Array.from(digest));
}

/**
 * The test key, or undefined when neither variable is set. E2E_CHAIN_FUJI_KEY_FILE names a file that holds the key
 * and that only its owner can read (mode 0600 or 0400). It wins over E2E_CHAIN_FUJI_KEY, and it keeps the key out of
 * the environment that every child process inherits (the test workers, Chromium, npx). The errors name the variable,
 * never the value. Do not print, log or write the returned value.
 */
export function readFujiKeyIfSet(): Hex | undefined {
  const file = process.env.E2E_CHAIN_FUJI_KEY_FILE?.trim();
  let raw: string;
  if (file) {
    const mode = statSync(file).mode & 0o777;
    if (mode & 0o077) {
      throw new Error(`E2E_CHAIN_FUJI_KEY_FILE ${file} has mode ${mode.toString(8)}. Run: chmod 600 ${file}`);
    }
    raw = readFileSync(file, 'utf8').trim();
  } else {
    raw = process.env.E2E_CHAIN_FUJI_KEY?.trim() ?? '';
    if (!raw) return undefined;
  }
  const key = /^0x/i.test(raw) ? `0x${raw.slice(2)}` : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${file ? 'E2E_CHAIN_FUJI_KEY_FILE' : 'E2E_CHAIN_FUJI_KEY'} is not a 32-byte hex private key.`);
  }
  return key as Hex;
}

/** The test key (readFujiKeyIfSet). Throws when neither variable is set. */
export function readFujiKey(): Hex {
  const key = readFujiKeyIfSet();
  if (!key) {
    throw new Error(
      'Set E2E_CHAIN_FUJI_KEY_FILE (or E2E_CHAIN_FUJI_KEY) to the Fuji test key (README.md, "Console chain tests").',
    );
  }
  return key;
}

/** The C-Chain and P-Chain addresses of a key, on Fuji. */
export function keyAddresses(key: Hex): { c: Address; p: string } {
  const c = privateKeyToAccount(key).address;
  const publicKey = secp256k1.getPublicKey(Uint8Array.from(Buffer.from(key.slice(2), 'hex')));
  const p = utils.format('P', FUJI.hrp, secp256k1.publicKeyBytesToAddress(publicKey));
  return { c, p };
}

/** Throws unless the public endpoints answer for Fuji. Call it before a send. */
export async function assertFuji(): Promise<void> {
  const { networkID } = await jsonRpc<{ networkID: string }>(FUJI.infoRpc, 'info.getNetworkID', {});
  // Mainnet (network ID 1, C-Chain 43114) is the case this guards against; any other value is wrong too.
  if (Number(networkID) !== FUJI.networkId) {
    throw new Error(`Refusing to continue: the P-Chain network ID is ${networkID}, not Fuji (${FUJI.networkId}).`);
  }
  const chainId = Number(await jsonRpc<string>(FUJI.cRpc, 'eth_chainId', []));
  if (chainId !== FUJI.cChainId) {
    throw new Error(`Refusing to continue: the C-Chain ID is ${chainId}, not Fuji (${FUJI.cChainId}).`);
  }
}

/** Formats nAVAX (P-Chain) as AVAX with up to 9 decimals. */
export function formatNanoAvax(nano: bigint): string {
  const whole = nano / NANO_AVAX;
  const frac = (nano % NANO_AVAX).toString().padStart(9, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// P-Chain
// ---------------------------------------------------------------------------------------------------------------------

export interface POwner {
  threshold: number;
  addresses: string[];
}

export interface L1Validator {
  validationId: string;
  nodeId: string;
  subnetId: string;
  weight: bigint;
  /** nAVAX. 0 means inactive: the validator was disabled, or its balance ran out. */
  balance: bigint;
  startTime: bigint;
  minNonce: bigint;
  publicKey?: string;
  deactivationOwner: POwner;
  remainingBalanceOwner: POwner;
}

interface RawOwner {
  threshold: string;
  addresses: string[];
}

interface RawL1Validator {
  validationID: string;
  nodeID: string;
  subnetID?: string;
  weight: string;
  balance: string;
  startTime: string;
  minNonce: string;
  publicKey?: string;
  deactivationOwner: RawOwner;
  remainingBalanceOwner: RawOwner;
}

const owner = (raw: RawOwner): POwner => ({ threshold: Number(raw.threshold), addresses: raw.addresses });

function toL1Validator(raw: RawL1Validator, subnetId: string): L1Validator {
  return {
    validationId: raw.validationID,
    nodeId: raw.nodeID,
    subnetId: raw.subnetID ?? subnetId,
    weight: BigInt(raw.weight),
    balance: BigInt(raw.balance),
    startTime: BigInt(raw.startTime),
    minNonce: BigInt(raw.minNonce),
    publicKey: raw.publicKey,
    deactivationOwner: owner(raw.deactivationOwner),
    remainingBalanceOwner: owner(raw.remainingBalanceOwner),
  };
}

const notFound = (error: unknown) => error instanceof RpcError && /not found/i.test(error.message);

/** 'Committed', 'Processing', 'Dropped' or 'Unknown'. */
export async function pTxStatus(txId: string): Promise<{ status: string; reason?: string }> {
  return jsonRpc<{ status: string; reason?: string }>(FUJI.pRpc, 'platform.getTxStatus', { txID: txId });
}

/**
 * The public API is load-balanced, and its nodes accept a block at different times: right after a tx commits, a read
 * can reach a node that has not seen it yet (seen on 2026-10-04: getTxStatus said Committed, and the next getSubnet
 * still showed no conversion). So a check after a tx, on the P-Chain or the C-Chain, polls until a node shows the
 * result, for up to 90 s.
 */
export async function chainShows<T>(
  label: string,
  read: () => Promise<T | null | undefined | false>,
  timeoutMs = 90_000,
): Promise<T> {
  return (await pollUntil(label, read, { timeoutMs, intervalMs: 2_000 })).value;
}

/** Waits until a P-Chain tx is committed. Throws when the chain drops it. */
export async function waitForPTx(txId: string, options: PollOptions = {}): Promise<{ waitedMs: number }> {
  const { waitedMs } = await pollUntil(
    `P-Chain tx ${txId} committed`,
    async () => {
      const { status, reason } = await pTxStatus(txId);
      if (status === 'Dropped') throw new Error(`P-Chain tx ${txId} was dropped: ${reason ?? 'no reason given'}`);
      return status === 'Committed';
    },
    { timeoutMs: 180_000, intervalMs: 2_000, ...options },
  );
  return { waitedMs };
}

export interface PSubnet {
  isPermissioned: boolean;
  controlKeys: string[];
  threshold: string;
  /** The empty ID until the subnet is converted to an L1. */
  conversionID?: string;
  managerChainID?: string;
  managerAddress?: string;
}

/** platform.getSubnet, or null when the P-Chain does not know the subnet. Read past the API cache (freshParams). */
export async function pSubnet(subnetId: string): Promise<PSubnet | null> {
  try {
    return await jsonRpc<PSubnet>(FUJI.pRpc, 'platform.getSubnet', freshParams({ subnetID: subnetId }));
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/**
 * platform.getTx in JSON: the unsigned tx as the P-Chain decodes it. Read past the API cache (freshParams). A node that
 * has not seen the tx answers 'not found', so call it in a poll (chainShows) after a send.
 */
export async function pTxJson<T>(txId: string): Promise<T> {
  const { tx } = await jsonRpc<{ tx: { unsignedTx: T } }>(
    FUJI.pRpc,
    'platform.getTx',
    freshParams({ txID: txId, encoding: 'json' }),
  );
  return tx.unsignedTx;
}

/** True when the P-Chain shows the subnet converted to an L1. */
export async function pIsL1(subnetId: string): Promise<boolean> {
  const subnet = await pSubnet(subnetId);
  return !!subnet?.conversionID && subnet.conversionID !== FUJI.pBlockchainId;
}

/** platform.getL1Validator, or null when the P-Chain has no such validator (never added, or removed). */
export async function pL1Validator(validationId: string): Promise<L1Validator | null> {
  try {
    const raw = await jsonRpc<RawL1Validator>(
      FUJI.pRpc,
      'platform.getL1Validator',
      freshParams({ validationID: validationId }),
    );
    return toL1Validator({ ...raw, validationID: raw.validationID ?? validationId }, raw.subnetID ?? '');
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

// A new value for each read: see freshParams.
let freshRead = 0;

/**
 * The params with one more field that makes the request new to the public API's cache. The public Fuji API caches
 * platform.getCurrentValidators, platform.getSubnet and platform.getTx by their params for about 3 min (response header
 * x-cache: HIT; request headers such as Cache-Control do not stop it; measured 2026-10-05). So a read right after a tx
 * can get the answer from before it, also when a page made the first read. The node ignores a param that it does not
 * know (checked on Fuji for these three methods), and a new value of that param makes each request new. The wallet
 * signer uses it for its owner lookups too.
 */
export function freshParams<T extends object>(params: T): T & { e2eRead: string } {
  return { ...params, e2eRead: `${process.pid}-${Date.now()}-${++freshRead}` };
}

/** platform.getCurrentValidators, read past the cache of the public API (freshParams). */
export async function pCurrentValidators<T>(params: { subnetID?: string; nodeIDs?: readonly string[] }): Promise<T[]> {
  const { validators } = await jsonRpc<{ validators?: T[] }>(
    FUJI.pRpc,
    'platform.getCurrentValidators',
    freshParams(params),
  );
  return validators ?? [];
}

/** The nAVAX that the address has staked on the P-Chain (platform.getStake): validator and delegator stakes. */
export async function pStaked(address: string): Promise<bigint> {
  const { staked } = await jsonRpc<{ staked?: string }>(FUJI.pRpc, 'platform.getStake', { addresses: [address] });
  return BigInt(staked ?? '0');
}

/** The L1 validators of a subnet (platform.getCurrentValidators), active and inactive. */
export async function pL1Validators(subnetId: string): Promise<L1Validator[]> {
  const validators = await pCurrentValidators<Partial<RawL1Validator>>({ subnetID: subnetId });
  return validators
    .filter((v): v is RawL1Validator => typeof v.validationID === 'string' && v.deactivationOwner !== undefined)
    .map((v) => toL1Validator(v, subnetId));
}

/** The unlocked P-Chain balance of an address, in nAVAX. */
export async function pBalance(address: string): Promise<bigint> {
  const result = await jsonRpc<{ unlocked?: string; balance: string }>(FUJI.pRpc, 'platform.getBalance', {
    addresses: [address],
  });
  return BigInt(result.unlocked ?? result.balance);
}

// ---------------------------------------------------------------------------------------------------------------------
// C-Chain and the Validator Manager
// ---------------------------------------------------------------------------------------------------------------------

/** viem client for the Fuji C-Chain. Its requests share the slot and the 429 stop above, and viem does not retry. */
const cClient = createPublicClient({
  chain: avalancheFuji,
  transport: custom({ request: ({ method, params }) => jsonRpc(FUJI.cRpc, method, params ?? []) }, { retryCount: 0 }),
  pollingInterval: 2_000,
});

/** The C-Chain balance of an address, in wei. */
export async function cBalance(address: Address): Promise<bigint> {
  return cClient.getBalance({ address });
}

/** True when the address holds contract code (a deploy landed). */
export async function cHasCode(address: Address): Promise<boolean> {
  const code = await cClient.getCode({ address });
  return !!code && code !== '0x';
}

/** The receipt of a C-Chain tx, or null while it is not mined. */
async function cReceipt(hash: Hex): Promise<TransactionReceipt | null> {
  try {
    return await cClient.getTransactionReceipt({ hash });
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionReceiptNotFoundError') return null;
    throw error;
  }
}

/** Waits for a C-Chain tx. Throws when it reverted. */
export async function waitForCTx(hash: Hex, options: PollOptions = {}): Promise<TransactionReceipt> {
  const { value: receipt } = await pollUntil(`C-Chain tx ${hash} mined`, () => cReceipt(hash), {
    timeoutMs: 180_000,
    intervalMs: 2_000,
    ...options,
  });
  if (receipt.status !== 'success') throw new Error(`C-Chain tx ${hash} reverted (block ${receipt.blockNumber}).`);
  return receipt;
}

/**
 * The parts of the ValidatorManager ABI that the tests read: views and events. Copied from the ABI that the Console
 * uses (contracts/icm-contracts/compiled/ValidatorManager.json), so the tests read no repo file.
 */
export const VALIDATOR_MANAGER_ABI = [
  {
    type: 'function',
    name: 'isValidatorSetInitialized',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'l1TotalWeight',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
  { type: 'function', name: 'subnetID', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  {
    type: 'function',
    name: 'getNodeValidationID',
    stateMutability: 'view',
    inputs: [{ name: 'nodeID', type: 'bytes' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getValidator',
    stateMutability: 'view',
    inputs: [{ name: 'validationID', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'status', type: 'uint8' },
          { name: 'nodeID', type: 'bytes' },
          { name: 'startingWeight', type: 'uint64' },
          { name: 'sentNonce', type: 'uint64' },
          { name: 'receivedNonce', type: 'uint64' },
          { name: 'weight', type: 'uint64' },
          { name: 'startTime', type: 'uint64' },
          { name: 'endTime', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'RegisteredInitialValidator',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'nodeID', type: 'bytes20', indexed: true },
      { name: 'subnetID', type: 'bytes32', indexed: true },
      { name: 'weight', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'InitiatedValidatorRegistration',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'nodeID', type: 'bytes20', indexed: true },
      { name: 'registrationMessageID', type: 'bytes32', indexed: false },
      { name: 'registrationExpiry', type: 'uint64', indexed: false },
      { name: 'weight', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CompletedValidatorRegistration',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'weight', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'InitiatedValidatorWeightUpdate',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'nonce', type: 'uint64', indexed: false },
      { name: 'weightUpdateMessageID', type: 'bytes32', indexed: false },
      { name: 'weight', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CompletedValidatorWeightUpdate',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'nonce', type: 'uint64', indexed: false },
      { name: 'weight', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'InitiatedValidatorRemoval',
    inputs: [
      { name: 'validationID', type: 'bytes32', indexed: true },
      { name: 'validatorWeightMessageID', type: 'bytes32', indexed: false },
      { name: 'weight', type: 'uint64', indexed: false },
      { name: 'endTime', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CompletedValidatorRemoval',
    inputs: [{ name: 'validationID', type: 'bytes32', indexed: true }],
  },
] as const;

/** enum ValidatorStatus of the ValidatorManager contract. */
export const ValidatorStatus = {
  Unknown: 0,
  PendingAdded: 1,
  Active: 2,
  PendingRemoved: 3,
  Completed: 4,
  Invalidated: 5,
} as const;

export interface ManagerValidator {
  status: number;
  nodeId: Hex;
  startingWeight: bigint;
  sentNonce: bigint;
  receivedNonce: bigint;
  weight: bigint;
  startTime: bigint;
  endTime: bigint;
}

const read = <T>(manager: Address, functionName: string, args: readonly unknown[] = []): Promise<T> =>
  cClient.readContract({
    address: getAddress(manager),
    abi: VALIDATOR_MANAGER_ABI,
    functionName,
    args,
  } as never) as Promise<T>;

/** True after Initialize Validator Set landed on this manager. */
export async function managerIsValidatorSetInitialized(manager: Address): Promise<boolean> {
  return read<boolean>(manager, 'isValidatorSetInitialized');
}

/** The manager's record of a validator. A validation ID that it does not know reads as status Unknown (0). */
export async function managerValidator(manager: Address, validationId: string): Promise<ManagerValidator> {
  const v = await read<{
    status: number;
    nodeID: Hex;
    startingWeight: bigint;
    sentNonce: bigint;
    receivedNonce: bigint;
    weight: bigint;
    startTime: bigint;
    endTime: bigint;
  }>(manager, 'getValidator', [validationIdToHex(validationId)]);
  return {
    status: Number(v.status),
    nodeId: v.nodeID,
    startingWeight: v.startingWeight,
    sentNonce: v.sentNonce,
    receivedNonce: v.receivedNonce,
    weight: v.weight,
    startTime: v.startTime,
    endTime: v.endTime,
  };
}

/** The validation ID (hex) that the manager holds for a node, or the zero hash. Takes NodeID-... or hex. */
export async function managerNodeValidationId(manager: Address, nodeId: string): Promise<Hex> {
  return read<Hex>(manager, 'getNodeValidationID', [nodeId.startsWith('0x') ? nodeId : nodeIdToHex(nodeId)]);
}

export async function managerTotalWeight(manager: Address): Promise<bigint> {
  return read<bigint>(manager, 'l1TotalWeight');
}

/** The subnet ID that the manager was initialized with, as CB58 (the empty ID before Initialize). */
export async function managerSubnetId(manager: Address): Promise<string> {
  return hexToCb58(await read<Hex>(manager, 'subnetID'));
}

/** The PoA owner of the manager (the zero address before Initialize). */
export async function managerOwner(manager: Address): Promise<Address> {
  return getAddress(await read<Address>(manager, 'owner'));
}

/** EIP-1967 storage slots of a TransparentUpgradeableProxy. */
export const EIP1967 = {
  implementation: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  admin: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
} as const;

/** The address that a storage slot holds (the low 20 bytes of the word), checksummed. */
export async function cSlotAddress(address: Address, slot: Hex): Promise<Address> {
  const word = (await cClient.getStorageAt({ address, slot })) ?? '0x';
  return getAddress(`0x${word.replace(/^0x/, '').padStart(64, '0').slice(24)}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Glacier (the Data API). The Console reads the same records, so a test waits for them before the step that needs them.
// ---------------------------------------------------------------------------------------------------------------------

export interface GlacierSubnet {
  subnetId: string;
  isL1: boolean;
  ownerAddresses?: string[];
  threshold?: number;
  l1ConversionTransactionHash?: string;
  l1ValidatorManagerDetails?: { blockchainId: string; contractAddress: string };
}

export interface GlacierL1Validator {
  validationId: string;
  validationIdHex: string;
  nodeId: string;
  subnetId: string;
  weight: number;
  remainingBalance: number;
  creationTimestamp: number;
}

/** Glacier's record of a subnet, or null while Glacier does not know it. */
async function glacierSubnet(subnetId: string): Promise<GlacierSubnet | null> {
  return glacierGet<GlacierSubnet>(`/subnets/${subnetId}`);
}

/** The L1 validators that Glacier lists for a subnet. The Console's Disable and Top-up tools read this list. */
export async function glacierL1Validators(
  subnetId: string,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<GlacierL1Validator[]> {
  const all: GlacierL1Validator[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      subnetId,
      pageSize: '100',
      includeInactiveL1Validators: String(includeInactive),
    });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await glacierGet<{ validators: GlacierL1Validator[]; nextPageToken?: string }>(
      `/l1Validators?${query}`,
    );
    all.push(...(page?.validators ?? []));
    pageToken = page?.nextPageToken;
  } while (pageToken);
  return all;
}

export interface GlacierSubnetWait extends PollOptions {
  /** Wait until Glacier shows the subnet as an L1 with a Validator Manager (after Convert). */
  converted?: boolean;
}

/**
 * Waits until Glacier knows the subnet (and the given state of it). Polls every 5 s for up to 15 min by default.
 * Returns the record and the lag, which a test can write to the ledger.
 */
export async function waitForGlacierSubnet(
  subnetId: string,
  { converted = false, ...options }: GlacierSubnetWait = {},
): Promise<{ subnet: GlacierSubnet; waitedMs: number }> {
  const { value, waitedMs } = await pollUntil(
    `Glacier lists subnet ${subnetId}${converted ? ' as an L1' : ''}`,
    async () => {
      const subnet = await glacierSubnet(subnetId);
      if (!subnet) return null;
      if (converted && !(subnet.isL1 && subnet.l1ValidatorManagerDetails)) return null;
      return subnet;
    },
    { timeoutMs: 15 * 60_000, intervalMs: 5_000, ...options },
  );
  return { subnet: value, waitedMs };
}
