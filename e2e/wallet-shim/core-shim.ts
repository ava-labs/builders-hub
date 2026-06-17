/**
 * Core-impersonating wallet shim for the QA harness.
 *
 * Injected into every page via Playwright addInitScript (bundled by esbuild,
 * see ../fixtures.ts). Installs a private-key-backed EIP-1193 provider as
 * BOTH `window.ethereum` and `window.avalanche`, and announces itself via
 * EIP-6963 with rdns `app.core` so wagmi creates a connector with
 * id === 'app.core' — the exact signal WalletSync.tsx uses to take the Core
 * wallet path (P-Chain address derivation, coreWalletClient bootstrap).
 *
 * Provider surface (the contract is components/toolbox/coreViem/rpcSchema.ts):
 *  - standard EIP-1193 (accounts, chain switching, eth_sendTransaction,
 *    signing) — signed locally with the viem account, broadcast over HTTP RPC
 *  - avalanche_getAccountPubKey — compressed secp256k1 pubkeys; the console
 *    derives the P-Chain address from `xp`
 *  - avalanche_sendTransaction — signs the unsigned P/X/C tx hex with the XP
 *    key via @avalanche-sdk/client (the same code path the console bundles)
 *    and issues it to the network
 *  - wallet_getEthereumChain — Core's chain+isTestnet introspection method
 *  - everything else proxies to the active chain's JSON-RPC endpoint
 *
 * Config is read from `window.__QA_WALLET_CONFIG__` (set by a preceding init
 * script): { privateKey: '0x…' } — one key drives both the EVM and XP accounts.
 *
 * SAFETY: this is a Fuji/testnet tool. Mainnet C-Chain (43114) is registered
 * for chain-detection completeness but tx submission is refused unless
 * `allowMainnet` is explicitly set in the config.
 */

import { createAvalancheWalletClient } from '@avalanche-sdk/client';
// NOT '@avalanche-sdk/client/chains': that barrel re-exports viem/chains from
// the SDK's nested viem, which dropped a few chains the barrel still names —
// esbuild fails hard on the missing exports. The barrel adds nothing over
// root viem/chains (it is a verbatim re-export), so import the chains there.
import { avalanche as sdkAvalanche, avalancheFuji as sdkAvalancheFuji } from 'viem/chains';
import { privateKeyToAvalancheAccount } from '@avalanche-sdk/client/accounts';
// Top-level avalanchejs (the SDK nests its own copy; see resolveSubnetAuth
// for why mixing them is safe here).
import {
  utils as ajsUtils,
  avaxSerial,
  Credential,
  Signature,
  UnsignedTx,
  EVMUnsignedTx,
  PChainOwner,
  Int as AjsInt,
} from '@avalabs/avalanchejs';
import { createWalletClient, defineChain, http } from 'viem';

type Hex = `0x${string}`;

interface QAWalletConfig {
  privateKey: Hex;
  allowMainnet?: boolean;
}

interface ChainEntry {
  chainId: number;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  isTestnet: boolean;
}

interface RequestArgs {
  method: string;
  params?: any;
}

class RpcError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

const config: QAWalletConfig = (window as any).__QA_WALLET_CONFIG__;
if (!config?.privateKey) {
  throw new Error('[qa-wallet-shim] window.__QA_WALLET_CONFIG__.privateKey is not set');
}

const account = privateKeyToAvalancheAccount(config.privateKey);
const evmAddress = account.getEVMAddress() as Hex;
// Non-null assertions: a private-key account always carries these; the
// runtime guard below catches SDK behavior changes. (Plain narrowing won't
// do — TS doesn't propagate module-level guards into the closures below.)
const { evmAccount } = account;
const xpAccount = account.xpAccount!;
const signMessage = evmAccount.signMessage!.bind(evmAccount);
const signTypedData = evmAccount.signTypedData!.bind(evmAccount);
if (!xpAccount || !evmAccount.signMessage || !evmAccount.signTypedData) {
  throw new Error('[qa-wallet-shim] private-key account is missing signing capabilities');
}

