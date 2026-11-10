import type { Metadata } from 'next';
import { AcademyLanding } from '@/components/academy/landing/academy-landing';
import { parseAcademyView } from '@/components/academy/landing/academy-views';
import { LANDING_LINE } from '@/components/academy/landing/landing-hero';
import { COURSE_STATS } from '@/lib/academy/course-stats.generated';
import { createMetadata } from '@/utils/metadata';

const OG_IMAGE = { url: '/api/og/academy?v=2', width: 1200, height: 630, alt: 'Avalanche Academy' };

export const metadata: Metadata = createMetadata({
  title: 'Avalanche Academy',
  description: LANDING_LINE,
  openGraph: { url: '/academy', images: OG_IMAGE },
  twitter: { images: OG_IMAGE },
});

interface AcademyPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The single Academy landing. The view comes from ?view=, so the server renders the one the URL names; reading
 * searchParams renders the page per request (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md).
 */
export default async function AcademyPage({ searchParams }: AcademyPageProps) {
  const { view } = await searchParams;
  // The 13 courses live under two url segments, so their stats come from both tracks' maps.
  const courseStats = { ...COURSE_STATS['avalanche-l1'], ...COURSE_STATS['blockchain'] };
  return <AcademyLanding view={parseAcademyView(view)} courseStats={courseStats} />;
}
