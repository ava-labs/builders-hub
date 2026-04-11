'use client';

import { useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { createCoreWalletClient } from '@/components/toolbox/coreViem';
import { networkIDs } from '@avalabs/avalanchejs';
import { getL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

/**
 * Determine isTestnet for an EVM chain ID by checking both L1 list stores.
 * Returns true/false if the chain is found, or undefined if unknown.
 */
function resolveIsTestnet(evmChainId: number): boolean | undefined {
  if (evmChainId === 43113) return true;
  if (evmChainId === 43114) return false;

  const testnetList: L1ListItem[] = getL1ListStore(true).getState().l1List;
  if (testnetList.some((l) => l.evmChainId === evmChainId)) return true;

  const mainnetList: L1ListItem[] = getL1ListStore(false).getState().l1List;
  if (mainnetList.some((l) => l.evmChainId === evmChainId)) return false;

  return undefined;
}

export function WalletBootstrap() {
  const setCoreWalletClient = useWalletStore((s) => s.setCoreWalletClient);
  const setWalletEVMAddress = useWalletStore((s) => s.setWalletEVMAddress);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const setPChainAddress = useWalletStore((s) => s.setPChainAddress);
  const setCoreEthAddress = useWalletStore((s) => s.setCoreEthAddress);
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet);
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID);
  const setEvmChainName = useWalletStore((s) => s.setEvmChainName);
  const updateAllBalances = useWalletStore((s) => s.updateAllBalances);
  const setBootstrapped = useWalletStore((s) => s.setBootstrapped);
  const setWalletType = useWalletStore((s) => s.setWalletType);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasCore = !!window.avalanche;
    const hasGenericEvm = !!window.ethereum;

    // No wallet provider at all — nothing to bootstrap
    if (!hasCore && !hasGenericEvm) return;

    // --- Core Wallet path (window.avalanche) ---
    if (hasCore) {
      const onChainChanged = async (chainId: string | number) => {
        const numericId = typeof chainId === 'string' ? Number.parseInt(chainId, 16) : chainId;
        setWalletChainId(numericId);

        // Resolve isTestnet by looking up the chain in both L1 list stores.
        // Falls back to current state only for truly unknown chains.
        const testnet = resolveIsTestnet(numericId) ?? useWalletStore.getState().isTestnet;

        try {
          const client = await createCoreWalletClient(
            useWalletStore.getState().walletEVMAddress as `0x${string}`,
            testnet,
          );
          if (client) {
            setCoreWalletClient(client);
            // Re-fetch P-Chain address — bech32 HRP changes between networks
            const [data, pAddr] = await Promise.all([
              client.getEthereumChain().catch(() => ({ chainName: '' }) as any),
              client.getPChainAddress().catch(() => ''),
            ]);
            if (pAddr) setPChainAddress(pAddr);
            setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
            setIsTestnet(testnet);
            setEvmChainName(data.chainName);
          }
        } catch {}

        try {
          updateAllBalances();
        } catch {}
      };

      const handleAccountsChanged = async (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          setWalletEVMAddress('');
          setPChainAddress('');
          setCoreEthAddress('');
          setWalletChainId(0);
          setWalletType(null);
          return;
        }
        if (accounts.length > 1) {
          accounts = [accounts[0]];
        }

        const account = accounts[0] as `0x${string}`;
        const client = await createCoreWalletClient(account);
        if (!client) return;

        setCoreWalletClient(client);
        setWalletEVMAddress(account);
        setWalletType('core');

        try {
          const [pAddr, cAddr, chainInfo, chainId] = await Promise.all([
            client.getPChainAddress().catch(() => ''),
            client.getCorethAddress().catch(() => ''),
            client.getEthereumChain().catch(() => ({ isTestnet: undefined as any, chainName: '' }) as any),
            client.getChainId().catch(() => 0),
          ]);
          if (pAddr) setPChainAddress(pAddr);
          if (cAddr) setCoreEthAddress(cAddr);
          if (chainId) {
            const numericId = typeof chainId === 'string' ? parseInt(chainId as any, 16) : chainId;
            setWalletChainId(numericId);
          }
          if (typeof chainInfo?.isTestnet === 'boolean') {
            setIsTestnet(chainInfo.isTestnet);
            setAvalancheNetworkID(chainInfo.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
            setEvmChainName(chainInfo.chainName);
          }
        } catch {}

        try {
          updateAllBalances();
        } catch {}
      };

      try {
        setBootstrapped(true);
        setWalletType('core');

        window.avalanche?.on('accountsChanged', handleAccountsChanged);
        window.avalanche?.on('chainChanged', onChainChanged);
      } catch {}

      return () => {
        try {
          if (window.avalanche?.removeListener) {
            window.avalanche.removeListener('accountsChanged', handleAccountsChanged as any);
            window.avalanche.removeListener('chainChanged', onChainChanged as any);
          }
        } catch {}
      };
    }

    // --- Generic EVM wallet path (window.ethereum, no Core) ---
    if (hasGenericEvm && !hasCore) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          setWalletEVMAddress('');
          setWalletChainId(0);
          setWalletType(null);
          return;
        }

        const account = accounts[0] as `0x${string}`;
        setWalletEVMAddress(account);
        setCoreWalletClient(null);
        setWalletType('generic-evm');

        try {
          updateAllBalances();
        } catch {}
      };

      const handleChainChanged = (chainIdHex: string | number) => {
        const numericId = typeof chainIdHex === 'string' ? Number.parseInt(chainIdHex, 16) : chainIdHex;
        setWalletChainId(numericId);

        // Resolve isTestnet from L1 list stores; fallback to current state for unknown chains
        const testnet = resolveIsTestnet(numericId) ?? useWalletStore.getState().isTestnet;
        setIsTestnet(testnet);
        setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);

        try {
          updateAllBalances();
        } catch {}
      };

      try {
        setBootstrapped(true);
        setWalletType('generic-evm');

        window.ethereum!.on('accountsChanged', handleAccountsChanged as any);
        window.ethereum!.on('chainChanged', handleChainChanged as any);
      } catch {}

      return () => {
        try {
          window.ethereum?.removeListener('accountsChanged', handleAccountsChanged as any);
          window.ethereum?.removeListener('chainChanged', handleChainChanged as any);
        } catch {}
      };
    }
  }, [
    setCoreWalletClient,
    setWalletEVMAddress,
    setWalletChainId,
    setPChainAddress,
    setCoreEthAddress,
    setIsTestnet,
    setAvalancheNetworkID,
    setEvmChainName,
    updateAllBalances,
    setBootstrapped,
    setWalletType,
  ]);

  return null;
}
