import React from "react";
import { redirect, notFound } from "next/navigation";
import { getHackathon } from "@/server/services/hackathons";
import { getRegisterForm } from "@/server/services/registerForms";
import { getAuthSession } from "@/lib/auth/authSession";
import LegacyEventLayout from "@/components/hackathons/event-layouts/LegacyEventLayout";
import ModernEventLayout from "@/components/hackathons/event-layouts/ModernEventLayout";
import { HostNavButtons } from "@/components/evaluate/HostNavButtons";
import { createMetadata } from "@/utils/metadata";
import type { Metadata } from "next";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { prisma } from "@/prisma/prisma";
import {
  calcSubmissionProgress,
  getSubmissionStatus,
  type SubmissionStatus,
} from "@/lib/hackathons/submission-progress";

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
    // Don't leak private/invite-only event details (title, description, OG
    // image) in metadata served to crawlers and link unfurlers.
    if (hackathon.is_public !== true) {
      const lang = normalizeEventsLang(hackathon.content?.language);
      return createMetadata({
        title: t(lang, "meta.events.title"),
        description: t(lang, "meta.events.description"),
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const hackathon = await getHackathon(id);

  // Check if user is authenticated and registered
  const session = await getAuthSession();

  // SECURITY: private/invite-only events (is_public !== true) must never render
  // for anonymous visitors. Authenticated users keep access so invite-only
  // registration still works (parity with the /api/events/[id] projection).
  if (hackathon && hackathon.is_public !== true && !session?.user?.id) {
    notFound();
  }

  const isAuthenticated = !!session?.user;
  let isRegistered = false;
  let submissionStatus: SubmissionStatus = "none";
  let submissionProgress = 0;
  let submissionProjectId: string | null = null;

  if (session?.user?.email) {
    const [registration, userProject] = await Promise.all([
      getRegisterForm(session.user.email, id),
      session.user.id
        ? prisma.project.findFirst({
            where: {
              hackaton_id: id,
              members: {
                some: { user_id: session.user.id, status: "Confirmed" },
              },
            },
            select: {
              id: true,
              project_name: true,
              short_description: true,
              full_description: true,
              tech_stack: true,
              tech_stack_tags: true,
              github_repository: true,
              demo_link: true,
              tracks: true,
            },
          })
        : Promise.resolve(null),
    ]);
    isRegistered = !!registration;
    if (userProject) {
      submissionProjectId = userProject.id;
      submissionProgress = calcSubmissionProgress(userProject);
      submissionStatus = getSubmissionStatus(userProject);
    }
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
        submissionStatus={submissionStatus}
        submissionProgress={submissionProgress}
        submissionProjectId={submissionProjectId}
        hostNavButtons={<HostNavButtons hackathonId={id} />}
      />
    );
  }

  return (
    <LegacyEventLayout
      hackathon={hackathon}
      id={id}
      isRegistered={isRegistered}
      isAuthenticated={isAuthenticated}
      submissionStatus={submissionStatus}
      submissionProgress={submissionProgress}
      submissionProjectId={submissionProjectId}
    />
  );
}
