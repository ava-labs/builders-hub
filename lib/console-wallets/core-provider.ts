'use client';

import { createAvalancheWalletClient } from '@avalanche-sdk/client';
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
import { Buffer } from 'buffer';
import { createWalletClient, defineChain, getAddress, http } from 'viem';
import { avalanche as sdkAvalanche, avalancheFuji as sdkAvalancheFuji } from 'viem/chains';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { avalancheAccountFor, listWallets, subscribe, type AvalancheAccount, type WalletInfo } from './vault';

/*
 * The console's wallet when a Console wallet is selected in the top bar: an EIP-1193 provider that answers like
 * Core, so the console's wallet sync, its Core client and every P-Chain tool work unchanged. EVM transactions and
 * messages are signed with the wallet's key; P/X-Chain transactions are signed with the same key through the
 * Avalanche SDK and issued to the public API. Nothing prompts: an unlocked wallet signs.
 */

type Hex = `0x${string}`;

interface ChainEntry {
  chainId: number;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  isTestnet: boolean;
}

class RpcError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export const CONSOLE_WALLET_CONNECTOR_ID = 'console-wallet';
/** Dispatched on window to open the top bar's Console wallet switch, for example from a tool's requirements. */
export const OPEN_CONSOLE_WALLETS_EVENT = 'console-wallets:open';
/** Dispatched when something needs a signature from the locked active wallet; the top bar answers with its PIN prompt. */
export const UNLOCK_REQUEST_EVENT = 'console-wallets:unlock-request';
/** Dispatched when that PIN prompt closes without unlocking, so the pending request is rejected. */
export const UNLOCK_CANCELLED_EVENT = 'console-wallets:unlock-cancelled';
const ACTIVE_KEY = 'console-wallets:active';
const CHAIN_KEY = 'console-wallets:chain';

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

/* ------------------------------ active wallet ------------------------------ */

const activeListeners = new Set<() => void>();

export function getActiveConsoleWallet(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Which Console wallet the console signs with; null hands signing back to the browser wallet. */
export function setActiveConsoleWallet(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage disabled: the choice lasts until reload */
  }
  activeListeners.forEach((fn) => fn());
  void provider.syncAccounts();
}

export function subscribeActiveConsoleWallet(fn: () => void) {
  activeListeners.add(fn);
  return () => {
    activeListeners.delete(fn);
  };
}

const activeAccount = (): AvalancheAccount | null => {
  const id = getActiveConsoleWallet();
  return id ? avalancheAccountFor(id) : null;
};

/* The wallet list without keys: a locked wallet still shows its addresses and balances, and asks for the PIN to sign. */
let known: WalletInfo[] | null = null;
const loadKnown = async () => (known = await listWallets());

async function activeInfo(): Promise<WalletInfo | null> {
  const id = getActiveConsoleWallet();
  if (!id) return null;
  return known?.find((w) => w.id === id) ?? (await loadKnown()).find((w) => w.id === id) ?? null;
}

/* --------------------------------- chains --------------------------------- */

const added = new Map<number, ChainEntry>();

function fromL1(item: L1ListItem, isTestnet: boolean): ChainEntry {
  return {
    chainId: item.evmChainId,
    chainName: item.name,
    rpcUrls: [item.rpcUrl],
    nativeCurrency: item.nativeCurrency ?? { name: item.coinName, symbol: item.coinName, decimals: 18 },
    isTestnet: item.isTestnet ?? isTestnet,
  };
}

/** A chain the console knows: the two C-Chains, every L1 in the console's lists, and chains added at runtime. */
function chainEntry(chainId: number): ChainEntry | null {
  if (chainId === FUJI_C.chainId) return FUJI_C;
  if (chainId === MAINNET_C.chainId) return MAINNET_C;
  const runtime = added.get(chainId);
  if (runtime) return runtime;
  for (const testnet of [true, false]) {
    const item = getL1ListStore(testnet)
      .getState()
      .l1List.find((l: L1ListItem) => l.evmChainId === chainId && l.rpcUrl);
    if (item) return fromL1(item, testnet);
  }
  return null;
}

let currentChainId = (() => {
  try {
    const saved = Number(localStorage.getItem(CHAIN_KEY));
    return saved > 0 ? saved : FUJI_C.chainId;
  } catch {
    return FUJI_C.chainId;
  }
})();

