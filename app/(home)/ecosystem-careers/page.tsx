import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { prisma } from '@/prisma/prisma';
import {
  listActiveJobs,
  listCompaniesWithActiveJobs,
  toSerializableJob,
} from '@/server/services/ecosystemCareers/queries';
import {
  PUBLIC_JOB_PREVIEW_COUNT,
  getViewerAccess,
  missingSocialsFor,
} from '@/lib/ecosystem-careers/viewerAccess';
import { getAuthSession } from '@/lib/auth/authSession';
import EcosystemCareersClient from './page.client';

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem Careers',
  description:
    'Open roles from teams building on Avalanche. Discover engineering, design, growth, and operations jobs across the ecosystem.',
  openGraph: { url: '/ecosystem-careers' },
});

// Reads from Postgres + the viewer's session, so don't pre-render at
// build time (the build DB is cold and the page is auth-conditional).
export const dynamic = 'force-dynamic';

async function getDevRelContext() {
  // Skip the extra DB hits when the viewer isn't devrel — most page loads.
  const session = await getAuthSession();
  const isDevRel = !!session?.user?.custom_attributes?.includes('devrel');
  if (!isDevRel) {
    return { isDevRel: false, pendingProjects: 0, pendingListings: 0 };
  }
  const [pendingProjects, pendingListings] = await Promise.all([
    prisma.project.count({
      where: {
        careers_approved: false,
        jobListings: { some: { source: 'community', is_active: false } },
      },
    }),
    prisma.jobListing.count({
      where: {
        source: { in: ['external', 'getro'] },
        is_active: false,
      },
    }),
  ]);
  return { isDevRel: true, pendingProjects, pendingListings };
}

export default async function EcosystemCareersPage() {
  const [list, companies, access, devrel] = await Promise.all([
    listActiveJobs({ limit: 120 }),
    listCompaniesWithActiveJobs(),
    getViewerAccess(),
    getDevRelContext(),
  ]);

  return (
    <EcosystemCareersClient
      initialJobs={list.jobs.map(toSerializableJob)}
      totalActive={list.total}
      companies={companies}
      viewerCanViewAll={access.canViewAll}
      viewerAuthenticated={access.authenticated}
      viewerMissingSocials={missingSocialsFor(access)}
      previewCount={PUBLIC_JOB_PREVIEW_COUNT}
      viewerIsDevRel={devrel.isDevRel}
      pendingProjects={devrel.pendingProjects}
      pendingListings={devrel.pendingListings}
    />
  );
}
