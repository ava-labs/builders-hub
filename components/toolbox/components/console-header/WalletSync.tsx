'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount, useAccountEffect, useChainId, useSwitchChain } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { createCoreWalletClient } from '@/components/toolbox/coreViem';
import { networkIDs } from '@avalabs/avalanchejs';
import posthog from 'posthog-js';
import {
  parseProviderChainId,
  readWalletProviderChainId,
  resolveActiveWalletProvider,
  type Eip1193Provider,
} from '@/components/toolbox/lib/walletProvider';
import { C_CHAIN_FUJI, C_CHAIN_MAINNET, findL1ByEvmChainId } from '@/lib/console/l1-dashboard';

/**
 * Invisible component that bridges wagmi/RainbowKit state into the
 * existing Zustand walletStore. All 145+ downstream consumers read
 * from the store and remain completely unchanged.
 *
 * Core detection: we look for EIP-6963 rdns `app.core` first, then fall
 * back to inspecting the injected provider identity (see the
 * `isCoreConnector` effect below). When detected, we instantiate the
 * full CoreWalletClient for P-Chain operations. Otherwise we set
 * walletType = 'generic-evm' and null out the Core client.
 */
export function WalletSync() {
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const pathname = usePathname();

  /**
   * On a *fresh* wallet connect (user just clicked Connect — not a reload
   * rehydration), nudge the wallet to Fuji testnet. Builder Hub tooling
   * defaults to testnet for safety: deploys, faucets, validator flows,
   * and Quick L1 are all testnet-first. `isReconnected` lets us skip
   * the nudge on page reloads so we don't fight a user who deliberately
   * switched to mainnet in a prior session.
   *
   * If the user rejects the switch we silently let them stay on whatever
   * chain they connected to — mainnet still works for read-only flows.
   *
   * Skip the nudge entirely on the ICM Test Connection flow: Echo and
   * Dispatch are pre-registered destination L1s, and the user lands on
   * those pages already on the chain they want. Switching them to Fuji
   * on connect would force an unwanted prompt before the tool UI loads.
   */
  useAccountEffect({
    onConnect({ chainId: connectChainId, isReconnected }) {
      if (isReconnected) return;
      if (connectChainId === avalancheFuji.id) return;
      if (pathname?.startsWith('/console/icm/test-connection')) return;
      switchChainAsync({ chainId: avalancheFuji.id }).catch(() => {});
    },
  });

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
  const testnetL1List = getL1ListStore(true)((state: { l1List: L1ListItem[] }) => state.l1List);
  const mainnetL1List = getL1ListStore(false)((state: { l1List: L1ListItem[] }) => state.l1List);

  // Track previous address to detect actual changes
  const prevAddressRef = useRef<string | undefined>(undefined);
  const prevChainIdRef = useRef<number | undefined>(undefined);

  const getKnownL1 = useCallback(
    (nextChainId: number) => {
      const activeFirstLists = useWalletStore.getState().isTestnet
        ? [testnetL1List, mainnetL1List]
        : [mainnetL1List, testnetL1List];
      return findL1ByEvmChainId(nextChainId, activeFirstLists);
    },
    [mainnetL1List, testnetL1List],
  );

  const resolveTestnetForChainId = useCallback(
    (nextChainId: number): boolean => {
      if (nextChainId === C_CHAIN_FUJI) return true;
      if (nextChainId === C_CHAIN_MAINNET) return false;
      return getKnownL1(nextChainId)?.isTestnet ?? useWalletStore.getState().isTestnet;
    },
    [getKnownL1],
  );

  const applyWalletChainId = useCallback(
    (nextChainId: number) => {
      if (!Number.isFinite(nextChainId) || nextChainId <= 0) return;

      const current = useWalletStore.getState();
      if (nextChainId !== current.walletChainId) {
        setWalletChainId(nextChainId);
      }

      const nextIsTestnet = resolveTestnetForChainId(nextChainId);
      if (nextIsTestnet !== current.isTestnet) {
        setIsTestnet(nextIsTestnet);
        setAvalancheNetworkID(nextIsTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
      }
    },
    [resolveTestnetForChainId, setAvalancheNetworkID, setIsTestnet, setWalletChainId],
  );

  /**
   * Determine if the connected wallet is Core.
   *
   * Preferred signal: EIP-6963 rdns — `connector.id === 'app.core'`
   * (resolved synchronously during render).
   *
   * Fallback: when wagmi attaches via the plain `injected()` connector
   * (id `'injected'`), resolve the underlying EIP-1193 provider and check
   * whether it *is* Core's provider. We compare against `window.avalanche`
   * and `provider.isAvalanche`. This is stricter than the legacy
   * `connector.type === 'injected' && !!window.avalanche` check — that
   * version false-positived when both Core and MetaMask were installed
   * but MetaMask was active, because `window.avalanche` is defined
   * regardless of which wallet is the active injected provider. Provider
   * identity disambiguates: if MetaMask is connected, `getProvider()`
   * returns MetaMask's provider, which is neither `window.avalanche` nor
   * carries `isAvalanche = true`.
   *
   * `isCoreConnector` is `null` until detection completes for the current
   * connector. Downstream effects bail on `null` so we don't commit to a
   * wallet path (and wipe `pChainAddress`) before we know the answer. We
   * track `resolvedForConnectorRef` to invalidate a stale async result
   * when the connector swaps out — otherwise, on reconnect with Core the
   * previously-resolved `false` would leak through and gate the bootstrap.
   */
  const [injectedIsCore, setInjectedIsCore] = useState<boolean | null>(null);
  const resolvedForConnectorRef = useRef<unknown>(undefined);

  const isCoreConnector: boolean | null = !connector
    ? false
    : connector.id === 'app.core'
      ? true
      : connector.type === 'injected'
        ? resolvedForConnectorRef.current === connector
          ? injectedIsCore
          : null
        : false;

  useEffect(() => {
    if (!connector || connector.type !== 'injected' || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const provider = (await connector.getProvider?.()) as
          | (Record<string, unknown> & { isAvalanche?: boolean })
          | undefined;
        const coreProvider = (window as any).avalanche;
        const isCore = !!provider && (provider === coreProvider || provider.isAvalanche === true);
        if (!cancelled) {
          resolvedForConnectorRef.current = connector;
          setInjectedIsCore(isCore);
        }
      } catch {
        if (!cancelled) {
          resolvedForConnectorRef.current = connector;
          setInjectedIsCore(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connector]);

  // Sync connection state → Zustand store
  useEffect(() => {
    // Wait for async Core detection before committing to a wallet path.
    // Without this guard the effect runs with isCoreConnector=false on the
    // first render, immediately firing the generic-evm branch and wiping
    // pChainAddress before detection resolves.
    if (isCoreConnector === null) return;

    if (!isConnected || !address) {
      // Disconnected — clear all wallet state
      if (prevAddressRef.current) {
        setWalletEVMAddress('');
        setPChainAddress('');
        setCoreEthAddress('');
        setWalletChainId(0);
        setCoreWalletClient(null);
        setWalletType(null);
        setBootstrapped(false);
        prevAddressRef.current = undefined;
        prevChainIdRef.current = undefined;
      }
      return;
    }

    const addressChanged = address !== prevAddressRef.current;
    prevAddressRef.current = address;

    const hexAddress = address as `0x${string}`;

    setBootstrapped(true);
    setWalletEVMAddress(hexAddress);

    // Track wallet type on new connections
    if (addressChanged && connector) {
      const walletName = connector.name || connector.id || 'unknown';
      posthog.capture('console_wallet_connected', {
        wallet_id: connector.id,
        wallet_name: walletName,
        wallet_type: connector.type,
        is_core: isCoreConnector,
        chain_id: chainId,
      });
      posthog.setPersonProperties({
        last_wallet: walletName,
        last_wallet_id: connector.id,
      });
    }

    if (isCoreConnector) {
      // --- Core Wallet path ---
      setWalletType('core');

      // Bootstrap when address changes OR when the store is missing Core
      // state. The second condition is what makes reload work: the
      // walletStore isn't persisted, so on page reload `pChainAddress` and
      // `coreWalletClient` come back empty even though wagmi rehydrates the
      // address — `addressChanged` alone would miss that case whenever the
      // async Core detection resolves after the connection effect has
      // already set `prevAddressRef`.
      const storeSnapshot = useWalletStore.getState();
      const needsCoreBootstrap = !storeSnapshot.coreWalletClient || !storeSnapshot.pChainAddress;

      if (addressChanged || needsCoreBootstrap) {
        // Full Core bootstrap: create client, fetch P-Chain address, chain info
        (async () => {
          try {
            const client = await createCoreWalletClient(hexAddress);
            if (!client) return;

            setCoreWalletClient(client);

            const [pAddr, cAddr, chainInfo, coreChainId] = await Promise.all([
              client.getPChainAddress().catch(() => ''),
              client.getCorethAddress().catch(() => ''),
              client.getEthereumChain().catch(() => ({ isTestnet: undefined as any, chainName: '' }) as any),
              client.getChainId().catch(() => 0),
            ]);

            if (pAddr) setPChainAddress(pAddr);
            if (cAddr) setCoreEthAddress(cAddr);
            let resolvedCoreChainId = 0;
            if (coreChainId) {
              resolvedCoreChainId = typeof coreChainId === 'string' ? parseInt(coreChainId as any, 16) : coreChainId;
              applyWalletChainId(resolvedCoreChainId);
            }
            if (typeof chainInfo?.isTestnet === 'boolean') {
              const knownL1 = resolvedCoreChainId > 0 ? getKnownL1(resolvedCoreChainId) : null;
              const chainInfoIsAuthoritative =
                resolvedCoreChainId === C_CHAIN_FUJI || resolvedCoreChainId === C_CHAIN_MAINNET || !knownL1;
              const nextIsTestnet = chainInfoIsAuthoritative ? chainInfo.isTestnet : knownL1.isTestnet;
              setIsTestnet(nextIsTestnet);
              setAvalancheNetworkID(nextIsTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
              setEvmChainName(chainInfo.chainName);
            }
          } catch {
            /* Core bootstrap failed silently */
          }

          try {
            updateAllBalances();
          } catch {}
        })();
      }
    } else {
      // --- Generic EVM wallet path (MetaMask, Rabby, WalletConnect, etc.) ---
      setWalletType('generic-evm');
      setCoreWalletClient(null);
      setPChainAddress('');
      setCoreEthAddress('');

      if (addressChanged) {
        try {
          updateAllBalances();
        } catch {}
      }
    }
  }, [
    address,
    applyWalletChainId,
    chainId,
    connector,
    getKnownL1,
    isConnected,
    isCoreConnector,
    setAvalancheNetworkID,
    setBootstrapped,
    setCoreEthAddress,
    setCoreWalletClient,
    setEvmChainName,
    setIsTestnet,
    setPChainAddress,
    setWalletChainId,
    setWalletEVMAddress,
    setWalletType,
    updateAllBalances,
  ]);

  // Sync chain changes → Zustand store
  //
  // Testnet derivation: only the primary-network chain IDs (43113 Fuji,
  // 43114 Mainnet) definitively signal a network switch.  Any other chain
  // ID is a custom L1 — switching to an L1 should NEVER flip the
  // mainnet/testnet flag because Core Wallet's `wallet_getEthereumChain`
  // unreliably reports `isTestnet: false` for custom L1 testnets.
  useEffect(() => {
    if (isCoreConnector === null) return; // wait for async Core detection
    if (!isConnected || !chainId) return;
    if (chainId === prevChainIdRef.current) return;
    prevChainIdRef.current = chainId;

    applyWalletChainId(chainId);
    const testnet = resolveTestnetForChainId(chainId);

    if (isCoreConnector) {
      // Re-create Core client for the new chain and update store.
      // Pass the resolved testnet flag so the SDK targets the correct
      // P-Chain endpoint regardless of Core Wallet's mode.
      (async () => {
        try {
          const client = await createCoreWalletClient(
            useWalletStore.getState().walletEVMAddress as `0x${string}`,
            testnet,
          );
          if (client) {
            setCoreWalletClient(client);

            // Re-fetch P-Chain address — the bech32 HRP changes between
            // networks (P-avax1… on mainnet vs P-fuji1… on testnet).
            const [data, pAddr] = await Promise.all([
              client.getEthereumChain().catch(() => ({ chainName: '' }) as any),
              client.getPChainAddress().catch(() => ''),
            ]);
            if (pAddr) setPChainAddress(pAddr);
            setIsTestnet(testnet);
            setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
            setEvmChainName(data.chainName);
          }
        } catch {}

        try {
          updateAllBalances();
        } catch {}
      })();
    } else {
      // Generic EVM wallets: same logic — only C-Chain IDs toggle testnet
      setIsTestnet(testnet);
      setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);

      try {
        updateAllBalances();
      } catch {}
    }
  }, [applyWalletChainId, chainId, isConnected, isCoreConnector, resolveTestnetForChainId]);

  // Bridge raw EIP-1193 `chainChanged` events into the store.
  //
  // wagmi's `useChainId` only surfaces chains registered in wagmiConfig
  // (avalanche + avalancheFuji). For any custom L1 the connector marks the
  // chain "unsupported" and never propagates the change — which leaves
  // `walletChainId` stale in the store and breaks ChainGate for L1 steps.
  // A native listener catches every switch regardless of registration.
  useEffect(() => {
    if (isCoreConnector === null) return;
    if (!isConnected) return;

    const handler = (chainIdHex: unknown) => {
      const next = parseProviderChainId(chainIdHex);
      if (next !== null) applyWalletChainId(next);
    };

    let cancelled = false;
    let activeProvider: Eip1193Provider | null = null;
    const walletType = isCoreConnector ? 'core' : 'generic-evm';

    resolveActiveWalletProvider({ connector, walletType }).then(async (provider) => {
      if (cancelled || !provider) return;

      activeProvider = provider;
      provider.on?.('chainChanged', handler);

      const liveChainId = await readWalletProviderChainId(provider);
      if (!cancelled && liveChainId !== null) {
        applyWalletChainId(liveChainId);
      }
    });

    return () => {
      cancelled = true;
      activeProvider?.removeListener?.('chainChanged', handler);
    };
  }, [applyWalletChainId, connector, isConnected, isCoreConnector]);

  return null;
}
