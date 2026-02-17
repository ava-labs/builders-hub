import React from "react";
import { redirect } from "next/navigation";
import {
  getFilteredHackathons,
  getHackathon,
} from "@/server/services/hackathons";
import { getRegisterForm } from "@/server/services/registerForms";
import { getAuthSession } from "@/lib/auth/authSession";
import HackathonEventLayout from "@/components/hackathons/event-layouts/HackathonEventLayout";
import WorkshopBootcampEventLayout from "@/components/hackathons/event-layouts/WorkshopBootcampEventLayout";
import { createMetadata } from "@/utils/metadata";
import type { Metadata } from "next";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { hackathons } = await getFilteredHackathons({});
  return hackathons.map((hackathon) => ({
    id: hackathon.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const hackathon = await getHackathon(id);
    
    if (!hackathon) {
      return createMetadata({
        title: 'Event Not Found',
        description: 'The requested event could not be found',
      });
    }

    const eventType = hackathon.event || 'hackathon';
    const eventTypeLabel = eventType === 'hackathon' ? 'Hackathon' : eventType === 'workshop' ? 'Workshop' : eventType === 'bootcamp' ? 'Bootcamp' : 'Event';

    return createMetadata({
      title: hackathon.title,
      description: hackathon.description,
      openGraph: {
        images: `/api/og/hackathons/${id}`,
      },
      twitter: {
        images: `/api/og/hackathons/${id}`,
      },
    });
  } catch (error) {
    return createMetadata({
      title: 'Events',
      description: 'Join exciting blockchain events, hackathons, workshops and bootcamps on Avalanche',
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
  let isRegistered = false;
  
  if (session?.user?.email) {
    const registration = await getRegisterForm(session.user.email, id);
    isRegistered = !!registration;
  }

  if (!hackathon) redirect("/hackathons");

  // Determine event type - default to "hackathon" for backwards compatibility
  const eventType = hackathon.event || "hackathon";
  const isHackathon = eventType === "hackathon";
  const isWorkshopOrBootcamp =
    eventType === "workshop" || eventType === "bootcamp";

  // Render appropriate layout based on event type
  if (isWorkshopOrBootcamp) {
    return (
      <WorkshopBootcampEventLayout
        hackathon={hackathon}
        id={id}
        isRegistered={isRegistered}
        utm={utm as string}
      />
    );
  }

  // Default to hackathon layout (for hackathon type or any other/unknown types)
  return (
    <HackathonEventLayout
      hackathon={hackathon}
      id={id}
      isRegistered={isRegistered}
      utm={utm as string}
    />
  );
}
