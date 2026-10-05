import { createHash } from 'node:crypto';
import { avaxSerial, Credential, pvmSerial, secp256k1, Signature, utils, type Common } from '@avalabs/avalanchejs';
import { getAddress, keccak256, type AccessList, type Hex, type TransactionSerializable } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { FUJI, formatNanoAvax, isRateLimited, NANO_AVAX, readFujiKey, RpcError, throttledFetch } from '../lib/chain.ts';

// The Node half of the e2e Core wallet. The page holds a provider with no key (provider.ts); it posts each request
// to /__e2e/wallet, and bridge.ts answers it with `handle`. The key exists only in this module. Nothing here prints
// it, returns it or puts it in an error.
//
// One key signs for the EVM (C-Chain and L1s) and for the P-Chain, as a Core account made from one private key.
//
// The wallet approves each request with no prompt, and any script on the Console page can send it requests. So it
// signs only what tier 1 needs, and refuses the rest with 4001 and the reason:
// - Chains: an allowlist. The Fuji C-Chain (43113), the Fuji P-Chain (network ID 5), and each EVM chain that test
//   code registers with allowChain(). wallet_addEthereumChain for any other chain ID is refused. Each request goes
//   to Fuji or to a registered RPC URL, never to a URL from the page.
// - EVM txs: no value, and gas x max fee at most 0.002 AVAX. No personal_sign or eth_signTypedData_v4.
// - P-Chain txs: the 7 types of tier 1 only (P_TX_TYPES). Each output is change to this wallet's P-Chain address.
//   The AVAX that leaves the wallet is the fee (at most 0.01 AVAX) and a validator balance in the tx's own field
//   (at most 0.05 AVAX), and that validator's remaining balance comes back to this wallet. The P-Chain txs of one
//   Signer spend at most 0.2 AVAX in total.
// - No C-Chain atomic txs (export and import).
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

// The P-Chain tx types that tier 1 sends. BaseTx, ExportTx and ImportTx move AVAX to any address, so the wallet
// refuses them, and every other type.
const P_TX_TYPES = new Set<string>([
  'pvm.CreateSubnetTx',
  'pvm.CreateChainTx',
  'pvm.ConvertSubnetToL1Tx',
  'pvm.RegisterL1ValidatorTx',
  'pvm.SetL1ValidatorWeightTx',
  'pvm.IncreaseL1ValidatorBalanceTx',
  'pvm.DisableL1ValidatorTx',
]);

// Caps, in nAVAX for the P-Chain and in wei for the EVM. A tier 1 run measured on 2026-10-04: P-Chain fees of 5,139
// to 55,662 nAVAX, validator balances of 0.02, 0.02 and 0.01 AVAX, and EVM gas x max fee below 1e-9 AVAX.
const P_FEE_CAP = NANO_AVAX / 100n; // 0.01 AVAX per tx
const P_BALANCE_CAP = NANO_AVAX / 20n; // 0.05 AVAX per tx
const P_SPEND_CAP = NANO_AVAX / 5n; // 0.2 AVAX per Signer: fees and validator balances
const EVM_FEE_CAP = 2_000_000_000_000_000n; // 0.002 AVAX per tx

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
  kind: 'evm' | 'p-chain';
  // The EVM chain ID, for kind 'evm'.
  chainId?: number;
  // 'eth_sendTransaction', or the avalanchejs type of a P-Chain tx (for example 'pvm.CreateSubnetTx').
  txType: string;
  // The EVM tx hash, or the P-Chain tx ID (cb58).
  hash: string;
  // The EVM nonce, for kind 'evm'.
  nonce?: number;
  at: string;
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
  // The nAVAX the tx takes from the wallet: the fee and the validator balance.
  spent: bigint;
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

// The type of a C-Chain atomic tx, for a refusal message. Empty when the hex does not decode.
function cChainTxType(transactionHex: string): string {
  try {
    return ` (${utils.getManagerForVM('EVM').unpackTransaction(utils.hexToBuffer(transactionHex))._type})`;
  } catch {
    return '';
  }
}

