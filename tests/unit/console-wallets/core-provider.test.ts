import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The provider keeps the active wallet in localStorage; Node has none.
vi.hoisted(() => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
});

import { privateKeyToAvalancheAccount } from '@avalanche-sdk/client/accounts';
import { getPChainAddress } from '@/components/toolbox/coreViem/methods/getPChainAddress';
import {
  UNLOCK_CANCELLED_EVENT,
  UNLOCK_REQUEST_EVENT,
  getConsoleCoreProvider,
  setActiveConsoleWallet,
} from '@/lib/console-wallets/core-provider';
import { configureVault, importWallet, lockAll, memoryStorage, unlock } from '@/lib/console-wallets/vault';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

describe('Console wallet Core provider', () => {
  let id: string;

  beforeEach(async () => {
    configureVault({ storage: memoryStorage(), iterations: 1_000 });
    id = (await importWallet(KEY, 'Mine', 'correct-horse')).id;
    setActiveConsoleWallet(id);
  });

  it('answers like Core: accounts, Fuji by default, and its testnet flag', async () => {
    const provider = getConsoleCoreProvider();
    const account = privateKeyToAvalancheAccount(KEY);
    expect(provider.isAvalanche).toBe(true);
    expect(await provider.request({ method: 'eth_accounts' })).toEqual([account.getEVMAddress()]);
    expect(await provider.request({ method: 'eth_chainId' })).toBe('0xa869');
    expect(await provider.request({ method: 'wallet_getEthereumChain' })).toMatchObject({ isTestnet: true });
  });

  it("gives the console the same P-Chain address the key's own Avalanche account has", async () => {
    const provider = getConsoleCoreProvider();
    const client = { request: provider.request } as unknown as Parameters<typeof getPChainAddress>[0];
    const fromConsole = await getPChainAddress(client);
    expect(fromConsole).toBe(privateKeyToAvalancheAccount(KEY).getXPAddress('P', 'fuji'));
  });

  it('switches only to chains it knows and adds new ones', async () => {
    const provider = getConsoleCoreProvider();
    await expect(
      provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }),
    ).rejects.toMatchObject({ code: 4902 });
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: '0x3039', chainName: 'Test L1', rpcUrls: ['https://rpc.example.test'] }],
    });
    expect(await provider.request({ method: 'eth_chainId' })).toBe('0x3039');
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa869' }] });
  });

  it('keeps a locked wallet connected with its C- and P-Chain addresses', async () => {
    const provider = getConsoleCoreProvider();
    lockAll({ broadcast: false });
    expect(await provider.request({ method: 'eth_accounts' })).toEqual([
      privateKeyToAvalancheAccount(KEY).getEVMAddress(),
    ]);
    const client = { request: provider.request } as unknown as Parameters<typeof getPChainAddress>[0];
    expect(await getPChainAddress(client)).toBe(privateKeyToAvalancheAccount(KEY).getXPAddress('P', 'fuji'));
  });

  describe('signing while locked', () => {
    const win = globalThis as { window?: EventTarget };
    beforeEach(() => {
      win.window = new EventTarget();
      lockAll({ broadcast: false });
    });
    afterEach(() => {
      delete win.window;
    });

    it('asks for the PIN, then signs once it is unlocked', async () => {
      win.window!.addEventListener(UNLOCK_REQUEST_EVENT, () => void unlock(id, 'correct-horse'));
      const signature = await getConsoleCoreProvider().request({ method: 'personal_sign', params: ['0x68656c6c6f'] });
      expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
    });

    it('rejects the request when the PIN prompt is dismissed', async () => {
      win.window!.addEventListener(UNLOCK_REQUEST_EVENT, () =>
        win.window!.dispatchEvent(new Event(UNLOCK_CANCELLED_EVENT)),
      );
      await expect(
        getConsoleCoreProvider().request({ method: 'personal_sign', params: ['0x68656c6c6f'] }),
      ).rejects.toMatchObject({ code: 4001 });
    });
  });

  it('signs messages with the wallet key without a prompt', async () => {
    const provider = getConsoleCoreProvider();
    const signature = await provider.request({ method: 'personal_sign', params: ['0x68656c6c6f'] });
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
    setActiveConsoleWallet(null);
    expect(await provider.request({ method: 'eth_accounts' })).toEqual([]);
  });
});
