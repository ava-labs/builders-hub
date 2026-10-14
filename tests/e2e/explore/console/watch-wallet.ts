import { secp256k1, utils } from '@avalabs/avalanchejs';
import { getAddress, type Hex } from 'viem';
import { FUJI, readFujiKeyIfSet } from '../../chain/lib/chain.ts';

// A watch-only Core wallet for `e2e explore` on the Builder Console (e2e.config.ts in this folder).
//
// The page gets an EIP-1193 provider for one fixed Fuji account. It reads and never signs:
// - It sets window.ethereum and window.avalanche (isAvalanche true) and announces itself through EIP-6963 with rdns
//   'app.core' and name 'Core', as the e2e Core wallet of the chain tests does (chain/wallet/provider.ts).
// - The site is connected from the start: eth_accounts returns the account, so wagmi connects on the first load.
// - It answers the account and chain methods itself (eth_accounts, eth_chainId, avalanche_getAccountPubKey,
//   wallet_getEthereumChain, and so on). It stays on the Fuji C-Chain (43113).
// - It sends the other eth_, net_ and web3_ reads from the page to the public Fuji C-Chain RPC. One read starts at
//   most every READ_GAP_MS for all tabs of the app together. The first HTTP 429 stops every later read of the run.
// - It rejects every method that signs or sends with EIP-1193 code 4001 and 'User rejected the request.', as Core
//   does when the user clicks Reject. The message also says that the wallet is watch-only for this run.
//
// The page gets public values only: the C-Chain address, the P-Chain address and the compressed public key. The
// private key stays in this module, in Node. Nothing here prints it, returns it or writes it to a file. There is no
// route and no Node signer: `e2e explore` supports no routes and no fixtures, and a watch-only wallet needs neither.

// The gap between two reads that the wallet sends, in milliseconds: under 2 requests per second.
const READ_GAP_MS = 600;
// A read that would wait longer than this for its slot fails at once, so a burst cannot queue reads without end.
const MAX_READ_WAIT_MS = 30_000;

/** The public values of the watched account. */
export type WatchAccount = {
  /** The C-Chain address, checksummed. */
  address: Hex;
  /** The P-Chain address, 'P-fuji1...'. */
  pChainAddress: string;
  /** The compressed secp256k1 public key, 0x hex (33 bytes). Core returns it from avalanche_getAccountPubKey. */
  publicKey: Hex;
};

/** What the init script gets: public values and settings only. */
export type WatchWalletOptions = WatchAccount & {
  /** The wallet installs only in a top-level document of this origin. */
  appOrigin: string;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  readGapMs: number;
  maxReadWaitMs: number;
};

/** The public values of a private key, on Fuji. */
export function publicAccount(privateKey: Hex): WatchAccount {
  const compressed = secp256k1.getPublicKey(utils.hexToBuffer(privateKey));
  return {
    address: getAddress(utils.bufferToHex(secp256k1.publicKeyToEthAddress(compressed))),
    pChainAddress: utils.format('P', FUJI.hrp, secp256k1.publicKeyBytesToAddress(compressed)),
    publicKey: utils.bufferToHex(compressed) as Hex,
  };
}

/**
 * The watched account of the key file that E2E_CHAIN_FUJI_KEY_FILE names, or undefined when the variable is not set.
 * Reads the file in Node and keeps only the public values. Throws when the file is not a private key or other users
 * can read it (readFujiKeyIfSet); the message never quotes the file's content.
 */
export function watchAccountFromKeyFile(): WatchAccount | undefined {
  if (!process.env.E2E_CHAIN_FUJI_KEY_FILE?.trim()) return undefined;
  const key = readFujiKeyIfSet();
  return key ? publicAccount(key) : undefined;
}

// tsx compiles the config with keepNames, so the source of a function can call __name. The page has no __name, so
// the script defines it, as the engine does for a function init script (@e2e-dev/web, init-scripts.js).
const KEEP_NAMES =
  "const __name = (target, value) => Object.defineProperty(target, 'name', { value, configurable: true });";

/**
 * The init script for web({ initScripts }): the source of watchWallet, called with the public values. An init
 * script function cannot take an argument from the config, so the values go into the source as JSON.
 */
export function watchWalletScript(account: WatchAccount, appUrl: string): string {
  // Only these fields cross into the page.
  const options: WatchWalletOptions = {
    address: account.address,
    pChainAddress: account.pChainAddress,
    publicKey: account.publicKey,
    appOrigin: new URL(appUrl).origin,
    chainId: FUJI.cChainId,
    chainName: 'Avalanche Fuji C-Chain',
    rpcUrl: FUJI.cRpc,
    readGapMs: READ_GAP_MS,
    maxReadWaitMs: MAX_READ_WAIT_MS,
  };
  const json = JSON.stringify(JSON.stringify(options));
  return `(() => {\n${KEEP_NAMES}\n(${watchWallet.toString()})(JSON.parse(${json}));\n})();`;
}

