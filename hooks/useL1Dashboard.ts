"use client";

import { useMemo, useEffect, useState } from "react";
import { useWalletStore, useNetworkInfo } from "@/components/toolbox/stores/walletStore";
import { useL1List, type L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { createPublicClient, http, formatEther } from "viem";

// C-Chain IDs
const C_CHAIN_FUJI = 43113;
const C_CHAIN_MAINNET = 43114;

export type L1HealthStatus = "healthy" | "degraded" | "offline" | "unknown";

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
  const [isLoading, setIsLoading] = useState(false);

  // Determine if connected
  const isConnected = Boolean(walletEVMAddress && walletEVMAddress !== "");

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

  // Calculate validator count from features (simplified for now)
  const validatorCount = useMemo(() => {
    if (!currentL1) return 0;
    // In a real implementation, this would query the validator manager contract
    // For now, return a default based on whether validatorManagerAddress exists
    return currentL1.validatorManagerAddress ? 3 : 0;
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

  // Fetch network health data
  useEffect(() => {
    if (!currentL1 || !currentL1.rpcUrl) {
      setHealthStatus("unknown");
      setBlockTime(null);
      setGasPrice(null);
      return;
    }

    const fetchHealthData = async () => {
      setIsLoading(true);
      try {
        const client = createPublicClient({
          transport: http(currentL1.rpcUrl),
        });

        // Get latest block
        const block = await client.getBlock();
        const previousBlock = await client.getBlock({ blockNumber: block.number - 1n });

        // Calculate block time
        const timeDiff = Number(block.timestamp - previousBlock.timestamp);
        setBlockTime(timeDiff);

        // Get gas price
        const gasPriceWei = await client.getGasPrice();
        setGasPrice(formatEther(gasPriceWei));

        // Set health status based on block time
        if (timeDiff <= 5) {
          setHealthStatus("healthy");
        } else if (timeDiff <= 30) {
          setHealthStatus("degraded");
        } else {
          setHealthStatus("offline");
        }
      } catch (error) {
        console.error("Failed to fetch L1 health data:", error);
        setHealthStatus("offline");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthData();

    // Refresh every 30 seconds
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
