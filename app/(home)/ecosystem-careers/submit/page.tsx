import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import {
  getViewerAccess,
  missingSocialsFor,
} from '@/lib/ecosystem-careers/viewerAccess';
import { UnlockPrompt } from '@/components/ecosystem-careers/UnlockPrompt';
import { SubmitListingForm } from '@/components/ecosystem-careers/SubmitListingForm';
import { Clock } from 'lucide-react';
import '@/components/profile/shell/styles.css';

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
      <div className="profile">
        <main className="pr-page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 96px' }}>
          <header className="pr-page-head">
            <div>
              <h1 className="pr-ttl">Post a role</h1>
            </div>
          </header>
          <UnlockPrompt
            authenticated
            missingSocials={missingSocialsFor(access)}
            returnTo="/ecosystem-careers/submit"
            variant="panel"
          />
        </main>
      </div>
    );
  }

  // Fetch the user's confirmed projects with their careers approval state.
  const memberRows = await prisma.member.findMany({
    where: { user_id: userId, status: 'Confirmed' },
    select: {
      project: {
        select: {
          id: true,
          project_name: true,
          logo_url: true,
          careers_approved: true,
        },
      },
    },
  });
  type MemberProject = NonNullable<(typeof memberRows)[number]['project']>;
  const projects = memberRows
    .map((m) => m.project)
    .filter((p): p is MemberProject => p !== null)
    .map((p) => ({
      id: p.id,
      project_name: p.project_name,
      logo_url: p.logo_url,
      careers_approved: p.careers_approved,
    }));

  if (projects.length === 0) {
    return (
      <div className="profile">
        <main className="pr-page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 96px' }}>
          <header className="pr-page-head">
            <div>
              <h1 className="pr-ttl">Post a role</h1>
              <p className="pr-sub">
                You&apos;re not a confirmed member of any project yet. Spin one up to start posting.
              </p>
            </div>
          </header>
          <Link href="/projects/new" className="pr-btn pr-btn--primary" style={{ width: 'fit-content' }}>
            Create a project →
          </Link>
        </main>
      </div>
    );
  }

  const params = await searchParams;
  const preselect = params.project && projects.some((p) => p.id === params.project)
    ? params.project
    : projects[0].id;
  const preselected = projects.find((p) => p.id === preselect);

  return (
    <div className="profile">
      <main className="pr-page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 96px' }}>
        <header className="pr-page-head">
          <div>
            <h1 className="pr-ttl">Post a role</h1>
            <p className="pr-sub">
              New teams go through a quick review before their listings go live. Once your project is approved, every future listing auto-publishes. The Apply CTA links directly to the URL you provide — Builders Hub never hosts applications.
            </p>
          </div>
        </header>

        {preselected && !preselected.careers_approved && (
          <div
            className="pr-card"
            style={{
              padding: '14px 18px',
              marginBottom: 20,
              borderColor: 'rgba(253, 200, 93, 0.45)',
              background: 'rgba(253, 200, 93, 0.10)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <Clock size={18} style={{ color: 'var(--pr-warning-text)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--pr-warning-text)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Your project is in review</div>
              <div>
                &ldquo;{preselected.project_name}&rdquo; hasn&apos;t been approved for Ecosystem Careers yet. You can still queue a listing — it&apos;ll publish automatically the moment a reviewer signs off on your team.
              </div>
            </div>
          </div>
        )}

        <SubmitListingForm
          projects={projects}
          initialValues={{ project_id: preselect }}
        />
      </main>
    </div>
  );
}
