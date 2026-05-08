import React from "react";
import { redirect } from "next/navigation";
import { getHackathon } from "@/server/services/hackathons";
import { getRegisterForm } from "@/server/services/registerForms";
import { getAuthSession } from "@/lib/auth/authSession";
import LegacyEventLayout from "@/components/hackathons/event-layouts/LegacyEventLayout";
import ModernEventLayout from "@/components/hackathons/event-layouts/ModernEventLayout";
import { createMetadata } from "@/utils/metadata";
import type { Metadata } from "next";
import { normalizeEventsLang, t } from "@/lib/events/i18n";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const hackathon = await getHackathon(id);
    
    if (!hackathon) {
      const lang = normalizeEventsLang(undefined);
      return createMetadata({
        title: t(lang, "meta.notFound.title"),
        description: t(lang, "meta.notFound.description"),
      });
    }
    const lang = normalizeEventsLang(hackathon.content?.language);

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
  } catch (error) {
    const lang = normalizeEventsLang(undefined);
    return createMetadata({
      title: t(lang, "meta.events.title"),
      description: t(lang, "meta.events.description"),
    });
  }
}

export default async function HackathonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const utm = resolvedSearchParams?.utm ?? "";
  
  const hackathon = await getHackathon(id);

  // Check if user is authenticated and registered
  const session = await getAuthSession();
  const isAuthenticated = !!session?.user;
  let isRegistered = false;

  if (session?.user?.email) {
    const registration = await getRegisterForm(session.user.email, id);
    isRegistered = !!registration;
  }

  if (!hackathon) redirect("/events");

  // Layout depends only on new_layout; when null/undefined, use legacy
  const useModernLayout = hackathon.new_layout === true;

  if (useModernLayout) {
    return (
      <ModernEventLayout
        hackathon={hackathon}
        id={id}
        isRegistered={isRegistered}
        isAuthenticated={isAuthenticated}
        utm={utm as string}
      />
    );
  }

  return (
    <LegacyEventLayout
      hackathon={hackathon}
      id={id}
      isRegistered={isRegistered}
      isAuthenticated={isAuthenticated}
      utm={utm as string}
    />
  );
}