// ── Chain registry ───────────────────────────────────────────────

const FUJI_C: ChainEntry = {
  chainId: 43113,
  chainName: 'Avalanche Fuji C-Chain',
  rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  isTestnet: true,
};

const MAINNET_C: ChainEntry = {
  chainId: 43114,
  chainName: 'Avalanche C-Chain',
  rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  isTestnet: false,
};

const chains = new Map<number, ChainEntry>([
  [FUJI_C.chainId, FUJI_C],
  [MAINNET_C.chainId, MAINNET_C],
]);

let currentChainId = FUJI_C.chainId;

function currentChain(): ChainEntry {
  return chains.get(currentChainId)!;
}

function toHexChainId(id: number): Hex {
  return `0x${id.toString(16)}` as Hex;
}

function assertNotMainnet(action: string) {
  if (!config.allowMainnet && !currentChain().isTestnet) {
    throw new RpcError(4001, `[qa-wallet-shim] refusing ${action} on mainnet (allowMainnet not set)`);
  }
}

// ── Event emitter (accountsChanged / chainChanged) ───────────────

const listeners = new Map<string, Set<(...args: any[]) => void>>();

function emit(event: string, ...args: any[]) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(...args);
    } catch {
      /* listener errors are not ours */
    }
  });
}

// ── EVM signing client (per active chain) ────────────────────────

function viemChainFor(entry: ChainEntry) {
  return defineChain({
    id: entry.chainId,
    name: entry.chainName,
    nativeCurrency: entry.nativeCurrency,
    rpcUrls: { default: { http: entry.rpcUrls } },
  });
}

function evmWalletClient() {
  const entry = currentChain();
  return createWalletClient({
    // The SDK pins its own nested viem; the account object is runtime-identical
    // but nominally typed against that copy, hence the cast.
    account: account.evmAccount as any,
    chain: viemChainFor(entry),
    transport: http(entry.rpcUrls[0]),
  });
}

// ── XP (P/X-Chain) signing via the Avalanche SDK ─────────────────
// With a full AvalancheAccount (xpAccount present) the SDK signs locally
// and issues via the public API — no wallet popup involved.

function sdkClient() {
  return createAvalancheWalletClient({
    // Root-viem chain into the SDK's nested-viem types — runtime-identical.
    chain: (currentChain().isTestnet ? sdkAvalancheFuji : sdkAvalanche) as any,
    transport: { type: 'http' },
    account,
  });
}

// ── Subnet-auth resolution for P-Chain txs ───────────────────────
// Txs that modify a subnet (CreateChainTx, ConvertSubnetToL1Tx,
// AddSubnetValidatorTx, ...) carry a subnetAuth credential that must be
// signed by the subnet's owner key. Real Core resolves the owners inside
// the wallet; the SDK only signs that credential when subnetOwners +
// subnetAuth are passed explicitly — without them it ships a zeroed
// signature and the node rejects with "unauthorized modification:
// invalid signature". This mirrors Core: parse the tx, and if it's a
// subnet-auth type, look up the owning CreateSubnetTx for its owner set.
async function resolveSubnetAuth(
  transactionHex: string,
): Promise<{ subnetOwners?: unknown; subnetAuth?: number[] }> {
  try {
    const manager = ajsUtils.getManagerForVM('PVM');
    const tx: any = manager.unpackTransaction(Buffer.from(ajsUtils.strip0x(transactionHex), 'hex'));
    if (typeof tx?.getSubnetAuth !== 'function' || typeof tx?.getSubnetID !== 'function') {
      return {};
    }
    const subnetId: string = tx.getSubnetID().toString();
    const subnetAuth: number[] = tx.getSubnetAuth().values();

    const rpcBase = currentChain().isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';
    const res = await fetch(`${rpcBase}/ext/bc/P`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcId++,
        method: 'platform.getTx',
        params: { txID: subnetId, encoding: 'hex' },
      }),
    });
    const body = await res.json();
    if (body.error || !body.result?.tx) return {};
    const signed: any = manager.unpack(
      Buffer.from(ajsUtils.strip0x(body.result.tx), 'hex'),
      avaxSerial.SignedTx as any,
    );
    const owners = signed.unsignedTx?.getSubnetOwners?.();
    if (!owners) return {};
    // 5.0.0 classes into the SDK's nested 5.1.0 types — only duck-typed
    // surface (addresses[].toString(hrp)) crosses the boundary.
    const subnetOwners = new PChainOwner(new AjsInt(owners.threshold.value()), owners.addrs);
    return { subnetOwners, subnetAuth };
  } catch {
    // Best effort: non-subnet txs (and anything unparseable) use the
    // plain signing path, which is correct for them.
    return {};
  }
}

