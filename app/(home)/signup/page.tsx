import type { Metadata } from 'next';
import FormLoginWrapper from '@/components/login/FormLoginWrapper';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create your Avalanche Builder Hub account.',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === 'string' ? params.callbackUrl : '/';

  return (
    <main className="container py-8 mx-auto min-h-[calc(100vh-92px)] lg:min-h-0 flex items-center justify-center relative px-2 pb-6 lg:px-14">
      <div className="border shadow-sm rounded-md">
        <FormLoginWrapper callbackUrl={callbackUrl} mode="signup" />
      </div>
    </main>
  );
}
