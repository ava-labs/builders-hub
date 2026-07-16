import type { Metadata } from 'next';
import DesignPatternsIndex from '@/components/landing-v2/DesignPatternsIndex';

export const metadata: Metadata = {
  title: 'Design Patterns | Avalanche Builder Hub',
  description:
    'Real-world institutional builds on Avalanche — each composes privacy, interoperability, performance, and compliance into one shippable architecture.',
};

export default function DesignPatternsPage() {
  return <DesignPatternsIndex />;
}
