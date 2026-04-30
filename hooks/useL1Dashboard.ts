"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useWalletStore, useNetworkInfo } from "@/components/toolbox/stores/walletStore";
import { useL1List, type L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { createPublicClient, http, formatEther } from "viem";
const GLACIER_API = "https://glacier-api.avax.network";

// C-Chain IDs
const C_CHAIN_FUJI = 43113;
const C_CHAIN_MAINNET = 43114;

export type L1HealthStatus = "healthy" | "degraded" | "stale" | "offline" | "unknown";

export interface L1DashboardData {
  // Connection status
  isConnected: boolean;
  isConnectedToL1: boolean;
  isConnectedToCChain: boolean;

  // Current L1 info (if connected to L1)
  currentL1: L1ListItem | null;

  // Network health
  healthStatus: L1HealthStatus;
  validatorCount: number;
  blockTime: number | null;
  gasPrice: string | null;

  // Wallet info
  walletAddress: string;
  balance: number;

  // Setup progress
  setupProgress: {
    l1Created: boolean;
    nodeRunning: boolean;
    vmSetup: boolean;
    icmEnabled: boolean;
    bridgeSetup: boolean;
  };
  setupProgressPercent: number;

  // Loading states
  isLoading: boolean;
}

export function useL1Dashboard(): L1DashboardData {
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const balances = useWalletStore((s) => s.balances);
  const { isTestnet } = useNetworkInfo();
  const l1List = useL1List();

  const [healthStatus, setHealthStatus] = useState<L1HealthStatus>("unknown");
  const [blockTime, setBlockTime] = useState<number | null>(null);
  const [gasPrice, setGasPrice] = useState<string | null>(null);
  const [validatorCount, setValidatorCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Determine if connected
  const isConnected = Boolean(walletEVMAddress);

  // Check if connected to C-Chain
  const isConnectedToCChain = walletChainId === C_CHAIN_FUJI || walletChainId === C_CHAIN_MAINNET;

  // Find current L1 from the list
  const currentL1 = useMemo((): L1ListItem | null => {
    if (!walletChainId || isConnectedToCChain) return null;
    return l1List.find((l1: L1ListItem) => l1.evmChainId === walletChainId) || null;
  }, [walletChainId, l1List, isConnectedToCChain]);

  const isConnectedToL1 = Boolean(currentL1);

  // Get balance for current chain
  const balance = useMemo(() => {
    if (isConnectedToCChain) {
      return balances.cChain;
    }
    if (currentL1) {
      return balances.l1Chains[walletChainId.toString()] || 0;
    }
    return 0;
  }, [isConnectedToCChain, currentL1, balances, walletChainId]);

  // Request-id guard for validator count (separate from health check)
  const validatorRequestIdRef = useRef(0);

  // Fetch real validator count directly from Glacier API
  useEffect(() => {
    if (!currentL1 || currentL1.subnetId === "11111111111111111111111111111111LpoYY") {
      setValidatorCount(0);
      return;
    }

    const requestId = ++validatorRequestIdRef.current;
    const network = currentL1.isTestnet ? 'testnet' : 'mainnet';

    const fetchValidatorCount = async () => {
      try {
        // Step 1: Resolve subnetId
        let subnetId = currentL1.subnetId;
        if (!subnetId) {
          const blockchainId = currentL1.id
            || currentL1.rpcUrl?.match(/\/ext\/bc\/([^/]+)\/rpc/)?.[1]
            || '';
          if (!blockchainId) { setValidatorCount(0); return; }

          const bcRes = await fetch(`${GLACIER_API}/v1/networks/${network}/blockchains/${blockchainId}`);
          if (!bcRes.ok) { setValidatorCount(0); return; }
          const bcData = await bcRes.json();
          subnetId = bcData?.subnetId ?? '';
        }
        if (!subnetId) { setValidatorCount(0); return; }

        // Step 2: Fetch L1 validators directly from Glacier
        const valRes = await fetch(`${GLACIER_API}/v1/networks/${network}/l1Validators?subnetId=${subnetId}&pageSize=100`);
        if (!valRes.ok) { if (requestId === validatorRequestIdRef.current) setValidatorCount(0); return; }
        const valData = await valRes.json();
        const activeValidators = (valData?.validators ?? []).filter((v: { remainingBalance?: number }) => !v.remainingBalance || v.remainingBalance > 0);

        if (requestId === validatorRequestIdRef.current) {
          setValidatorCount(activeValidators.length);
        }
      } catch {
        if (requestId === validatorRequestIdRef.current) {
          setValidatorCount(0);
        }
      }
    };

    fetchValidatorCount();
    const interval = setInterval(fetchValidatorCount, 30000);
    return () => clearInterval(interval);
  }, [currentL1]);

  // Calculate setup progress
  const setupProgress = useMemo(() => {
    if (!currentL1) {
      return {
        l1Created: false,
        nodeRunning: false,
        vmSetup: false,
        icmEnabled: false,
        bridgeSetup: false,
      };
    }

    return {
      l1Created: true, // If we have an L1 in the list, it's created
      nodeRunning: true, // If we're connected, node is running
      vmSetup: Boolean(currentL1.validatorManagerAddress),
      icmEnabled: Boolean(currentL1.wellKnownTeleporterRegistryAddress),
      bridgeSetup: Boolean(currentL1.wrappedTokenAddress),
    };
  }, [currentL1]);

  // Calculate progress percentage
  const setupProgressPercent = useMemo(() => {
    const steps = Object.values(setupProgress);
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
  }, [setupProgress]);

  // Request-id guard to prevent stale responses from overwriting state
  const healthRequestIdRef = useRef(0);

  // Fetch network health data
  useEffect(() => {
    if (!currentL1 || !currentL1.rpcUrl) {
      setHealthStatus("unknown");
      setBlockTime(null);
      setGasPrice(null);
      return;
    }

    const requestId = ++healthRequestIdRef.current;

    const fetchHealthData = async () => {
      setIsLoading(true);
      try {
        const client = createPublicClient({
          transport: http(currentL1.rpcUrl),
        });

        // Liveness probe: verify chain ID matches
        const chainId = await client.getChainId();
        if (chainId !== currentL1.evmChainId) {
          if (requestId === healthRequestIdRef.current) {
            setHealthStatus("offline");
            setBlockTime(null);
            setGasPrice(null);
            setIsLoading(false);
          }
          return;
        }

        // Fetch block and gas price independently so one failure doesn't affect the other
        const [blockResult, gasPriceResult] = await Promise.allSettled([
          client.getBlock(),
          client.getGasPrice(),
        ]);

        if (requestId !== healthRequestIdRef.current) return;

        // Handle gas price independently
        if (gasPriceResult.status === "fulfilled") {
          setGasPrice(formatEther(gasPriceResult.value));
        } else {
          setGasPrice(null);
        }

        // Block fetch is required for status determination
        if (blockResult.status === "rejected") {
          setHealthStatus("offline");
          setBlockTime(null);
          setIsLoading(false);
          return;
        }

        const block = blockResult.value;

        // Compute time since last block for status determination
        const lastBlockAge = Math.floor(Date.now() / 1000) - Number(block.timestamp);

        if (lastBlockAge <= 120) {
          setHealthStatus("healthy");
        } else if (lastBlockAge <= 600) {
          setHealthStatus("degraded");
        } else {
          setHealthStatus("stale");
        }

        // Compute inter-block gap as informational blockTime (only when not genesis-only)
        if (block.number > 0n) {
          try {
            const previousBlock = await client.getBlock({ blockNumber: block.number - 1n });
            if (requestId === healthRequestIdRef.current) {
              const timeDiff = Number(block.timestamp - previousBlock.timestamp);
              setBlockTime(timeDiff);
            }
          } catch {
            if (requestId === healthRequestIdRef.current) {
              setBlockTime(null);
            }
          }
        } else {
          setBlockTime(null);
        }
      } catch {
        if (requestId === healthRequestIdRef.current) {
          setHealthStatus("offline");
          setBlockTime(null);
          setGasPrice(null);
        }
      } finally {
        if (requestId === healthRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchHealthData();

    // Poll every 30 seconds, clear previous interval on chain switch
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, [currentL1]);

  return {
    isConnected,
    isConnectedToL1,
    isConnectedToCChain,
    currentL1,
    healthStatus,
    validatorCount,
    blockTime,
    gasPrice,
    walletAddress: walletEVMAddress,
    balance,
    setupProgress,
    setupProgressPercent,
    isLoading,
  };
}
