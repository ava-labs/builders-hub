import FormLoginWrapper from '@/components/login/FormLoginWrapper';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
// Await the searchParams to resolve the query parameters
const params = await searchParams;

// Extract callbackUrl with type safety, defaulting to '/' if invalid or missing
const callbackUrl = typeof params.callbackUrl === 'string' ? params.callbackUrl : '/';
  return (
    <main className='min-h-[calc(100vh-92px)] lg:min-h-0 flex items-center justify-center  container relative px-2 pb-6 lg:px-14 '>
      <div className='border  shadow-sm  rounded-md'>
        <FormLoginWrapper callbackUrl={callbackUrl}/>
      </div>
    </main>
  );
}
