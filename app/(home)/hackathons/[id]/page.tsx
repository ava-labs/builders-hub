import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getFilteredHackathons,
  getHackathon,
} from "@/server/services/hackathons";
import { getRegisterForm } from "@/server/services/registerForms";
import { getAuthSession } from "@/lib/auth/authSession";
import Image from "next/image";
import { NavigationMenu } from "@/components/hackathons/NavigationMenu";
import Schedule from "@/components/hackathons/hackathon/sections/Schedule";
import Tracks from "@/components/hackathons/hackathon/sections/Tracks";
import About from "@/components/hackathons/hackathon/sections/About";
import Sponsors from "@/components/hackathons/hackathon/sections/Sponsors";
import Submission from "@/components/hackathons/hackathon/sections/Submission";
import Resources from "@/components/hackathons/hackathon/sections/Resources";
import Community from "@/components/hackathons/hackathon/sections/Community";
import MentorsJudges from "@/components/hackathons/hackathon/sections/MentorsJudges";
import OverviewBanner from "@/components/hackathons/hackathon/sections/OverviewBanner";
import JoinButton from "@/components/hackathons/hackathon/JoinButton";
import JoinBannerLink from "@/components/hackathons/hackathon/JoinBannerLink";
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
        title: 'Hackathon Not Found',
        description: 'The requested hackathon could not be found',
      });
    }

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
      title: 'Hackathons',
      description: 'Join exciting blockchain hackathons and build the future on Avalanche',
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

  const menuItems = [
    { name: "About", ref: "about" },
    { name: "Prizes & Tracks", ref: "tracks" },
    { name: "Resources", ref: "resources" },
    { name: "Schedule", ref: "schedule" },
    { name: "Submission", ref: "submission" },
    { name: "Mentors & Judges", ref: "speakers" },
    { name: "Partners", ref: "sponsors" },
  ];

  if (!hackathon) redirect("/hackathons");

  return (
    <main className="container sm:px-2 py-4 lg:py-16">
      <div className="pl-4 flex gap-4 items-center">
        <Image
          src={
            hackathon.icon.trim().length > 0
              ? hackathon.icon
              : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-logo-ILfO9EujWnQj1xMZpIIWTZ8mc87I7f.png"
          }
          alt="Hackathon background"
          width={40}
          height={40}
        />
        <span className="text-sm sm:text-xl font-bold">{hackathon.title}</span>{" "}
        <JoinButton
          isRegistered={isRegistered}
          hackathonId={id}
          customLink={hackathon.content.join_custom_link}
          customText={hackathon.content.join_custom_text}
          className="w-2/5 md:w-1/3 lg:w-1/4 cursor-pointer"
          variant="red"
          showChatWhenRegistered={true}
          utm={utm as string}
        />
      </div>
      <div className="p-4 flex flex-col gap-24">
        <NavigationMenu items={menuItems} />
      </div>
      <div className="flex flex-col mt-2 ">
        <div className="sm:px-8 pt-6 ">
          <div className="sm:block relative w-full">
            <OverviewBanner hackathon={hackathon} id={id} isTopMost={false} isRegistered={isRegistered} utm={utm as string} />
            <JoinBannerLink
              isRegistered={isRegistered}
              hackathonId={id}
              customLink={hackathon.content.join_custom_link}
              bannerSrc={
                hackathon.banner?.trim().length > 0
                  ? hackathon.banner
                  : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png"
              }
              altText="Hackathon background"
              utm={utm as string}
            />
          </div>
          <div className="py-8 sm:p-8 flex flex-col gap-20">
            {hackathon.content.tracks_text && <About hackathon={hackathon} />}
            {hackathon.content.tracks && <Tracks hackathon={hackathon} />}
            <Resources hackathon={hackathon} />
            {hackathon.content.schedule && <Schedule hackathon={hackathon} />}
            <Submission hackathon={hackathon} />
            {hackathon.content.speakers && hackathon.content.speakers.length > 0 && (
              <MentorsJudges hackathon={hackathon} />
            )}
            <Community hackathon={hackathon} />
            {hackathon.content.partners?.length > 0 && (
              <Sponsors hackathon={hackathon} />
            )}
          </div>
        </div>
      </div>
      {/* <div className="flex justify-end mt-4">
        <Link href={`/hackathons/${id}/admin-panel`}>
          <Button>Edit Hackathon</Button>
        </Link>
      </div> */}
    </main>
  );
}