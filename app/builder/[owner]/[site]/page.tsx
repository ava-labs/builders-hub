import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishedSite } from '@/components/studio/PublishedSite';
import { publicSite } from '@/server/services/studio/sites';

export const dynamic = 'force-dynamic';

type Params = { owner: string; site: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { owner, site } = await params;
  const published = await publicSite(owner, site);
  if (!published) return { title: 'Not found' };
  return {
    title: `${published.title} · Built on Builder Hub Studio`,
    description: `${published.title}, an app on Avalanche built with Builder Hub Studio.`,
    robots: { index: false },
  };
}

export default async function BuilderSitePage({ params }: { params: Promise<Params> }) {
  const { owner, site } = await params;
  const published = await publicSite(owner, site);
  if (!published) notFound();
  return (
    <PublishedSite
      owner={owner}
      slug={site}
      title={published.title}
      context={{
        files: published.files,
        contracts: published.contracts,
        chains: published.chains,
        designCss: published.designCss,
        studioReact: published.studioReact,
      }}
    />
  );
}
