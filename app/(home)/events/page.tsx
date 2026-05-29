import type { HackathonsFilters, HackathonStatus } from "@/types/hackathons";
import Events from "@/components/hackathons/Events";
import { HeroBackground } from "@/components/landing/hero";
import { getFilteredHackathons } from "@/server/services/hackathons";
import { createMetadata } from "@/utils/metadata";
import type { Metadata } from "next";
import { normalizeEventsLang, t } from "@/lib/events/i18n";

// Open events fill an auto-flowing grid, so fetch more than the paginated past list.
const OPEN_EVENTS_PAGE_SIZE = 24;

export const revalidate = 3600;
export const dynamicParams = true;

export const metadata: Metadata = createMetadata({
  title: t(normalizeEventsLang(undefined), "meta.events.title"),
  description: t(normalizeEventsLang(undefined), "meta.eventsIndex.description"),
  openGraph: {
    images: '/api/og/events',
  },
  twitter: {
    images: '/api/og/events',
  },
});

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
    recordsByPage?: number;
    location?: string;
  }>;
}) {
  const { page, location, recordsByPage } = await searchParams;
  const { hackathons: pastEvents, total: totalPastEvents } =
    await getFilteredHackathons({
      page: page ?? 1,
      pageSize: Number(recordsByPage ?? 4),
      location: location,
      status: "ENDED",
    });

  const { hackathons: upcomingEvents, total: totalUpcomingEvents } =
    await getFilteredHackathons({
      page: 1,
      pageSize: OPEN_EVENTS_PAGE_SIZE,
      location: location,
      status: "UPCOMING",
    });

  const { hackathons: ongoingEvents, total: totalOngoingEvents } =
    await getFilteredHackathons({
      page: 1,
      pageSize: OPEN_EVENTS_PAGE_SIZE,
      location: location,
      status: "ONGOING",
    });

  const initialFilters: HackathonsFilters = {
    page: page ?? 1,
    location: location,
    recordsByPage: Number(recordsByPage ?? 4)
  };


  return (
    <>
      <HeroBackground />
      <main className="container relative z-10 mx-auto max-w-[1400px] px-4 pb-16 pt-2">
        <Events
          initialPastEvents={pastEvents}
          initialUpcomingEvents={upcomingEvents}
          initialOngoingEvents={ongoingEvents}
          initialFilters={initialFilters}
          totalPastEvents={totalPastEvents}
          totalUpcomingEvents={totalUpcomingEvents}
        />
      </main>
    </>
  );
}
