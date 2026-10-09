'use client';

import { useEffect, useMemo, useState } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiContext } from 'wagmi';
import { reconnect } from 'wagmi/actions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { wagmiConfig } from './wagmi-config';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const AVALANCHE_RED = '#E84142' as const;

// Theme-aware piece lives below the wagmi context so theme transitions don't rerender the provider.
function ThemedRainbowKit({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gate the theme on `mounted` so SSR and first client render emit the
  // same <style data-rk> block. Dark-mode users see a brief light flash —
  // the standard next-themes / RainbowKit tradeoff.
  const rainbowTheme = useMemo(
    () =>
      mounted && resolvedTheme === 'dark'
        ? darkTheme({ accentColor: AVALANCHE_RED, borderRadius: 'medium' })
        : lightTheme({ accentColor: AVALANCHE_RED, borderRadius: 'medium' }),
    [mounted, resolvedTheme],
  );

  return (
    <RainbowKitProvider theme={rainbowTheme} modalSize="compact">
      {children}
    </RainbowKitProvider>
  );
}

let reconnected = false;

/**
 * wagmi's WagmiProvider reconnects on every one of its renders (with `ssr: false` its Hydrate calls onMount during
 * render), so any rerender after mount updated subscribers such as RainbowKit's ConnectModal mid-render. This
 * provides the same context and reconnects once, on the first client render, before anything has subscribed.
 */
export function Web3Provider({ children }: { children: React.ReactNode }) {
  if (!reconnected && typeof window !== 'undefined') {
    reconnected = true;
    void reconnect(wagmiConfig);
  }
  return (
    <WagmiContext.Provider value={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemedRainbowKit>{children}</ThemedRainbowKit>
      </QueryClientProvider>
    </WagmiContext.Provider>
  );
}
