import type { Metadata } from 'next';
import ExternalChainIcmPattern from '@/components/landing-v2/ExternalChainIcmPattern';

export const metadata: Metadata = {
  title: 'Connecting an External EVM Chain to Avalanche with ICM Attestors | Avalanche Builder Hub',
  description:
    'A design pattern for linking a permissioned network, such as Hyperledger Besu, to the Avalanche C-Chain without an intermediary operator in the message path. The Avalanche primitives run in production; the extension to a non-Avalanche chain is designed and not yet implemented.',
};

export default function ExternalEvmIcmPatternPage() {
  return <ExternalChainIcmPattern />;
}
