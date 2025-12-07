"use client";
import { useCallback } from "react";

const STORAGE_KEY = "builder-hub-faucet-tracker-temp";

interface ChainTokenNeed {
  chainId: number;
  timestamp: number;
  walletAddress: string;
}

export const useChainTokenTracker = () => {
  const getNeededChains = useCallback((walletAddress: string): number[] => {
    if (typeof window === "undefined") return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const needs: ChainTokenNeed[] = JSON.parse(stored);
      const now = Date.now();
      const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

      return needs
        .filter(
          (need) =>
            need.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
            now - need.timestamp < EXPIRY_TIME
        )
        .map((need) => need.chainId);
    } catch (error) {
      return [];
    }
  }, []);

  const markChainAsNeeded = useCallback((chainId: number, walletAddress: string) => {
    if (typeof window === "undefined" || !walletAddress) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const existing: ChainTokenNeed[] = stored ? JSON.parse(stored) : [];

      const filtered = existing.filter(
        (need) =>
          !(
            need.chainId === chainId &&
            need.walletAddress.toLowerCase() === walletAddress.toLowerCase()
          )
      );

      filtered.push({
        chainId,
        timestamp: Date.now(),
        walletAddress: walletAddress.toLowerCase(),
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      return;
    }
  }, []);

  const markChainAsSatisfied = useCallback((chainId: number, walletAddress: string) => {
    if (typeof window === "undefined" || !walletAddress) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const existing: ChainTokenNeed[] = JSON.parse(stored);
      const filtered = existing.filter(
        (need) =>
          !(
            need.chainId === chainId &&
            need.walletAddress.toLowerCase() === walletAddress.toLowerCase()
          )
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      return;
    }
  }, []);

  const cleanupExpiredEntries = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const existing: ChainTokenNeed[] = JSON.parse(stored);
      const now = Date.now();
      const EXPIRY_TIME = 24 * 60 * 60 * 1000;

      const filtered = existing.filter((need) => now - need.timestamp < EXPIRY_TIME);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      return;
    }
  }, []);

  return {
    getNeededChains,
    markChainAsNeeded,
    markChainAsSatisfied,
    cleanupExpiredEntries,
  };
};
