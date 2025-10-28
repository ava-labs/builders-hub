import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HackathonHeader } from "@/types/hackathons";
import { format } from "date-fns";
import { Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";
import React from "react";
import HackathonStatus from "../HackathonStatus";
import JoinButton from "../JoinButton";

type Props = {
  id: string;
  hackathon: HackathonHeader;
  isTopMost: boolean;
  isRegistered: boolean;
  utm?: string;
  isPreview?: boolean;
};

export default function OverviewBanner({ hackathon, id, isTopMost, isRegistered, utm = "", isPreview = false }: Props) {
  const now = new Date();
  const defaultStartDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const defaultEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
  const startDate = hackathon.start_date ? new Date(hackathon.start_date) : defaultStartDate;
  const endDate = hackathon.end_date ? new Date(hackathon.end_date) : defaultEndDate;

  const validStartDate = isNaN(startDate.getTime()) ? defaultStartDate : startDate;
  const validEndDate = isNaN(endDate.getTime()) ? defaultEndDate : endDate;
  const startMonth = format(validStartDate, "MMMM");
  const endMonth = format(validEndDate, "MMMM");

  const formattedDate =
    startMonth === endMonth
      ? `${format(validStartDate, "MMMM d")} - ${format(validEndDate, "d, yyyy")}`
      : `${format(validStartDate, "MMMM d")} - ${format(validEndDate, "MMMM d, yyyy")}`;
  return (
    <div
      className={isPreview ? "z-10 pointer-events-none absolute flex flex-col justify-end inset-x-6 sm:inset-x-8 lg:inset-x-12 bottom-3 sm:bottom-4 lg:bottom-6 xl:bottom-8 max-w-[min(46rem,92vw)] md:max-w-[min(42rem,86vw)] lg:max-w-[min(38rem,70vw)]" : "z-10 pointer-events-none h-full w-[45%] absolute flex flex-col justify-end bottom-2 sm:bottom-6 lg:bottom-10 xl:bottom-12 left-[4%]"}
      style={{ textShadow: "0 0 3px black" }}
    >
      <h1 className={isPreview ? "m-0 text-base sm:text-lg md:text-2xl lg:text-3xl xl:text-4xl leading-tight md:leading-[1.1] tracking-[-0.01em] text-zinc-50 font-bold max-w-[min(40rem,85vw)] break-words" : "text-md sm:text-2xl md:text-3xl lg:text-5xl xl:text-6xl text-zinc-50 font-bold sm:mb-2"}>
        {hackathon.title || 'Hackathon Title'}
      </h1>
      {hackathon.description && (
        <p className="text-s xl:text-sm 2xl:text-base text-zinc-50 hidden xl:inline">
          {hackathon.description}
        </p>
      )}
      <div className="max-w-80">
        <h2
          className={isPreview ? "m-0 md:m-0 lg:m-0 text-sm sm:text-base md:text-xl lg:text-2xl xl:text-3xl font-bold text-red-500 leading-tight tracking-[-0.01em] max-w-[min(38rem,85vw)] break-words" : "mt-0 md:mt-2 lg:mt-4 mb-2 md:mb-6 lg:mb-8 text-lg sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-red-500"}
          style={{ textShadow: "0px 4px 6px #9F2428" }}
        >
          ${(hackathon.total_prizes || 0).toLocaleString("en-US")}
        </h2>
        <div className={isPreview ? "m-0 pointer-events-auto w-full hidden xl:block" : "pointer-events-auto w-full mb-12 hidden xl:block"}>
          {isTopMost ? (
            <Button asChild variant="secondary" className="w-full bg-red-500 border-none text-zinc-100 rounded-md">
              <Link href={`/hackathons/${id}`}>
                LEARN MORE
              </Link>
            </Button>
          ) : (
            <JoinButton
              isRegistered={isRegistered}
              hackathonId={id}
              customLink={hackathon.content?.join_custom_link}
              customText={hackathon.content?.join_custom_text}
              className="w-full bg-red-500 border-none text-zinc-100 rounded-md"
              variant="secondary"
              allowNavigationWhenRegistered={true}
              utm={utm}
            />
          )}
        </div>
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
              {hackathon.location && (
                <span className="text-s xl:text-sm text-zinc-300">
                  {hackathon.location}
                </span>
              )}
            </div>
          </div>
          <div className="max-w-[90%] hidden lg:flex justify-center flex-wrap gap-x-2 xl:gap-x-4 gap-y-2 xl:gap-y-2 mt-4">
            {hackathon.tags?.map((tag, index) => (
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
              <Users
                color="#F5F5F9"
                className="w-4 lg:w-5 h-4 lg:h-5 drop-shadow-[0_0_2px_black]"
              />
              {hackathon.participants && (
                <span className="text-xs xl:text-sm text-zinc-50">
                  {hackathon.participants}
                </span>
              )}
            </div>
            <HackathonStatus status={hackathon.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
