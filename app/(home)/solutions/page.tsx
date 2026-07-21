import type { Metadata } from 'next';
import SolutionsIndex from '@/components/landing-v2/SolutionsIndex';

export const metadata: Metadata = {
  title: 'Solutions | Avalanche Builder Hub',
  description:
    'Performance, interoperability, privacy, and compliance: the four guarantees enterprise chains on Avalanche are built on.',
};

export default function SolutionsPage() {
  return <SolutionsIndex />;
}
