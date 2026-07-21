import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PILLARS } from '@/components/landing-v2/pillars';
import PillarPage from '@/components/landing-v2/PillarPage';

export function generateStaticParams() {
  return PILLARS.map((pillar) => ({ slug: pillar.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pillar = PILLARS.find((p) => p.slug === slug);
  if (!pillar) {
    return { title: 'Solutions | Avalanche Builder Hub' };
  }
  return {
    title: `${pillar.title} | Avalanche Builder Hub`,
    description: pillar.metaDescription,
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pillar = PILLARS.find((p) => p.slug === slug);
  if (!pillar) notFound();
  return <PillarPage pillar={pillar} />;
}