// ── Single-key atomic tx signing (cross-chain export/import) ─────
// A cross-chain transfer has one C-Chain *atomic* leg (an EVM export/import)
// and one P-Chain *atomic* leg (a PVM import). The SDK's sendXPTransaction
// re-signs from hex via a path that (a) reads `baseTx.inputs` and throws on
// EVM atomic txs, and (b) only credentials `baseTx.inputs`, missing the
// `importedInputs` a PVM import is paid from. Real Core signs both natively.
//
// Because this shim is a SINGLE-KEY wallet, every input is owned by our one
// key. We sign the UnsignedTx byte form (the exact sequence avalanchego
// hashes — NOT the bare inner-tx bytes, which differ for PVM) and place that
// one signature into every credential slot getSigIndices enumerates (which
// includes importedInputs). Verified end-to-end against Fuji.
async function signAndIssueSingleKey(
  transactionHex: string,
  vm: 'EVM' | 'PVM',
  endpointPath: string,
  issueMethod: string,
): Promise<string> {
  const manager = ajsUtils.getManagerForVM(vm);
  const codec = manager.getDefaultCodec();
  const innerTx = manager.unpackTransaction(ajsUtils.hexToBuffer(transactionHex));
  const Wrapper = vm === 'EVM' ? EVMUnsignedTx : UnsignedTx;
  const wrapped = new Wrapper(innerTx as any, [], new ajsUtils.AddressMaps(), []);

  // Sign the UnsignedTx byte form — the exact sequence avalanchego hashes.
  // (For PVM this differs from the bare inner-tx bytes; for EVM they match.)
  const sig = await xpAccount.signTransaction(wrapped.toBytes());
  const sigBytes = typeof sig === 'string' ? ajsUtils.hexToBuffer(sig) : sig;
  // One credential per input, each holding our single signature, in the order
  // getSigIndices enumerates (covers fee inputs AND importedInputs).
  const credentials = wrapped
    .getSigIndices()
    .map((idxs) => new Credential(idxs.map(() => new Signature(sigBytes))));

  const signedTx = new avaxSerial.SignedTx(innerTx, credentials);
  // SignedTx.toBytes is typed 0-arg but accepts a codec at runtime (verified
  // against Fuji); cast to pass the VM's codec explicitly.
  const signedHex = ajsUtils.bufferToHex(
    ajsUtils.addChecksum((signedTx as { toBytes(c: unknown): Uint8Array }).toBytes(codec)),
  );

  const rpcBase = currentChain().isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network';
  const res = await fetch(`${rpcBase}${endpointPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: rpcId++,
      method: issueMethod,
      params: { tx: signedHex, encoding: 'hex' },
    }),
  });
  const body = await res.json();
  if (body.error) throw new RpcError(body.error.code ?? -32000, body.error.message ?? `${issueMethod} error`);
  return body.result.txID as string;
}

/** True for a PVM ImportTx — the cross-chain import leg the SDK can't sign. */
function isPvmImportTx(transactionHex: string): boolean {
  try {
    const innerTx = ajsUtils
      .getManagerForVM('PVM')
      .unpackTransaction(ajsUtils.hexToBuffer(transactionHex)) as any;
    return innerTx?._type === 'pvm.ImportTx' || typeof innerTx?.importedInputs !== 'undefined';
  } catch {
    return false;
  }
}

// ── Raw JSON-RPC proxy for read methods ──────────────────────────

let rpcId = 1;
async function proxyRpc(method: string, params: any): Promise<any> {
  const url = currentChain().rpcUrls[0];
  const payload = JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params: params ?? [] });

  // The public Fuji RPC rate-limits under parallel test load. Throttle (429)
  // and gateway (5xx) responses come back without CORS headers, so the browser
  // surfaces them as a bare "Failed to fetch" TypeError. Retry transient
  // failures with exponential backoff — exactly what a real wallet does — so a
  // momentary throttle doesn't masquerade as a shim/flow regression. A real
  // JSON-RPC error (RpcError) is a protocol-level result, not transient, so it
  // propagates immediately.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`RPC HTTP ${res.status} from ${url}`);
        continue;
      }
      const body = await res.json();
      if (body.error) throw new RpcError(body.error.code ?? -32000, body.error.message ?? 'RPC error');
      return body.result;
    } catch (e) {
      if (e instanceof RpcError) throw e;
      lastErr = e; // network-layer "Failed to fetch" — retry
    }
  }
  throw lastErr;
}

// ── Tx param mapping for eth_sendTransaction ─────────────────────

function hexToBigInt(v: string | undefined): bigint | undefined {
  return v === undefined ? undefined : BigInt(v);
}

async function handleEthSendTransaction(params: any[]): Promise<Hex> {
  assertNotMainnet('eth_sendTransaction');
  const tx = params[0] ?? {};
  const client = evmWalletClient();
  return client.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: hexToBigInt(tx.value),
    gas: hexToBigInt(tx.gas),
    gasPrice: hexToBigInt(tx.gasPrice),
    maxFeePerGas: hexToBigInt(tx.maxFeePerGas),
    maxPriorityFeePerGas: hexToBigInt(tx.maxPriorityFeePerGas),
    nonce: tx.nonce === undefined ? undefined : Number(BigInt(tx.nonce)),
  } as any);
}

// ── The request() dispatcher ─────────────────────────────────────

async function request({ method, params }: RequestArgs): Promise<any> {
  switch (method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      return [evmAddress];

    case 'eth_chainId':
      return toHexChainId(currentChainId);

    case 'net_version':
      return String(currentChainId);

    case 'wallet_switchEthereumChain': {
      const target = parseInt(params?.[0]?.chainId, 16);
      if (!chains.has(target)) {
        throw new RpcError(4902, `Unrecognized chain ID ${params?.[0]?.chainId}. Add the chain first.`);
      }
      if (target !== currentChainId) {
        currentChainId = target;
        emit('chainChanged', toHexChainId(target));
      }
      return null;
    }

    case 'wallet_addEthereumChain': {
      const p = params?.[0] ?? {};
      const id = parseInt(p.chainId, 16);
      if (!chains.has(id)) {
        chains.set(id, {
          chainId: id,
          chainName: p.chainName ?? `Chain ${id}`,
          rpcUrls: p.rpcUrls ?? [],
          nativeCurrency: p.nativeCurrency ?? { name: 'Token', symbol: 'TKN', decimals: 18 },
          // QA harness operates on Fuji: custom L1s added at runtime are
          // treated as testnets (mirrors Core's behavior in testnet mode).
          isTestnet: id !== MAINNET_C.chainId,
        });
      }
      if (id !== currentChainId) {
        currentChainId = id;
        emit('chainChanged', toHexChainId(id));
      }
      return null;
    }

    // ── Core-specific methods (coreViem/rpcSchema.ts) ──

    case 'wallet_getEthereumChain': {
      const entry = currentChain();
      return {
        chainId: toHexChainId(entry.chainId),
        chainName: entry.chainName,
        rpcUrls: entry.rpcUrls,
        nativeCurrency: entry.nativeCurrency,
        isTestnet: entry.isTestnet,
      };
    }

    case 'avalanche_getAccountPubKey':
      // Compressed pubkeys; getPChainAddress normalizes via noble Point.fromHex.
      return {
        evm: evmAccount.publicKey,
        xp: xpAccount.publicKey,
      };

    case 'avalanche_sendTransaction': {
      assertNotMainnet('avalanche_sendTransaction');
      const p = params ?? {};
      // Cross-chain atomic legs need native signing the SDK's XP re-sign path
      // can't do: the C-Chain (EVM) export/import, and the P-Chain import
      // (whose value lives in importedInputs the SDK leaves uncredentialed).
      if (p.chainAlias === 'C') {
        return await signAndIssueSingleKey(p.transactionHex, 'EVM', '/ext/bc/C/avax', 'avax.issueTx');
      }
      if (p.chainAlias === 'P' && isPvmImportTx(p.transactionHex)) {
        return await signAndIssueSingleKey(p.transactionHex, 'PVM', '/ext/bc/P', 'platform.issueTx');
      }
      const auth = p.chainAlias === 'P' ? await resolveSubnetAuth(p.transactionHex) : {};
      const result = await sdkClient().sendXPTransaction({
        tx: p.transactionHex,
        chainAlias: p.chainAlias,
        utxoIds: p.utxos,
        ...auth,
      } as any);
      // Real Core returns the bare tx hash string here; callers like the
      // SDK's sendXPTransaction wrap it into { txHash } themselves, so
      // returning an object double-wraps and the UI stores [object Object].
      if (typeof result === 'string') return result;
      if (result && typeof (result as any).txHash === 'string') return (result as any).txHash;
      if (result && typeof (result as any).txID === 'string') return (result as any).txID;
      return result;
    }

    // ── Local signing ──

    case 'eth_sendTransaction':
      return handleEthSendTransaction(params ?? []);

    case 'personal_sign': {
      // params: [message, address]
      const raw = params?.[0] as Hex;
      return signMessage({ message: { raw } });
    }

    case 'eth_signTypedData_v4': {
      // params: [address, jsonPayload]
      const payload = typeof params?.[1] === 'string' ? JSON.parse(params[1]) : params?.[1];
      return signTypedData(payload);
    }

    // ── Everything else: read methods → chain RPC ──

    default:
      return proxyRpc(method, params);
  }
}

// ── Provider object ──────────────────────────────────────────────

const provider = {
  isAvalanche: true as const,
  isMetaMask: false,
  request,
  on(event: string, fn: (...args: any[]) => void) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return provider;
  },
  addListener(event: string, fn: (...args: any[]) => void) {
    return provider.on(event, fn);
  },
  once(event: string, fn: (...args: any[]) => void) {
    const wrapped = (...args: any[]) => {
      provider.removeListener(event, wrapped);
      fn(...args);
    };
    return provider.on(event, wrapped);
  },
  removeListener(event: string, fn: (...args: any[]) => void) {
    listeners.get(event)?.delete(fn);
    return provider;
  },
  off(event: string, fn: (...args: any[]) => void) {
    return provider.removeListener(event, fn);
  },
};

// ── Install: window globals + EIP-6963 announcement ──────────────

Object.defineProperty(window, 'avalanche', { value: provider, configurable: true });
Object.defineProperty(window, 'ethereum', { value: provider, configurable: true });

// crypto.randomUUID is secure-context-only; fall back for http targets.
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const providerInfo = Object.freeze({
  uuid: uuid(),
  name: 'Core',
  // Minimal placeholder icon — RainbowKit requires a data URI to render the entry.
  icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iI2U4NDE0MiIvPjwvc3ZnPg==',
  rdns: 'app.core',
});

function announceProvider() {
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info: providerInfo, provider }),
    }),
  );
}

window.addEventListener('eip6963:requestProvider', announceProvider);
announceProvider();

console.log(`[qa-wallet-shim] installed — EVM ${evmAddress}, P-Chain ${account.getXPAddress('P', 'fuji')}`);
