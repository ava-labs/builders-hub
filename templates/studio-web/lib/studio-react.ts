'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Abi,
  type Chain,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';

/*
 * The hooks a Studio app is written with: `import { useWallet, useRead, useWrite } from '@studio/react'`.
 * They read the deployed contracts and chains from `window.studio` and sign with the connected wallet, so the same
 * source runs in the Studio preview, on a published Builder Hub address, and in the exported Next.js app.
 * Only react and viem are imported here on purpose: the preview compiles this file in the browser.
 */

type Eip1193 = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, fn: (data: unknown) => void) => unknown;
  removeListener?: (event: string, fn: (data: unknown) => void) => unknown;
};

export interface StudioContractInfo {
  address: `0x${string}`;
  abi: Abi;
  chainId: number | null;
  network: string;
  explorerUrl: string | null;
}

export interface StudioChainInfo {
  name: string;
  rpcUrl: string | null;
  explorerUrl: string | null;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export interface StudioToken {
  address: `0x${string}`;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logoURI: string | null;
  source: string;
}

export interface StudioTokenBalance {
  address: `0x${string}`;
  symbol: string | null;
  name: string | null;
  decimals: number;
  balance: string;
  /** Already scaled by decimals, for display. */
  formatted: string;
  logoURI: string | null;
}

export type EERCStage = 'signature' | 'proof' | 'transaction' | 'confirming';

export interface EERCStatus {
  account: `0x${string}`;
  registered: boolean;
  unlocked: boolean;
  isConverter: boolean;
  decimals: number;
  owner: `0x${string}`;
  isOwner: boolean;
  auditorSet: boolean;
  tokens: `0x${string}`[];
}

interface EERCResult {
  txHash?: Hex;
  cents?: string;
  formatted?: string;
  dust?: string;
  registered?: boolean;
  status?: EERCStatus;
}

interface StudioGlobal {
  contracts: Record<string, StudioContractInfo>;
  chains: Record<number, StudioChainInfo>;
  provider: Eip1193;
  explorer: {
    tokenList: (chainId: number) => Promise<StudioToken[]>;
    tokenBalances: (address: string, chainId: number) => Promise<{ source: string; balances: StudioTokenBalance[] }>;
  };
  /** Encrypted ERC: keys and proofs are handled outside the app's code; only hashes and plain numbers come back. */
  eerc: (
    request: Record<string, string | undefined>,
    options?: { onStage?: (stage: EERCStage) => void },
  ) => Promise<EERCResult>;
}

export function getStudio(): StudioGlobal {
  const studio = (globalThis as unknown as { studio?: StudioGlobal }).studio;
  if (!studio) throw new Error('window.studio is not available yet.');
  return studio;
}

/* ------------------------------ errors in words ----------------------------- */

/** What went wrong, for a person: a rejected request, a contract's own revert reason, or the wallet's message. */
export function explainError(error: unknown): string {
  const e = error as { code?: number; shortMessage?: string; message?: string } | null;
  if (e?.code === 4001) return 'You rejected the request in your wallet.';
  if (e?.code === 4100) return 'Connect your wallet first.';
  if (error instanceof BaseError) {
    const revert = error.walk((inner) => inner instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name) {
        const args = revert.data?.args?.length ? ` (${revert.data.args.map(String).join(', ')})` : '';
        return `The contract refused it: ${name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}${args}.`;
      }
      if (revert.reason) return `The contract refused it: ${revert.reason}.`;
    }
    return error.shortMessage;
  }
  return e?.shortMessage ?? e?.message ?? 'Something went wrong.';
}

/* --------------------------------- clients ---------------------------------- */

const chainCache = new Map<number, Chain>();

function chainOf(chainId: number): Chain {
  let chain = chainCache.get(chainId);
  if (!chain) {
    const info = getStudio().chains[chainId];
    chain = defineChain({
      id: chainId,
      name: info?.name ?? `Chain ${chainId}`,
      nativeCurrency: info?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [info?.rpcUrl ?? 'http://127.0.0.1:8545'] } },
      ...(info?.explorerUrl ? { blockExplorers: { default: { name: 'Explorer', url: info.explorerUrl } } } : {}),
    });
    chainCache.set(chainId, chain);
  }
  return chain;
}

const clientCache = new Map<number, PublicClient>();

