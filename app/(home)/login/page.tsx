import FormLoginWrapper from '@/components/login/FormLoginWrapper';
import { getAuthCallbackUrl } from '@/lib/auth/callback-url';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
const params = await searchParams;

const callbackUrl = getAuthCallbackUrl(params.callbackUrl);
  return (
    <main className='container py-8 mx-auto min-h-[calc(100vh-92px)] lg:min-h-0 flex items-center justify-center  relative px-2 pb-6 lg:px-14 '>
      <div className='border  shadow-sm  rounded-md'>
        <FormLoginWrapper callbackUrl={callbackUrl}/>
      </div>
    </main>
  );
}
