import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import {
  listActiveJobs,
  listCompaniesWithActiveJobs,
  toSerializableJob,
} from '@/server/services/ecosystemCareers/queries';
import EcosystemCareersClient from './page.client';

export const metadata: Metadata = createMetadata({
  title: 'Ecosystem Careers',
  description:
    'Open roles from teams building on Avalanche. Discover engineering, design, growth, and operations jobs across the ecosystem.',
  openGraph: { url: '/ecosystem-careers' },
});

export const revalidate = 600;

export default async function EcosystemCareersPage() {
  const [list, companies] = await Promise.all([
    listActiveJobs({ limit: 120 }),
    listCompaniesWithActiveJobs(),
  ]);

  return (
    <EcosystemCareersClient
      initialJobs={list.jobs.map(toSerializableJob)}
      totalActive={list.total}
      companies={companies}
    />
  );
}
