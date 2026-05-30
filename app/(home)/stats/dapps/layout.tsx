import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DApp Analytics | Avalanche Stats',
  description: 'Explore Avalanche C-Chain dApp analytics, TVL rankings, and protocol metrics',
};

export default function DAppsStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
