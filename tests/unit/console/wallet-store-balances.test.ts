import { describe, expect, it } from 'vitest';
import { balanceUpdate, loadingUpdate, useWalletStore } from '@/components/toolbox/stores/walletStore';

const balances = { pChain: 0, cChain: 0, l1Chains: { '1': 5 } };
const isLoading = { pChain: false, cChain: false, l1Chains: { '1': true } };

describe('balanceUpdate', () => {
  it('writes a P-Chain or C-Chain amount to balances and to its copy field', () => {
    expect(balanceUpdate(balances, 'pChain', 1.38)).toEqual({
      balances: { pChain: 1.38, cChain: 0, l1Chains: { '1': 5 } },
      pChainBalance: 1.38,
    });
    expect(balanceUpdate(balances, 'cChain', 2)).toEqual({
      balances: { pChain: 0, cChain: 2, l1Chains: { '1': 5 } },
      cChainBalance: 2,
    });
  });

  it('reads a null P-Chain amount as 0', () => {
    expect(balanceUpdate(balances, 'pChain', null)).toMatchObject({ pChainBalance: 0, balances: { pChain: 0 } });
  });

  it('keeps a null L1 amount and writes no copy field', () => {
    const update = balanceUpdate(balances, '43113', null);
    expect(update).toEqual({ balances: { pChain: 0, cChain: 0, l1Chains: { '1': 5, '43113': null } } });
  });
});

describe('loadingUpdate', () => {
  it('writes a P-Chain or C-Chain flag to isLoading and to its copy field', () => {
    expect(loadingUpdate(isLoading, 'pChain', true)).toEqual({
      isLoading: { pChain: true, cChain: false, l1Chains: { '1': true } },
      isPChainBalanceLoading: true,
    });
    expect(loadingUpdate(isLoading, 'cChain', true)).toEqual({
      isLoading: { pChain: false, cChain: true, l1Chains: { '1': true } },
      isCChainBalanceLoading: true,
    });
  });

  it('writes an L1 flag under its chain ID only', () => {
    expect(loadingUpdate(isLoading, '1', false)).toEqual({
      isLoading: { pChain: false, cChain: false, l1Chains: { '1': false } },
    });
  });
});

describe('useWalletStore balance fields', () => {
  it('keeps pChainBalance and cChainBalance in step after more than one set', () => {
    const { setBalance, setLoading, setIsTestnet } = useWalletStore.getState();
    // Any set before the balance read froze the old getters at 0.
    setIsTestnet(true);
    setBalance('pChain', 1.38);
    setBalance('cChain', 0.5);
    setLoading('pChain', true);
    expect(useWalletStore.getState()).toMatchObject({
      pChainBalance: 1.38,
      cChainBalance: 0.5,
      isPChainBalanceLoading: true,
      balances: { pChain: 1.38, cChain: 0.5 },
    });

    setBalance('pChain', 2.5);
    setLoading('pChain', false);
    expect(useWalletStore.getState()).toMatchObject({ pChainBalance: 2.5, isPChainBalanceLoading: false });
  });
});
