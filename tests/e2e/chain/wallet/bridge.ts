import type { Browser, WebRoute } from '@e2e-dev/web';
import type { JsonValue } from 'e2e';
import { WALLET_PATH, type WalletReply } from './provider.ts';
import { RpcError } from '../lib/chain.ts';
import { ERR, type Signer, type WalletRequest } from './signer.ts';

// Connects the in-page provider (provider.ts) to the Node signer (signer.ts) with one browser.route: the provider's
// POST to WALLET_PATH. The route answers it from the signer, so the request never reaches a server. The provider
// itself comes from the engine's init scripts (chain/e2e.config.ts). This module only answers its requests.
//
// The route matches WALLET_PATH on every origin, so a request from a page of another site stops here and does not
// go to that site. Only a same-origin POST from a page of the app reaches the signer. Anything else gets an error.

const NO_STORE = { 'cache-control': 'no-store' };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// WALLET_PATH on any http or https origin, with or without a query.
export const WALLET_ROUTE = new RegExp(`^https?://[^/?#]+${escapeRegExp(WALLET_PATH)}(?:[?#]|$)`);

export interface WalletRoute {
  // The wallet requests that the route answered for the app, as method names, in order.
  readonly requests: readonly string[];
}

function header(request: WebRoute['request'], name: string): string | undefined {
  for (const [key, value] of Object.entries(request.headers)) {
    if (key.toLowerCase() === name) return value;
  }
  return undefined;
}

// The site grant. Core gives a site no account until the user connects it: eth_accounts is [] and the methods that
// show or use the account fail with 4100. The e2e wallet does the same, so a fresh session shows the Console's
// connect flow, and wagmi cannot connect by itself. eth_requestAccounts (the 'Core' button of the connect dialog)
// grants; wallet_revokePermissions (Disconnect) takes the grant back. The grant belongs to the signer, so it lasts
// across reloads and across the members of a serial group, as Core keeps a site's grant.
const granted = new WeakSet<Signer>();
const GRANTS = new Set(['eth_requestAccounts', 'wallet_requestPermissions']);
const NEEDS_GRANT = new Set([
  'avalanche_getAccountPubKey',
  'avalanche_getAccounts',
  'avalanche_sendTransaction',
  'eth_sendTransaction',
]);

// What the signer answers before the grant, without asking it.
function beforeGrant(method: string): { result: unknown } | undefined {
  if (method === 'eth_accounts' || method === 'wallet_getPermissions') return { result: [] };
  if (method === 'eth_coinbase') return { result: null };
  if (NEEDS_GRANT.has(method)) {
    throw new RpcError(ERR.unauthorized, `[e2e wallet] ${method} needs a connected site: connect the wallet first`);
  }
  return undefined;
}

// The page's wallet request, answered by the signer. Never throws: an error goes back to the page as a JSON-RPC
// error, as a wallet would show it.
export async function answerWalletRequest(signer: Signer, body: unknown): Promise<WalletReply> {
  const state = () => ({ chainId: signer.chainIdHex, accounts: granted.has(signer) ? [signer.address] : [] });
  const request = body as Partial<WalletRequest> | null;
  if (!request || typeof request.method !== 'string') {
    return { error: { code: -32600, message: '[e2e wallet] the request has no method' }, ...state() };
  }
  const { method, params } = request;
  try {
    if (method === 'wallet_revokePermissions') granted.delete(signer);
    if (!granted.has(signer) && !GRANTS.has(method)) {
      const early = beforeGrant(method);
      if (early) return { ...early, ...state() };
    }
    const result = await signer.handle({ method, params });
    if (GRANTS.has(method)) granted.add(signer);
    return { result: result === undefined ? null : result, ...state() };
  } catch (err) {
    const error =
      err instanceof RpcError
        ? { code: err.code, message: err.message, ...(err.data !== undefined && { data: err.data }) }
        : {
            code: ERR.internal,
            message: `[e2e wallet] ${method} failed: ${err instanceof Error ? err.message : String(err)}`,
          };
    return { error, ...state() };
  }
}

// The route handler. `appOrigin` is the origin of the app under test; `requests` collects the method names.
export function walletRouteHandler(
  signer: Signer,
  appOrigin: string,
  requests: string[],
): (route: WebRoute) => Promise<void> {
  return async (route) => {
    const { request } = route;
    const refuse = (status: number, message: string) =>
      route.fulfill({
        status,
        headers: NO_STORE,
        json: { error: { code: ERR.unauthorized, message: `[e2e wallet] ${message}` } },
      });

    const target = new URL(request.url).origin;
    if (target !== appOrigin) return refuse(403, `no wallet on ${target}`);
    if (request.method !== 'POST') return refuse(405, 'POST a JSON request');
    // A fetch from a page of the app sends Origin: the app origin. A page of another site that posts here sends
    // its own origin, and gets nothing from the signer.
    const origin = header(request, 'origin');
    if (origin !== appOrigin) return refuse(403, `no wallet for a request from ${origin ?? 'an unknown origin'}`);

    let body: unknown;
    try {
      body = JSON.parse(request.postData ?? '');
    } catch {
      body = undefined;
    }
    if (!body || typeof body !== 'object') {
      return route.fulfill({
        status: 400,
        headers: NO_STORE,
        json: { error: { code: -32700, message: '[e2e wallet] POST a JSON request' } },
      });
    }
    const method = (body as { method?: unknown }).method;
    requests.push(typeof method === 'string' ? method : '(none)');
    const reply = await answerWalletRequest(signer, body);
    await route.fulfill({ status: 200, headers: NO_STORE, json: reply as JsonValue });
  };
}

// Installs the wallet route for the attempt. Call it before the first navigation: chain/lib/fixtures.ts does. The
// signer keeps its state (chain, added chains, nonces) for every page of the attempt.
export async function installWalletRoute(browser: Browser, signer: Signer, appUrl: string): Promise<WalletRoute> {
  const requests: string[] = [];
  await browser.route(WALLET_ROUTE, walletRouteHandler(signer, new URL(appUrl).origin, requests));
  return { requests };
}
