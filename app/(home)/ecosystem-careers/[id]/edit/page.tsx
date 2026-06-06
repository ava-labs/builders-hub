import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { getListingForEdit } from '@/server/services/ecosystemCareers/queries';
import { SubmitListingForm } from '@/components/ecosystem-careers/SubmitListingForm';
import '@/components/profile/shell/styles.css';

export const metadata: Metadata = createMetadata({
  title: 'Edit listing · Ecosystem Careers',
});

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: Params) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/ecosystem-careers/${id}/edit`);
  }

  const listing = await getListingForEdit(id, session.user.id);
  if (!listing || !listing.projectId) notFound();

  const project = await prisma.project.findUnique({
    where: { id: listing.projectId },
    select: { id: true, project_name: true, logo_url: true },
  });
  if (!project) notFound();

  return (
    <div className="profile">
      <main className="pr-page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 96px' }}>
        <header className="pr-page-head">
          <div>
            <h1 className="pr-ttl">Edit listing</h1>
            <p className="pr-sub">
              Updating &ldquo;{listing.title}&rdquo; for {project.project_name}.
            </p>
          </div>
        </header>
        <SubmitListingForm
          projects={[project]}
          listingId={listing.id}
          initialValues={{
            project_id: project.id,
            title: listing.title,
            short_description: listing.shortDescription,
            description: listing.description ?? '',
            location: listing.location ?? '',
            remote_type:
              (listing.remoteType as 'remote' | 'onsite' | 'hybrid' | null) ?? '',
            employment_type:
              (listing.employmentType as 'full_time' | 'contract' | 'part_time' | null) ?? '',
            seniority: extractYears(listing.seniority),
            salary: listing.salary ?? '',
            tags: listing.tags.join(', '),
            apply_url: listing.applyUrl,
          }}
        />
      </main>
    </div>
  );
}

function extractYears(stored: string | null): string {
  if (!stored) return '';
  const m = stored.match(/^(\d{1,2})\+\s*years?$/i);
  return m ? m[1] : '';
}
