"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { NavigationMenu } from "@/components/hackathons/NavigationMenu";
import { formatReferralTeamLabel } from "@/lib/referrals/team-labels";
import About from "@/components/hackathons/hackathon/sections/About";
import Schedule from "@/components/hackathons/hackathon/sections/Schedule";
import Tracks from "@/components/hackathons/hackathon/sections/Tracks";
import Sponsors from "@/components/hackathons/hackathon/sections/Sponsors";
import Submission from "@/components/hackathons/hackathon/sections/Submission";
import Resources from "@/components/hackathons/hackathon/sections/Resources";
import Community from "@/components/hackathons/hackathon/sections/Community";
import MentorsJudges from "@/components/hackathons/hackathon/sections/MentorsJudges";
import JoinButton from "@/components/hackathons/hackathon/JoinButton";
import { EventReferralButton } from "@/components/hackathons/hackathon/EventReferralModal";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import type { HackathonHeader } from "@/types/hackathons";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import type { SubmissionStatus } from "@/lib/hackathons/submission-progress";
import StagesSection from "../hackathon/sections/StagesSection";

interface ModernEventLayoutProps {
  hackathon: HackathonHeader;
  id: string;
  isRegistered: boolean;
  isAuthenticated: boolean;
  utm: string;
  submissionStatus?: SubmissionStatus;
  submissionProgress?: number;
  submissionProjectId?: string | null;
  isPreview?: boolean;
  hostNavButtons?: React.ReactNode;
}

export default function ModernEventLayout({
  hackathon,
  id,
  isRegistered,
  isAuthenticated,
  utm,
  submissionStatus = "none",
  submissionProgress = 0,
  submissionProjectId = null,
  isPreview = false,
  hostNavButtons,
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

  const isValidSrc = (src: string | undefined | null) =>
    /^(https?:\/\/|\/|data:)/.test((src ?? '').trim());

  const bannerSrc = isValidSrc(hackathon.banner)
    ? hackathon.banner!
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

  const scheduleSource = hackathon.google_calendar_id
    ? "google-calendar"
    : "database";
  const googleCalendarConfig = hackathon.google_calendar_id
    ? { calendarId: hackathon.google_calendar_id }
    : undefined;

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
      <div className="pl-4 flex flex-wrap gap-4 items-center">
        <Image
          src={
            isValidSrc(hackathon.icon)
              ? hackathon.icon
              : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-logo-ILfO9EujWnQj1xMZpIIWTZ8mc87I7f.png"
          }
          alt="Event background"
          width={40}
          height={40}
        />
        <span className="text-sm sm:text-xl font-bold">{hackathon.title}</span>{" "}
        {isHackathon && (
          <EventReferralButton
            hackathonId={id}
            hackathonTitle={hackathon.title}
            lang={lang}
            isAuthenticated={isAuthenticated}
          />
        )}
        <JoinButton
          isRegistered={isRegistered}
          isAuthenticated={isAuthenticated}
          hackathonId={id}
          customLink={hackathon.content.join_custom_link}
          customText={hackathon.content.join_custom_text}
          className="cursor-pointer"
          variant="red"
          showChatWhenRegistered={true}
          utm={utm}
          lang={lang}
        />
        {isHackathon && hostNavButtons}
        {isHackathon && isAuthenticated && submissionStatus !== "none" && (
          <Link
            href={
              submissionProjectId
                ? `/events/project-submission?event=${id}&project=${submissionProjectId}`
                : `/events/project-submission?event=${id}`
            }
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 " +
              (submissionStatus === "complete"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300")
            }
          >
            <span className={
              "size-1.5 rounded-full " +
              (submissionStatus === "complete" ? "bg-emerald-500" : "bg-amber-500")
            } />
            {submissionStatus === "complete"
              ? t(lang, "section.submission.editProject")
              : `${submissionProgress}% · ${t(lang, "section.submission.continueProject")}`}
          </Link>
        )}
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
              unoptimized={bannerSrc.startsWith('data:')}
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
                    {formatReferralTeamLabel(hackathon.organizers)}
                  </span>
                </div>
              )}
            </div>

            {/* Register Button */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
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
              {isRegistered && (
                <a
                  href={`/events/registration-form?event=${id}`}
                  className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors"
                >
                  {t(lang, "join.editRegistration")}
                </a>
              )}
            </div>
          </div>

          {/* Content Sections - same as legacy, with empty checks */}
          <div className="py-8 sm:p-8 flex flex-col gap-20">
            {hackathon.content.stages && hackathon.content.stages.length > 0 && (
              <StagesSection
                stages={hackathon.content.stages}
                hackathon={hackathon}
                renderInPreview={isPreview}
              />
            )}
            {hasAbout && <About hackathon={hackathon} />}
            {isHackathon && hasTracks && <Tracks hackathon={hackathon} />}
            {hasResources && <Resources hackathon={hackathon} />}
            {hasSchedule && (
              <Schedule
                hackathon={hackathon}
                scheduleSource={scheduleSource}
                googleCalendarConfig={googleCalendarConfig}
              />
            )}
            {isHackathon && (
              <Submission
                hackathon={hackathon}
                isRegistered={isRegistered}
                isAuthenticated={isAuthenticated}
                utm={utm}
                submissionStatus={submissionStatus}
                submissionProgress={submissionProgress}
                submissionProjectId={submissionProjectId}
              />
            )}
            {hasSpeakers && <MentorsJudges hackathon={hackathon} />}
            <Community hackathon={hackathon} />
            {hasPartners && (
              <Sponsors hackathon={hackathon} isPreview={isPreview} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
