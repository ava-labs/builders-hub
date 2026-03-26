"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { usePostHog } from "posthog-js/react";
import { Wallet } from "lucide-react";

interface WalletGuardProps {
  children: ReactNode;
  /** Optional context label for analytics (e.g. "deploy-erc20", "mint-native") */
  context?: string;
}

/**
 * WalletGuard — A/B tested wrapper for console action buttons.
 *
 * Uses the `wallet-guard-experiment` multivariate feature flag:
 * - "control" variant → renders children as-is (current behavior)
 * - "test" variant + no wallet → replaces children with "Connect Wallet" prompt
 * - Flag not loaded / undefined → renders children as-is (safe default)
 */
export function WalletGuard({ children, context }: WalletGuardProps) {
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { openConnectModal } = useConnectModal();
  const posthog = usePostHog();
  const hasTracked = useRef(false);
  const [variant, setVariant] = useState<string | undefined>(undefined);

  // Get the multivariate flag variant (returns "control" | "test" | undefined)
  useEffect(() => {
    if (!posthog) return;

    const checkVariant = () => {
      const v = posthog.getFeatureFlag("wallet-guard-experiment");
      if (typeof v === "string") setVariant(v);
    };

    checkVariant();
    const unsub = posthog.onFeatureFlags(() => checkVariant());
    return () => { if (typeof unsub === "function") unsub(); };
  }, [posthog]);

  const isConnected = !!walletEVMAddress;
  const shouldGuard = variant === "test" && !isConnected;

  // Track when the guard activates (once per mount)
  useEffect(() => {
    if (shouldGuard && !hasTracked.current) {
      hasTracked.current = true;
      posthog?.capture("wallet_guard_shown", { context: context ?? "unknown" });
    }
  }, [shouldGuard, posthog, context]);

  // Flag OFF or wallet connected → render children normally
  if (!shouldGuard) return <>{children}</>;

  // Flag ON + wallet disconnected → show inline connect prompt
  return (
    <button
      onClick={() => openConnectModal?.()}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
        bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100
        dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50
        transition-colors cursor-pointer"
    >
      <Wallet className="h-4 w-4" />
      Connect Wallet to Continue
    </button>
  );
}
