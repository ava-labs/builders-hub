import { createConfig, http } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { CONSOLE_WALLET_CONNECTOR_ID, getConsoleCoreProvider } from '@/lib/console-wallets/core-provider';

export const wagmiConfig = createConfig({
  chains: [avalanche, avalancheFuji],
  connectors: [
    injected(),
    // A Console wallet chosen in the top bar: a key kept in this browser that signs without prompts.
    injected({
      target: () => ({
        id: CONSOLE_WALLET_CONNECTOR_ID,
        name: 'Console wallet',
        provider: getConsoleCoreProvider() as never,
      }),
    }),
  ],
  transports: {
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
  },
  ssr: false,
});
