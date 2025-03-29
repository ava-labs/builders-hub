"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { SearchEventInput } from "@/components/ui/search-event-input";
import { TimeZoneSelect } from "@/components/ui/timezone-select";
import { HackathonHeader, ScheduleActivity } from "@/types/hackathons";
import { Link as LinkIcon, MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import DeadLine from "../DeadLine";

function Schedule({ hackathon }: { hackathon: HackathonHeader }) {
  const [search, setSearch] = useState<string>("");
  const [timeZone, setTimeZone] = useState<string>("");

  useEffect(() => {
    if (hackathon.timezone) {
      setTimeZone(hackathon.timezone);
    }
  }, [hackathon]);

  const defineTimeZone = (formatDateParams: any) => {
    if (timeZone) return { ...formatDateParams, timeZone: timeZone };
    return formatDateParams;
  };

  function getFormattedDay(date: Date) {
    return `${date.toLocaleString(
      "en-US",
      defineTimeZone({
        day: "numeric",
      })
    )}TH ${date.toLocaleString(
      "en-US",
      defineTimeZone({
        weekday: "long",
      })
    )}`;
  }

  function groupActivitiesByDay(
    activities: ScheduleActivity[]
  ): GroupedActivities {
    return activities.reduce((groups: GroupedActivities, activity) => {
      // Format the date to YYYY-MM-DD to use as key
      const date = new Date(activity.date);
      const dateKey = getFormattedDay(date);

      // If this date doesn't exist in groups, create an empty array
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      // Add the activity to the corresponding date group
      groups[dateKey].push(activity);

      // Sort activities within the day by time
      groups[dateKey].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return groups;
    }, {});
  }

  function getDateRange(activities: ScheduleActivity[]): string {
    if (!activities.length) return "No dates available";

    const dates = activities.map((activity) => new Date(activity.date));

    const earliestDate = new Date(
      Math.min(...dates.map((date) => date.getTime()))
    );
    const latestDate = new Date(
      Math.max(...dates.map((date) => date.getTime()))
    );

    const formatter = new Intl.DateTimeFormat(
      "en-US",
      defineTimeZone({
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    );

    if (earliestDate.getTime() === latestDate.getTime()) {
      return formatter.format(earliestDate);
    }

    return `${formatter.format(earliestDate)} - ${formatter.format(
      latestDate
    )}`;
  }
  return (
    <section className="flex flex-col gap-6">
      <h2
        className="text-4xl font-bold mb-2 md:text-4xl sm:text-3xl"
        id="schedule"
      >
        Schedule
      </h2>
      <Separator className="my-2 sm:my-8 bg-zinc-300 dark:bg-zinc-800" />
      <span className="dark:text-zinc-50 text-zinc-900 text-lg font-medium sm:text-base">
        {getDateRange(hackathon.content.schedule)}
      </span>
      <div className="flex flex-col lg:flex-row justify-between gap-4 md:gap-10 mt-4 min-w-full">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-start lg:justify-center gap-4 md:gap-10 w-full md:w-auto">
          <SearchEventInput setSearch={setSearch} />
          <TimeZoneSelect timeZone={timeZone} setTimeZone={setTimeZone} />
        </div>
        <DeadLine deadline={hackathon.content.submission_deadline} />
      </div>
      <Divider />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {Object.entries(groupActivitiesByDay(hackathon.content.schedule))
          .slice(0, 2)
          .map(([formattedGroupDate, activities], index) => {
            const now = new Date();
            const nowFormattedDay = getFormattedDay(now);
            const dateIsCurrentDate = false;//Pending to activate
            return (
              <div key={index} className="flex flex-col gap-4">
                <h3
                  className={`text-2xl text-center p-4 rounded-md text-zinc-900 font-black mb-4 ${
                    dateIsCurrentDate ? "bg-red-500" : "bg-red-300"
                  } sm:text-xl`}
                >
                  {formattedGroupDate}
                </h3>

                {activities
                  .filter((activity) => {
                    const searchLower = search.toLowerCase();
                    return (
                      !search ||
                      activity.name?.toLowerCase().includes(searchLower) ||
                      activity.category?.toLowerCase().includes(searchLower) ||
                      activity.location
                        ?.toLocaleLowerCase()
                        .includes(searchLower)
                    );
                  })
                  .map((activity, index) => {
                    const startDate = new Date(activity.date);
                    const endDate = new Date(
                      new Date(activity.date).getTime() +
                        (Number(activity.duration) || 0) * 60000
                    );
                    const activityIsOcurring =
                      startDate <= now && now <= endDate;
                    const voidHost =
                      !activity.host_icon &&
                      !activity.host_name &&
                      !activity.host_media;
                    return (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row gap-3 sm:h-[220px] md:h-[180px]"
                      >
                        <Card
                          className={`${
                            dateIsCurrentDate
                              ? "dark:bg-zinc-900 bg-zinc-100 "
                              : "dark:bg-zinc-950 bg-zinc-50"
                          } ${
                            activityIsOcurring && dateIsCurrentDate
                              ? "border-2 dark:border-red-500 border-red-500"
                              : dateIsCurrentDate
                              ? "dark:border-zinc-900 border-zinc-400"
                              : "dark:border-zinc-800 border-zinc-300"
                          } px-2 sm:px-4 sm:w-[40%] md:w-[173px] rounded-lg`}
                        >
                          <CardContent className="h-full relative flex flex-col gap-2 justify-center items-center p-2 sm:p-6">
                            <div className="absolute top-4">
                              {activityIsOcurring && dateIsCurrentDate && (
                                <div className="border border-red-500 rounded-full text-sm font-medium text-center w-1/3 sm:w-auto sm:px-2">
                                  Live now
                                </div>
                              )}
                              {!activityIsOcurring && dateIsCurrentDate && (
                                <div className="border dark:bg-zinc-800 bg-zinc-300 flex items-center justify-center gap-1 rounded-full text-sm font-medium text-center w-1/3 sm:w-auto sm:px-3 py-1">
                                  <LinkIcon
                                    size={16}
                                    className="!text-zinc-900 dark:!text-zinc-50"
                                  />
                                  Zoom
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className="text-base md:text-lg font-medium">
                                {startDate.toLocaleTimeString(
                                  "en-US",
                                  defineTimeZone({
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                )}
                              </span>
                              <span className="text-base md:text-lg font-medium">
                                {endDate.toLocaleTimeString(
                                  "en-US",
                                  defineTimeZone({
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card
                          className={`${
                            dateIsCurrentDate
                              ? "dark:bg-zinc-900 bg-zinc-100"
                              : "dark:bg-zinc-950 bg-zinc-50"
                          } border ${
                            activityIsOcurring && dateIsCurrentDate
                              ? "border-2 dark:border-red-500 border-red-500"
                              : dateIsCurrentDate
                              ? "dark:border-zinc-900 border-zinc-400"
                              : "dark:border-zinc-800 border-zinc-300"
                          } sm:w-[60%] md:flex-1 rounded-lg`}
                        >
                          <CardContent
                            className={`p-3 sm:p-4 h-full flex flex-col ${
                              voidHost ? "justify-start" : "justify-between"
                            } gap-2`}
                          >
                            <div>
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-red-500 text-lg sm:text-base">
                                  {activity.name}
                                </CardTitle>
                                {activity.category && (
                                  <Badge className="dark:bg-zinc-50 bg-zinc-900 dark:text-zinc-900 text-zinc-50 py-0.5 px-2.5 text-s w-fit h-fit">
                                    {activity.category}
                                  </Badge>
                                )}
                              </div>
                              <span className="dark:text-zinc-400 text-zinc-600 text-s sm:text-sm font-normal">
                                {activity.description}
                              </span>
                            </div>
                            {!voidHost && (
                              <div className="flex flex-row items-center gap-4">
                                {activity.host_icon && (
                                  <Image
                                    src={activity.host_icon}
                                    alt={activity.host_name || "Host"}
                                    width={40}
                                    height={40}
                                    className="min-w-[40px]"
                                  />
                                )}
                                <div className="flex flex-col">
                                  {activity.host_name && (
                                    <span className="text-sm sm:text-base">
                                      {activity.host_name}
                                    </span>
                                  )}
                                  {activity.host_media && (
                                    <Link
                                      className="dark:text-zinc-400 text-zinc-600 text-s sm:text-sm font-normal"
                                      href={`https://x.com/${activity.host_media}`}
                                      target="_blank"
                                    >
                                      @{activity.host_media}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}
                            <div
                              className={`flex flex-row sm:gap-4 ${
                                voidHost
                                  ? "flex-1 items-center"
                                  : "justify-between"
                              }`}
                            >
                              <div className="flex flex-row items-center gap-2">
                                <MapPin color="#8F8F99" className="w-5 h-5" />
                                <span className="dark:text-zinc-50 zinc-900 sm:text-sm font-normal">
                                  {activity.location}
                                </span>
                              </div>
                              {/* <Button
                                  variant="secondary"
                                  size="icon"
                                  className="bg-zinc-300 dark:bg-zinc-800 w-8 sm:w-10 min-w-8 sm:min-w-10 h-8 sm:h-10"
                                >
                                  <CalendarPlus2 className="w-3 h-3 sm:w-4 sm:h-4 !text-zinc-900 dark:!text-zinc-50" />
                                </Button> */}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
              </div>
            );
          })}
      </div>
    </section>
  );
}

export default Schedule;

type GroupedActivities = {
  [key: string]: ScheduleActivity[];
};
