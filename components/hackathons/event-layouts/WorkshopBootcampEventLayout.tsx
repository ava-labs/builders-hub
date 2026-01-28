import React from "react";
import Image from "next/image";
import { NavigationMenu } from "@/components/hackathons/NavigationMenu";
import About from "@/components/hackathons/hackathon/sections/About";
import Sponsors from "@/components/hackathons/hackathon/sections/Sponsors";
import Resources from "@/components/hackathons/hackathon/sections/Resources";
import Community from "@/components/hackathons/hackathon/sections/Community";
import MentorsJudges from "@/components/hackathons/hackathon/sections/MentorsJudges";
import JoinButton from "@/components/hackathons/hackathon/JoinButton";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import type { HackathonHeader } from "@/types/hackathons";

interface WorkshopBootcampEventLayoutProps {
  hackathon: HackathonHeader;
  id: string;
  isRegistered: boolean;
  utm: string;
}

const simplifiedMenuItems = [
  { name: "About", ref: "about" },
  { name: "Resources", ref: "resources" },
  { name: "Partners", ref: "sponsors" },
];

export default function WorkshopBootcampEventLayout({
  hackathon,
  id,
  isRegistered,
  utm,
}: WorkshopBootcampEventLayoutProps) {
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
          hackathonId={id}
          customLink={hackathon.content.join_custom_link}
          customText={hackathon.content.join_custom_text}
          className="w-2/5 md:w-1/3 lg:w-1/4 cursor-pointer"
          variant="red"
          showChatWhenRegistered={true}
          utm={utm}
        />
      </div>
      <div className="p-4 flex flex-col gap-24">
        <NavigationMenu items={simplifiedMenuItems} />
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
                  <span className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    {hackathon.location}
                  </span>
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
              />
            </div>
          </div>

          {/* Content Sections */}
          <div className="py-8 sm:p-8 flex flex-col gap-20">
            {hackathon.content.tracks_text && <About hackathon={hackathon} />}
            <Resources hackathon={hackathon} />
            {hackathon.content.speakers &&
              hackathon.content.speakers.length > 0 && (
                <MentorsJudges hackathon={hackathon} />
              )}
            {hackathon.content.partners?.length > 0 && (
              <Sponsors hackathon={hackathon} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