// The page half. It runs in the page, so it uses nothing from this module: only its argument.
export function watchWallet(options: WatchWalletOptions): void {
  const { address, pChainAddress, publicKey, appOrigin, chainId, chainName, rpcUrl, readGapMs, maxReadWaitMs } =
    options;
  // A plain orange square. EIP-6963 needs a data URI icon.
  const icon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+' +
    'PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iI2U4NDE0MiIvPjwvc3ZnPg==';
  const installed = Symbol.for('e2e.watchWallet');
  // localStorage keys. Every tab of the app origin shares them, and they last for the browser context of the run.
  const nextReadKey = 'e2e.watchWallet.nextReadAt';
  const stopKey = 'e2e.watchWallet.rateLimitedAt';
  const userRejected = 'User rejected the request.';
  const stopMessage =
    'The public Fuji API rate-limited this run (HTTP 429). The watch-only wallet sends no more reads in this run.';
  // A method that signs or sends: eth_sign, personal_sign, eth_signTypedData_v4, eth_sendTransaction,
  // eth_sendRawTransaction, wallet_sendCalls, avalanche_sendTransaction, avalanche_signMessage, and the like. The
  // second part takes a camel-case name such as wallet_batchSendCalls.
  const signsOrSends = /_(sign|send|submit)(?![a-z])|(Sign|Send|Submit)/;
  const alsoRefused = new Set(['avalanche_bridgeAsset']);

  type Listener = (value: unknown) => void;
  type ProviderError = Error & { code: number; data?: unknown };

  const page = window as unknown as Record<PropertyKey, unknown>;
  if (window.top !== window) return;
  if (location.origin !== appOrigin) return;
  if (page[installed]) return;
  Object.defineProperty(page, installed, { value: true });

  // The app can wrap fetch later (analytics, error tracking). The wallet keeps the browser's own.
  const nativeFetch = window.fetch.bind(window);
  const listeners = new Map<string, Set<Listener>>();
  const chainIdHex = `0x${chainId.toString(16)}`;
  let nextReadAt = 0;
  let stopped = false;
  let rpcId = 0;

  function providerError(code: number, message: string, data?: unknown): ProviderError {
    const err = new Error(message) as ProviderError;
    err.code = code;
    if (data !== undefined && data !== null) err.data = data;
    return err;
  }

  function stored(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function store(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // No storage: this document keeps its own slot and stop flag.
    }
  }

  function rateLimited(): boolean {
    return stopped || stored(stopKey) !== null;
  }

  function watchOnly(method: string): ProviderError {
    console.info(`[e2e watch wallet] rejected ${method}: the wallet is watch-only for this run`);
    return providerError(
      4001,
      `${userRejected} The e2e wallet is watch-only for this run. It does not sign or send (${method}).`,
    );
  }

  // Takes the next free read slot of the app origin and waits for it.
  async function waitForSlot(method: string): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, nextReadAt, Number(stored(nextReadKey)) || 0);
    if (slot - now > maxReadWaitMs) {
      throw providerError(-32005, `[e2e watch wallet] too many reads are waiting; ${method} was not sent`);
    }
    nextReadAt = slot + readGapMs;
    store(nextReadKey, String(nextReadAt));
    if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
  }

  // One read on the Fuji C-Chain RPC.
  async function read(method: string, params: unknown): Promise<unknown> {
    if (rateLimited()) throw providerError(-32005, stopMessage);
    let body: string;
    try {
      body = JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params: params ?? [] });
    } catch (err) {
      throw providerError(-32602, `[e2e watch wallet] the params of ${method} are not JSON: ${String(err)}`);
    }
    await waitForSlot(method);
    if (rateLimited()) throw providerError(-32005, stopMessage);
    let res: Response;
    try {
      res = await nativeFetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        cache: 'no-store',
        credentials: 'omit',
      });
    } catch (err) {
      throw providerError(-32603, `[e2e watch wallet] the Fuji C-Chain RPC did not answer ${method}: ${String(err)}`);
    }
    if (res.status === 429) {
      stopped = true;
      store(stopKey, new Date().toISOString());
      console.error(`[e2e watch wallet] ${stopMessage}`);
      throw providerError(-32005, stopMessage);
    }
    let reply: { result?: unknown; error?: { code?: unknown; message?: unknown; data?: unknown } } | null;
    try {
      reply = await res.json();
    } catch {
      throw providerError(
        -32603,
        `[e2e watch wallet] the Fuji C-Chain RPC sent no JSON for ${method} (HTTP ${res.status})`,
      );
    }
    if (reply?.error) {
      const { code, message, data } = reply.error;
      throw providerError(typeof code === 'number' ? code : -32603, String(message ?? `${method} failed`), data);
    }
    if (!res.ok || !reply) throw providerError(-32603, `[e2e watch wallet] ${method}: HTTP ${res.status}`);
    return reply.result === undefined ? null : reply.result;
  }

  function requestedChainId(params: unknown): number {
    const first = Array.isArray(params) ? params[0] : params;
    const raw = first && typeof first === 'object' ? (first as { chainId?: unknown }).chainId : undefined;
    const id = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw providerError(-32602, `[e2e watch wallet] invalid chainId: ${String(raw)}`);
    }
    return id;
  }

  async function request(args: { method: string; params?: unknown }): Promise<unknown> {
    if (!args || typeof args !== 'object' || typeof args.method !== 'string') {
      throw providerError(-32600, '[e2e watch wallet] request needs an object with a method');
    }
    const { method, params } = args;
    // First, so no case below and no read can sign or send.
    if (signsOrSends.test(method) || alsoRefused.has(method)) throw watchOnly(method);
    switch (method) {
      case 'eth_accounts':
      case 'eth_requestAccounts':
        return [address];
      case 'eth_coinbase':
        return address;
      case 'eth_chainId':
        return chainIdHex;
      case 'net_version':
        return String(chainId);
      case 'wallet_requestPermissions':
      case 'wallet_getPermissions':
        return [
          { parentCapability: 'eth_accounts', caveats: [{ type: 'restrictReturnedAccounts', value: [address] }] },
        ];
      case 'wallet_revokePermissions':
      case 'avalanche_selectAccount':
        return null;
      case 'wallet_switchEthereumChain':
        if (requestedChainId(params) === chainId) return null;
        throw providerError(
          4902,
          `Unrecognized chain ID. The e2e watch-only wallet knows only the ${chainName} (${chainId}).`,
        );
      case 'wallet_addEthereumChain':
        if (requestedChainId(params) === chainId) return null;
        throw providerError(
          4001,
          `${userRejected} The e2e wallet is watch-only for this run. It stays on the ${chainName} (${chainId}).`,
        );
      case 'wallet_getEthereumChain':
        return {
          chainId: chainIdHex,
          chainName,
          rpcUrls: [rpcUrl],
          nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
          isTestnet: true,
        };
      // Core returns the account's public keys. One key, so evm and xp are the same.
      case 'avalanche_getAccountPubKey':
        return { evm: publicKey, xp: publicKey };
      case 'avalanche_getAccounts':
        return [
          {
            index: 0,
            active: true,
            name: 'e2e watch-only',
            addressC: address,
            addressPVM: pChainAddress,
            addressAVM: pChainAddress.replace(/^P-/, 'X-'),
            addressCoreEth: pChainAddress.replace(/^P-/, 'C-'),
          },
        ];
    }
    if (/^(eth|net|web3)_/.test(method)) return read(method, params);
    throw providerError(4200, `[e2e watch wallet] ${method} is not supported`);
  }

  const provider = {
    isAvalanche: true,
    isMetaMask: false,
    isE2EWatchOnly: true,
    chainId: chainIdHex,
    selectedAddress: address,
    request,
    isConnected: () => true,
    on(event: string, fn: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(fn);
      return provider;
    },
    addListener(event: string, fn: Listener) {
      return provider.on(event, fn);
    },
    once(event: string, fn: Listener) {
      const wrapped: Listener = (value) => {
        provider.removeListener(event, wrapped);
        fn(value);
      };
      return provider.on(event, wrapped);
    },
    removeListener(event: string, fn: Listener) {
      listeners.get(event)?.delete(fn);
      return provider;
    },
    off(event: string, fn: Listener) {
      return provider.removeListener(event, fn);
    },
    removeAllListeners(event?: string) {
      if (event === undefined) listeners.clear();
      else listeners.delete(event);
      return provider;
    },
  };

  // Defined on window, so an element with id "avalanche" or "ethereum" does not shadow the provider.
  for (const name of ['ethereum', 'avalanche']) {
    Object.defineProperty(page, name, { value: provider, configurable: true, writable: true, enumerable: true });
  }

  // EIP-6963 asks for a v4 UUID. crypto.randomUUID needs a secure context, and an http URL other than localhost is
  // not one.
  function uuidV4(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  const detail = Object.freeze({
    info: Object.freeze({ uuid: uuidV4(), name: 'Core', icon, rdns: 'app.core' }),
    provider,
  });
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
}
