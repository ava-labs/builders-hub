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

// ── Raw JSON-RPC proxy for read methods ──────────────────────────

let rpcId = 1;
async function proxyRpc(method: string, params: any): Promise<any> {
  const res = await fetch(currentChain().rpcUrls[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params: params ?? [] }),
  });
  const body = await res.json();
  if (body.error) throw new RpcError(body.error.code ?? -32000, body.error.message ?? 'RPC error');
  return body.result;
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
      const result = await sdkClient().sendXPTransaction({
        tx: p.transactionHex,
        chainAlias: p.chainAlias,
        utxoIds: p.utxos,
      } as any);
      // Normalize to Core's response shape.
      if (typeof result === 'string') return { txHash: result };
      if (result && typeof (result as any).txHash === 'string') return result;
      if (result && typeof (result as any).txID === 'string') return { txHash: (result as any).txID };
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
