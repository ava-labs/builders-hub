import { createHash } from 'node:crypto';
import {
  Credential,
  evmSerial,
  Input,
  NodeId,
  OutputOwners,
  pvmSerial,
  secp256k1,
  Signature,
  utils,
  type avaxSerial,
  type Common,
  type TransferableInput,
  type TransferableOutput,
} from '@avalabs/avalanchejs';
import { getAddress, keccak256, type AccessList, type Hex, type TransactionSerializable } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  FUJI,
  formatNanoAvax,
  freshParams,
  isRateLimited,
  NANO_AVAX,
  readFujiKey,
  RpcError,
  throttledFetch,
} from '../lib/chain.ts';
import { decodeTx, readSignedTx, signedTxBytes } from './codec.ts';

// The Node half of the e2e Core wallet. The page holds a provider with no key (provider.ts); it posts each request
// to /__e2e/wallet, and bridge.ts answers it with `handle`. The key exists only in this module. Nothing here prints
// it, returns it or puts it in an error.
//
// One key signs for the EVM (C-Chain and L1s) and for the P-Chain, as a Core account made from one private key.
//
// The wallet approves each request with no prompt, and any script on the Console page can send it requests. So it
// signs only what the tests need, and refuses the rest with 4001 and the reason. Each refusal also goes into
// `signer.refusals`, which the sends audit reads (chain/lib/audit.ts).
// - Chains: an allowlist. The Fuji C-Chain (43113), the Fuji P-Chain (network ID 5), and each EVM chain that test
//   code registers with allowChain(). wallet_addEthereumChain for any other chain ID is refused. Each request goes
//   to Fuji or to a registered RPC URL, never to a URL from the page.
// - EVM txs: no value, and gas x max fee at most 0.002 AVAX per tx and 0.01 AVAX per Signer. No personal_sign or
//   eth_signTypedData_v4.
// - P-Chain txs: the 7 types of tier 1 (P_TX_TYPES). Each output is change to this wallet's P-Chain address.
//   The AVAX that leaves the wallet is the fee (at most 0.01 AVAX) and a validator balance in the tx's own field
//   (at most 0.05 AVAX), and that validator's remaining balance comes back to this wallet. The P-Chain txs of one
//   Signer spend at most 0.2 AVAX in total.
// - Capabilities. Each is off by default. A test turns one on for its own Signer, and revokeAll() turns them off:
//   - allowPrimaryStake(nodeId): a Primary Network stake for that one NodeID, of at most 1 AVAX per Signer. A fixed
//     validator (AddPermissionlessValidatorTx) that ends at most 13 h from now, or an auto-renewed validator (ACP-236
//     AddAutoRenewedValidatorTx) with a cycle of at most 13 h. Then SetAutoRenewedValidatorConfigTx for the
//     auto-renewed validator that this Signer added, or adopted (adoptAutoRenewedValidator: an add of an earlier run
//     that passes the same add rule). Every stake output, reward owner and authority is this wallet alone, with no
//     lock.
//   - allowBridge(): atomic txs between this wallet's own C-Chain and P-Chain addresses (ExportTx and ImportTx on
//     each chain). At most 0.05 AVAX and a fee of 0.001 AVAX per tx, and per Signer 6 atomic txs and 0.1 AVAX
//     exported. The C-Chain ones go to the Fuji C-Chain's avax.issueTx only.
//
// - A test can make the wallet answer a request as a user who clicks Reject in Core: rejectNext(method). The answer
//   is 4001 'User rejected the request.', before the wallet signs or sends anything. It goes into `userRejections`,
//   not into `refusals`: it is the test's own act, not a policy refusal. rejectNext(method, { times: Infinity })
//   rejects each request of the method until cancel(): a safety net for a check that the page sends nothing.
//
// Each request goes through chain.ts throttledFetch: one slot every 500 ms per process, and a stop at the first 429.
//
// Ported from the Playwright shim (git show 6a1461e3a:e2e/wallet-shim/core-shim.ts), with these fixes:
// - eth_sendTransaction keeps accessList, type and gas (the Warp deliveries need the accessList).
// - Each chain has a nonce lock: nonce = max(the page's nonce, the pending count, the last nonce sent + 1).
// - A tx that needs subnet auth or disable auth fails when the owner lookup fails or the auth does not point at
//   this wallet. The shim sent a zeroed signature instead.
// - DisableL1ValidatorTx auth comes from platform.getL1Validator (the deactivation owner).
// - Added chains stay in Node, so a reload or a new page keeps the fresh L1.

const MAINNET_C_CHAIN_ID = 43114;

// The P-Chain tx types that tier 1 sends. BaseTx moves AVAX to any address, so the wallet refuses it, and every type
// that no capability turns on.
const P_TX_TYPES = [
  'pvm.CreateSubnetTx',
  'pvm.CreateChainTx',
  'pvm.ConvertSubnetToL1Tx',
  'pvm.RegisterL1ValidatorTx',
  'pvm.SetL1ValidatorWeightTx',
  'pvm.IncreaseL1ValidatorBalanceTx',
  'pvm.DisableL1ValidatorTx',
];
// allowPrimaryStake. avalanchejs names AddPermissionlessValidatorTx 'pvm.AddPermissionlessValidator'.
const STAKE_TX_TYPES = [
  'pvm.AddPermissionlessValidator',
  'pvm.AddAutoRenewedValidatorTx',
  'pvm.SetAutoRenewedValidatorConfigTx',
];
// allowBridge.
const P_BRIDGE_TX_TYPES = ['pvm.ExportTx', 'pvm.ImportTx'];
const C_BRIDGE_TX_TYPES = ['evm.ExportTx', 'evm.ImportTx'];

// Caps, in nAVAX for the P-Chain and the atomic txs, and in wei for the EVM. A tier 1 run measured on 2026-10-04:
// P-Chain fees of 5,139 to 55,662 nAVAX, validator balances of 0.02, 0.02 and 0.01 AVAX, and EVM gas x max fee below
// 1e-9 AVAX. The key's earlier atomic txs: a P-Chain ExportTx fee of 16,352 nAVAX and an ImportTx fee of 8,270.
const P_FEE_CAP = NANO_AVAX / 100n; // 0.01 AVAX per tx
const P_BALANCE_CAP = NANO_AVAX / 20n; // 0.05 AVAX per tx
const P_SPEND_CAP = NANO_AVAX / 5n; // 0.2 AVAX per Signer: fees and validator balances
const P_STAKE_CAP = NANO_AVAX; // 1 AVAX per Signer: the Primary Network stakes
const EVM_FEE_CAP = 2_000_000_000_000_000n; // 0.002 AVAX per tx
const EVM_SPEND_CAP = 10_000_000_000_000_000n; // 0.01 AVAX per Signer: the sum of gas x max fee
const ATOMIC_FEE_CAP = NANO_AVAX / 1_000n; // 0.001 AVAX per atomic tx
const ATOMIC_AMOUNT_CAP = NANO_AVAX / 20n; // 0.05 AVAX exported or imported per tx
const EVM_EXPORT_INPUT_CAP = (51n * NANO_AVAX) / 1_000n; // 0.051 AVAX: the export and its fee
const ATOMIC_COUNT_CAP = 6; // per Signer: a round trip (4) and 2 imports of stranded UTXOs
const ATOMIC_EXPORT_CAP = NANO_AVAX / 10n; // 0.1 AVAX exported per Signer

// ACP-236 limits that the wallet adds to the P-Chain's own. The P-Chain takes a cycle of 12 h or more.
const STAKE_PERIOD_MIN = 43_200n; // 12 h
const STAKE_PERIOD_MAX = 46_800n; // 13 h: a stake locks the AVAX for one cycle
const AUTO_COMPOUND_MAX = 1_000_000; // 100 %

/** The caps per Signer, in the units of `totals()`. chain/lib/audit.ts checks the totals against them. */
export const SIGNER_CAPS = {
  pSpent: P_SPEND_CAP,
  pStaked: P_STAKE_CAP,
  evmReserved: EVM_SPEND_CAP,
  atomicCount: ATOMIC_COUNT_CAP,
  atomicExported: ATOMIC_EXPORT_CAP,
} as const;

// EIP-1193 and JSON-RPC error codes the wallet returns.
export const ERR = {
  userRejected: 4001,
  unauthorized: 4100,
  unsupported: 4200,
  unknownChain: 4902,
  invalidParams: -32602,
  internal: -32603,
  limitExceeded: -32005,
} as const;

export interface WalletRequest {
  method: string;
  params?: unknown;
}

interface WalletChain {
  chainId: number;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  isTestnet: true;
}

// One tx the wallet sent. A test reads `signer.sends` to check the chain after a Console step.
export interface WalletSend {
  // 'atomic' is a C-Chain atomic tx (avax.issueTx). A P-Chain ExportTx or ImportTx is 'p-chain'.
  kind: 'evm' | 'p-chain' | 'atomic';
  // The EVM chain ID, for kind 'evm'.
  chainId?: number;
  // The chain alias of an atomic tx: 'C'.
  chainAlias?: 'C';
  // 'eth_sendTransaction', or the avalanchejs type of the tx (for example 'pvm.CreateSubnetTx', 'evm.ExportTx').
  txType: string;
  // The EVM tx hash, or the P-Chain or atomic tx ID (cb58).
  hash: string;
  // The EVM nonce, for kind 'evm'.
  nonce?: number;
  at: string;
}

