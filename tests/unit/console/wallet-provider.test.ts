import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readWalletProviderChainId,
  resolveActiveWalletProvider,
  type Eip1193Provider,
} from '@/components/toolbox/lib/walletProvider';

function makeProvider(chainId: number): Eip1193Provider {
  return {
    request: vi.fn(async ({ method }) => {
      if (method !== 'eth_chainId') throw new Error(`unexpected method ${method}`);
      return `0x${chainId.toString(16)}`;
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe('wallet provider resolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the connected connector provider instead of the first injected provider', async () => {
    const coreProvider = makeProvider(43_113);
    const genericProvider = makeProvider(123_456);
    vi.stubGlobal('window', {
      avalanche: coreProvider,
      ethereum: genericProvider,
    });

    const provider = await resolveActiveWalletProvider({
      connector: { getProvider: vi.fn(async () => genericProvider) },
      walletType: 'generic-evm',
    });

    expect(provider).toBe(genericProvider);
    expect(await readWalletProviderChainId(provider)).toBe(123_456);
    expect(coreProvider.request).not.toHaveBeenCalled();
  });

  it('uses Core provider when Core is the connected connector', async () => {
    const coreProvider = makeProvider(555_777);
    const genericProvider = makeProvider(43_114);
    vi.stubGlobal('window', {
      avalanche: coreProvider,
      ethereum: genericProvider,
    });

    const provider = await resolveActiveWalletProvider({
      connector: { getProvider: vi.fn(async () => coreProvider) },
      walletType: 'core',
    });

    expect(provider).toBe(coreProvider);
    expect(await readWalletProviderChainId(provider)).toBe(555_777);
    expect(genericProvider.request).not.toHaveBeenCalled();
  });

  it('returns null chain state when no connected provider is supplied', async () => {
    expect(await readWalletProviderChainId(null)).toBeNull();
  });
});
