import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HackathonHeader } from "@/types/hackathons";
import { format } from "date-fns";
import { Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";
import React from "react";
import HackathonStatus from "../HackathonStatus";

type Props = {
  id: string;
  hackathon: HackathonHeader;
};

export default function OverviewBanner({ hackathon, id }: Props) {
  const startDate = new Date(hackathon.start_date);
  const endDate = new Date(hackathon.end_date);

  const startMonth = format(startDate, "MMMM");
  const endMonth = format(endDate, "MMMM");

  const formattedDate =
    startMonth === endMonth
      ? `${format(startDate, "MMMM d")} - ${format(endDate, "d, yyyy")}`
      : `${format(startDate, "MMMM d")} - ${format(endDate, "MMMM d, yyyy")}`;
  return (
    <div className="z-10 pointer-events-none h-full w-[45%] absolute flex flex-col justify-end bottom-2 sm:bottom-6 lg:bottom-10 xl:bottom-12 left-[4%]">
      <h1 className="text-md sm:text-2xl md:text-3xl lg:text-5xl xl:text-6xl text-zinc-50 font-bold sm:mb-2">
        {hackathon.title}
      </h1>
      <p className="text-s xl:text-sm 2xl:text-base text-zinc-50 hidden xl:inline">
        {hackathon.description}
      </p>
      <div className="max-w-80">
        <h2
          className="mt-0 md:mt-2 lg:mt-4 mb-2 md:mb-6 lg:mb-8 text-lg sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-red-500"
          style={{ textShadow: "0px 4px 6px #9F2428" }}
        >
          ${hackathon.total_prizes.toLocaleString("en-US")}
        </h2>
        <Button
          variant={"secondary"}
          className="w-full mb-12 bg-red-500 border-none text-zinc-100 rounded-md hidden xl:block"
        >
          <Link href={
              hackathon.content.join_custom_link
                ? hackathon.content.join_custom_link
                : `/hackathons/registration-form?hackaId=${id}`
             } target={hackathon.content.join_custom_link? '_blank': '_self'}> { hackathon.content.join_custom_text?? "Join now"} </Link>
        </Button>
        <div className="flex flex-col">
          <div className="hidden md:flex flex-col gap-2 max-w-[60%] md:max-w-[45%] xl:max-w-[60%]">
            <div className="flex justify-between gap-2 text-gray-400">
              <Calendar color="#F5F5F9" className="w-4 lg:w-5 h-4 lg:h-5" />
              <span className="text-s xl:text-sm text-zinc-50">
                {formattedDate}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-gray-400">
              <MapPin color="#F5F5F9" className="w-4 lg:w-5 h-4 lg:h-5" />
              <span className="text-s xl:text-sm text-zinc-300">
                {hackathon.location}
              </span>
            </div>
          </div>
          <div className="max-w-[90%] hidden lg:flex justify-center flex-wrap gap-x-2 xl:gap-x-4 gap-y-2 xl:gap-y-2 mt-4">
            {hackathon.tags.map((tag, index) => (
              <Badge
                key={index}
                className="bg-zinc-800 text-zinc-50 px-3 py-1 text-xs xl:text-sm rounded-full"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="hidden md:flex justify-between gap-4 mt-4 max-w-[90%]">
            <div className="flex gap-2 text-gray-400">
              <Users color="#F5F5F9" className="w-4 lg:w-5 h-4 lg:h-5" />
              <span className="text-xs xl:text-sm text-zinc-50">
                {hackathon.participants}
              </span>
            </div>
            <HackathonStatus status={hackathon.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
