'use client';

import { useEffect, useMemo, useState } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { wagmiConfig } from './wagmi-config';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const AVALANCHE_RED = '#E84142' as const;

// Theme-aware piece lives *below* WagmiProvider so theme transitions
// don't rerender WagmiProvider. A WagmiProvider rerender re-fires its
// internal Hydrate → reconnect() during render, which makes subscribed
// components (RainbowKit's ConnectModal via useAccount) call setState
// inside another component's render — the React 19 warning we hit.
// See: https://github.com/wevm/wagmi/issues/3794
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

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemedRainbowKit>{children}</ThemedRainbowKit>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
