import { createConfig, http } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [avalanche, avalancheFuji],
  connectors: [injected()],
  transports: {
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
  },
  ssr: false,
});
