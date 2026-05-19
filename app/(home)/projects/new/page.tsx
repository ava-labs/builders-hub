import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { getAuthSession } from '@/lib/auth/authSession';
import { NewProjectForm } from './page.client';

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
    <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Create a project
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          A lightweight registration so your team can show up on Builders Hub — primarily to post Ecosystem Careers listings. You can fill in the deeper details later.
        </p>
      </header>
      <NewProjectForm userId={session.user.id} />
    </main>
  );
}
