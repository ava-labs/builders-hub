import { useState, useEffect, useMemo } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, type Chain } from "viem";

const STORAGE_KEY = "game-wallet-key";

export function useGameWallet(chain?: Chain) {
  const [privateKey, setPrivateKey] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPrivateKey(stored as `0x${string}`);
    } else {
      const key = generatePrivateKey();
      sessionStorage.setItem(STORAGE_KEY, key);
      setPrivateKey(key);
    }
  }, []);

  const account = useMemo(
    () => (privateKey ? privateKeyToAccount(privateKey) : null),
    [privateKey],
  );

  const walletClient = useMemo(() => {
    if (!account || !chain) return null;
    return createWalletClient({
      account,
      chain,
      transport: http(),
    });
  }, [account, chain]);

  return {
    address: account?.address ?? null,
    walletClient,
    privateKey,
    isReady: Boolean(account),
  };
}
