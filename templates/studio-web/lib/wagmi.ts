import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  coreWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, type Chain } from 'viem';
import { http, createConfig } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { studioConfig } from './studio.config';

/*
 * Wallet and chain setup. The chains are the ones your contracts were deployed
 * to (from studio.config.ts). Wallets: Core, MetaMask, Rabby, Coinbase and any
 * injected wallet work out of the box; WalletConnect (mobile wallets) needs a
 * free project id from https://cloud.reown.com in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
 */

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

const deployed: Chain[] = Object.entries(studioConfig.chains)
  .filter(([, chain]) => !!chain.rpcUrl)
  .map(([id, chain]) =>
    defineChain({
      id: Number(id),
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: { default: { http: [chain.rpcUrl as string] } },
      ...(chain.explorerUrl ? { blockExplorers: { default: { name: 'Explorer', url: chain.explorerUrl } } } : {}),
    }),
  );

export const chains = (deployed.length > 0 ? deployed : [avalancheFuji]) as unknown as readonly [Chain, ...Chain[]];

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Wallets',
      wallets: [
        coreWallet,
        metaMaskWallet,
        rabbyWallet,
        coinbaseWallet,
        injectedWallet,
        ...(projectId ? [walletConnectWallet] : []),
      ],
    },
  ],
  { appName: studioConfig.title, projectId: projectId || 'studio-no-walletconnect' },
);

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: Object.fromEntries(chains.map((chain) => [chain.id, http(chain.rpcUrls.default.http[0])])),
  ssr: true,
});