/** A read client for a chain: its RPC when Studio knows one, else the connected wallet. */
export function publicClientFor(chainId: number): PublicClient {
  let client = clientCache.get(chainId);
  if (!client) {
    const studio = getStudio();
    const rpc = studio.chains[chainId]?.rpcUrl;
    client = createPublicClient({
      chain: chainOf(chainId),
      transport: rpc ? http(rpc) : custom(studio.provider),
    }) as PublicClient;
    clientCache.set(chainId, client);
  }
  return client;
}

/** Stable text for a list of call arguments, so an effect re-runs when they change and not before. */
const keyOf = (value: unknown) => JSON.stringify(value ?? null, (_, v) => (typeof v === 'bigint' ? `${v}n` : v));

/* --------------------------------- contracts -------------------------------- */

/** A deployed contract by name (`useContract('Guestbook')`), or null while none is deployed. */
export function useContract(name: string) {
  return useMemo(() => {
    const studio = (globalThis as unknown as { studio?: StudioGlobal }).studio;
    const contract = studio?.contracts[name];
    return contract ? { name, ...contract } : null;
  }, [name]);
}

/* ---------------------------------- wallet ---------------------------------- */

export function useWallet() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { provider } = getStudio();
    let alive = true;
    const readAccounts = (accounts: unknown) => {
      if (alive) setAddress(Array.isArray(accounts) && accounts[0] ? (accounts[0] as `0x${string}`) : null);
    };
    const readChain = (id: unknown) => {
      if (alive) setChainId(typeof id === 'string' ? parseInt(id, 16) : typeof id === 'number' ? id : null);
    };
    void provider.request({ method: 'eth_accounts' }).then(readAccounts, () => {});
    void provider.request({ method: 'eth_chainId' }).then(readChain, () => {});
    provider.on?.('accountsChanged', readAccounts);
    provider.on?.('chainChanged', readChain);
    return () => {
      alive = false;
      provider.removeListener?.('accountsChanged', readAccounts);
      provider.removeListener?.('chainChanged', readChain);
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await getStudio().provider.request({ method: 'eth_requestAccounts' })) as string[];
      setAddress((accounts[0] as `0x${string}`) ?? null);
      const id = (await getStudio().provider.request({ method: 'eth_chainId' })) as string;
      setChainId(parseInt(id, 16));
      return accounts[0] ?? null;
    } catch (e) {
      setError(explainError(e));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Switches the wallet to a chain, adding it first when the wallet doesn't know it. */
  const switchChain = useCallback(async (target: number) => {
    const { provider, chains } = getStudio();
    const hex = `0x${target.toString(16)}`;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e) {
      const info = chains[target];
      if ((e as { code?: number }).code !== 4902 || !info?.rpcUrl) throw e;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hex,
            chainName: info.name,
            rpcUrls: [info.rpcUrl],
            nativeCurrency: info.nativeCurrency,
            ...(info.explorerUrl ? { blockExplorerUrls: [info.explorerUrl] } : {}),
          },
        ],
      });
    }
    setChainId(target);
  }, []);

  return { address, chainId, isConnected: !!address, connecting, error, connect, switchChain };
}

/* ----------------------------------- reads ---------------------------------- */

export interface ReadOptions {
  /** Re-read every this many milliseconds (for live values). */
  refresh?: number;
  /** Skip the read until this is true, for example until an argument is known. */
  enabled?: boolean;
}

/** Reads a view function of a deployed contract: `useRead('Guestbook', 'count')`. */
export function useRead<T = unknown>(
  contractName: string,
  functionName: string,
  args: readonly unknown[] = [],
  { refresh, enabled = true }: ReadOptions = {},
) {
  const contract = useContract(contractName);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const argsKey = keyOf(args);
  const argsRef = useRef(args);
  argsRef.current = args;

  const read = useCallback(async () => {
    if (!contract || contract.chainId === null || !enabled) return;
    setLoading(true);
    try {
      const value = await publicClientFor(contract.chainId).readContract({
        address: contract.address,
        abi: contract.abi,
        functionName,
        args: argsRef.current,
      } as never);
      setData(value as T);
      setError(null);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setLoading(false);
    }
  }, [contract, functionName, enabled]);

  useEffect(() => {
    void read();
    if (!refresh || !enabled) return;
    const timer = setInterval(() => void read(), refresh);
    return () => clearInterval(timer);
  }, [read, refresh, enabled, argsKey]);

  return { data, error, loading, refetch: read, contract };
}

/* ---------------------------------- writes ---------------------------------- */

export type WriteStatus = 'idle' | 'wallet' | 'pending' | 'confirmed' | 'failed';

/**
 * Sends a transaction to a function of a deployed contract:
 * `const { write, status } = useWrite('Guestbook', 'sign')`, then `await write(['hello'])`.
 * It connects the wallet and switches to the contract's chain first, then follows the transaction to a receipt.
 */
