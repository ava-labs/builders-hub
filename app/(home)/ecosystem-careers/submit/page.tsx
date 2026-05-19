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
import { Clock } from 'lucide-react';

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

  // Fetch the user's confirmed projects together with the linked
  // EcosystemCompany so we can show review status next to each one.
  type ProjectRow = {
    id: string;
    project_name: string;
    logo_url: string | null;
    ecosystem_company: {
      authorization_status: string;
      rejection_reason: string | null;
    } | null;
  };
  const memberRows = await prisma.member.findMany({
    where: { user_id: userId, status: 'Confirmed' },
    select: {
      project: {
        select: {
          id: true,
          project_name: true,
          logo_url: true,
          ecosystem_company: {
            select: { authorization_status: true, rejection_reason: true },
          },
        },
      },
    },
  });
  const allProjects = memberRows
    .map((m) => m.project as ProjectRow | null)
    .filter((p): p is ProjectRow => p !== null)
    .map((p) => ({
      id: p.id,
      project_name: p.project_name,
      logo_url: p.logo_url,
      authorization_status: (p.ecosystem_company?.authorization_status ?? null) as
        | 'pending'
        | 'approved'
        | 'rejected'
        | null,
      rejection_reason: p.ecosystem_company?.rejection_reason ?? null,
    }));
  // Hide rejected projects from the dropdown — the user can't post under
  // them again until a devrel reverses the decision.
  const projects = allProjects.filter((p) => p.authorization_status !== 'rejected');

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
  const preselected = projects.find((p) => p.id === preselect);
  const rejectedProjects = allProjects.filter((p) => p.authorization_status === 'rejected');

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Post a role
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          New teams go through a quick review before their listings go live. Once your project is approved, every future listing auto-publishes. The Apply CTA links directly to the URL you provide — Builders Hub never hosts applications.
        </p>
      </header>

      {preselected?.authorization_status !== 'approved' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold">Your project is in review</p>
            <p>
              {preselected
                ? `“${preselected.project_name}”`
                : 'This project'}{' '}
              hasn&apos;t been approved for Ecosystem Careers yet. You can still queue a listing — it&apos;ll publish automatically the moment a reviewer signs off on your team.
            </p>
          </div>
        </div>
      )}

      {rejectedProjects.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 text-sm text-zinc-600 dark:text-zinc-300">
          <p className="font-semibold text-zinc-900 dark:text-white">
            {rejectedProjects.length} of your projects can&apos;t post listings
          </p>
          <p>
            {rejectedProjects.map((p) => p.project_name).join(', ')} —{' '}
            {rejectedProjects[0].rejection_reason ?? 'review was declined.'} Reach out to the DevRel team if you think that&apos;s a mistake.
          </p>
        </div>
      )}

      <SubmitListingForm
        projects={projects}
        initialValues={{ project_id: preselect }}
      />
    </main>
  );
}
