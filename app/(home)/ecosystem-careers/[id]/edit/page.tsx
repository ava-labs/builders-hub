import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { getListingForEdit } from '@/server/services/ecosystemCareers/queries';
import { SubmitListingForm } from '@/components/ecosystem-careers/SubmitListingForm';

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
    <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Edit listing
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Updating &ldquo;{listing.title}&rdquo; for {project.project_name}.
        </p>
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
          // The submit form takes a raw number-of-years; if the stored value
          // is "3+ years" (community submissions store it that way), pull the
          // number back out for the input. Legacy/external rows that hold a
          // category label like "senior" simply pre-fill blank.
          seniority: extractYears(listing.seniority),
          tags: listing.tags.join(', '),
          apply_url: listing.applyUrl,
        }}
      />
    </main>
  );
}

function extractYears(stored: string | null): string {
  if (!stored) return '';
  const m = stored.match(/^(\d{1,2})\+\s*years?$/i);
  return m ? m[1] : '';
}