// The nAVAX that a P-Chain tx puts into validator balances, from the tx's own fields.
function validatorBalance(tx: Common.Transaction): bigint {
  if (pvmSerial.isConvertSubnetToL1Tx(tx)) return tx.validators.reduce((sum, v) => sum + v.balance.value(), 0n);
  if (pvmSerial.isRegisterL1ValidatorTx(tx) || pvmSerial.isIncreaseL1ValidatorBalanceTx(tx)) return tx.balance.value();
  return 0n;
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

export class Signer {
  // The EVM address, checksummed.
  readonly address: Hex;
  // The P-Chain address, 'P-fuji1...'.
  readonly pChainAddress: string;
  // The compressed secp256k1 public key (33 bytes, 0x hex). avalanche_getAccountPubKey returns it for evm and xp.
  readonly publicKey: Hex;
  // Every tx the wallet sent, in order.
  readonly sends: WalletSend[] = [];

  #key: Uint8Array;
  // The 20 bytes of the P-Chain address.
  #pAddressBytes: Uint8Array;
  #account: PrivateKeyAccount;
  #chains = new Map<number, ChainState>();
  // The EVM chains that test code lets the page add, with the RPC URL the wallet uses for each.
  #allowed = new Map<number, string>();
  #currentChainId: number = FUJI.cChainId;
  #pChainLock = createLock();
  // The nAVAX that the P-Chain txs of this signer took from the wallet: fees and validator balances.
  #pSpent = 0n;
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

  // Answers one EIP-1193 request. Throws RpcError; bridge.ts turns it into a JSON-RPC error for the page.
  async handle({ method, params }: WalletRequest): Promise<unknown> {
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
      case 'avalanche_sendTransaction':
        return this.#sendXP(params);
      case 'eth_sendTransaction':
        return this.#sendEvm(params);
      default:
        if (this.#isForwardedRead(method)) return this.#forward(method, params);
        this.#log(`refused unsupported method ${method}`);
        throw new RpcError(ERR.unsupported, `[e2e wallet] unsupported method: ${method}`);
    }
  }

  // Checks a P-Chain tx against the tier 1 rules (#checkPChainTx) and signs it. Does not issue it. The hex is what
  // @avalanche-sdk/client sends in avalanche_sendTransaction: the codec-prefixed unsigned tx (UnsignedTx.toBytes()).
  async signPChainTx(transactionHex: string): Promise<SignedPChainTx> {
    let tx: Common.Transaction;
    try {
      tx = utils.getManagerForVM('PVM').unpackTransaction(utils.hexToBuffer(transactionHex));
    } catch (err) {
      throw new RpcError(ERR.invalidParams, `[e2e wallet] cannot read the P-Chain tx: ${errorMessage(err)}`);
    }
    const { credentials, spent } = await this.#checkPChainTx(tx);
    // avalanchego signs sha256 of the codec-prefixed unsigned tx; secp256k1.sign hashes with sha256.
    const signature = await secp256k1.sign(utils.packTx(tx), this.#key);
    const signedBytes = new avaxSerial.SignedTx(
      tx,
      credentials.map((indices) => new Credential(indices.map(() => new Signature(signature)))),
    ).toBytes();
    return {
      signedTxHex: utils.bufferToHex(utils.addChecksum(signedBytes)) as Hex,
      txId: utils.base58check.encode(sha256(signedBytes)),
      txType: tx._type,
      credentials,
      spent,
    };
  }

  // Logs a refusal and returns the 4001 error for it.
  #refuse(what: string): RpcError {
    this.#log(`refused ${what}`);
    return new RpcError(ERR.userRejected, `[e2e wallet] refuses ${what}`);
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
      throw this.#refuse(`a switch to chain ${target}: only Fuji (${FUJI.cChainId}) and the chains the test allows`);
    }
    this.#currentChainId = target;
    return null;
  }

  async #addChain(params: unknown): Promise<null> {
    const p = firstParam(params);
    const id = parseChainId(p.chainId);
    if (!this.#chains.has(id)) {
      const rpcUrl = this.#allowed.get(id);
      if (!rpcUrl)
        throw this.#refuse(`to add chain ${id}: only Fuji (${FUJI.cChainId}) and the chains the test allows`);
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
    const tx = firstParam(params);
    const state = this.#state(this.#currentChainId);
    const { chainId } = state.chain;
    if (typeof tx.from === 'string' && tx.from.toLowerCase() !== this.address.toLowerCase()) {
      throw new RpcError(ERR.unauthorized, `[e2e wallet] from ${tx.from} is not this wallet (${this.address})`);
    }
    if (tx.chainId !== undefined && parseChainId(tx.chainId) !== chainId) {
      throw new RpcError(
        ERR.invalidParams,
        `[e2e wallet] tx chainId ${String(tx.chainId)} is not the wallet chain ${chainId}`,
      );
    }
    const value = quantity(tx.value, 'value');
    if (value) throw this.#refuse(`eth_sendTransaction with value ${value} wei: tier 1 sends no value`);
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
      if (gas * maxPrice > EVM_FEE_CAP) {
        throw this.#refuse(`eth_sendTransaction with gas ${gas} x max fee ${maxPrice} wei: more than 0.002 AVAX`);
      }
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

  // Runs under the chain lock.
  async #nextNonce(state: ChainState, given: bigint | undefined): Promise<number> {
    const pending = await this.#pendingNonce(state.chain.rpcUrls[0]);
    const remembered =
      state.lastNonce && Date.now() - state.lastNonce.at < NONCE_MEMORY_MS ? state.lastNonce.nonce + 1 : 0;
    return Math.max(Number(given ?? 0n), pending, remembered);
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

  // ---- P-Chain sends ----

  async #sendXP(params: unknown): Promise<string> {
    const { transactionHex, chainAlias } = firstParam(params);
    if (typeof transactionHex !== 'string') {
      throw new RpcError(ERR.invalidParams, '[e2e wallet] avalanche_sendTransaction needs transactionHex');
    }
    if (chainAlias !== 'P') {
      const type = chainAlias === 'C' ? cChainTxType(transactionHex) : '';
      throw this.#refuse(`a tx on chain ${String(chainAlias)}${type}: tier 1 sends P-Chain txs only`);
    }
    return this.#pChainLock(async () => {
      const signed = await this.signPChainTx(transactionHex);
      if (this.#pSpent + signed.spent > P_SPEND_CAP) {
        throw this.#refuse(
          `${signed.txType}: it spends ${formatNanoAvax(signed.spent)} AVAX, and this signer has spent ` +
            `${formatNanoAvax(this.#pSpent)} of its ${formatNanoAvax(P_SPEND_CAP)} AVAX`,
        );
      }
      // Counted before the issue: an issue that fails after the node took the tx still spent it.
      this.#pSpent += signed.spent;
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

  // The tier 1 rules for a P-Chain tx (see the top of this file). The checks that need no network come first, so a
  // refused tx makes no request; then the owner lookups. Returns the credential layout, in the order avalanchego reads
  // it (the fee inputs, then the owner auth; one key owns every input, so each slot gets the same signature), and
  // the nAVAX the tx takes from the wallet.
  async #checkPChainTx(tx: Common.Transaction): Promise<{ credentials: number[][]; spent: bigint }> {
    const type = tx._type;
    if (!P_TX_TYPES.has(type)) {
      throw this.#refuse(`P-Chain tx type ${type}: the wallet signs only ${[...P_TX_TYPES].join(', ')}`);
    }
    const { baseTx } = tx as unknown as { baseTx: avaxSerial.BaseTx };
    const networkId = baseTx.NetworkId.value();
    if (networkId !== FUJI.networkId) throw this.#refuse(`a ${type} for network ID ${networkId}: Fuji (5) only`);
    if (baseTx.BlockchainId.toString() !== FUJI.pBlockchainId) {
      throw new RpcError(ERR.invalidParams, `[e2e wallet] ${type} is for blockchain ${baseTx.BlockchainId}`);
    }

    // The AVAX that leaves the wallet: the inputs minus the change. Each output must be change to this wallet.
    let spent = 0n;
    for (const input of baseTx.inputs) {
      if (input.getAssetId() !== FUJI.avaxAssetId || !utils.isTransferInput(input.input)) {
        throw this.#refuse(`${type}: an input is not unlocked AVAX`);
      }
      spent += input.amount();
    }
    for (const { output, assetId } of baseTx.outputs) {
      const owners = utils.isTransferOut(output) ? output.getOwners() : [];
      const change =
        assetId.toString() === FUJI.avaxAssetId &&
        utils.isTransferOut(output) &&
        output.getLocktime() === 0n &&
        this.#isOurs(output.getThreshold(), owners);
      if (!change) {
        const payee = owners.map(pAddress).join(', ') || 'no secp256k1 owner';
        throw this.#refuse(`${type}: an output is not unlocked AVAX change to this wallet (it pays ${payee})`);
      }
      spent -= output.amount();
    }
    // A validator balance is in the tx's own field; the fee is what is left.
    const balance = validatorBalance(tx);
    const fee = spent - balance;
    if (fee < 0n) throw new RpcError(ERR.invalidParams, `[e2e wallet] ${type}: the inputs do not cover the tx`);
    if (fee > P_FEE_CAP) throw this.#refuse(`${type}: a fee of ${formatNanoAvax(fee)} AVAX (cap 0.01)`);
    if (balance > P_BALANCE_CAP) {
      throw this.#refuse(`${type}: a validator balance of ${formatNanoAvax(balance)} AVAX (cap 0.05)`);
    }

    // The owners in the tx: each must be this wallet alone.
    if (pvmSerial.isCreateSubnetTx(tx)) {
      const owners = tx.getSubnetOwners();
      const ours = owners.locktime.value() === 0n && this.#isOurs(owners.threshold.value(), bytesOf(owners.addrs));
      if (!ours) throw this.#refuse(`${type}: the subnet owner is not this wallet`);
    }
    if (pvmSerial.isConvertSubnetToL1Tx(tx)) {
      for (const v of tx.validators) {
        for (const [name, owner] of [
          ['remaining balance owner', v.remainingBalanceOwner],
          ['deactivation owner', v.deactivationOwner],
        ] as const) {
          if (!this.#isOurs(owner.threshold.value(), bytesOf(owner.addresses))) {
            throw this.#refuse(`${type}: a validator's ${name} is not this wallet`);
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
        throw this.#refuse(`${type}: the remaining balance owner is not this wallet`);
      }
      if (!this.#isOurs(disable.threshold, disable.addresses)) {
        throw this.#refuse(`${type}: the disable owner is not this wallet`);
      }
    }

    const fees = baseTx.inputs.map((input) => input.sigIndicies());
    if (tx instanceof pvmSerial.AbstractSubnetTx) {
      const subnetId = tx.getSubnetID().toString();
      const auth = tx.getSubnetAuth().values();
      const owner = await this.#lookup<{ controlKeys?: string[]; threshold?: string }>(
        'platform.getSubnet',
        { subnetID: subnetId },
        `subnet ${subnetId}`,
      );
      this.#checkAuth(`${type} subnet auth (subnet ${subnetId})`, owner.controlKeys, owner.threshold, auth);
      return { credentials: [...fees, auth], spent };
    }
    if (pvmSerial.isDisableL1ValidatorTx(tx)) {
      const validationId = tx.validationId.toString();
      const auth = tx.getDisableAuth().values();
      const validator = await this.#l1Validator(validationId);
      const owner = validator.deactivationOwner;
      this.#checkAuth(`disable auth (validation ${validationId})`, owner?.addresses, owner?.threshold, auth);
      return { credentials: [...fees, auth], spent };
    }
    if (pvmSerial.isIncreaseL1ValidatorBalanceTx(tx)) {
      // The balance stays with the validator and comes back to its remaining balance owner, which must be us.
      const validationId = tx.validationId.toString();
      const owner = (await this.#l1Validator(validationId)).remainingBalanceOwner;
      const ours = bareXPAddress(this.pChainAddress);
      if (owner?.threshold !== '1' || owner.addresses?.length !== 1 || bareXPAddress(owner.addresses[0]) !== ours) {
        throw this.#refuse(`${type}: validator ${validationId} returns its balance to another owner`);
      }
    }
    return { credentials: fees, spent };
  }

  // True when the owner is this wallet alone: threshold 1 and one address, ours.
  #isOurs(threshold: number, addresses: Uint8Array[]): boolean {
    return threshold === 1 && addresses.length === 1 && utils.bytesEqual(addresses[0], this.#pAddressBytes);
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
        const result = await this.#rpc(FUJI.pRpc, method, params);
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
  #checkAuth(what: string, addresses: string[] | undefined, threshold: string | undefined, auth: number[]) {
    if (!addresses || addresses.length === 0)
      throw new RpcError(ERR.internal, `[e2e wallet] ${what}: the owner has no addresses`);
    const needed = Number(threshold ?? 1);
    if (auth.length < needed) {
      throw new RpcError(ERR.unauthorized, `[e2e wallet] ${what}: the tx signs ${auth.length} of ${needed} owners`);
    }
    const ours = bareXPAddress(this.pChainAddress);
    for (const index of auth) {
      const owner = addresses[index];
      if (owner === undefined)
        throw new RpcError(ERR.unauthorized, `[e2e wallet] ${what}: auth index ${index} has no owner`);
      if (bareXPAddress(owner) !== ours) {
        throw new RpcError(
          ERR.unauthorized,
          `[e2e wallet] ${what}: owner ${index} is ${owner}, not this wallet (${this.pChainAddress})`,
        );
      }
    }
  }

  #record(send: Omit<WalletSend, 'at'>) {
    const entry = { ...send, at: new Date().toISOString() };
    this.sends.push(entry);
    const where = send.kind === 'evm' ? `chain ${send.chainId} nonce ${send.nonce}` : send.kind;
    this.#log(`sent ${send.txType} on ${where}: ${send.hash}`);
  }
}

// The signer for a run. The key comes from chain.ts readFujiKey: the file that E2E_CHAIN_FUJI_KEY_FILE names, or
// E2E_CHAIN_FUJI_KEY. For a local run:
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key
export function createSignerFromEnv(options: Omit<SignerOptions, 'privateKey'> = {}): Signer {
  return new Signer({ ...options, privateKey: readFujiKey() });
}
