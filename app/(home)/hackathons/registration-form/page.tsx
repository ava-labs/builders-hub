import RegistrationFormWrapped from "@/components/hackathons/registration-form/RegistrationFormWrapped";
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";
import HackathonPageviewTag from "@/components/hackathons/HackathonPageviewTag";

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

  const resolvedSearchParams = await searchParams;
  const hackathonId =
    firstString(resolvedSearchParams?.event) ??
    firstString(resolvedSearchParams?.hackathon);

  return (
    <UTMPreservationWrapper>
      {hackathonId && <HackathonPageviewTag hackathonId={hackathonId} />}
      <main className="container relative max-w-[1400px] rounded-md border border-zinc-800 p-14 mt-8">
        <RegistrationFormWrapped searchParams={resolvedSearchParams} />
      </main>
    </UTMPreservationWrapper>
  );
}