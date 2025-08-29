import RegistrationFormWrapped from "@/components/hackathons/registration-form/RegistrationFormWrapped";
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

  const resolvedSearchParams = await searchParams;

  return (
    <UTMPreservationWrapper>
      <main className="container relative max-w-[1400px] rounded-md border border-zinc-800 p-14 mt-8">
        <RegistrationFormWrapped searchParams={resolvedSearchParams} />
      </main>
    </UTMPreservationWrapper>
  );
}