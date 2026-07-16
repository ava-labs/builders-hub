import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PATTERNS } from '@/components/landing-v2/patterns';
import PatternPage from '@/components/landing-v2/PatternPage';

export function generateStaticParams() {
  return PATTERNS.map((pattern) => ({ slug: pattern.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pattern = PATTERNS.find((p) => p.slug === slug);
  if (!pattern) {
    return { title: 'Design Patterns | Avalanche Builder Hub' };
  }
  return {
    title: `${pattern.title} | Avalanche Builder Hub`,
    description: pattern.metaDescription,
  };
}

export default async function DesignPatternPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pattern = PATTERNS.find((p) => p.slug === slug);
  if (!pattern) notFound();
  return <PatternPage pattern={pattern} />;
}
