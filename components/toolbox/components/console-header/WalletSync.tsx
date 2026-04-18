'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { createCoreWalletClient } from '@/components/toolbox/coreViem';
import { networkIDs } from '@avalabs/avalanchejs';
import posthog from 'posthog-js';

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

  // Track previous address to detect actual changes
  const prevAddressRef = useRef<string | undefined>(undefined);
  const prevChainIdRef = useRef<number | undefined>(undefined);

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
            if (coreChainId) {
              const numId = typeof coreChainId === 'string' ? parseInt(coreChainId as any, 16) : coreChainId;
              setWalletChainId(numId);
            }
            if (typeof chainInfo?.isTestnet === 'boolean') {
              setIsTestnet(chainInfo.isTestnet);
              setAvalancheNetworkID(chainInfo.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
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
  }, [isConnected, address, isCoreConnector]);

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

    setWalletChainId(chainId);

    // Determine testnet status from chain ID, preserving current state for L1s
    const resolveTestnet = (): boolean => {
      if (chainId === 43113) return true; // Fuji C-Chain
      if (chainId === 43114) return false; // Mainnet C-Chain
      // Custom L1 — preserve the current testnet state from the store
      return useWalletStore.getState().isTestnet;
    };
    const testnet = resolveTestnet();

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
  }, [chainId, isConnected, isCoreConnector]);

  // Bridge raw EIP-1193 `chainChanged` events into the store.
  //
  // wagmi's `useChainId` only surfaces chains registered in wagmiConfig
  // (avalanche + avalancheFuji). For any custom L1 the connector marks the
  // chain "unsupported" and never propagates the change — which leaves
  // `walletChainId` stale in the store and breaks ChainGate for L1 steps.
  // A native listener catches every switch regardless of registration.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (chainIdHex: string | number) => {
      const next = typeof chainIdHex === 'string' ? Number.parseInt(chainIdHex, 16) : Number(chainIdHex);
      if (!Number.isFinite(next) || next <= 0) return;
      if (next === useWalletStore.getState().walletChainId) return;
      setWalletChainId(next);
    };

    const providers: Array<{
      on?: (event: string, listener: (...args: any[]) => void) => void;
      removeListener?: (event: string, listener: (...args: any[]) => void) => void;
    }> = [];
    if (window.avalanche) providers.push(window.avalanche as any);
    if (window.ethereum && window.ethereum !== window.avalanche) providers.push(window.ethereum as any);

    providers.forEach((p) => p.on?.('chainChanged', handler));
    return () => {
      providers.forEach((p) => p.removeListener?.('chainChanged', handler));
    };
  }, [setWalletChainId]);

  return null;
}
