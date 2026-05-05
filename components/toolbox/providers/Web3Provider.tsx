'use client';

import { useEffect, useState } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { wagmiConfig } from './wagmi-config';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const AVALANCHE_RED = '#E84142' as const;

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gate the theme on `mounted` so both SSR and the very first client
  // render emit the same RainbowKit theme. Otherwise the <style data-rk>
  // block — whose CSS custom properties differ between light/dark — comes
  // out mismatched on hydration. After mount we switch to the user's
  // actual theme from next-themes; dark-mode users see a brief light
  // flash, which is the standard next-themes / RainbowKit tradeoff.
  const rainbowTheme =
    mounted && resolvedTheme === 'dark'
      ? darkTheme({ accentColor: AVALANCHE_RED, borderRadius: 'medium' })
      : lightTheme({ accentColor: AVALANCHE_RED, borderRadius: 'medium' });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
