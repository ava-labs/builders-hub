import type { Metadata } from 'next';
import FormLoginWrapper from '@/components/login/FormLoginWrapper';
import { getAuthCallbackUrl } from '@/lib/auth/callback-url';
import { headers } from 'next/headers';

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
  const requestHeaders = await headers();
  const requestOrigin = `${requestHeaders.get('x-forwarded-proto') ?? 'https'}://${requestHeaders.get('host')}`;
  const trackingParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') trackingParams.set(key, value);
  }
  const callbackUrl = getAuthCallbackUrl(params.callbackUrl ?? '/', trackingParams, requestOrigin);

  return (
    <main className="container py-8 mx-auto min-h-[calc(100vh-92px)] lg:min-h-0 flex items-center justify-center relative px-2 pb-6 lg:px-14">
      <div className="border shadow-sm rounded-md">
        <FormLoginWrapper callbackUrl={callbackUrl} mode="signup" />
      </div>
    </main>
  );
}
