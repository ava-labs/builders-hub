import type { HackathonsFilters, HackathonStatus } from "@/types/hackathons";
import Events from "@/components/hackathons/Events";
import { getFilteredHackathons } from "@/server/services/hackathons";
import { createMetadata } from "@/utils/metadata";
import type { Metadata } from "next";

export const revalidate = 3600;
export const dynamicParams = true;

export const metadata: Metadata = createMetadata({
  title: 'Events',
  description: 'Join exciting blockchain hackathons, workshops and bootcamps on Avalanche',
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
      page: page ?? 1,
      pageSize: Number(recordsByPage ?? 4),
      location: location,
      status: "UPCOMING",
    });

  const { hackathons: ongoingEvents, total: totalOngoingEvents } =
    await getFilteredHackathons({
      page: page ?? 1,
      pageSize: Number(recordsByPage ?? 4),
      location: location,
      status: "ONGOING",
    });

  const initialFilters: HackathonsFilters = {
    page: page ?? 1,
    location: location,
    recordsByPage: Number(recordsByPage ?? 4)
  };


  return (
    <main className="container relative max-w-[1400px] mx-auto px-4 pt-4 pb-16">
      <div className="border border-zinc-300 dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md">
        <Events
          initialPastEvents={pastEvents}
          initialUpcomingEvents={upcomingEvents}
          initialOngoingEvents={ongoingEvents}
          initialFilters={initialFilters}
          totalPastEvents={totalPastEvents}
          totalUpcomingEvents={totalUpcomingEvents}
        />
      </div>
    </main>
  );
}
