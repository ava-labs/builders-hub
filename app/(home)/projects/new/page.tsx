import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { NewProjectForm } from './page.client';
import '@/components/profile/shell/styles.css';

export const metadata: Metadata = createMetadata({
  title: 'Create a project',
  description: 'Register your Avalanche-ecosystem project on Builders Hub.',
});

export default async function NewProjectPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/projects/new');
  }
  return (
    <div className="profile">
      <main className="pr-page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 96px' }}>
        <header className="pr-page-head">
          <div>
            <h1 className="pr-ttl">Create a project</h1>
            <p className="pr-sub">
              A lightweight registration so your team can show up on Builders Hub — primarily to post Ecosystem Careers listings. You can fill in the deeper details later.
            </p>
          </div>
        </header>
        <NewProjectForm
          userId={session.user.id}
          currentUserName={session.user.name ?? null}
          currentUserImage={session.user.image ?? null}
        />
      </main>
    </div>
  );
}