// An AddAutoRenewedValidatorTx of an earlier run that this Signer adopted (adoptAutoRenewedValidator). The Signer did
// not send it, so it is not in `sends`; the sends audit reads this list for the ledger's add step.
export interface WalletAdoption {
  txType: 'pvm.AddAutoRenewedValidatorTx';
  // The tx ID (cb58).
  hash: string;
  nodeId: string;
  // nAVAX that the tx stakes. It counts to the stake cap of this Signer.
  staked: bigint;
  at: string;
}

// One request the wallet refused. It never holds the key or a full tx hex.
export interface WalletRefusal {
  at: string;
  // The wallet method, for example 'avalanche_sendTransaction'.
  method: string;
  // The tx type, when the request was a tx.
  txType?: string;
  reason: string;
}

// One request that the test made the wallet reject (rejectNext).
export interface WalletUserRejection {
  at: string;
  method: string;
}

// The handle of one rejectNext call.
export interface RejectNextHandle {
  // The number of requests of the method that this rejection answered.
  readonly used: number;
  // Drops the rejection, also when it has rejections left. A request after cancel() goes on as usual.
  cancel(): void;
}

export interface RejectNextOptions {
  // How many requests of the method to reject: a whole number from 1, or Infinity for each request until cancel().
  // Default 1.
  times?: number;
}

// The message of a user rejection, as Core and other EIP-1193 wallets send it. viem maps code 4001 to
// UserRejectedRequestError, and the Console's error parsers look for 'User rejected'.
export const USER_REJECTED_MESSAGE = 'User rejected the request.';

// What the txs of one Signer took from the wallet. SIGNER_CAPS holds the cap of each.
export interface SignerTotals {
  // nAVAX: P-Chain fees and L1 validator balances.
  pSpent: bigint;
  // nAVAX: Primary Network stakes.
  pStaked: bigint;
  // wei: the sum of gas x max fee of the EVM txs (the most they can burn).
  evmReserved: bigint;
  // Atomic txs on either chain.
  atomicCount: number;
  // nAVAX exported to the other chain. The wallet still owns it.
  atomicExported: bigint;
}

export interface SignedPChainTx {
  // Hex of the signed tx with its checksum, as platform.issueTx takes it.
  signedTxHex: Hex;
  // The tx ID (cb58) the node gives this tx.
  txId: string;
  // The avalanchejs type, for example 'pvm.ConvertSubnetToL1Tx'.
  txType: string;
  // The signature indices of each credential, in credential order.
  credentials: number[][];
  // The nAVAX that counts to the P-Chain spend cap: the fee and a validator balance.
  spent: bigint;
  // The nAVAX that a Primary Network stake locks. It comes back at the end of the stake.
  staked: bigint;
  // The nAVAX that a P-Chain ExportTx sends to the C-Chain. The wallet still owns it.
  exported: bigint;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface SignerOptions {
  // 0x-prefixed or bare 32-byte hex. Never logged.
  privateKey: string;
  // Each network call of the signer goes through this. Default: chain.ts throttledFetch. The self-test swaps it.
  fetch?: Fetch;
  // Each send and each refused request, one line each. Default: console.log with a '[e2e wallet]' prefix.
  log?: (line: string) => void;
  // How often an owner lookup (platform.getSubnet, platform.getL1Validator) asks again when the node does not know
  // the subnet or validator yet. A tx right after Create Subnet can reach a node that has not seen the subnet.
  lookupAttempts?: number;
  lookupDelayMs?: number;
}

// The request that a refusal belongs to.
interface RequestContext {
  method: string;
  txType?: string;
}

type Lock = <T>(work: () => Promise<T>) => Promise<T>;

// Runs work one at a time, in call order. A failed work item does not block the next one.
function createLock(): Lock {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work);
    tail = run.catch(() => undefined);
    return run;
  };
}

interface ChainState {
  chain: WalletChain;
  lock: Lock;
  // The last nonce the node took from this wallet, and when. The public API is load-balanced, so the pending count
  // can lag a tx sent a moment ago; within NONCE_MEMORY_MS the wallet trusts its own count.
  lastNonce?: { nonce: number; at: number };
}

const NONCE_MEMORY_MS = 120_000;

const FUJI_C: WalletChain = {
  chainId: FUJI.cChainId,
  chainName: 'Avalanche Fuji C-Chain',
  rpcUrls: [FUJI.cRpc],
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  isTestnet: true,
};

const SEND_XP = 'avalanche_sendTransaction';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}

