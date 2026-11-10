import { createPublicClient, createWalletClient, defineChain, http, toHex, type Hex } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { Eip1193Provider } from '@/components/toolbox/hooks/useLiveWalletChainId';

export interface ChainInfo {
  name: string;
  rpcUrl: string | null;
  explorerUrl: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  testnet?: boolean;
}

export interface PreparedTx {
  to?: string;
  data: Hex;
  value: string;
}

/**
 * Whoever signs for a tool: the browser extension wallet, or a Console wallet
 * unlocked in this tab. Callers pass the chain they got from Builder Hub, so a
 * Console wallet only ever talks to an RPC the server chose.
 */
export interface ConsoleSigner {
  kind: 'browser' | 'console';
  address: `0x${string}`;
  walletId?: string;
  send(chainId: number, info: ChainInfo | undefined, tx: PreparedTx): Promise<Hex>;
  /** EIP-191 personal_sign; a Console wallet signs without a prompt. */
  signMessage(message: string): Promise<Hex>;
}

const request = (provider: Eip1193Provider, method: string, params?: unknown[]) =>
  (provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }).request({
    method,
    params,
  });

/** Switches the wallet to `chainId`, adding the chain first when the wallet does not know it. */
export async function ensureChain(provider: Eip1193Provider, chainId: number, info?: ChainInfo) {
  const current = Number(await request(provider, 'eth_chainId'));
  if (current === chainId) return;
  try {
    await request(provider, 'wallet_switchEthereumChain', [{ chainId: toHex(chainId) }]);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902 || !info?.rpcUrl) throw error;
    await request(provider, 'wallet_addEthereumChain', [
      {
        chainId: toHex(chainId),
        chainName: info.name,
        rpcUrls: [info.rpcUrl],
        nativeCurrency: info.nativeCurrency,
        ...(info.explorerUrl ? { blockExplorerUrls: [info.explorerUrl] } : {}),
      },
    ]);
  }
  if (Number(await request(provider, 'eth_chainId')) !== chainId)
    throw new Error("Switch your wallet to the step's chain to continue");
}

/** Sends exactly the prepared transaction; the wallet fills in gas and nonce. */
export async function sendPrepared(provider: Eip1193Provider, from: string, tx: PreparedTx): Promise<Hex> {
  const params: Record<string, string> = { from, data: tx.data };
  if (tx.to) params.to = tx.to;
  if (tx.value && tx.value !== '0') params.value = toHex(BigInt(tx.value));
  return (await request(provider, 'eth_sendTransaction', [params])) as Hex;
}

export function browserSigner(provider: Eip1193Provider, address: `0x${string}`): ConsoleSigner {
  return {
    kind: 'browser',
    address,
    async send(chainId, info, tx) {
      await ensureChain(provider, chainId, info);
      return sendPrepared(provider, address, tx);
    },
    async signMessage(message) {
      return (await request(provider, 'personal_sign', [toHex(message), address])) as Hex;
    },
  };
}

export function chainFor(chainId: number, info: ChainInfo | undefined) {
  if (!info?.rpcUrl)
    throw new Error(`Builder Hub has no RPC for chain ${chainId}, so a Console wallet can't sign there`);
  return defineChain({
    id: chainId,
    name: info.name,
    nativeCurrency: info.nativeCurrency,
    rpcUrls: { default: { http: [info.rpcUrl] } },
    ...(info.explorerUrl ? { blockExplorers: { default: { name: 'Explorer', url: info.explorerUrl } } } : {}),
    testnet: info.testnet,
  });
}

/** `account` is looked up on every send, so a wallet that locked mid-run stops instead of signing. */
export function consoleSigner(
  walletId: string,
  address: `0x${string}`,
  account: () => PrivateKeyAccount | null,
): ConsoleSigner {
  return {
    kind: 'console',
    address,
    walletId,
    async send(chainId, info, tx) {
      const signer = account();
      if (!signer) throw new LockedWalletError();
      const chain = chainFor(chainId, info);
      const client = createWalletClient({ account: signer, chain, transport: http(chain.rpcUrls.default.http[0]) });
      return client.sendTransaction({
        account: signer,
        chain,
        to: tx.to as `0x${string}` | undefined,
        data: tx.data,
        value: tx.value && tx.value !== '0' ? BigInt(tx.value) : undefined,
      });
    },
    async signMessage(message) {
      const signer = account();
      if (!signer) throw new LockedWalletError();
      return signer.signMessage({ message });
    },
  };
}

export class LockedWalletError extends Error {
  constructor() {
    super('Unlock your Console wallet to continue');
    this.name = 'LockedWalletError';
  }
}

const reader = (chainId: number, info: ChainInfo | undefined) => {
  const chain = chainFor(chainId, info);
  return createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
};

export function nativeBalance(address: `0x${string}`, chainId: number, info: ChainInfo | undefined) {
  return reader(chainId, info).getBalance({ address });
}

export function gasPrice(chainId: number, info: ChainInfo | undefined) {
  return reader(chainId, info).getGasPrice();
}

export const walletErrorText = (error: unknown) => {
  const e = error as { code?: number; shortMessage?: string; message?: string };
  if (e?.code === 4001) return 'You rejected the request in your wallet.';
  return e?.shortMessage ?? e?.message ?? String(error);
};