const currentChain = () => chainEntry(currentChainId) ?? FUJI_C;
const toHexChainId = (id: number) => `0x${id.toString(16)}` as Hex;
const pChainApi = () => (currentChain().isTestnet ? 'https://api.avax-test.network' : 'https://api.avax.network');

function setChain(id: number) {
  if (id === currentChainId) return;
  currentChainId = id;
  try {
    localStorage.setItem(CHAIN_KEY, String(id));
  } catch {
    /* ignore */
  }
  emit('chainChanged', toHexChainId(id));
}

/* --------------------------------- events --------------------------------- */

const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
function emit(event: string, ...args: unknown[]) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(...args);
    } catch {
      /* listener errors are not ours */
    }
  });
}

/* --------------------------------- signing -------------------------------- */

/** The unlocked active account; a locked one asks the top bar for its PIN and waits, like a wallet popup. */
async function requireAccount(): Promise<AvalancheAccount> {
  const ready = activeAccount();
  if (ready) return ready;
  if (!(await activeInfo()) || typeof window === 'undefined') {
    throw new RpcError(4100, 'Choose a Console wallet from the top bar first.');
  }
  return new Promise((resolve, reject) => {
    const done = () => {
      off();
      window.removeEventListener(UNLOCK_CANCELLED_EVENT, cancelled);
    };
    const off = subscribe(() => {
      const account = activeAccount();
      if (account) {
        done();
        resolve(account);
      }
    });
    const cancelled = () => {
      done();
      reject(new RpcError(4001, 'The Console wallet stayed locked.'));
    };
    window.addEventListener(UNLOCK_CANCELLED_EVENT, cancelled);
    window.dispatchEvent(new Event(UNLOCK_REQUEST_EVENT));
  });
}

let rpcId = 1;

async function postJson(url: string, method: string, params: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params: params ?? [] }),
  });
  const body = await res.json();
  if (body.error) throw new RpcError(body.error.code ?? -32000, body.error.message ?? `${method} failed`);
  return body.result;
}

