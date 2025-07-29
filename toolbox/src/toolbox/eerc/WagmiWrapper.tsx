'use client';

import React from "react";
import { WagmiProvider, createConfig, http } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

const config = createConfig({
  chains: [avalancheFuji],
  transports: {
    [avalancheFuji.id]: http(),
  },
});

export default function WagmiWrapper({ children }: { children: React.ReactNode }) {
  // Use React.createElement to avoid JSX type error
  return React.createElement(WagmiProvider as any, { config }, children) as any;
} 