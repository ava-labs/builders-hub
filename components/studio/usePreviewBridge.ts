'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { createPublicClient, getAddress, http, type PublicClient } from 'viem';
import type { Eip1193Provider } from '@/components/toolbox/hooks/useLiveWalletChainId';
import { browserSigner, chainFor, type ChainInfo } from '@/lib/console-wallets/signer';
import { PREVIEW_API_OPS, PREVIEW_RPC_METHODS } from './preview';

export type Eip1193 = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, fn: (data: unknown) => void) => void;
  removeListener?: (event: string, fn: (data: unknown) => void) => void;
};

type FrameMessage = {
  channel?: string;
  type?: string;
  id?: number;
  method?: string;
  params?: unknown;
  op?: string;
  args?: { chainId?: unknown; address?: unknown };
  request?: unknown;
  message?: string;
};

/** The app's deployed contracts and their chains: the only tokens an app may run eERC operations on. */
export interface BridgeApp {
  contracts: { address: string; chainId: number | null }[];
  chains: Record<string, unknown>;
}

const WALLET_EVENTS = ['accountsChanged', 'chainChanged'] as const;

/**
 * The parent side of a sandboxed Studio frontend: the frame's only ways out.
 * Wallet requests from the allowlist go to `wallet`; token lookups go to
 * `tokensUrl` (a Builder Hub route that picks its own upstreams); script
 * errors are reported to `onError`. Replies go to that frame alone.
 */
export function usePreviewBridge({
  frame,
  channel,
  wallet,
  tokensUrl,
  noWalletMessage,
  onError,
  theme,
  app,
}: {
  frame: RefObject<HTMLIFrameElement | null>;
  channel: string;
  wallet: Eip1193 | null;
  tokensUrl: string;
  noWalletMessage: string;
  onError: (message: string) => void;
  theme: 'light' | 'dark';
  app?: BridgeApp | null;
}) {
  const live = useRef({ wallet, tokensUrl, noWalletMessage, onError, app });
  live.current = { wallet, tokensUrl, noWalletMessage, onError, app };

  useEffect(() => {
    const reply = (message: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage({ channel, ...message }, '*');
    const fail = (id: number, code: number, message: string, data?: unknown) =>
      reply({ type: 'rpc-result', id, error: { code, message, data } });

    const onMessage = async (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const m = event.data as FrameMessage;
      if (!m || m.channel !== channel) return;
      if (m.type === 'error' && m.message) {
        live.current.onError(m.message);
        return;
      }
      if (typeof m.id !== 'number') return;

      if (m.type === 'eerc') {
        const { wallet: current, app: known } = live.current;
        try {
          // Loaded on first use: most apps never touch eERC, and this pulls in the contract ABIs and the prover.
          const { parseEERCRequest, runEERC } = await import('@/lib/eerc/client');
          const request = parseEERCRequest(m.request);
          const target = 'token' in request && request.token ? getAddress(request.token) : null;
          const contract = known?.contracts.find((c) => target && c.chainId && getAddress(c.address) === target);
          if (!contract?.chainId) throw new Error("eERC operations only run on this app's own deployed tokens");
          const info = known?.chains[String(contract.chainId)] as ChainInfo | undefined;
          if (!current) throw Object.assign(new Error(live.current.noWalletMessage), { code: 4100 });
          const accounts = (await current.request({ method: 'eth_requestAccounts' })) as string[];
          if (!accounts?.[0]) throw Object.assign(new Error(live.current.noWalletMessage), { code: 4100 });
          const signer = browserSigner(current as unknown as Eip1193Provider, getAddress(accounts[0]) as `0x${string}`);
          const chain = chainFor(contract.chainId, info);
          const client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) }) as PublicClient;
          const chainId = contract.chainId;
          const result = await runEERC(request, {
            client,
            chainId,
            onStage: (stage) => reply({ type: 'eerc-stage', id: m.id, stage }),
            signer: {
              address: signer.address,
              signMessage: (message) => signer.signMessage(message),
              send: (tx) => signer.send(chainId, info, { to: tx.to, data: tx.data, value: '0' }),
            },
          });
          reply({ type: 'rpc-result', id: m.id, result });
        } catch (e) {
          const err = e as { code?: number; message?: string; shortMessage?: string };
          fail(m.id, err.code ?? -32603, err.shortMessage ?? err.message ?? 'eERC operation failed');
        }
        return;
      }

      if (m.type === 'api') {
        const chainId = Number(m.args?.chainId);
        if (!m.op || !PREVIEW_API_OPS.has(m.op) || !Number.isInteger(chainId) || chainId <= 0) {
          fail(m.id, 4200, 'Unsupported explorer request');
          return;
        }
        const query = new URLSearchParams({ chainId: String(chainId) });
        if (m.op === 'tokenBalances') query.set('owner', String(m.args?.address ?? ''));
        try {
          const res = await fetch(`${live.current.tokensUrl}?${query}`, { cache: 'no-store' });
          const body = (await res.json().catch(() => ({}))) as { tokens?: unknown; error?: string; message?: string };
          if (!res.ok) throw new Error(body.message ?? body.error ?? `Token lookup failed (${res.status})`);
          reply({ type: 'rpc-result', id: m.id, result: m.op === 'tokenList' ? body.tokens : body });
        } catch (e) {
          fail(m.id, -32603, e instanceof Error ? e.message : String(e));
        }
        return;
      }

      if (m.type !== 'rpc' || typeof m.method !== 'string') return;
      if (!PREVIEW_RPC_METHODS.has(m.method)) {
        fail(m.id, 4200, `This app isn't allowed to call ${m.method}`);
        return;
      }
      const current = live.current.wallet;
      if (!current) {
        if (m.method === 'eth_accounts') reply({ type: 'rpc-result', id: m.id, result: [] });
        else fail(m.id, 4100, live.current.noWalletMessage);
        return;
      }
      try {
        reply({ type: 'rpc-result', id: m.id, result: await current.request({ method: m.method, params: m.params }) });
      } catch (e) {
        const err = e as { code?: number; message?: string; shortMessage?: string; data?: unknown };
        fail(m.id, err.code ?? -32603, err.shortMessage ?? err.message ?? 'Wallet error', err.data);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [channel, frame]);

  // Wallet account and chain changes reach the frame as EIP-1193 events.
  useEffect(() => {
    if (!wallet?.on) return;
    const handlers = WALLET_EVENTS.map((event) => {
      const fn = (data: unknown) =>
        frame.current?.contentWindow?.postMessage({ channel, type: 'event', event, data }, '*');
      wallet.on!(event, fn);
      return [event, fn] as const;
    });
    return () => handlers.forEach(([event, fn]) => wallet.removeListener?.(event, fn));
  }, [wallet, channel, frame]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ channel, type: 'theme', theme }, '*');
  }, [theme, channel, frame]);
}
