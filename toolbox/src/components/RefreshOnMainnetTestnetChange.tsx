"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useWalletStore } from "../lib/walletStore"

export function RefreshOnMainnetTestnetChange({ children }: { children: React.ReactNode }) {
  const isTestnet = useWalletStore(state => state.isTestnet);
  const [initialTestnetState, setInitialTestnetState] = useState<boolean | null>(null);
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    // Set initial testnet state on first render
    if (initialTestnetState === null && isTestnet !== undefined) {
      setInitialTestnetState(isTestnet);
    }

    // Check if testnet status changed after initial value was set
    if (initialTestnetState !== null && isTestnet !== initialTestnetState) {
      setHasChanged(true);
    }
  }, [isTestnet, initialTestnetState]);

  const refreshPage = () => {
    window.location.reload();
  };

  if (!hasChanged) {
    return <>{children}</>;
  }

  if (isTestnet === undefined) {
    // If the state is still undefined, don't render anything or the alert.
    // This might happen on initial load before the wallet state is determined.
    return <></>;
  }

  return (
    <div className="space-y-4">
      {/* Top alert banner */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Network has changed since page load
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                This may cause unexpected behavior. Please refresh the page.
              </p>
            </div>
          </div>
          <button
            onClick={refreshPage}
            className="bg-black hover:bg-zinc-800 text-white text-sm font-medium py-1.5 px-3 rounded-md"
          >
            Refresh Page
          </button>
        </div>
      </div>

      {/* Semi-transparent and unclickable content */}
      <div className="pointer-events-none opacity-50">
        {children}
      </div>
    </div>
  );
} 