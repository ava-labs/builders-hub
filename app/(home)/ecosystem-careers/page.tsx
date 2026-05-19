import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import {
  listActiveJobs,
  listCompaniesWithActiveJobs,
  toSerializableJob,
} from '@/server/services/ecosystemCareers/queries';
import {
  PUBLIC_JOB_PREVIEW_COUNT,
  getViewerAccess,
  missingSocialsFor,
} from '@/lib/ecosystemCareers/viewerAccess';
import EcosystemCareersClient from './page.client';

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem Careers',
  description:
    'Open roles from teams building on Avalanche. Discover engineering, design, growth, and operations jobs across the ecosystem.',
  openGraph: { url: '/ecosystem-careers' },
});

export const revalidate = 600;

export default async function EcosystemCareersPage() {
  const [list, companies, access] = await Promise.all([
    listActiveJobs({ limit: 120 }),
    listCompaniesWithActiveJobs(),
    getViewerAccess(),
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
    />
  );
}
