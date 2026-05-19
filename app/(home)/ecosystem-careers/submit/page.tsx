import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import {
  getViewerAccess,
  missingSocialsFor,
} from '@/lib/ecosystemCareers/viewerAccess';
import { UnlockPrompt } from '@/components/ecosystem-careers/UnlockPrompt';
import { SubmitListingForm } from '@/components/ecosystem-careers/SubmitListingForm';

export const metadata: Metadata = createMetadata({
  title: 'Post a role · Ecosystem Careers',
  description: 'Publish an opening for your Avalanche-ecosystem team.',
});

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function SubmitListingPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/ecosystem-careers/submit');
  }
  const userId = session.user.id;

  const access = await getViewerAccess();
  if (!access.canViewAll) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6">
          Post a role
        </h1>
        <UnlockPrompt
          authenticated
          missingSocials={missingSocialsFor(access)}
          returnTo="/ecosystem-careers/submit"
          variant="panel"
        />
      </main>
    );
  }

  const projects = (
    await prisma.member.findMany({
      where: { user_id: userId, status: 'Confirmed' },
      select: {
        project: { select: { id: true, project_name: true, logo_url: true } },
      },
    })
  )
    .map((m) => m.project)
    .filter(
      (p): p is { id: string; project_name: string; logo_url: string | null } => p !== null,
    );

  if (projects.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3">
          Post a role
        </h1>
        <p className="text-zinc-600 dark:text-zinc-300 mb-6">
          You&apos;re not a confirmed member of any project yet. Spin one up to start posting.
        </p>
        <Link
          href="/projects/new"
          className="inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20"
        >
          Create a project →
        </Link>
      </main>
    );
  }

  const params = await searchParams;
  const preselect = params.project && projects.some((p) => p.id === params.project)
    ? params.project
    : projects[0].id;

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Post a role
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Listings auto-publish on the Ecosystem Careers board. The Apply CTA on your listing will link directly to the URL you provide — Builders Hub never hosts applications.
        </p>
      </header>
      <SubmitListingForm
        projects={projects}
        initialValues={{ project_id: preselect }}
      />
    </main>
  );
}
