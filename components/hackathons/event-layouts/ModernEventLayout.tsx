import React from "react";
import Image from "next/image";
import { NavigationMenu } from "@/components/hackathons/NavigationMenu";
import About from "@/components/hackathons/hackathon/sections/About";
import Schedule from "@/components/hackathons/hackathon/sections/Schedule";
import Tracks from "@/components/hackathons/hackathon/sections/Tracks";
import Sponsors from "@/components/hackathons/hackathon/sections/Sponsors";
import Submission from "@/components/hackathons/hackathon/sections/Submission";
import Resources from "@/components/hackathons/hackathon/sections/Resources";
import Community from "@/components/hackathons/hackathon/sections/Community";
import MentorsJudges from "@/components/hackathons/hackathon/sections/MentorsJudges";
import JoinButton from "@/components/hackathons/hackathon/JoinButton";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import type { HackathonHeader } from "@/types/hackathons";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import StagesSection from "../hackathon/sections/StagesSection";

interface ModernEventLayoutProps {
  hackathon: HackathonHeader;
  id: string;
  isRegistered: boolean;
  isAuthenticated: boolean;
  utm: string;
}

export default function ModernEventLayout({
  hackathon,
  id,
  isRegistered,
  isAuthenticated,
  utm,
}: ModernEventLayoutProps) {
  const lang = normalizeEventsLang(hackathon.content?.language);

  // Format dates
  const now = new Date();
  const defaultStartDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const defaultEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const startDate = hackathon.start_date
    ? new Date(hackathon.start_date)
    : defaultStartDate;
  const endDate = hackathon.end_date
    ? new Date(hackathon.end_date)
    : defaultEndDate;

  const validStartDate = isNaN(startDate.getTime()) ? defaultStartDate : startDate;
  const validEndDate = isNaN(endDate.getTime()) ? defaultEndDate : endDate;
  const startMonth = format(validStartDate, "MMMM");
  const endMonth = format(validEndDate, "MMMM");
  const isSameDay =
    validStartDate.getFullYear() === validEndDate.getFullYear() &&
    validStartDate.getMonth() === validEndDate.getMonth() &&
    validStartDate.getDate() === validEndDate.getDate();

  const formattedDate =
    isSameDay
      ? `${format(validStartDate, "MMMM d, h:mm a")} - ${format(
          validEndDate,
          "h:mm a"
        )}`
      : startMonth === endMonth
      ? `${format(validStartDate, "MMMM d")} - ${format(validEndDate, "d, yyyy")}`
      : `${format(validStartDate, "MMMM d")} - ${format(validEndDate, "MMMM d, yyyy")}`;

  const bannerSrc =
    hackathon.banner?.trim().length > 0
      ? hackathon.banner
      : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png";

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
          alt="Event background"
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
          {/* Banner Image - Solo la imagen, sin superposiciones */}
          <div className="sm:block relative w-full mb-8">
            <Image
              src={bannerSrc}
              alt="Event banner"
              width={1270}
              height={760}
              className="w-full h-auto rounded-lg"
              priority
            />
          </div>

          {/* Event Info Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 mb-12 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 flex-1">
              {/* Date */}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                <span className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  {formattedDate}
                </span>
              </div>

              {/* Location */}
              {hackathon.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                  {/online/i.test(hackathon.location) ? (
                    <span className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
                      {hackathon.location}
                    </span>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hackathon.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                    >
                      {hackathon.location}
                    </a>
                  )}
                </div>
              )}

              {/* Organizers */}
              {hackathon.organizers && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                  <span className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    {hackathon.organizers}
                  </span>
                </div>
              )}
            </div>

            {/* Register Button */}
            <div className="flex-shrink-0">
              <JoinButton
                isRegistered={isRegistered}
                hackathonId={id}
                customLink={hackathon.content.join_custom_link}
                customText={hackathon.content.join_custom_text}
                className="w-full sm:w-auto min-w-[200px] cursor-pointer"
                variant="red"
                showChatWhenRegistered={true}
                utm={utm}
                lang={lang}
              />
            </div>
          </div>

          {/* Content Sections - same as legacy, with empty checks */}
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