export function useWrite(contractName: string, functionName: string) {
  const contract = useContract(contractName);
  const wallet = useWallet();
  const [status, setStatus] = useState<WriteStatus>('idle');
  const [hash, setHash] = useState<Hex | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setHash(null);
    setReceipt(null);
    setError(null);
  }, []);

  const write = useCallback(
    async (args: readonly unknown[] = [], options: { value?: bigint } = {}) => {
      if (!contract || contract.chainId === null) {
        setStatus('failed');
        setError('This contract has not been deployed yet.');
        return null;
      }
      setError(null);
      setHash(null);
      setReceipt(null);
      setStatus('wallet');
      try {
        const account = wallet.address ?? (await wallet.connect());
        if (!account) {
          setStatus('idle');
          return null;
        }
        if (wallet.chainId !== contract.chainId) await wallet.switchChain(contract.chainId);
        const chain = chainOf(contract.chainId);
        const client = createWalletClient({
          account: account as `0x${string}`,
          chain,
          transport: custom(getStudio().provider),
        });
        const txHash = await client.writeContract({
          address: contract.address,
          abi: contract.abi,
          functionName,
          args,
          value: options.value,
          chain,
        } as never);
        setHash(txHash);
        setStatus('pending');
        const done = await publicClientFor(contract.chainId).waitForTransactionReceipt({ hash: txHash });
        setReceipt(done);
        setStatus(done.status === 'success' ? 'confirmed' : 'failed');
        if (done.status !== 'success') setError('The transaction failed on-chain.');
        return done;
      } catch (e) {
        const message = explainError(e);
        // Closing the wallet prompt is a choice, not a failure.
        if ((e as { code?: number })?.code === 4001) setStatus('idle');
        else setStatus('failed');
        setError(message);
        return null;
      }
    },
    [contract, functionName, wallet],
  );

  const explorerUrl = useMemo(
    () => (hash && contract?.explorerUrl ? contract.explorerUrl.replace(/\/address\/.*$/, `/tx/${hash}`) : null),
    [hash, contract],
  );

  return { write, status, hash, receipt, error, reset, explorerUrl, busy: status === 'wallet' || status === 'pending' };
}

/* ---------------------------------- tokens ---------------------------------- */

/** The tokens Builder Hub knows on a chain (the project's own, and well-known ones like USDC). */
export function useTokens(chainId: number | null) {
  const [tokens, setTokens] = useState<StudioToken[]>([]);
  useEffect(() => {
    if (chainId === null) return;
    let alive = true;
    void getStudio()
      .explorer.tokenList(chainId)
      .then(
        (list) => alive && setTokens(list),
        () => {},
      );
    return () => {
      alive = false;
    };
  }, [chainId]);
  return tokens;
}

/** The connected wallet's non-zero ERC-20 balances on a chain, refreshed on an interval. */
export function useTokenBalances(chainId: number | null, { refresh = 0 }: { refresh?: number } = {}) {
  const { address } = useWallet();
  const [balances, setBalances] = useState<StudioTokenBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (chainId === null || !address) {
      setBalances([]);
      return;
    }
    setLoading(true);
    try {
      setBalances((await getStudio().explorer.tokenBalances(address, chainId)).balances);
      setError(null);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setLoading(false);
    }
  }, [chainId, address]);

  useEffect(() => {
    void load();
    if (!refresh) return;
    const timer = setInterval(() => void load(), refresh);
    return () => clearInterval(timer);
  }, [load, refresh]);

  return { balances, error, loading, refetch: load };
}

/* ------------------------------ encrypted ERC ------------------------------- */

const STAGE_TEXT: Record<EERCStage, string> = {
  signature: 'Confirm the signature in your wallet. It unlocks your private balance and costs nothing.',
  proof: 'Creating the privacy proof in your browser. This takes a few seconds.',
  transaction: 'Confirm the transaction in your wallet.',
  confirming: 'Waiting for the network to confirm…',
};

/** "12.5" in a token's decimals as base units; refuses more decimals than the token has. */
function toUnits(amount: string, decimals: number): bigint {
  const value = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Enter an amount like 12.50');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error(`Use at most ${decimals} decimal places`);
  const units =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (units <= 0n) throw new Error('Enter an amount above zero');
  return units;
}

const ERC20_DECIMALS = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

export type EERCAction = 'register' | 'unlock' | 'deposit' | 'transfer' | 'withdraw' | 'mint';

