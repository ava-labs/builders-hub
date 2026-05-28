import RegistrationFormWrapped from "@/components/hackathons/registration-form/RegistrationFormWrapped";
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";
import { getHackathon } from "@/server/services/hackathons";
import { createMetadata } from "@/utils/metadata";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import type { Metadata } from "next";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const rawId = resolvedSearchParams?.event ?? resolvedSearchParams?.hackathon;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) {
    const lang = normalizeEventsLang(undefined);
    return createMetadata({
      title: t(lang, "meta.events.title"),
      description: t(lang, "meta.events.description"),
    });
  }

  try {
    const hackathon = await getHackathon(id);

    if (!hackathon) {
      const lang = normalizeEventsLang(undefined);
      return createMetadata({
        title: t(lang, "meta.notFound.title"),
        description: t(lang, "meta.notFound.description"),
      });
    }

    return createMetadata({
      title: hackathon.title,
      description: hackathon.description,
      openGraph: {
        images: `/api/og/events/${id}`,
      },
      twitter: {
        images: `/api/og/events/${id}`,
      },
    });
  } catch {
    const lang = normalizeEventsLang(undefined);
    return createMetadata({
      title: t(lang, "meta.events.title"),
      description: t(lang, "meta.events.description"),
    });
  }
}

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
