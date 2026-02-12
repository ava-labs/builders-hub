import React from "react";
import { redirect } from "next/navigation";
import { getHackathon } from "@/server/services/hackathons";
import { getRegisterForm } from "@/server/services/registerForms";
import { getAuthSession } from "@/lib/auth/authSession";
import Image from "next/image";
import Schedule from "@/components/hackathons/hackathon/sections/Schedule";
import Tracks from "@/components/hackathons/hackathon/sections/Tracks";
import About from "@/components/hackathons/hackathon/sections/About";
import Sponsors from "@/components/hackathons/hackathon/sections/Sponsors";
import Submission from "@/components/hackathons/hackathon/sections/Submission";
import Resources from "@/components/hackathons/hackathon/sections/Resources";
import Community from "@/components/hackathons/hackathon/sections/Community";
import MentorsJudges from "@/components/hackathons/hackathon/sections/MentorsJudges";
import JoinButton from "@/components/hackathons/hackathon/JoinButton";
import { createMetadata } from "@/utils/metadata";
import type { Metadata } from "next";
import "../../build-games/styles.css";
import "./styles.css";

export const revalidate = 60;

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  try {
    const hackathon = await getHackathon(HACKATHON_ID);

    if (!hackathon) {
      return createMetadata({
        title: 'Hackathon Not Found',
        description: 'The requested hackathon could not be found',
      });
    }

    return createMetadata({
      title: hackathon.title,
      description: hackathon.description,
      openGraph: {
        images: `/api/og/hackathons/${HACKATHON_ID}`,
      },
      twitter: {
        images: `/api/og/hackathons/${HACKATHON_ID}`,
      },
    });
  } catch (error) {
    return createMetadata({
      title: 'Hackathons',
      description: 'Join exciting blockchain hackathons and build the future on Avalanche',
    });
  }
}

export default async function HackathonPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const utm = resolvedSearchParams?.utm ?? "";

  const hackathon = await getHackathon(HACKATHON_ID);

  // Check if user is authenticated and registered
  const session = await getAuthSession();
  let isRegistered = false;

  if (session?.user?.email) {
    const registration = await getRegisterForm(session.user.email, HACKATHON_ID);
    isRegistered = !!registration;
  }

  if (!hackathon) redirect("/hackathons");

  const bannerSrc = hackathon.banner?.trim().length > 0
    ? hackathon.banner
    : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png";

  return (
    <div className="build-games-container">
      <main className="relative w-full">
        {/* Hero Banner Section - Full Width */}
        <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden">
          <Image
            src={bannerSrc}
            alt={hackathon.title}
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#152d44]/50 to-[#152d44]" />
        </div>

        {/* Content Section */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[186px] -mt-20 relative z-10">
          {/* Header Card */}
          <div className="gradient-border-card rounded-[16px] p-6 md:p-8 mb-12">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex gap-4 items-center flex-1">
                <Image
                  src={
                    hackathon.icon.trim().length > 0
                      ? hackathon.icon
                      : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-logo-ILfO9EujWnQj1xMZpIIWTZ8mc87I7f.png"
                  }
                  alt="Hackathon icon"
                  width={60}
                  height={60}
                  className="shrink-0"
                />
                <h1 className="font-['Aeonik:Medium',sans-serif] text-2xl md:text-4xl font-medium text-white">
                  {hackathon.title}
                </h1>
              </div>
              <JoinButton
                isRegistered={isRegistered}
                hackathonId={HACKATHON_ID}
                customLink={hackathon.content.join_custom_link}
                customText={hackathon.content.join_custom_text}
                className="shrink-0"
                variant="red"
                showChatWhenRegistered={true}
                utm={utm as string}
              />
            </div>
          </div>

          {/* Main Content Sections */}
          <div className="flex flex-col gap-16 pb-20">
            {hackathon.content.tracks_text && (
              <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
                <About hackathon={hackathon} />
              </div>
            )}

            {hackathon.content.tracks && (
              <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
                <Tracks hackathon={hackathon} />
              </div>
            )}

            <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
              <Resources hackathon={hackathon} />
            </div>

            {hackathon.content.schedule && (
              <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
                <Schedule hackathon={hackathon} />
              </div>
            )}

            <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
              <Submission hackathon={hackathon} />
            </div>

            {hackathon.content.speakers && hackathon.content.speakers.length > 0 && (
              <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
                <MentorsJudges hackathon={hackathon} />
              </div>
            )}

            <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
              <Community hackathon={hackathon} />
            </div>

            {hackathon.content.partners?.length > 0 && (
              <div className="gradient-border-card rounded-[16px] p-6 md:p-10">
                <Sponsors hackathon={hackathon} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
