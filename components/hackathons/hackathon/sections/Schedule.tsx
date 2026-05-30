'use client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { SearchEventInput } from '@/components/ui/search-event-input';
import { resolveTimezone } from '@/components/ui/timezone-select';
import { HackathonHeader, ScheduleActivity } from '@/types/hackathons';
import {
  Link as LinkIcon,
  MapPin,
  CircleArrowRight,
  CircleArrowLeft,
  ExternalLink,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import DeadLine from '../DeadLine';
import { Button } from '@/components/ui/button';
import { useSchedule, ScheduleSource, GoogleCalendarConfig } from '@/hooks/useSchedule';
import { normalizeEventsLang, t } from '@/lib/events/i18n';
import CalendarPlusButton from '@/components/hackathons/hackathon/CalendarPlusButton';
import { TimezoneSelectorModal } from './TimezoneSelectorModal';

export type ScheduleProps = {
  hackathon: HackathonHeader;
  /** Data source for schedule: 'database' (default) or 'google-calendar' */
  scheduleSource?: ScheduleSource;
  /** Google Calendar configuration (required when scheduleSource is 'google-calendar') */
  googleCalendarConfig?: GoogleCalendarConfig;
};

function Schedule({ hackathon, scheduleSource = 'database', googleCalendarConfig }: ScheduleProps) {
  const lang = normalizeEventsLang(hackathon.content?.language);
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const [search, setSearch] = useState<string>('');
  const [timeZone, setTimeZone] = useState<string>('');
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');

  // Use the schedule strategy hook - source is determined programmatically via scheduleSource prop
  const { schedule: scheduleData, calendarTimeZone, isLoading, error } = useSchedule({
    source: scheduleSource,
    hackathonId: hackathon.id,
    existingSchedule: hackathon.content.schedule,
    googleCalendarConfig,
  });

  useEffect(() => {
    // Use hackathon timezone, or calendar timezone from Google Calendar as fallback
    // resolveTimezone finds a matching timezone in our selector if exact match not found
    const rawTimeZone = hackathon.timezone || calendarTimeZone || '';
    if (rawTimeZone) {
      setTimeZone(resolveTimezone(rawTimeZone));
    }
  }, [hackathon, calendarTimeZone]);

  useEffect(() => {
    // Keep the selected day aligned with the current timezone-derived groups.
    const groupedActivities = groupActivitiesByDay(scheduleData);
    const days = Object.keys(groupedActivities);
    setSelectedDay((currentDay) =>
      currentDay && days.includes(currentDay) ? currentDay : days[0] || ''
    );
  }, [scheduleData, timeZone]);

  const defineTimeZone = (formatDateParams: any) => {
    if (timeZone) return { ...formatDateParams, timeZone: timeZone };
    return formatDateParams;
  };

  function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  function getConvertedDateParts(date: Date) {
    const formatter = new Intl.DateTimeFormat(
      locale,
      defineTimeZone({
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    );
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value || '';

    return {
      day: Number(getPart('day')),
      month: getPart('month'),
      weekday: getPart('weekday'),
    };
  }

  function getFormattedDay(date: Date) {
    if (isNaN(date.getTime())) return '';

    const { day, weekday } = getConvertedDateParts(date);
    if (!day || !weekday) return '';

    if (lang === 'es') {
      return `${day} ${weekday}`.toLocaleUpperCase();
    }
    const suffix = getOrdinalSuffix(day);
    return `${day}${suffix} ${weekday}`.toLocaleUpperCase();
  }

  function groupActivitiesByDay(
    activities: ScheduleActivity[]
  ): GroupedActivities {
    return activities.reduce((groups: GroupedActivities, activity) => {
      const date = new Date(activity.date);
      if (isNaN(date.getTime())) return groups;

      const dateKey = getFormattedDay(date);
      if (!dateKey) return groups;

      // If this date doesn't exist in groups, create an empty array
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      // Add the activity to the corresponding date group
      groups[dateKey].push(activity);

      // Sort activities within the day by time
      groups[dateKey].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateA.getTime() - dateB.getTime();
      });

      return groups;
    }, {});
  }

  function getDateRange(activities: ScheduleActivity[]): string {
    if (!activities.length) return t(lang, 'schedule.noDatesAvailable');

    const validDates = activities
      .map((activity) => new Date(activity.date))
      .filter((date) => !isNaN(date.getTime()));
    if (!validDates.length) return t(lang, 'schedule.noValidDatesAvailable');

    const earliestDate = new Date(
      Math.min(...validDates.map((date) => date.getTime()))
    );
    const latestDate = new Date(
      Math.max(...validDates.map((date) => date.getTime()))
    );
    if (isNaN(earliestDate.getTime()) || isNaN(latestDate.getTime())) {
      return t(lang, 'schedule.invalidDateRange');
    }

    const formatter = new Intl.DateTimeFormat(
      locale,
      defineTimeZone({
        month: 'long',
        day: 'numeric',
        year: 'numeric',
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
    <section className='flex flex-col gap-6'>
      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2'>
        <h2
          className='text-4xl font-bold md:text-4xl sm:text-3xl'
          id='schedule'
        >
          {t(lang, 'section.schedule.title')}
        </h2>
        <CalendarPlusButton
          googleCalendarId={hackathon.google_calendar_id}
          lang={lang}
          variant='schedule'
        />
      </div>
      <Separator className='my-2 sm:my-8 bg-zinc-300 dark:bg-zinc-800' />

      {isLoading && (
        <div className='flex items-center gap-3 py-6 text-zinc-500 dark:text-zinc-400'>
          <svg className='animate-spin h-5 w-5 shrink-0' viewBox='0 0 24 24' fill='none'>
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z' />
          </svg>
          <span className='text-sm'>{t(lang, 'schedule.loadingCalendar')}</span>
        </div>
      )}

      {!isLoading && error && (
        <div className='rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400'>
          {t(lang, 'schedule.calendarError')}
        </div>
      )}

      <span className='dark:text-zinc-50 text-zinc-900 text-lg font-medium sm:text-base'>
        {getDateRange(scheduleData)}
      </span>
      <div className='flex flex-col lg:flex-row justify-between gap-4 md:gap-10 mt-4 min-w-full'>
        <div className='flex flex-col md:flex-row items-start md:items-center justify-start lg:justify-center gap-4 md:gap-10 w-full md:w-auto'>
          <SearchEventInput setSearch={setSearch} />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <span className='text-sm font-medium text-foreground'>
              {t(lang, 'schedule.timezoneSelector.label')}
            </span>
            <Badge
              variant='outline'
              className='max-w-[240px] justify-start truncate px-3 py-1'
            >
              <span className='truncate'>
                {timeZone || t(lang, 'schedule.timezoneSelector.none')}
              </span>
            </Badge>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setTimezoneModalOpen(true)}
            >
              {t(lang, 'schedule.timezoneSelector.button')}
            </Button>
          </div>
          <TimezoneSelectorModal
            open={timezoneModalOpen}
            onOpenChangeAction={setTimezoneModalOpen}
            timeZone={timeZone}
            setTimeZoneAction={setTimeZone}
            lang={lang}
          />
        </div>
        <DeadLine deadline={hackathon.content.submission_deadline} />
      </div>
      <Divider />
      <div className='bg-zinc-200 dark:bg-zinc-800 backdrop-blur-sm rounded-lg py-1 sm:w-fit w-full sm:max-w-none flex items-center gap-2'>
        <button
          onClick={() => {
            const days = Object.keys(groupActivitiesByDay(scheduleData));
            const currentIndex = days.findIndex(day => day === selectedDay);
            if (currentIndex > 0) {
              setSelectedDay(days[currentIndex - 1]);
            }
          }}
          className='hidden sm:block text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300 px-2 cursor-pointer min-w-[32px]'
        >
          <CircleArrowLeft strokeWidth={1} className='h-6 w-6 sm:h-8 sm:w-8' />
        </button>
        <div className='flex items-center overflow-x-auto no-scrollbar w-full sm:w-auto'>
          <div className='flex w-full sm:w-auto divide-x divide-zinc-300 dark:divide-zinc-700'>
            {Object.entries(groupActivitiesByDay(scheduleData)).map(
              ([formattedDate, activities], index) => {
                if (!activities || activities.length === 0 || !activities[0]?.date) {
                  return null;
                }
                const date = new Date(activities[0].date);
                if (isNaN(date.getTime())) {
                  return null;
                }
                const { month, day } = getConvertedDateParts(date);
                return (
                  <div
                    key={index}
                    className={`border-none cursor-pointer transition-all select-none flex-1 sm:flex-initial ${
                      selectedDay === formattedDate
                        ? 'bg-zinc-500 text-white dark:bg-black dark:text-white'
                        : 'bg-transparent text-zinc-600 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
                    } rounded-lg whitespace-nowrap`}
                    onClick={() => setSelectedDay(formattedDate)}
                  >
                    <div className='flex items-center justify-center gap-1 py-1.5 px-2 sm:px-3'>
                      {month && <span className='text-xs sm:text-sm font-medium'>{month.toUpperCase()}</span>}
                      {day && <span className='text-xs sm:text-sm font-medium'>{day}</span>}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
        <button
          onClick={() => {
            const days = Object.keys(groupActivitiesByDay(scheduleData));
            const currentIndex = days.findIndex(day => day === selectedDay);
            if (currentIndex < days.length - 1) {
              setSelectedDay(days[currentIndex + 1]);
            }
          }}
          className='hidden sm:block text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300 px-2 cursor-pointer min-w-[32px]'
        >
          <CircleArrowRight strokeWidth={1} className='h-6 w-6 sm:h-8 sm:w-8' />
        </button>
      </div>
      <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
        {Object.entries(groupActivitiesByDay(scheduleData))
          .filter(([date], index, array) => {
            const selectedIndex = array.findIndex(([d]) => d === selectedDay);
            return index === selectedIndex || index === selectedIndex + 1;
          })
          .map(([formattedGroupDate, activities], index) => {
            const now = new Date();
            const nowFormattedDay = getFormattedDay(now);
            const dateIsCurrentDate = formattedGroupDate == nowFormattedDay;
            return (
              <div key={index} className='flex flex-col gap-4'>
                <h3
                  className={`text-2xl text-center p-4 rounded-md text-zinc-900 font-black mb-4 ${
                    dateIsCurrentDate ? 'bg-red-500' : 'bg-red-300'
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
                    const joinUrl = (
                      activity.video_call_url ||
                      activity.url ||
                      ''
                    ).trim();
                    const moreInfoUrl = (activity.infoUrl || '').trim();
                    return (
                      <div
                        key={index}
                        className='flex flex-col sm:flex-row gap-3 sm:h-[220px] md:h-[180px]'
                      >
                        <Card
                          className={`${
                            dateIsCurrentDate
                              ? 'bg-zinc-100 dark:!bg-zinc-900'
                              : 'bg-zinc-50 dark:!bg-zinc-950'
                          } ${
                            activityIsOcurring && dateIsCurrentDate
                              ? 'border-2 dark:border-red-500 border-red-500'
                              : dateIsCurrentDate
                              ? 'dark:!border-zinc-900 border-zinc-400'
                              : 'dark:!border-zinc-800 border-zinc-300'
                          } px-2 sm:px-4 sm:w-[40%] md:w-[173px] rounded-lg`}
                        >
                          <CardContent className='h-full relative flex flex-col gap-2 justify-center items-center p-2 sm:p-6'>
                            <div className='absolute top-0'>
                              {activityIsOcurring && dateIsCurrentDate && (
                                <div className='border border-red-500 rounded-full text-xs font-medium text-center w-1/3 sm:w-auto sm:px-2'>
                                  {t(lang, 'schedule.liveNow')}
                                </div>
                              )}
                              {!activityIsOcurring &&
                                dateIsCurrentDate &&
                                activity.isVirtual &&
                                joinUrl && (
                                <div className='border dark:bg-zinc-800 bg-zinc-300 flex items-center justify-center gap-1 rounded-full text-xs font-medium text-center w-1/3 sm:w-auto sm:px-3 py-1 border-none'>
                                  <a
                                    href={joinUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                  >
                                    <LinkIcon
                                      size={16}
                                      className='!text-zinc-900 dark:!text-zinc-50'
                                    />
                                  </a>
                                  {t(lang, 'schedule.join')}
                                </div>
                              )}
                            </div>
                            <div className='flex flex-col items-center justify-center h-full'>
                              <span className='text-base md:text-lg font-medium'>
                                {startDate.toLocaleTimeString(
                                  'en-US',
                                  defineTimeZone({
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                )}
                              </span>
                              <span className='text-base md:text-lg font-medium'>
                                {endDate.toLocaleTimeString(
                                  'en-US',
                                  defineTimeZone({
                                    hour: '2-digit',
                                    minute: '2-digit',
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
                              ? 'dark:!bg-zinc-900 bg-zinc-100'
                              : 'dark:!bg-zinc-950 bg-zinc-50'
                          } border ${
                            activityIsOcurring && dateIsCurrentDate
                              ? 'border-2 dark:border-red-500 border-red-500'
                              : dateIsCurrentDate
                              ? 'dark:!border-zinc-900 border-zinc-400'
                              : 'dark:!border-zinc-800 border-zinc-300'
                          } sm:w-[60%] md:flex-1 rounded-lg`}
                        >
                          <CardContent
                            className={`h-full flex flex-col ${
                              voidHost ? 'justify-start' : 'justify-between'
                            } gap-2`}
                          >
                            <div>
                              <div className='flex justify-between items-center'>
                                <CardTitle className='text-red-500 text-lg sm:text-base'>
                                  {activity.name || t(lang, 'schedule.untitledActivity')}
                                </CardTitle>
                                {activity.category && (
                                  <Badge className='bg-zinc-600 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 py-0.5 px-2.5 text-xs rounded-xl'>
                                    {activity.category}
                                  </Badge>
                                )}
                              </div>
                              {activity.description && (
                                <span className='dark:text-zinc-400 text-zinc-600 text-s sm:text-sm font-normal'>
                                  {activity.description}
                                </span>
                              )}
                            </div>
                            {!voidHost && (
                              <div className='flex flex-row items-center gap-4'>
                                {activity.host_icon && (
                                  <Image
                                    src={activity.host_icon}
                                    alt={activity.host_name || 'Host'}
                                    width={40}
                                    height={40}
                                    className='min-w-[40px]'
                                  />
                                )}
                                <div className='flex flex-col'>
                                  {activity.host_name && (
                                    <span className='text-sm sm:text-base'>
                                      {activity.host_name}
                                    </span>
                                  )}
                                  {activity.host_media && (
                                    <Link
                                      className='dark:text-zinc-400 text-zinc-600 text-s sm:text-sm font-normal'
                                      href={`https://x.com/${activity.host_media}`}
                                      target='_blank'
                                    >
                                      @{activity.host_media}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}
                            <div
                              className={`flex flex-col sm:flex-row sm:gap-4 ${
                                voidHost
                                  ? 'flex-1 items-start sm:items-center'
                                  : 'justify-between'
                              }`}
                            >
                              <div className='flex flex-row flex-wrap gap-x-4 gap-y-1'>
                                {activity.isVirtual && joinUrl && (
                                  <div className='flex flex-row items-center gap-2'>
                                    <a
                                      href={joinUrl}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                    >
                                      <LinkIcon color='#8F8F99' className='w-5 h-5' />
                                    </a>
                                    <Link
                                      href={joinUrl}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                      className='dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal hover:text-red-500 dark:hover:text-red-400 transition-colors'
                                    >
                                      {t(lang, 'schedule.joinVideoCall')}
                                    </Link>
                                  </div>
                                )}
                                <div className='flex flex-row items-center gap-2'>
                                  <MapPin color='#8F8F99' className='w-5 h-5' />
                                  {activity.isVirtual ? (
                                    <span className='dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal'>
                                      {t(lang, 'event.online')}
                                    </span>
                                  ) : activity.location && activity.location !== 'TBD' ? (
                                    activity.location.toLowerCase() === 'online' && activity.url ? (
                                      <Link
                                        href={activity.url}
                                        target='_blank'
                                        className='dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal hover:text-red-500 dark:hover:text-red-400 transition-colors'
                                      >
                                        {activity.location}
                                      </Link>
                                    ) : activity.location.toLowerCase() !== 'online' ? (
                                      <Link
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`}
                                        target='_blank'
                                        className='dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal hover:text-red-500 dark:hover:text-red-400 transition-colors'
                                      >
                                        {activity.location.split(',').slice(0, 2).join(',')}
                                      </Link>
                                    ) : (
                                      <span className='dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal'>
                                        {activity.location}
                                      </span>
                                    )
                                  ) : (
                                    <span className='dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal'>
                                      {activity.location || t(lang, 'schedule.tbd')}
                                    </span>
                                  )}
                                </div>
                                {moreInfoUrl && (
                                  <a
                                    href={moreInfoUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='flex flex-row items-center gap-2 dark:text-zinc-50 text-zinc-900 sm:text-sm font-normal hover:text-red-500 dark:hover:text-red-400 transition-colors'
                                  >
                                    <ExternalLink color='#8F8F99' className='w-5 h-5' />
                                    {t(lang, 'event.moreInfo')}
                                  </a>
                                )}
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
