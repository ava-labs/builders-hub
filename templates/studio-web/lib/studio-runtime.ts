import { toHex } from 'viem';
import type { Config } from 'wagmi';
import { getAccount, getPublicClient, watchAccount } from 'wagmi/actions';
import { createEERC } from './studio-eerc';
import { studioConfig } from './studio.config';
import { tokenBalances, tokenList } from './tokens';

/*
 * window.studio, the same surface the Studio preview gave the app while you
 * built it: { contracts, chains, provider, explorer, eerc }. Here `provider` is an
 * EIP-1193 provider backed by wagmi, so whichever wallet the user connects
 * through RainbowKit is the one that signs. Asking for accounts opens the
 * RainbowKit connect modal.
 */

type Eip1193 = { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
type Listener = (data: unknown) => void;

/** Reads that can be answered from the chain's RPC before anyone connects. */
const READ_METHODS = new Set([
  'eth_call',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getLogs',
  'eth_getCode',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_getBlockByNumber',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_feeHistory',
  'eth_maxPriorityFeePerGas',
]);

const rpcError = (code: number, message: string) => Object.assign(new Error(message), { code });

export interface StudioRuntimeOptions {
  config: Config;
  openConnectModal: () => void;
  isModalOpen: () => boolean;
}

export function createStudioRuntime({ config, openConnectModal, isModalOpen }: StudioRuntimeOptions) {
  const listeners: Record<string, Listener[]> = {};
  const emit = (event: string, data: unknown) =>
    (listeners[event] ?? []).forEach((fn) => {
      try {
        fn(data);
      } catch (error) {
        console.error(error);
      }
    });

  watchAccount(config, {
    onChange(account, previous) {
      if (account.address !== previous.address) emit('accountsChanged', account.address ? [account.address] : []);
      if (account.chainId && account.chainId !== previous.chainId) emit('chainChanged', toHex(account.chainId));
    },
  });

  const connectedAccount = () => {
    const account = getAccount(config);
    return account.status === 'connected' && account.connector && account.address ? account : null;
  };

  /** Opens the connect modal and resolves once a wallet connects; rejects if the modal is closed without one. */
  const connect = () =>
    new Promise<NonNullable<ReturnType<typeof connectedAccount>>>((resolve, reject) => {
      let sawModal = false;
      const stop = () => {
        clearInterval(poll);
        clearTimeout(timeout);
        unwatch();
      };
      const unwatch = watchAccount(config, {
        onChange() {
          const account = connectedAccount();
          if (account) {
            stop();
            resolve(account);
          }
        },
      });
      const poll = setInterval(() => {
        if (isModalOpen()) sawModal = true;
        else if (sawModal) {
          stop();
          reject(rpcError(4001, 'The wallet connection was closed without connecting.'));
        }
      }, 250);
      const timeout = setTimeout(
        () => {
          stop();
          reject(rpcError(4001, 'Connecting a wallet took too long. Try again.'));
        },
        5 * 60 * 1000,
      );
      openConnectModal();
    });

  const provider = {
    isStudio: true,
    async request({ method, params }: { method: string; params?: unknown }): Promise<unknown> {
      const account = connectedAccount();
      switch (method) {
        case 'eth_accounts':
          return account ? [account.address] : [];
        case 'eth_chainId':
        case 'net_version': {
          const id = account?.chainId ?? config.chains[0].id;
          return method === 'net_version' ? String(id) : toHex(id);
        }
        case 'eth_requestAccounts':
          return [(account ?? (await connect())).address];
      }
      if (!account && READ_METHODS.has(method)) {
        const client = getPublicClient(config as never) as { request: (args: never) => Promise<unknown> } | undefined;
        if (client) return client.request({ method, params } as never);
      }
      if (!account) throw rpcError(4100, 'Connect a wallet first.');
      const wallet = (await account.connector.getProvider()) as Eip1193;
      return wallet.request({ method, params });
    },
    on(event: string, fn: Listener) {
      (listeners[event] ??= []).push(fn);
      return provider;
    },
    removeListener(event: string, fn: Listener) {
      listeners[event] = (listeners[event] ?? []).filter((listener) => listener !== fn);
      return provider;
    },
  };

  return Object.freeze({
    contracts: studioConfig.contracts,
    chains: studioConfig.chains,
    provider,
    explorer: Object.freeze({
      tokenList: async (chainId: number) => tokenList(Number(chainId)),
      tokenBalances: (address: string, chainId: number) => tokenBalances(config, String(address), Number(chainId)),
    }),
    eerc: createEERC({ provider, contracts: studioConfig.contracts, chains: studioConfig.chains }),
  });
}

declare global {
  interface Window {
    studio?: ReturnType<typeof createStudioRuntime>;
  }
}
