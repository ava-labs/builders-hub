// The in-page half of the e2e Core wallet: an EIP-1193 provider with no key and no secret. chain/e2e.config.ts gives
// coreProvider to the engine as an init script (web({ initScripts })). The engine runs it in each new document
// before the document's own scripts: on each navigation, after a reload, and after app.restart().
//
// - It sets window.ethereum and window.avalanche, with isAvalanche true, as the Core extension does.
// - It announces itself through EIP-6963 with rdns 'app.core' and name 'Core'. wagmi then makes a connector with id
//   'app.core', which the Console reads as Core (components/toolbox/components/console-header/WalletSync.tsx).
// - request({ method, params }) posts the request as JSON to WALLET_PATH on the page's own origin. The route that
//   bridge.ts installs answers it from the Node signer (signer.ts), so the request never leaves the browser.
// - Each answer carries the wallet's chain and accounts. The first answer sets them. When a later answer changes
//   them, the provider emits chainChanged or accountsChanged, as EIP-1193 asks.
// - It installs only in the top frame of an http or https document. A frame of another site gets no wallet.

export const WALLET_PATH = '/__e2e/wallet';

// The answer to one wallet request, as the route sends it to the page.
export type WalletReply = {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  chainId: string;
  accounts: string[];
};

// The engine serializes this function by its source and runs it in the page with no argument, so the function uses
// nothing from this module. Its endpoint is the literal value of WALLET_PATH (selftest.ts checks that).
export function coreProvider(): void {
  const endpoint = '/__e2e/wallet';
  // A plain orange square. EIP-6963 needs a data URI icon.
  const icon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+' +
    'PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iI2U4NDE0MiIvPjwvc3ZnPg==';
  const installed = Symbol.for('e2e.coreProvider');

  type Listener = (value: unknown) => void;
  type Reply = {
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
    chainId?: unknown;
    accounts?: unknown;
  };
  type ProviderError = Error & { code: number; data?: unknown };

  const page = window as unknown as Record<PropertyKey, unknown>;
  if (window.top !== window) return;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
  if (page[installed]) return;
  Object.defineProperty(page, installed, { value: true });

  // The app can wrap fetch later (analytics, error tracking). The wallet keeps the browser's own.
  const nativeFetch = window.fetch.bind(window);
  const listeners = new Map<string, Set<Listener>>();
  // Unknown until the first answer: the signer in Node, not the page, holds the wallet's chain and accounts.
  let chainId: string | null = null;
  let accounts: string[] | null = null;

  function emit(event: string, value: unknown): void {
    for (const fn of Array.from(listeners.get(event) ?? [])) {
      try {
        fn(value);
      } catch (err) {
        console.error(`[e2e wallet] a ${event} listener failed`, err);
      }
    }
  }

  function sync(reply: Reply): void {
    if (typeof reply.chainId === 'string' && reply.chainId !== chainId) {
      const known = chainId !== null;
      chainId = reply.chainId;
      if (known) emit('chainChanged', chainId);
    }
    if (Array.isArray(reply.accounts)) {
      const next = reply.accounts.map(String);
      if (accounts === null || next.join(',') !== accounts.join(',')) {
        const known = accounts !== null;
        accounts = next;
        if (known) emit('accountsChanged', next.slice());
      }
    }
  }

  function providerError(code: number, message: string, data?: unknown): ProviderError {
    const err = new Error(message) as ProviderError;
    err.code = code;
    if (data !== undefined && data !== null) err.data = data;
    return err;
  }

  async function request(args: { method: string; params?: unknown }): Promise<unknown> {
    if (!args || typeof args !== 'object' || typeof args.method !== 'string') {
      throw providerError(-32600, '[e2e wallet] request needs an object with a method');
    }
    let body: string;
    try {
      body = JSON.stringify({ method: args.method, params: args.params });
    } catch (err) {
      throw providerError(-32602, `[e2e wallet] the params of ${args.method} are not JSON: ${String(err)}`);
    }
    let res: Response;
    try {
      res = await nativeFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch (err) {
      throw providerError(4900, `[e2e wallet] the wallet route did not answer ${args.method}: ${String(err)}`);
    }
    let reply: Reply;
    try {
      reply = (await res.json()) as Reply;
    } catch {
      throw providerError(4900, `[e2e wallet] the wallet route sent no JSON for ${args.method} (HTTP ${res.status})`);
    }
    sync(reply);
    if (reply.error) throw providerError(reply.error.code, reply.error.message, reply.error.data);
    return reply.result === undefined ? null : reply.result;
  }

  const provider = {
    isAvalanche: true,
    isMetaMask: false,
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
  Object.defineProperty(provider, 'chainId', { enumerable: true, get: () => chainId });
  Object.defineProperty(provider, 'selectedAddress', { enumerable: true, get: () => accounts?.[0] ?? null });

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
