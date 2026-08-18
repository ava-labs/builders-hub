import type { Metadata } from 'next';
import SolutionsIndex from '@/components/landing-v2/SolutionsIndex';

export const metadata: Metadata = {
  title: 'Solutions | Avalanche Builder Hub',
  description:
    'Control, reach, and performance: the three guarantees enterprise chains on Avalanche are built on.',
};

export default function SolutionsPage() {
  return <SolutionsIndex />;
}
