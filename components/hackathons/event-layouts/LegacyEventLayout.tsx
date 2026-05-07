import React from "react";
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
import type { HackathonHeader } from "@/types/hackathons";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import StagesSection from "@/components/hackathons/hackathon/sections/StagesSection";

interface LegacyEventLayoutProps {
  hackathon: HackathonHeader;
  id: string;
  isRegistered: boolean;
  isAuthenticated: boolean;
  utm: string;
}

export default function LegacyEventLayout({
  hackathon,
  id,
  isRegistered,
  isAuthenticated,
  utm,
}: LegacyEventLayoutProps) {
  const lang = normalizeEventsLang(hackathon.content?.language);

  const hasAbout = Boolean(hackathon.content.tracks_text);
  const hasTracks =
    Array.isArray(hackathon.content.tracks) &&
    hackathon.content.tracks.length > 0;
  const hasResources =
    Array.isArray(hackathon.content.resources) &&
    hackathon.content.resources.length > 0;
  const hasSchedule =
    (Array.isArray(hackathon.content.schedule) &&
      hackathon.content.schedule.length > 0) ||
    Boolean(hackathon.google_calendar_id);
  const hasSpeakers =
    Array.isArray(hackathon.content.speakers) &&
    hackathon.content.speakers.length > 0;
  const hasPartners =
    Array.isArray(hackathon.content.partners) &&
    hackathon.content.partners.length > 0;

  const isHackathon = (hackathon.event || "hackathon") === "hackathon";

  const menuItems = [
    ...(hasAbout ? [{ name: t(lang, "menu.about"), ref: "about" }] : []),
    ...(isHackathon && hasTracks
      ? [{ name: t(lang, "menu.tracks"), ref: "tracks" }]
      : []),
    ...(hasResources
      ? [{ name: t(lang, "menu.resources"), ref: "resources" }]
      : []),
    ...(hasSchedule
      ? [{ name: t(lang, "menu.schedule"), ref: "schedule" }]
      : []),
    ...(isHackathon && isRegistered
      ? [{ name: t(lang, "menu.submission"), ref: "submission" }]
      : []),
    ...(hasSpeakers
      ? [{ name: t(lang, "menu.mentorsJudges"), ref: "speakers" }]
      : []),
    ...(hasPartners
      ? [{ name: t(lang, "menu.partners"), ref: "sponsors" }]
      : []),
  ];

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
          isAuthenticated={isAuthenticated}
          hackathonId={id}
          customLink={hackathon.content.join_custom_link}
          customText={hackathon.content.join_custom_text}
          className="w-2/5 md:w-1/3 lg:w-1/4 cursor-pointer"
          variant="red"
          showChatWhenRegistered={true}
          utm={utm}
          lang={lang}
        />
      </div>
      <div className="p-4 flex flex-col gap-24">
        <NavigationMenu items={menuItems} />
      </div>
      <div className="flex flex-col mt-2 ">
        <div className="sm:px-8 pt-6 ">
          <div className="sm:block relative w-full">
            <OverviewBanner
              hackathon={hackathon}
              id={id}
              isTopMost={false}
              isRegistered={isRegistered}
              utm={utm}
            />
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
              utm={utm}
            />
          </div>
          <div className="py-8 sm:p-8 flex flex-col gap-20">
            {
              hackathon.content.stages && hackathon.content.stages.length > 0 && (
                <StagesSection stages={hackathon.content.stages} hackathon={hackathon} />
              )
            }
            {hasAbout && <About hackathon={hackathon} />}
            {isHackathon && hasTracks && <Tracks hackathon={hackathon} />}
            {hasResources && <Resources hackathon={hackathon} />}
            {hasSchedule && (
              <Schedule
                hackathon={hackathon}
                scheduleSource={
                  hackathon.google_calendar_id ? "google-calendar" : "database"
                }
                googleCalendarConfig={
                  hackathon.google_calendar_id
                    ? { calendarId: hackathon.google_calendar_id }
                    : undefined
                }
              />
            )}
            {isHackathon && <Submission hackathon={hackathon} isRegistered={isRegistered} isAuthenticated={isAuthenticated} utm={utm} />}
            {hasSpeakers && <MentorsJudges hackathon={hackathon} />}
            <Community hackathon={hackathon} />
            {hasPartners && <Sponsors hackathon={hackathon} />}
          </div>
        </div>
      </div>
    </main>
  );
}
