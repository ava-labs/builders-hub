import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RWA Dashboard | Avalanche Stats',
  description: 'Real World Asset analytics on Avalanche — capital flows, lender activity, and protocol metrics.',
}

export default function RWALayout({ children }: { children: React.ReactNode }) {
  return children
}