/**
 * A private (Encrypted ERC) token by contract name: `const eerc = useEERC('EncryptedERC')`.
 * Everything a holder does happens here, in the app: create the private account (`register`), read the balance
 * (`unlock` the first time, then `refresh`), `deposit` an ERC-20 into a converter, `transfer` privately,
 * `withdraw` back, and `mint` as the owner of a standalone token. Amounts are plain strings like "12.50".
 * For a converter token, pass the ERC-20 it wraps: `useEERC('EncryptedERC', { token: usdcAddress })`.
 * The key derived from the user's signature and the zero-knowledge proofs are handled outside the app's code.
 */
export function useEERC(contractName: string, { token }: { token?: string } = {}) {
  const contract = useContract(contractName);
  const wallet = useWallet();
  const [status, setStatus] = useState<EERCStatus | null>(null);
  const [balance, setBalance] = useState<{ cents: bigint; formatted: string } | null>(null);
  const [busy, setBusy] = useState<EERCAction | null>(null);
  const [stage, setStage] = useState<EERCStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const call = useCallback(
    (request: Record<string, string | undefined>) => {
      if (!contract) throw new Error(`${contractName} is not deployed yet.`);
      return getStudio().eerc({ token: contract.address, ...request }, { onStage: setStage });
    },
    [contract, contractName],
  );

  const loadStatus = useCallback(async () => {
    if (!contract || !wallet.address) {
      setStatus(null);
      setBalance(null);
      return null;
    }
    const { status: next } = await call({ op: 'status', erc20: token });
    setStatus(next ?? null);
    return next ?? null;
  }, [call, contract, token, wallet.address]);

  const readBalance = useCallback(async () => {
    const result = await call({ op: 'balance', erc20: token });
    setBalance({ cents: BigInt(result.cents ?? '0'), formatted: result.formatted ?? '0.00' });
  }, [call, token]);

  /** Re-reads the account; the balance too once it's unlocked, without asking for a signature. */
  const refresh = useCallback(async () => {
    try {
      const next = await loadStatus();
      if (next?.registered && next.unlocked) await readBalance();
      setError(null);
    } catch (e) {
      setError(explainError(e));
    }
  }, [loadStatus, readBalance]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: EERCAction, work: () => Promise<EERCResult | void>) => {
      setBusy(action);
      setError(null);
      setStage(null);
      try {
        if (!wallet.address && !(await wallet.connect())) return null;
        const result = (await work()) || {};
        if (result.txHash) setLastTx(result.txHash);
        await refresh();
        return result;
      } catch (e) {
        setError(explainError(e));
        return null;
      } finally {
        setBusy(null);
        setStage(null);
      }
    },
    [refresh, wallet],
  );

  const eercDecimals = status?.decimals ?? 2;
  const tokenDecimals = useCallback(async () => {
    if (!token || !contract?.chainId) throw new Error('Pass the ERC-20 to deposit: useEERC(name, { token })');
    const value = await publicClientFor(contract.chainId).readContract({
      address: token as `0x${string}`,
      abi: ERC20_DECIMALS,
      functionName: 'decimals',
    });
    return Number(value);
  }, [contract, token]);

  return {
    contract,
    wallet,
    status,
    /** The private balance, once unlocked: `balance.formatted` is "12.34". */
    balance,
    busy,
    stage,
    /** What is happening right now, in words, while an action runs. */
    stageText: stage ? STAGE_TEXT[stage] : null,
    error,
    lastTx,
    refresh,
    register: () => run('register', () => call({ op: 'register' })),
    /** Reads the balance for the first time on this device; asks for one free signature. */
    unlock: () => run('unlock', () => readBalance()),
    deposit: (amount: string) =>
      run('deposit', async () =>
        call({ op: 'deposit', erc20: token, amount: toUnits(amount, await tokenDecimals()).toString() }),
      ),
    transfer: (to: string, amount: string) =>
      run('transfer', () =>
        call({ op: 'transfer', to, amount: toUnits(amount, eercDecimals).toString(), erc20: token }),
      ),
    withdraw: (amount: string) =>
      run('withdraw', () => call({ op: 'withdraw', amount: toUnits(amount, eercDecimals).toString(), erc20: token })),
    mint: (to: string, amount: string) =>
      run('mint', () => call({ op: 'mint', to, amount: toUnits(amount, eercDecimals).toString() })),
    /** Whether an address has a private account, to check a recipient before sending. */
    isRegistered: async (account: string) => !!(await call({ op: 'isRegistered', account })).registered,
  };
}