function toHexChainId(id: number): Hex {
  return `0x${id.toString(16)}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// wei as AVAX, for a message.
function formatWeiAvax(wei: bigint): string {
  return formatNanoAvax(wei / NANO_AVAX);
}

// A hex quantity or a number from the page, as a bigint. Undefined stays undefined.
function quantity(value: unknown, field: string): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) return BigInt(value);
  throw new RpcError(ERR.invalidParams, `[e2e wallet] ${field} is not a quantity: ${String(value)}`);
}

function parseChainId(value: unknown): number {
  const id = quantity(value, 'chainId');
  if (id === undefined || id <= 0n || id > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RpcError(ERR.invalidParams, `[e2e wallet] invalid chainId: ${String(value)}`);
  }
  return Number(id);
}

function firstParam(params: unknown): Record<string, unknown> {
  const first = Array.isArray(params) ? params[0] : params;
  if (!first || typeof first !== 'object') throw new RpcError(ERR.invalidParams, '[e2e wallet] missing params[0]');
  return first as Record<string, unknown>;
}

// 'P-fuji1abc' and 'fuji1abc' are the same P-Chain address.
function bareXPAddress(address: string): string {
  return address.replace(/^[PXC]-/, '').toLowerCase();
}

function pAddress(bytes: Uint8Array): string {
  return utils.format('P', FUJI.hrp, bytes);
}

// The bytes of avalanchejs Address values.
function bytesOf(addresses: { toBytes(): Uint8Array }[]): Uint8Array[] {
  return addresses.map((address) => address.toBytes());
}

// The type of a C-Chain atomic tx, for a refusal. Undefined when the hex does not decode.
function cChainTxType(transactionHex: string): string | undefined {
  try {
    return utils.getManagerForVM('EVM').unpackTransaction(utils.hexToBuffer(transactionHex))._type;
  } catch {
    return undefined;
  }
}

// The nAVAX that a P-Chain tx puts into validator balances, from the tx's own fields.
function validatorBalance(tx: Common.Transaction): bigint {
  if (pvmSerial.isConvertSubnetToL1Tx(tx)) return tx.validators.reduce((sum, v) => sum + v.balance.value(), 0n);
  if (pvmSerial.isRegisterL1ValidatorTx(tx) || pvmSerial.isIncreaseL1ValidatorBalanceTx(tx)) return tx.balance.value();
  return 0n;
}

function sumInputs(inputs: readonly TransferableInput[]): bigint {
  return inputs.reduce((sum, input) => sum + input.amount(), 0n);
}

function sumOutputs(outputs: readonly TransferableOutput[]): bigint {
  return outputs.reduce((sum, out) => sum + out.amount(), 0n);
}

interface Owner {
  threshold: number;
  addresses: Uint8Array[];
}

// A cursor over big-endian bytes. Each read past the end throws.
function reader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  const take = (n: number) => {
    if (at + n > bytes.length) throw new Error('the message is too short');
    at += n;
    return bytes.subarray(at - n, at);
  };
  const u32 = () => view.getUint32(take(4).byteOffset - bytes.byteOffset);
  return {
    take,
    u32,
    varBytes: () => take(u32()),
    owner: (): Owner => {
      const threshold = u32();
      const count = u32();
      return { threshold, addresses: Array.from({ length: count }, () => take(20)) };
    },
  };
}

// The owners in the RegisterL1ValidatorMessage of a RegisterL1ValidatorTx (ACP-77). The tx holds the signed Warp
// message: codec version (2 bytes), network ID (4), source chain ID (32), and the payload (a 4-byte length, then the
// bytes). The payload is an AddressedCall: codec version (2), type ID 1 (4), the source address and the inner payload
// (each a 4-byte length, then the bytes). The inner payload is the message: codec version (2), type ID 1 (4), subnet
// ID (32), node ID (4-byte length, then the bytes), BLS public key (48), expiry (8), the remaining balance owner and
// the disable owner (each a threshold (4), an address count (4) and 20 bytes per address), and the weight (8).
function registrationOwners(signedMessage: Uint8Array): { remainingBalance: Owner; disable: Owner } {
  const warp = reader(signedMessage);
  warp.take(2 + 4 + 32);
  const call = reader(warp.varBytes());
  call.take(2);
  if (call.u32() !== 1) throw new Error('the Warp payload is not an AddressedCall');
  call.varBytes();
  const message = reader(call.varBytes());
  message.take(2);
  if (message.u32() !== 1) throw new Error('the AddressedCall does not hold a RegisterL1ValidatorMessage');
  message.take(32);
  message.varBytes();
  message.take(48 + 8);
  return { remainingBalance: message.owner(), disable: message.owner() };
}

// The NodeID in its canonical form. Throws for a value that is not 'NodeID-' and 20 bytes in CB58 with a checksum.
function canonicalNodeId(nodeId: string): string {
  if (!/^NodeID-[1-9A-HJ-NP-Za-km-z]+$/.test(nodeId)) throw new Error(`${nodeId} is not a NodeID`);
  const bytes = utils.base58check.decode(nodeId.slice('NodeID-'.length));
  if (bytes.length !== 20) throw new Error(`${nodeId} has ${bytes.length} bytes, not 20`);
  return new NodeId(bytes).toString();
}

export class Signer {
  // The EVM address, checksummed.
  readonly address: Hex;
  // The P-Chain address, 'P-fuji1...'.
  readonly pChainAddress: string;
  // The compressed secp256k1 public key (33 bytes, 0x hex). avalanche_getAccountPubKey returns it for evm and xp.
  readonly publicKey: Hex;
  // Every tx the wallet sent, in order.
  readonly sends: WalletSend[] = [];
  // Every request the wallet refused, in order: the policy refusals, the unsupported methods, and (bridge.ts) the
  // requests from another origin.
  readonly refusals: WalletRefusal[] = [];
  // The auto-renewed validators of earlier runs that this Signer adopted, in order.
  readonly adopted: WalletAdoption[] = [];
  // The requests that the test made the wallet reject (rejectNext), in order.
  readonly userRejections: WalletUserRejection[] = [];

  #key: Uint8Array;
  // The 20 bytes of the P-Chain address. The C-Chain atomic address (C-fuji1...) has the same bytes.
  #pAddressBytes: Uint8Array;
  // The 20 bytes of the EVM address.
  #evmAddressBytes: Uint8Array;
  #account: PrivateKeyAccount;
  #chains = new Map<number, ChainState>();
  // The EVM chains that test code lets the page add, with the RPC URL the wallet uses for each.
  #allowed = new Map<number, string>();
  #currentChainId: number = FUJI.cChainId;
  #pChainLock = createLock();
  // The capabilities: the NodeID that allowPrimaryStake registered, and allowBridge.
  #stakeNodeId: string | undefined;
  #bridge = false;
  // The tx IDs of the AddAutoRenewedValidatorTx that this Signer sent or adopted. SetAutoRenewedValidatorConfigTx may
  // name these.
  #ownAutoRenewed = new Set<string>();
  // The totals of this Signer (SignerTotals).
  #pSpent = 0n;
  #pStaked = 0n;
  #evmReserved = 0n;
  #atomicCount = 0;
  #atomicExported = 0n;
  // The rejections that rejectNext armed and that have rejections left, in call order.
  #pendingRejections: { method: string; left: number; used: number }[] = [];
  #fetch: Fetch;
  #log: (line: string) => void;
  #lookupAttempts: number;
  #lookupDelayMs: number;
  #rpcId = 1;

  constructor(options: SignerOptions) {
    const hex = options.privateKey.trim().replace(/^0x/i, '');
    // The message never quotes the value.
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('the private key is not 32 bytes of hex');
    this.#key = Uint8Array.from(Buffer.from(hex, 'hex'));
    this.#account = privateKeyToAccount(utils.bufferToHex(this.#key) as Hex);
    this.address = getAddress(this.#account.address);
    this.#evmAddressBytes = utils.hexToBuffer(this.address);
    const compressed = secp256k1.getPublicKey(this.#key);
    this.publicKey = utils.bufferToHex(compressed) as Hex;
    this.#pAddressBytes = secp256k1.publicKeyBytesToAddress(compressed);
    this.pChainAddress = pAddress(this.#pAddressBytes);
    this.#fetch = options.fetch ?? throttledFetch;
    this.#log = options.log ?? ((line) => console.log(`[e2e wallet] ${line}`));
    this.#lookupAttempts = Math.max(1, options.lookupAttempts ?? 6);
    this.#lookupDelayMs = options.lookupDelayMs ?? 2_500;
    this.#chains.set(FUJI.cChainId, { chain: FUJI_C, lock: createLock() });
  }

  // The chain the wallet is on, as the provider reports it.
  get chainId(): number {
    return this.#currentChainId;
  }

  get chainIdHex(): Hex {
    return toHexChainId(this.#currentChainId);
  }

  // Lets the page add an EVM chain with wallet_addEthereumChain, for example the fresh L1 of a test. The wallet then
  // sends that chain's requests to `rpcUrl`, not to the URLs that the page gives.
  allowChain(chainId: number, rpcUrl: string): void {
    if (chainId === MAINNET_C_CHAIN_ID) throw new Error(`allowChain: ${MAINNET_C_CHAIN_ID} is the mainnet C-Chain`);
    this.#allowed.set(chainId, rpcUrl);
  }

  // Lets the page stake on the Primary Network for one NodeID: a mock validator from chain/lib/mock-validator.ts.
  // One NodeID per Signer until revokeAll(). The stake cap (1 AVAX per Signer) still holds after a revoke.
  allowPrimaryStake(nodeId: string): void {
    const canonical = canonicalNodeId(nodeId);
    if (this.#stakeNodeId && this.#stakeNodeId !== canonical) {
      throw new Error(`allowPrimaryStake: this signer already allows ${this.#stakeNodeId}; one NodeID per signer`);
    }
    this.#stakeNodeId = canonical;
    this.#log(`allowed Primary Network stakes for ${canonical}`);
  }

  // Adopts the auto-renewed validator that an earlier run of this key added, so that SetAutoRenewedValidatorConfigTx
  // may name it. A weekly run that stopped after the add can then finish the config steps, and stop the renewal,
  // with the same Console tool. Needs allowPrimaryStake for the validator's NodeID first. The P-Chain must hold the
  // tx as committed (platform.getTxStatus), the bytes from platform.getTx must hash to the tx ID, and the tx must pass
  // the rule of a new add: the registered NodeID, a stake and every owner of this wallet alone, at most 1 AVAX, a
  // cycle of at most 13 h. Its stake counts to the stake cap, so the Signer refuses a second stake. It signs and
  // issues nothing.
  async adoptAutoRenewedValidator(txId: string): Promise<void> {
    const txType = 'pvm.AddAutoRenewedValidatorTx';
    const context = { method: 'adoptAutoRenewedValidator', txType };
    if (!this.#stakeNodeId) throw this.#refuse(context, `to adopt ${txId}: allowPrimaryStake was not called`);
    if (this.#ownAutoRenewed.has(txId)) return;
    const { status } = await this.#lookup<{ status?: string }>('platform.getTxStatus', { txID: txId }, `tx ${txId}`);
    if (status !== 'Committed') throw this.#refuse(context, `to adopt ${txId}: its status is ${status}, not Committed`);
    const { tx: hex } = await this.#lookup<{ tx?: string }>(
      'platform.getTx',
      { txID: txId, encoding: 'hex' },
      `tx ${txId}`,
    );
    let tx: Common.Transaction;
    try {
      const bytes = utils.hexToBuffer(String(hex));
      const body = bytes.subarray(0, -4);
      if (!utils.bytesEqual(sha256(body).slice(-4), bytes.slice(-4))) throw new Error('bad checksum');
      if (utils.base58check.encode(sha256(body)) !== txId) throw new Error('the bytes do not hash to the tx ID');
      tx = readSignedTx('PVM', body).tx;
    } catch (err) {
      throw new RpcError(
        ERR.invalidParams,
        `[e2e wallet] cannot read ${txId} from platform.getTx: ${errorMessage(err)}`,
      );
    }
    if (!pvmSerial.isAddAutoRenewedValidatorTx(tx))
      throw this.#refuse(context, `to adopt ${txId}: it is a ${tx._type}`);
    const { baseTx } = tx;
    if (baseTx.NetworkId.value() !== FUJI.networkId || baseTx.BlockchainId.toString() !== FUJI.pBlockchainId) {
      throw this.#refuse(context, `to adopt ${txId}: it is not a Fuji P-Chain tx`);
    }
    const staked = this.#checkStake(context, tx);
    if (this.#pStaked + staked > P_STAKE_CAP) {
      throw this.#refuse(
        context,
        `to adopt ${txId}: it stakes ${formatNanoAvax(staked)} AVAX, and this signer has staked ` +
          `${formatNanoAvax(this.#pStaked)} of its ${formatNanoAvax(P_STAKE_CAP)} AVAX`,
      );
    }
    this.#pStaked += staked;
    this.#ownAutoRenewed.add(txId);
    const nodeId = tx.nodeId.toString();
    this.adopted.push({ txType, hash: txId, nodeId, staked, at: new Date().toISOString() });
    this.#log(`adopted ${txType} ${txId} of an earlier run (${nodeId}, ${formatNanoAvax(staked)} AVAX)`);
  }

  // Lets the page send atomic txs (ExportTx and ImportTx) between this wallet's C-Chain and P-Chain addresses.
  allowBridge(): void {
    this.#bridge = true;
    this.#log('allowed C-Chain and P-Chain atomic txs');
  }

  // Test-only: the next request of `method` (for example 'avalanche_sendTransaction' or 'eth_sendTransaction') gets
  // the answer of a user who clicks Reject in Core: 4001 'User rejected the request.'. The wallet answers before it
  // reads, signs or sends anything. One request per call, or `times` requests (Infinity: each request until
  // cancel()). The handle counts the requests that the rejection answered, and cancel() drops it, so a test can also
  // prove that a page sent no request.
  rejectNext(method: string, { times = 1 }: RejectNextOptions = {}): RejectNextHandle {
    if (!(times === Infinity || (Number.isInteger(times) && times >= 1))) {
      throw new Error(`rejectNext: times must be a whole number from 1, or Infinity (got ${times})`);
    }
    const entry = { method, left: times, used: 0 };
    this.#pendingRejections.push(entry);
    const which = times === Infinity ? 'each' : times === 1 ? 'the next' : `the next ${times}`;
    this.#log(`user rejections (test) for ${which} ${method}`);
    return {
      get used() {
        return entry.used;
      },
      cancel: () => {
        this.#pendingRejections = this.#pendingRejections.filter((pending) => pending !== entry);
      },
    };
  }

  // The methods of the rejections that rejectNext armed and that have rejections left. The audit fails on any: a test
  // that arms a single rejection expects the page to send that request, and a test that arms `times: Infinity`
  // cancels it after its check.
  armedRejections(): string[] {
    return this.#pendingRejections.map((pending) => pending.method);
  }

  // Turns every capability off, and drops every armed rejection. The audit (chain/lib/audit.ts) calls it, so a later
  // test does not inherit one.
  revokeAll(): void {
    this.#stakeNodeId = undefined;
    this.#bridge = false;
    this.#pendingRejections = [];
  }

  // What the txs of this Signer took from the wallet. SIGNER_CAPS holds the caps.
  totals(): SignerTotals {
    return {
      pSpent: this.#pSpent,
      pStaked: this.#pStaked,
      evmReserved: this.#evmReserved,
      atomicCount: this.#atomicCount,
      atomicExported: this.#atomicExported,
    };
  }

  // Records a refusal that happened outside the signer: bridge.ts refuses a request from another origin.
  recordRefusal(method: string, reason: string): void {
    this.#refuse({ method }, reason);
  }

  // Answers one EIP-1193 request. Throws RpcError; bridge.ts turns it into a JSON-RPC error for the page.
  async handle({ method, params }: WalletRequest): Promise<unknown> {
    const rejection = this.#pendingRejections.find((pending) => pending.method === method);
    if (rejection) {
      rejection.used += 1;
      rejection.left -= 1;
      if (rejection.left <= 0) this.#pendingRejections = this.#pendingRejections.filter((p) => p !== rejection);
      this.userRejections.push({ at: new Date().toISOString(), method });
      this.#log(`rejected ${method} as the user (test)`);
      throw new RpcError(ERR.userRejected, USER_REJECTED_MESSAGE);
    }
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [this.address];
      case 'eth_coinbase':
        return this.address;
      case 'eth_chainId':
        return this.chainIdHex;
      case 'net_version':
        return String(this.#currentChainId);
      case 'wallet_requestPermissions':
      case 'wallet_getPermissions':
        return [
          {
            parentCapability: 'eth_accounts',
            caveats: [{ type: 'restrictReturnedAccounts', value: [this.address] }],
          },
        ];
      case 'wallet_revokePermissions':
        return null;
      case 'wallet_switchEthereumChain':
        return this.#switchChain(params);
      case 'wallet_addEthereumChain':
        return this.#addChain(params);
      // Core's chain introspection (components/toolbox/coreViem/rpcSchema.ts).
      case 'wallet_getEthereumChain': {
        const { chain } = this.#state(this.#currentChainId);
        return {
          chainId: toHexChainId(chain.chainId),
          chainName: chain.chainName,
          rpcUrls: chain.rpcUrls,
          nativeCurrency: chain.nativeCurrency,
          isTestnet: chain.isTestnet,
        };
      }
      // Core returns the account's public keys. The Console derives the P-Chain address from xp
      // (coreViem/methods/getPChainAddress.ts) and the C-Chain bech32 address from evm (getCorethAddress.ts); both
      // accept a compressed key. One key, so evm and xp are the same.
      case 'avalanche_getAccountPubKey':
        return { evm: this.publicKey, xp: this.publicKey };
      // The older tools (components/tools/common/api/coreWallet.ts) read addressPVM from Core's account list.
      case 'avalanche_getAccounts':
        return [
          {
            index: 0,
            active: true,
            name: 'e2e',
            addressC: this.address,
            addressPVM: this.pChainAddress,
            addressAVM: this.pChainAddress.replace(/^P-/, 'X-'),
            addressCoreEth: this.pChainAddress.replace(/^P-/, 'C-'),
          },
        ];
      case SEND_XP:
        return this.#sendXP(params);
      case 'eth_sendTransaction':
        return this.#sendEvm(params);
      default:
        if (this.#isForwardedRead(method)) return this.#forward(method, params);
        throw this.#refuse({ method }, `unsupported method ${method}`, ERR.unsupported);
    }
  }

  // Checks a P-Chain tx against the rules (#checkPChainTx) and signs it. Does not issue it, and does not count it to
  // the caps per Signer (#sendXP does). The hex is what @avalanche-sdk/client sends in avalanche_sendTransaction: the
  // codec-prefixed unsigned tx (UnsignedTx.toBytes()).
  async signPChainTx(transactionHex: string): Promise<SignedPChainTx> {
    let bytes: Uint8Array;
    let tx: Common.Transaction;
    try {
      bytes = utils.hexToBuffer(transactionHex);
      tx = decodeTx('PVM', bytes);
    } catch (err) {
      throw new RpcError(ERR.invalidParams, `[e2e wallet] cannot read the P-Chain tx: ${errorMessage(err)}`);
    }
    const checked = await this.#checkPChainTx(tx);
    const signed = await this.#sign('PVM', bytes, checked.credentials);
    return { ...signed, txType: tx._type, ...checked };
  }

  // Signs the unsigned bytes (decodeTx proved that they encode the checked tx). avalanchego signs sha256 of the
  // codec-prefixed unsigned tx, and secp256k1.sign hashes with sha256. One key owns every input and every auth, so
  // each credential slot gets the same signature.
  async #sign(vm: 'PVM' | 'EVM', unsignedBytes: Uint8Array, credentials: number[][]) {
    const signature = await secp256k1.sign(unsignedBytes, this.#key);
    const signedBytes = signedTxBytes(
      vm,
      unsignedBytes,
      credentials.map((indices) => new Credential(indices.map(() => new Signature(signature)))),
    );
    return {
      signedTxHex: utils.bufferToHex(utils.addChecksum(signedBytes)) as Hex,
      txId: utils.base58check.encode(sha256(signedBytes)),
    };
  }

  // Logs a refusal, adds it to `refusals`, and returns its error: 4001 unless the caller gives another code.
  #refuse(context: RequestContext, what: string, code: number = ERR.userRejected): RpcError {
    this.#log(`refused ${what}`);
    this.refusals.push({
      at: new Date().toISOString(),
      method: context.method,
      ...(context.txType && { txType: context.txType }),
      reason: what,
    });
    return new RpcError(code, `[e2e wallet] refuses ${what}`);
  }

  // ---- chains ----

  #state(chainId: number): ChainState {
    const state = this.#chains.get(chainId);
    if (!state) throw new RpcError(ERR.unknownChain, `[e2e wallet] unknown chain ${chainId}`);
    return state;
  }

  #switchChain(params: unknown): null {
    const target = parseChainId(firstParam(params).chainId);
    if (!this.#chains.has(target)) {
      // As Core does for a chain it does not know: the page adds the chain, then switches.
      if (this.#allowed.has(target)) {
        throw new RpcError(ERR.unknownChain, `Unrecognized chain ID ${toHexChainId(target)}. Add the chain first.`);
      }
      throw this.#refuse(
        { method: 'wallet_switchEthereumChain' },
        `a switch to chain ${target}: only Fuji (${FUJI.cChainId}) and the chains the test allows`,
      );
    }
    this.#currentChainId = target;
    return null;
  }

  async #addChain(params: unknown): Promise<null> {
    const p = firstParam(params);
    const id = parseChainId(p.chainId);
    if (!this.#chains.has(id)) {
      const rpcUrl = this.#allowed.get(id);
      if (!rpcUrl) {
        throw this.#refuse(
          { method: 'wallet_addEthereumChain' },
          `to add chain ${id}: only Fuji (${FUJI.cChainId}) and the chains the test allows`,
        );
      }
      // Like Core, check that the RPC serves the chain it claims. The URLs from the page get no request.
      const served = parseChainId(await this.#rpc(rpcUrl, 'eth_chainId', []));
      if (served !== id) {
        throw new RpcError(ERR.invalidParams, `[e2e wallet] ${rpcUrl} serves chain ${served}, not ${id}`);
      }
      const currency = (p.nativeCurrency ?? {}) as Partial<WalletChain['nativeCurrency']>;
      this.#chains.set(id, {
        chain: {
          chainId: id,
          chainName: typeof p.chainName === 'string' ? p.chainName : `Chain ${id}`,
          rpcUrls: [rpcUrl],
          nativeCurrency: {
            name: currency.name ?? 'Token',
            symbol: currency.symbol ?? 'TKN',
            decimals: currency.decimals ?? 18,
          },
          isTestnet: true,
        },
        lock: createLock(),
      });
      this.#log(`added chain ${id} (${rpcUrl})`);
    }
    // Core switches to a chain it adds.
    this.#currentChainId = id;
    return null;
  }

  // ---- reads ----

  #isForwardedRead(method: string): boolean {
    if (!/^(eth|net|web3)_/.test(method)) return false;
    // Signing methods the wallet does not implement must not reach the node.
    return !/^eth_(sign|signTransaction|signTypedData.*)$/.test(method);
  }

  async #forward(method: string, params: unknown): Promise<unknown> {
    const { chain } = this.#state(this.#currentChainId);
    return this.#rpc(chain.rpcUrls[0], method, params ?? []);
  }

  // One JSON-RPC call. throttledFetch gives a network error or an HTTP 5xx one more try, and stops the process at
  // the first HTTP 429 (the public API rate-limits by IP, and more requests make the ban longer).
  async #rpc(url: string, method: string, params: unknown): Promise<unknown> {
    const body = JSON.stringify({ jsonrpc: '2.0', id: this.#rpcId++, method, params });
    let res: Response;
    try {
      res = await this.#fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    } catch (err) {
      const code = isRateLimited(err) ? ERR.limitExceeded : ERR.internal;
      throw new RpcError(code, `[e2e wallet] ${method} at ${url} failed: ${errorMessage(err)}`);
    }
    if (res.status === 429) {
      throw new RpcError(ERR.limitExceeded, `[e2e wallet] ${new URL(url).host} rate-limited ${method} (HTTP 429)`);
    }
    if (res.status >= 500) throw new RpcError(ERR.internal, `[e2e wallet] ${method} at ${url}: HTTP ${res.status}`);
    let reply: { result?: unknown; error?: { code?: number; message?: string; data?: unknown } };
    try {
      reply = (await res.json()) as typeof reply;
    } catch {
      throw new RpcError(ERR.internal, `[e2e wallet] ${method} at ${url}: HTTP ${res.status}, no JSON`);
    }
    if (reply.error) {
      throw new RpcError(reply.error.code ?? ERR.internal, reply.error.message ?? `${method} failed`, reply.error.data);
    }
    return reply.result ?? null;
  }

  // ---- EVM sends ----

  async #sendEvm(params: unknown): Promise<Hex> {
    const context = { method: 'eth_sendTransaction', txType: 'eth_sendTransaction' };
    const tx = firstParam(params);
    const state = this.#state(this.#currentChainId);
    const { chainId } = state.chain;
    if (typeof tx.from === 'string' && tx.from.toLowerCase() !== this.address.toLowerCase()) {
      throw this.#refuse(context, `a tx from ${tx.from}: it is not this wallet (${this.address})`, ERR.unauthorized);
    }
    if (tx.chainId !== undefined && parseChainId(tx.chainId) !== chainId) {
      throw new RpcError(
        ERR.invalidParams,
        `[e2e wallet] tx chainId ${String(tx.chainId)} is not the wallet chain ${chainId}`,
      );
    }
    const value = quantity(tx.value, 'value');
    if (value) throw this.#refuse(context, `eth_sendTransaction with value ${value} wei: the tests send no value`);
    const to = typeof tx.to === 'string' && tx.to !== '' ? getAddress(tx.to) : undefined;
    const data = (typeof tx.data === 'string' ? tx.data : typeof tx.input === 'string' ? tx.input : undefined) as
      | Hex
      | undefined;
    const accessList = Array.isArray(tx.accessList) ? (tx.accessList as AccessList) : undefined;
    const givenNonce = quantity(tx.nonce, 'nonce');
    const rpcUrl = state.chain.rpcUrls[0];

    return state.lock(async () => {
      let gas = quantity(tx.gas, 'gas');
      if (gas === undefined) {
        const call = {
          from: this.address,
          ...(to && { to }),
          ...(data && { data }),
          ...(accessList && { accessList }),
        };
        // 20 % over the estimate. The node refunds unused gas.
        gas = ((quantity(await this.#rpc(rpcUrl, 'eth_estimateGas', [call]), 'gas estimate') ?? 0n) * 12n) / 10n;
      }
      const type = await this.#feeFields(rpcUrl, tx, accessList);
      const maxPrice = type.type === 'eip1559' ? type.maxFeePerGas : type.gasPrice;
      const reserve = gas * maxPrice;
      if (reserve > EVM_FEE_CAP) {
        throw this.#refuse(
          context,
          `eth_sendTransaction with gas ${gas} x max fee ${maxPrice} wei: more than 0.002 AVAX`,
        );
      }
      // The most the tx can burn counts to the cap per Signer before the signature, whether or not the node takes it.
      if (this.#evmReserved + reserve > EVM_SPEND_CAP) {
        throw this.#refuse(
          context,
          `eth_sendTransaction with gas ${gas} x max fee ${maxPrice} wei: this signer has reserved ` +
            `${formatWeiAvax(this.#evmReserved)} of its ${formatWeiAvax(EVM_SPEND_CAP)} AVAX`,
        );
      }
      this.#evmReserved += reserve;
      let nonce = await this.#nextNonce(state, givenNonce);
      for (let attempt = 0; ; attempt++) {
        const serializable = {
          chainId,
          nonce,
          gas,
          ...(to && { to }),
          ...(data && { data }),
          ...(accessList && { accessList }),
          ...type,
        } as TransactionSerializable;
        const raw = await this.#account.signTransaction(serializable);
        const localHash = keccak256(raw);
        let hash: Hex;
        try {
          hash = (await this.#rpc(rpcUrl, 'eth_sendRawTransaction', [raw])) as Hex;
        } catch (err) {
          const message = errorMessage(err);
          if (/already known/i.test(message)) {
            hash = localHash;
          } else if (attempt === 0 && /nonce too low/i.test(message)) {
            const pending = await this.#pendingNonce(rpcUrl);
            this.#log(`chain ${chainId}: nonce ${nonce} too low, retrying with ${Math.max(pending, nonce + 1)}`);
            nonce = Math.max(pending, nonce + 1);
            continue;
          } else {
            throw err;
          }
        }
        state.lastNonce = { nonce, at: Date.now() };
        this.#record({ kind: 'evm', chainId, txType: 'eth_sendTransaction', hash, nonce });
        return hash;
      }
    });
  }

  async #pendingNonce(rpcUrl: string): Promise<number> {
    return Number(quantity(await this.#rpc(rpcUrl, 'eth_getTransactionCount', [this.address, 'pending']), 'nonce'));
  }

  // The nonce that the wallet's own memory gives: the last nonce sent + 1, for NONCE_MEMORY_MS. 0 without one.
  #rememberedNonce(state: ChainState): number {
    return state.lastNonce && Date.now() - state.lastNonce.at < NONCE_MEMORY_MS ? state.lastNonce.nonce + 1 : 0;
  }

  // Runs under the chain lock.
  async #nextNonce(state: ChainState, given: bigint | undefined): Promise<number> {
    const pending = await this.#pendingNonce(state.chain.rpcUrls[0]);
    return Math.max(Number(given ?? 0n), pending, this.#rememberedNonce(state));
  }

  // The fee fields and the viem tx type. The page's type wins; without one an accessList or no gasPrice means
  // EIP-1559.
  async #feeFields(
    rpcUrl: string,
    tx: Record<string, unknown>,
    accessList: AccessList | undefined,
  ): Promise<
    | { type: 'legacy' | 'eip2930'; gasPrice: bigint }
    | { type: 'eip1559'; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  > {
    const names: Record<string, number> = { legacy: 0, eip2930: 1, eip1559: 2 };
    const given =
      tx.type === undefined || tx.type === null
        ? undefined
        : typeof tx.type === 'string' && tx.type in names
          ? names[tx.type]
          : Number(quantity(tx.type, 'type'));
    const gasPrice = quantity(tx.gasPrice, 'gasPrice');
    const kind =
      given === 0 ? 'legacy' : given === 1 ? 'eip2930' : given === 2 ? 'eip1559' : given !== undefined ? 'unknown' : '';
    if (kind === 'unknown')
      throw new RpcError(ERR.invalidParams, `[e2e wallet] unsupported tx type ${String(tx.type)}`);
    if (kind === 'legacy' || kind === 'eip2930' || (kind === '' && gasPrice !== undefined)) {
      const price = gasPrice ?? (quantity(await this.#rpc(rpcUrl, 'eth_gasPrice', []), 'gasPrice') as bigint);
      return { type: kind === 'legacy' || (kind === '' && !accessList) ? 'legacy' : 'eip2930', gasPrice: price };
    }
    let priority = quantity(tx.maxPriorityFeePerGas, 'maxPriorityFeePerGas');
    if (priority === undefined) {
      priority = quantity(await this.#rpc(rpcUrl, 'eth_maxPriorityFeePerGas', []), 'maxPriorityFeePerGas') ?? 0n;
    }
    let maxFee = quantity(tx.maxFeePerGas, 'maxFeePerGas');
    if (maxFee === undefined) {
      const block = (await this.#rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false])) as { baseFeePerGas?: string };
      const baseFee =
        quantity(block?.baseFeePerGas, 'baseFeePerGas') ??
        (quantity(await this.#rpc(rpcUrl, 'eth_gasPrice', []), 'gasPrice') as bigint);
      maxFee = baseFee * 2n + priority;
    }
    if (maxFee < priority) maxFee = priority;
    return { type: 'eip1559', maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
  }

  // ---- P-Chain and C-Chain atomic sends ----

  // The P-Chain tx types that this Signer signs now.
  #pTxTypes(): string[] {
    return [...P_TX_TYPES, ...(this.#stakeNodeId ? STAKE_TX_TYPES : []), ...(this.#bridge ? P_BRIDGE_TX_TYPES : [])];
  }

  async #sendXP(params: unknown): Promise<string> {
    const { transactionHex, chainAlias } = firstParam(params);
    if (typeof transactionHex !== 'string') {
      throw new RpcError(ERR.invalidParams, `[e2e wallet] ${SEND_XP} needs transactionHex`);
    }
    if (chainAlias === 'C') return this.#sendCChainAtomic(transactionHex);
    if (chainAlias !== 'P') {
      throw this.#refuse(
        { method: SEND_XP },
        `a tx on chain ${String(chainAlias)}: the wallet signs P-Chain txs, and C-Chain atomic txs with allowBridge`,
      );
    }
    return this.#pChainLock(async () => {
      const signed = await this.signPChainTx(transactionHex);
      const context = { method: SEND_XP, txType: signed.txType };
      if (this.#pSpent + signed.spent > P_SPEND_CAP) {
        throw this.#refuse(
          context,
          `${signed.txType}: it spends ${formatNanoAvax(signed.spent)} AVAX, and this signer has spent ` +
            `${formatNanoAvax(this.#pSpent)} of its ${formatNanoAvax(P_SPEND_CAP)} AVAX`,
        );
      }
      if (this.#pStaked + signed.staked > P_STAKE_CAP) {
        throw this.#refuse(
          context,
          `${signed.txType}: it stakes ${formatNanoAvax(signed.staked)} AVAX, and this signer has staked ` +
            `${formatNanoAvax(this.#pStaked)} of its ${formatNanoAvax(P_STAKE_CAP)} AVAX`,
        );
      }
      const atomic = P_BRIDGE_TX_TYPES.includes(signed.txType);
      if (atomic) this.#checkAtomicTotals(context, signed.exported);
      // Counted before the issue: an issue that fails after the node took the tx still spent it.
      this.#pSpent += signed.spent;
      this.#pStaked += signed.staked;
      if (atomic) this.#countAtomic(signed.exported);
      if (signed.txType === 'pvm.AddAutoRenewedValidatorTx') this.#ownAutoRenewed.add(signed.txId);
      const result = (await this.#rpc(FUJI.pRpc, 'platform.issueTx', { tx: signed.signedTxHex, encoding: 'hex' })) as {
        txID?: string;
      };
      const txId = result?.txID ?? signed.txId;
      if (txId !== signed.txId) this.#log(`platform.issueTx returned ${txId}, the local tx ID is ${signed.txId}`);
      this.#record({ kind: 'p-chain', txType: signed.txType, hash: txId });
      // Core returns the bare tx ID; @avalanche-sdk/client wraps it into { txHash }.
      return txId;
    });
  }

  // Refuses an atomic tx that would pass the count or the export cap of this Signer. No network call.
  #checkAtomicTotals(context: RequestContext, exported: bigint): void {
    if (this.#atomicCount + 1 > ATOMIC_COUNT_CAP) {
      throw this.#refuse(context, `${context.txType}: this signer has sent ${this.#atomicCount} atomic txs (cap 6)`);
    }
    if (this.#atomicExported + exported > ATOMIC_EXPORT_CAP) {
      throw this.#refuse(
        context,
        `${context.txType}: it exports ${formatNanoAvax(exported)} AVAX, and this signer has exported ` +
          `${formatNanoAvax(this.#atomicExported)} of its ${formatNanoAvax(ATOMIC_EXPORT_CAP)} AVAX`,
      );
    }
  }

  #countAtomic(exported: bigint): void {
    this.#atomicCount += 1;
    this.#atomicExported += exported;
  }

  // Gives back the count of an atomic tx that the wallet refused before it signed it.
  #uncountAtomic(exported: bigint): void {
    this.#atomicCount -= 1;
    this.#atomicExported -= exported;
  }

  // The rules for a P-Chain tx (see the top of this file). The checks that need no network come first, so a refused
  // tx makes no request; then the owner lookups. Returns the credential layout, in the order avalanchego reads it
  // (the fee inputs, then the imported inputs or the owner auth), and the nAVAX the tx moves (SignedPChainTx).
  async #checkPChainTx(
    tx: Common.Transaction,
  ): Promise<{ credentials: number[][]; spent: bigint; staked: bigint; exported: bigint }> {
    const type = tx._type;
    const context = { method: SEND_XP, txType: type };
    const enabled = this.#pTxTypes();
    if (!enabled.includes(type)) {
      throw this.#refuse(context, `P-Chain tx type ${type}: the wallet signs only ${enabled.join(', ')}`);
    }
    const { baseTx } = tx as unknown as { baseTx: avaxSerial.BaseTx };
    const networkId = baseTx.NetworkId.value();
    if (networkId !== FUJI.networkId)
      throw this.#refuse(context, `a ${type} for network ID ${networkId}: Fuji (5) only`);
    if (baseTx.BlockchainId.toString() !== FUJI.pBlockchainId) {
      throw new RpcError(ERR.invalidParams, `[e2e wallet] ${type} is for blockchain ${baseTx.BlockchainId}`);
    }

    // The fee inputs: unlocked AVAX. The outputs: change to this wallet.
    for (const input of baseTx.inputs) {
      if (input.getAssetId() !== FUJI.avaxAssetId || !utils.isTransferInput(input.input)) {
        throw this.#refuse(context, `${type}: an input is not unlocked AVAX`);
      }
    }
    for (const out of baseTx.outputs) {
      if (!this.#isOurAvaxOutput(out)) {
        throw this.#refuse(context, `${type}: an output is not unlocked AVAX change to this wallet (${payee(out)})`);
      }
    }

    // The AVAX that the tx moves in its own fields. The fee is what is left.
    const balance = validatorBalance(tx);
    let staked = 0n;
    let exported = 0n;
    let imported = 0n;
    if (STAKE_TX_TYPES.includes(type)) staked = this.#checkStake(context, tx);
    if (pvmSerial.isExportTx(tx)) exported = this.#checkPChainExport(context, tx);
    if (pvmSerial.isImportTx(tx)) imported = this.#checkPChainImport(context, tx);
    const fee = sumInputs(baseTx.inputs) + imported - sumOutputs(baseTx.outputs) - balance - staked - exported;
    if (fee < 0n) throw new RpcError(ERR.invalidParams, `[e2e wallet] ${type}: the inputs do not cover the tx`);
    const feeCap = P_BRIDGE_TX_TYPES.includes(type) ? ATOMIC_FEE_CAP : P_FEE_CAP;
    if (fee > feeCap) {
      throw this.#refuse(context, `${type}: a fee of ${formatNanoAvax(fee)} AVAX (cap ${formatNanoAvax(feeCap)})`);
    }
    if (balance > P_BALANCE_CAP) {
      throw this.#refuse(context, `${type}: a validator balance of ${formatNanoAvax(balance)} AVAX (cap 0.05)`);
    }
    const amounts = { spent: fee + balance, staked, exported };

    // The owners in the tx: each must be this wallet alone.
    if (pvmSerial.isCreateSubnetTx(tx)) {
      const owners = tx.getSubnetOwners();
      const ours = owners.locktime.value() === 0n && this.#isOurs(owners.threshold.value(), bytesOf(owners.addrs));
      if (!ours) throw this.#refuse(context, `${type}: the subnet owner is not this wallet`);
    }
    if (pvmSerial.isConvertSubnetToL1Tx(tx)) {
      for (const v of tx.validators) {
        for (const [name, owner] of [
          ['remaining balance owner', v.remainingBalanceOwner],
          ['deactivation owner', v.deactivationOwner],
        ] as const) {
          if (!this.#isOurs(owner.threshold.value(), bytesOf(owner.addresses))) {
            throw this.#refuse(context, `${type}: a validator's ${name} is not this wallet`);
          }
        }
      }
    }
    if (pvmSerial.isRegisterL1ValidatorTx(tx)) {
      let owners: ReturnType<typeof registrationOwners>;
      try {
        owners = registrationOwners(tx.message.bytes);
      } catch (err) {
        throw new RpcError(ERR.invalidParams, `[e2e wallet] ${type}: ${errorMessage(err)}`);
      }
      const { remainingBalance, disable } = owners;
      if (!this.#isOurs(remainingBalance.threshold, remainingBalance.addresses)) {
        throw this.#refuse(context, `${type}: the remaining balance owner is not this wallet`);
      }
      if (!this.#isOurs(disable.threshold, disable.addresses)) {
        throw this.#refuse(context, `${type}: the disable owner is not this wallet`);
      }
    }

    const fees = baseTx.inputs.map((input) => input.sigIndicies());
    if (pvmSerial.isImportTx(tx)) {
      // avalanchego reads the credentials of the base inputs, then those of the imported inputs.
      return { credentials: [...fees, ...tx.ins.map((input) => input.sigIndicies())], ...amounts };
    }
    if (pvmSerial.isSetAutoRenewedValidatorConfigTx(tx)) {
      return { credentials: [...fees, this.#checkAutoRenewedConfig(context, tx)], ...amounts };
    }
    if (tx instanceof pvmSerial.AbstractSubnetTx) {
      const subnetId = tx.getSubnetID().toString();
      const auth = tx.getSubnetAuth().values();
      const owner = await this.#lookup<{ controlKeys?: string[]; threshold?: string }>(
        'platform.getSubnet',
        { subnetID: subnetId },
        `subnet ${subnetId}`,
      );
      this.#checkAuth(context, `${type} subnet auth (subnet ${subnetId})`, owner.controlKeys, owner.threshold, auth);
      return { credentials: [...fees, auth], ...amounts };
    }
    if (pvmSerial.isDisableL1ValidatorTx(tx)) {
      const validationId = tx.validationId.toString();
      const auth = tx.getDisableAuth().values();
      const validator = await this.#l1Validator(validationId);
      const owner = validator.deactivationOwner;
      this.#checkAuth(context, `disable auth (validation ${validationId})`, owner?.addresses, owner?.threshold, auth);
      return { credentials: [...fees, auth], ...amounts };
    }
    if (pvmSerial.isIncreaseL1ValidatorBalanceTx(tx)) {
      // The balance stays with the validator and comes back to its remaining balance owner, which must be us.
      const validationId = tx.validationId.toString();
      const owner = (await this.#l1Validator(validationId)).remainingBalanceOwner;
      const ours = bareXPAddress(this.pChainAddress);
      if (owner?.threshold !== '1' || owner.addresses?.length !== 1 || bareXPAddress(owner.addresses[0]) !== ours) {
        throw this.#refuse(context, `${type}: validator ${validationId} returns its balance to another owner`);
      }
    }
    return { credentials: fees, ...amounts };
  }

  // A Primary Network stake (allowPrimaryStake): AddPermissionlessValidatorTx or AddAutoRenewedValidatorTx. Returns
  // the nAVAX it stakes. A SetAutoRenewedValidatorConfigTx stakes nothing; #checkAutoRenewedConfig checks it.
  #checkStake(context: RequestContext, tx: Common.Transaction): bigint {
    const type = context.txType;
    if (pvmSerial.isAddPermissionlessValidatorTx(tx)) {
      const { validator, subnetId } = tx.subnetValidator;
      if (subnetId.toString() !== FUJI.primaryNetworkId) {
        throw this.#refuse(context, `${type}: subnet ${subnetId} is not the Primary Network`);
      }
      this.#checkStakeNode(context, validator.nodeId.toString());
      const staked = this.#checkStakeOutputs(context, tx.stake, validator.weight.value());
      // By the Node clock. The test types now + 12 h 15 min; the page's default (1 day + 5 min) is refused.
      const fromNow = validator.endTime.value() - BigInt(Math.floor(Date.now() / 1000));
      if (fromNow > STAKE_PERIOD_MAX) {
        throw this.#refuse(context, `${type}: an end time ${fromNow} s from now (cap ${STAKE_PERIOD_MAX} s, 13 h)`);
      }
      this.#checkRewardOwner(context, 'validation reward owner', tx.validatorRewardsOwner);
      this.#checkRewardOwner(context, 'delegation reward owner', tx.delegatorRewardsOwner);
      return staked;
    }
    if (pvmSerial.isAddAutoRenewedValidatorTx(tx)) {
      this.#checkStakeNode(context, tx.nodeId.toString());
      // The tx on the wire has no weight: codec.ts sets the weight to the stake sum, as the P-Chain does.
      const staked = this.#checkStakeOutputs(context, tx.stake, tx.weight.value());
      this.#checkRewardOwner(context, 'validation reward owner', tx.validatorRewardsOwner);
      this.#checkRewardOwner(context, 'delegation reward owner', tx.delegatorRewardsOwner);
      this.#checkRewardOwner(context, 'validator authority', tx.owner);
      const period = tx.period.value();
      if (period > STAKE_PERIOD_MAX) {
        throw this.#refuse(context, `${type}: a cycle of ${period} s (cap ${STAKE_PERIOD_MAX} s, 13 h)`);
      }
      this.#checkAutoCompound(context, tx.autoCompoundRewardShares.value());
      return staked;
    }
    return 0n;
  }

  #checkStakeNode(context: RequestContext, nodeId: string): void {
    if (nodeId !== this.#stakeNodeId) {
      throw this.#refuse(context, `${context.txType}: NodeID ${nodeId} is not ${this.#stakeNodeId}, the one allowed`);
    }
  }

  // Each stake output: unlocked AVAX to this wallet. Their sum is the weight, at most 1 AVAX. Returns the sum.
  #checkStakeOutputs(context: RequestContext, stake: readonly TransferableOutput[], weight: bigint): bigint {
    for (const out of stake) {
      if (!this.#isOurAvaxOutput(out)) {
        throw this.#refuse(
          context,
          `${context.txType}: a stake output is not unlocked AVAX to this wallet (${payee(out)})`,
        );
      }
    }
    const staked = sumOutputs(stake);
    if (weight !== staked) {
      throw this.#refuse(context, `${context.txType}: the weight ${weight} is not the stake ${staked}`);
    }
    if (staked > P_STAKE_CAP) {
      throw this.#refuse(
        context,
        `${context.txType}: a stake of ${formatNanoAvax(staked)} AVAX (cap ${formatNanoAvax(P_STAKE_CAP)})`,
      );
    }
    return staked;
  }

  #checkRewardOwner(context: RequestContext, name: string, owner: unknown): void {
    const ours =
      owner instanceof OutputOwners &&
      owner.locktime.value() === 0n &&
      this.#isOurs(owner.threshold.value(), bytesOf(owner.addrs));
    if (!ours) throw this.#refuse(context, `${context.txType}: the ${name} is not this wallet`);
  }

  #checkAutoCompound(context: RequestContext, shares: number): void {
    if (shares > AUTO_COMPOUND_MAX) {
      throw this.#refuse(context, `${context.txType}: auto-compound shares ${shares} (cap ${AUTO_COMPOUND_MAX})`);
    }
  }

  // A SetAutoRenewedValidatorConfigTx for the auto-renewed validator that this Signer added. The add rule proved that
  // the validator authority is this wallet alone, so the auth is [0] and needs no lookup. Returns the auth indices.
  #checkAutoRenewedConfig(context: RequestContext, tx: pvmSerial.SetAutoRenewedValidatorConfigTx): number[] {
    const type = context.txType;
    const validatorTxId = tx.txId.toString();
    if (!this.#ownAutoRenewed.has(validatorTxId)) {
      throw this.#refuse(
        context,
        `${type}: ${validatorTxId} is not an AddAutoRenewedValidatorTx that this signer sent`,
      );
    }
    if (!(tx.auth instanceof Input))
      throw new RpcError(ERR.invalidParams, `[e2e wallet] ${type}: the auth is not an input`);
    const auth = tx.getAuth().values();
    if (auth.length !== 1 || auth[0] !== 0) {
      throw this.#refuse(context, `${type}: auth indices [${auth.join(', ')}]; the wallet signs [0] only`);
    }
    const period = tx.period.value();
    if (period !== 0n && (period < STAKE_PERIOD_MIN || period > STAKE_PERIOD_MAX)) {
      throw this.#refuse(
        context,
        `${type}: a cycle of ${period} s (0, or ${STAKE_PERIOD_MIN} to ${STAKE_PERIOD_MAX} s: 12 to 13 h)`,
      );
    }
    this.#checkAutoCompound(context, tx.autoCompoundRewardShares.value());
    return auth;
  }

  // A P-Chain ExportTx to this wallet's C-Chain address. Returns the nAVAX it exports.
  #checkPChainExport(context: RequestContext, tx: pvmSerial.ExportTx): bigint {
    if (tx.destination.toString() !== FUJI.cBlockchainId) {
      throw this.#refuse(context, `${context.txType}: destination ${tx.destination} is not the Fuji C-Chain`);
    }
    for (const out of tx.outs) {
      if (!this.#isOurAvaxOutput(out)) {
        throw this.#refuse(
          context,
          `${context.txType}: an exported output is not unlocked AVAX to this wallet (${payee(out)})`,
        );
      }
    }
    return this.#checkAtomicAmount(context, 'exports', sumOutputs(tx.outs));
  }

  // A P-Chain ImportTx from the C-Chain. Its outputs are change to this wallet (the base tx check). Returns the nAVAX
  // it imports.
  #checkPChainImport(context: RequestContext, tx: pvmSerial.ImportTx): bigint {
    if (tx.sourceChain.toString() !== FUJI.cBlockchainId) {
      throw this.#refuse(context, `${context.txType}: source chain ${tx.sourceChain} is not the Fuji C-Chain`);
    }
    this.#checkImportedInputs(context, tx.ins);
    return this.#checkAtomicAmount(context, 'imports', sumInputs(tx.ins));
  }

  #checkImportedInputs(context: RequestContext, inputs: readonly TransferableInput[]): void {
    for (const input of inputs) {
      if (input.getAssetId() !== FUJI.avaxAssetId || !utils.isTransferInput(input.input)) {
        throw this.#refuse(context, `${context.txType}: an imported input is not unlocked AVAX`);
      }
    }
  }

  #checkAtomicAmount(context: RequestContext, verb: 'exports' | 'imports', amount: bigint): bigint {
    if (amount > ATOMIC_AMOUNT_CAP) {
      throw this.#refuse(
        context,
        `${context.txType}: it ${verb} ${formatNanoAvax(amount)} AVAX (cap ${formatNanoAvax(ATOMIC_AMOUNT_CAP)})`,
      );
    }
    return amount;
  }

  // A C-Chain atomic tx (allowBridge): avalanche_sendTransaction with chainAlias 'C'. The wallet signs it and issues
  // it to the Fuji C-Chain's avax.issueTx, never to a URL from the page.
  async #sendCChainAtomic(transactionHex: string): Promise<string> {
    if (!this.#bridge) {
      const txType = cChainTxType(transactionHex);
      throw this.#refuse(
        { method: SEND_XP, txType },
        `a tx on chain C${txType ? ` (${txType})` : ''}: the wallet signs ${C_BRIDGE_TX_TYPES.join(' and ')} ` +
          'only with allowBridge (enabled: none)',
      );
    }
    let bytes: Uint8Array;
    let tx: Common.Transaction;
    try {
      bytes = utils.hexToBuffer(transactionHex);
      tx = decodeTx('EVM', bytes);
    } catch (err) {
      throw new RpcError(ERR.invalidParams, `[e2e wallet] cannot read the C-Chain atomic tx: ${errorMessage(err)}`);
    }
    const context = { method: SEND_XP, txType: tx._type };
    const state = this.#state(FUJI.cChainId);
    return state.lock(async () => {
      const { credentials, exported, nonce } = this.#checkCChainAtomicTx(context, tx);
      // Check and count with no await between them, as the P-Chain path does under its own lock: a P-Chain atomic tx
      // under #pChainLock can run in any await below, and must see this tx in the totals. A refusal before the
      // signature gives the count back; after the signature the tx counts, as on the P-Chain.
      this.#checkAtomicTotals(context, exported);
      this.#countAtomic(exported);
      if (nonce !== undefined) {
        // The EVMInput nonce must not be below the wallet's next nonce: its own memory first (no network call), then
        // the pending count.
        let next: number;
        try {
          const remembered = this.#rememberedNonce(state);
          next = nonce < remembered ? remembered : Math.max(remembered, await this.#pendingNonce(FUJI.cRpc));
        } catch (err) {
          this.#uncountAtomic(exported);
          throw err;
        }
        if (nonce < next) {
          this.#uncountAtomic(exported);
          throw this.#refuse(context, `${context.txType}: EVM input nonce ${nonce}, below the next nonce ${next}`);
        }
      }
      const signed = await this.#sign('EVM', bytes, credentials);
      const result = (await this.#rpc(FUJI.cAvax, 'avax.issueTx', { tx: signed.signedTxHex, encoding: 'hex' })) as {
        txID?: string;
      };
      if (nonce !== undefined) state.lastNonce = { nonce, at: Date.now() };
      const txId = result?.txID ?? signed.txId;
      if (txId !== signed.txId) this.#log(`avax.issueTx returned ${txId}, the local tx ID is ${signed.txId}`);
      this.#record({ kind: 'atomic', chainAlias: 'C', txType: tx._type, hash: txId });
      return txId;
    });
  }

  // The rules for a C-Chain atomic tx. No network call. Returns the credential layout, the nAVAX it exports, and the
  // EVM nonce of an ExportTx.
  #checkCChainAtomicTx(
    context: RequestContext,
    tx: Common.Transaction,
  ): { credentials: number[][]; exported: bigint; nonce?: number } {
    const type = context.txType;
    if (!evmSerial.isImportExportTx(tx)) {
      throw this.#refuse(context, `C-Chain tx type ${type}: the wallet signs only ${C_BRIDGE_TX_TYPES.join(', ')}`);
    }
    const networkId = tx.networkId.value();
    if (networkId !== FUJI.networkId)
      throw this.#refuse(context, `a ${type} for network ID ${networkId}: Fuji (5) only`);
    if (tx.blockchainId.toString() !== FUJI.cBlockchainId) {
      throw this.#refuse(context, `${type}: blockchain ${tx.blockchainId} is not the Fuji C-Chain`);
    }
    if (evmSerial.isExportTx(tx)) {
      if (tx.destinationChain.toString() !== FUJI.pBlockchainId) {
        throw this.#refuse(context, `${type}: destination ${tx.destinationChain} is not the P-Chain`);
      }
      if (tx.ins.length !== 1) throw this.#refuse(context, `${type}: ${tx.ins.length} EVM inputs; the wallet signs 1`);
      const [input] = tx.ins;
      if (!utils.bytesEqual(input.address.toBytes(), this.#evmAddressBytes)) {
        throw this.#refuse(context, `${type}: the EVM input is ${input.address.toHex()}, not this wallet`);
      }
      if (input.assetId.toString() !== FUJI.avaxAssetId)
        throw this.#refuse(context, `${type}: the EVM input is not AVAX`);
      const spent = input.amount.value();
      if (spent > EVM_EXPORT_INPUT_CAP) {
        throw this.#refuse(context, `${type}: an EVM input of ${formatNanoAvax(spent)} AVAX (cap 0.051)`);
      }
      for (const out of tx.exportedOutputs) {
        if (!this.#isOurAvaxOutput(out)) {
          throw this.#refuse(
            context,
            `${type}: an exported output is not unlocked AVAX to this wallet (${payee(out)})`,
          );
        }
      }
      const exported = this.#checkAtomicAmount(context, 'exports', sumOutputs(tx.exportedOutputs));
      this.#checkAtomicFee(context, spent - exported);
      return { credentials: [[0]], exported, nonce: Number(input.nonce.value()) };
    }
    if (evmSerial.isImportTx(tx)) {
      if (tx.sourceChain.toString() !== FUJI.pBlockchainId) {
        throw this.#refuse(context, `${type}: source chain ${tx.sourceChain} is not the P-Chain`);
      }
      this.#checkImportedInputs(context, tx.importedInputs);
      const imported = this.#checkAtomicAmount(context, 'imports', sumInputs(tx.importedInputs));
      let credited = 0n;
      for (const out of tx.Outs) {
        if (
          !utils.bytesEqual(out.address.toBytes(), this.#evmAddressBytes) ||
          out.assetId.toString() !== FUJI.avaxAssetId
        ) {
          throw this.#refuse(context, `${type}: an output pays ${out.address.toHex()}, not AVAX to this wallet`);
        }
        credited += out.amount.value();
      }
      this.#checkAtomicFee(context, imported - credited);
      return { credentials: tx.importedInputs.map((input) => input.sigIndicies()), exported: 0n };
    }
    throw this.#refuse(context, `C-Chain tx type ${type}: the wallet signs only ${C_BRIDGE_TX_TYPES.join(', ')}`);
  }

  #checkAtomicFee(context: RequestContext, fee: bigint): void {
    if (fee < 0n)
      throw new RpcError(ERR.invalidParams, `[e2e wallet] ${context.txType}: the inputs do not cover the tx`);
    if (fee > ATOMIC_FEE_CAP) {
      throw this.#refuse(
        context,
        `${context.txType}: a fee of ${formatNanoAvax(fee)} AVAX (cap ${formatNanoAvax(ATOMIC_FEE_CAP)})`,
      );
    }
  }

  // ---- owners ----

  // True when the owner is this wallet alone: threshold 1 and one address, ours.
  #isOurs(threshold: number, addresses: Uint8Array[]): boolean {
    return threshold === 1 && addresses.length === 1 && utils.bytesEqual(addresses[0], this.#pAddressBytes);
  }

  // True for unlocked AVAX (a secp256k1 TransferOutput, locktime 0) to this wallet alone.
  #isOurAvaxOutput({ output, assetId }: TransferableOutput): boolean {
    return (
      assetId.toString() === FUJI.avaxAssetId &&
      utils.isTransferOut(output) &&
      output.getLocktime() === 0n &&
      this.#isOurs(output.getThreshold(), output.getOwners())
    );
  }

  async #l1Validator(validationId: string) {
    type RawOwner = { addresses?: string[]; threshold?: string };
    return this.#lookup<{ deactivationOwner?: RawOwner; remainingBalanceOwner?: RawOwner }>(
      'platform.getL1Validator',
      { validationID: validationId },
      `L1 validator ${validationId}`,
    );
  }

  // A P-Chain read for an owner lookup. "not found" asks again: a node behind the load balancer can lag the tx
  // that made the subnet or the validator. Every other failure, and the last "not found", throws.
  async #lookup<T>(method: string, params: Record<string, string>, what: string): Promise<T> {
    let lastError = '';
    for (let attempt = 1; attempt <= this.#lookupAttempts; attempt++) {
      if (attempt > 1) await sleep(this.#lookupDelayMs);
      try {
        // Past the public API's cache: a cached answer from before the tx that made the subnet or the validator would
        // say 'not found' for minutes (chain.ts freshParams).
        const result = await this.#rpc(FUJI.pRpc, method, freshParams(params));
        if (result && typeof result === 'object') return result as T;
        lastError = 'empty result';
      } catch (err) {
        lastError = errorMessage(err);
        if (!/not found/i.test(lastError)) break;
      }
    }
    throw new RpcError(ERR.internal, `[e2e wallet] owner lookup for ${what} failed (${method}): ${lastError}`);
  }

  // Each auth index must point at this wallet's P-Chain address, and the auth must meet the threshold.
  #checkAuth(
    context: RequestContext,
    what: string,
    addresses: string[] | undefined,
    threshold: string | undefined,
    auth: number[],
  ) {
    if (!addresses || addresses.length === 0)
      throw new RpcError(ERR.internal, `[e2e wallet] ${what}: the owner has no addresses`);
    const needed = Number(threshold ?? 1);
    if (auth.length < needed) {
      throw this.#refuse(context, `${what}: the tx signs ${auth.length} of ${needed} owners`, ERR.unauthorized);
    }
    const ours = bareXPAddress(this.pChainAddress);
    for (const index of auth) {
      const owner = addresses[index];
      if (owner === undefined)
        throw this.#refuse(context, `${what}: auth index ${index} has no owner`, ERR.unauthorized);
      if (bareXPAddress(owner) !== ours) {
        throw this.#refuse(
          context,
          `${what}: owner ${index} is ${owner}, not this wallet (${this.pChainAddress})`,
          ERR.unauthorized,
        );
      }
    }
  }

  #record(send: Omit<WalletSend, 'at'>) {
    const entry = { ...send, at: new Date().toISOString() };
    this.sends.push(entry);
    const where = send.kind === 'evm' ? `chain ${send.chainId} nonce ${send.nonce}` : (send.chainAlias ?? 'P');
    this.#log(`sent ${send.txType} on ${where}: ${send.hash}`);
  }
}

// Who an output pays, for a refusal message.
function payee({ output }: TransferableOutput): string {
  const owners = utils.isTransferOut(output) ? output.getOwners() : [];
  return `it pays ${owners.map(pAddress).join(', ') || 'no secp256k1 owner'}`;
}

// The signer for a run. The key comes from chain.ts readFujiKey: the file that E2E_CHAIN_FUJI_KEY_FILE names, or
// E2E_CHAIN_FUJI_KEY. For a local run:
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key
export function createSignerFromEnv(options: Omit<SignerOptions, 'privateKey'> = {}): Signer {
  return new Signer({ ...options, privateKey: readFujiKey() });
}