/** Reads go to the active chain's RPC, retried briefly when a public endpoint throttles. */
async function proxyRpc(method: string, params: unknown) {
  const url = currentChain().rpcUrls[0];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
    try {
      return await postJson(url, method, params);
    } catch (e) {
      if (e instanceof RpcError) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

function evmWalletClient(account: AvalancheAccount) {
  const entry = currentChain();
  return createWalletClient({
    // The SDK pins its own viem; the account is runtime-identical to root viem's.
    account: account.evmAccount as never,
    chain: defineChain({
      id: entry.chainId,
      name: entry.chainName,
      nativeCurrency: entry.nativeCurrency,
      rpcUrls: { default: { http: entry.rpcUrls } },
    }),
    transport: http(entry.rpcUrls[0]),
  });
}

const big = (v: string | undefined) => (v === undefined ? undefined : BigInt(v));

async function sendEvmTransaction(params: unknown[]): Promise<Hex> {
  const tx = (params[0] ?? {}) as Record<string, string | undefined>;
  return evmWalletClient(await requireAccount()).sendTransaction({
    to: tx.to as Hex | undefined,
    data: tx.data as Hex | undefined,
    value: big(tx.value),
    gas: big(tx.gas),
    gasPrice: big(tx.gasPrice),
    maxFeePerGas: big(tx.maxFeePerGas),
    maxPriorityFeePerGas: big(tx.maxPriorityFeePerGas),
    nonce: tx.nonce === undefined ? undefined : Number(BigInt(tx.nonce)),
  } as never);
}

/**
 * Txs that modify a subnet carry a subnetAuth credential signed by the subnet's owners. Core resolves the owners
 * itself; the SDK signs that credential only when subnetOwners and subnetAuth are passed, so look them up from the
 * subnet's CreateSubnetTx.
 */
async function resolveSubnetAuth(transactionHex: string): Promise<{ subnetOwners?: unknown; subnetAuth?: number[] }> {
  try {
    const manager = ajsUtils.getManagerForVM('PVM');
    const tx = manager.unpackTransaction(Buffer.from(ajsUtils.strip0x(transactionHex), 'hex')) as unknown as {
      getSubnetAuth?: () => { values(): number[] };
      getSubnetID?: () => { toString(): string };
    };
    if (typeof tx?.getSubnetAuth !== 'function' || typeof tx?.getSubnetID !== 'function') return {};
    const subnetAuth = tx.getSubnetAuth().values();
    const result = await postJson(`${pChainApi()}/ext/bc/P`, 'platform.getTx', {
      txID: tx.getSubnetID().toString(),
      encoding: 'hex',
    });
    if (!result?.tx) return {};
    const signed = manager.unpack(Buffer.from(ajsUtils.strip0x(result.tx), 'hex'), avaxSerial.SignedTx as never) as {
      unsignedTx?: { getSubnetOwners?: () => { threshold: { value(): number }; addrs: never } };
    };
    const owners = signed.unsignedTx?.getSubnetOwners?.();
    if (!owners) return {};
    return { subnetOwners: new PChainOwner(new AjsInt(owners.threshold.value()), owners.addrs), subnetAuth };
  } catch {
    return {};
  }
}

/**
 * Atomic legs (a C-Chain export/import, a P-Chain import) that the SDK's re-sign path can't credential. Every input
 * belongs to this one key, so the UnsignedTx bytes are signed once and the signature fills every credential slot.
 */
async function signAndIssueSingleKey(
  account: AvalancheAccount,
  transactionHex: string,
  vm: 'EVM' | 'PVM',
  endpointPath: string,
  issueMethod: string,
): Promise<string> {
  const manager = ajsUtils.getManagerForVM(vm);
  const codec = manager.getDefaultCodec();
  const innerTx = manager.unpackTransaction(ajsUtils.hexToBuffer(transactionHex));
  const Wrapper = vm === 'EVM' ? EVMUnsignedTx : UnsignedTx;
  const wrapped = new Wrapper(innerTx as never, [], new ajsUtils.AddressMaps(), []);
  const sig = await account.xpAccount!.signTransaction(wrapped.toBytes());
  const sigBytes = typeof sig === 'string' ? ajsUtils.hexToBuffer(sig) : sig;
  const credentials = wrapped.getSigIndices().map((idxs) => new Credential(idxs.map(() => new Signature(sigBytes))));
  const signedTx = new avaxSerial.SignedTx(innerTx, credentials);
  const signedHex = ajsUtils.bufferToHex(
    ajsUtils.addChecksum((signedTx as unknown as { toBytes(c: unknown): Uint8Array }).toBytes(codec)),
  );
  const result = await postJson(`${pChainApi()}${endpointPath}`, issueMethod, { tx: signedHex, encoding: 'hex' });
  return result.txID as string;
}

function isPvmImportTx(transactionHex: string): boolean {
  try {
    const innerTx = ajsUtils.getManagerForVM('PVM').unpackTransaction(ajsUtils.hexToBuffer(transactionHex)) as {
      _type?: string;
      importedInputs?: unknown;
    };
    return innerTx?._type === 'pvm.ImportTx' || typeof innerTx?.importedInputs !== 'undefined';
  } catch {
    return false;
  }
}

async function sendXpTransaction(p: { transactionHex: string; chainAlias: string; utxos?: unknown }) {
  const account = await requireAccount();
  if (p.chainAlias === 'C')
    return signAndIssueSingleKey(account, p.transactionHex, 'EVM', '/ext/bc/C/avax', 'avax.issueTx');
  if (p.chainAlias === 'P' && isPvmImportTx(p.transactionHex))
    return signAndIssueSingleKey(account, p.transactionHex, 'PVM', '/ext/bc/P', 'platform.issueTx');
  const auth = p.chainAlias === 'P' ? await resolveSubnetAuth(p.transactionHex) : {};
  const result = (await createAvalancheWalletClient({
    chain: (currentChain().isTestnet ? sdkAvalancheFuji : sdkAvalanche) as never,
    transport: { type: 'http' },
    account,
  }).sendXPTransaction({ tx: p.transactionHex, chainAlias: p.chainAlias, utxoIds: p.utxos, ...auth } as never)) as
    | string
    | { txHash?: string; txID?: string };
  // Core answers with the bare tx id; callers wrap it themselves.
  if (typeof result === 'string') return result;
  return result?.txHash ?? result?.txID ?? result;
}

/* -------------------------------- provider -------------------------------- */

let lastAccounts: string[] = [];

async function request({ method, params }: { method: string; params?: unknown }): Promise<unknown> {
  const list = (Array.isArray(params) ? params : params === undefined ? [] : [params]) as unknown[];
  switch (method) {
    case 'eth_accounts': {
      const wallet = await activeInfo();
      return wallet ? [getAddress(wallet.address)] : [];
    }
    case 'eth_requestAccounts': {
      const wallet = await activeInfo();
      if (!wallet) throw new RpcError(4100, 'Choose a Console wallet from the top bar first.');
      return [getAddress(wallet.address)];
    }
    case 'eth_chainId':
      return toHexChainId(currentChainId);
    case 'net_version':
      return String(currentChainId);

    case 'wallet_switchEthereumChain': {
      const target = parseInt(String((list[0] as { chainId?: string })?.chainId), 16);
      if (!chainEntry(target))
        throw new RpcError(4902, `Unrecognized chain ID ${toHexChainId(target)}. Add the chain first.`);
      setChain(target);
      return null;
    }
    case 'wallet_addEthereumChain': {
      const p = (list[0] ?? {}) as {
        chainId: string;
        chainName?: string;
        rpcUrls?: string[];
        nativeCurrency?: ChainEntry['nativeCurrency'];
        isTestnet?: boolean;
      };
      const id = parseInt(p.chainId, 16);
      if (!chainEntry(id)) {
        if (!p.rpcUrls?.[0]) throw new RpcError(-32602, 'The chain needs an RPC URL');
        added.set(id, {
          chainId: id,
          chainName: p.chainName ?? `Chain ${id}`,
          rpcUrls: p.rpcUrls,
          nativeCurrency: p.nativeCurrency ?? { name: 'Token', symbol: 'TKN', decimals: 18 },
          isTestnet: p.isTestnet ?? currentChain().isTestnet,
        });
      }
      setChain(id);
      return null;
    }

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
    case 'avalanche_getAccountPubKey': {
      const keys = (await activeInfo())?.publicKeys;
      if (keys) return keys;
      const account = await requireAccount();
      return { evm: account.evmAccount.publicKey, xp: account.xpAccount!.publicKey };
    }
    case 'avalanche_sendTransaction':
      return sendXpTransaction((params ?? {}) as { transactionHex: string; chainAlias: string; utxos?: unknown });

    case 'eth_sendTransaction':
      return sendEvmTransaction(list);
    case 'personal_sign': {
      const raw = list[0] as Hex;
      return (await requireAccount()).evmAccount.signMessage!({ message: { raw } });
    }
    case 'eth_signTypedData_v4': {
      const payload = typeof list[1] === 'string' ? JSON.parse(list[1]) : list[1];
      return (await requireAccount()).evmAccount.signTypedData!(payload);
    }
    default:
      return proxyRpc(method, list);
  }
}

const provider = {
  isAvalanche: true as const,
  isConsoleWallet: true as const,
  isMetaMask: false,
  request,
  on(event: string, fn: (...args: unknown[]) => void) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return provider;
  },
  addListener(event: string, fn: (...args: unknown[]) => void) {
    return provider.on(event, fn);
  },
  removeListener(event: string, fn: (...args: unknown[]) => void) {
    listeners.get(event)?.delete(fn);
    return provider;
  },
  off(event: string, fn: (...args: unknown[]) => void) {
    return provider.removeListener(event, fn);
  },
  /** Tells connected apps the account changed: another wallet was chosen, or none. Locking keeps it connected. */
  async syncAccounts() {
    const wallet = await activeInfo();
    const next = wallet ? [getAddress(wallet.address)] : [];
    if (next.join() === lastAccounts.join()) return;
    lastAccounts = next;
    emit('accountsChanged', next);
    if (next.length === 0) emit('disconnect', new RpcError(4900, 'No Console wallet is chosen'));
  },
};

if (typeof window !== 'undefined') {
  subscribe(() => {
    void loadKnown().then((ws) => {
      // A wallet removed from this browser can't stay active.
      const id = getActiveConsoleWallet();
      if (id && !ws.some((w) => w.id === id)) setActiveConsoleWallet(null);
      else void provider.syncAccounts();
    });
  });
}

export type ConsoleCoreProvider = typeof provider;

export function getConsoleCoreProvider(): ConsoleCoreProvider {
  return provider;
}
