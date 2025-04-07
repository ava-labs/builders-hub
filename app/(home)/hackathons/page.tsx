import type { HackathonsFilters, HackathonStatus } from "@/types/hackathons";
import Hackathons from "@/components/hackathons/Hackathons";
import { getFilteredHackathons } from "@/server/services/hackathons";

export const revalidate = 3600;
export const dynamicParams = true;

export default async function HackathonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
    recordsByPage?: number;
    location?: string;
  }>;
}) {
  const { page, location, recordsByPage } = await searchParams;
  const { hackathons: pastHackathons, total: totalPastHackathons } =
    await getFilteredHackathons({
      page: page ?? 1,
      pageSize: Number(recordsByPage ?? 4),
      location: location,
      status: "ENDED",
    });

  const { hackathons: upcomingHackathons, total: totalUpcomingHackathons } =
    await getFilteredHackathons({
      page: page ?? 1,
      pageSize: Number(recordsByPage ?? 4),
      location: location,
      status: '!ENDED',
    });

  const initialFilters: HackathonsFilters = {
    page: page ?? 1,
    location: location,
    recordsByPage: Number(recordsByPage ?? 4)
  };

  return (
    <main className="container relative max-w-[1400px] pt-4 pb-16">
      <div className="border border-zinc-300 dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md">
        <Hackathons
          initialPastHackathons={pastHackathons}
          initialUpcomingHackathons={upcomingHackathons}
          initialFilters={initialFilters}
          totalPastHackathons={totalPastHackathons}
          totalUpcomingHackathons={totalUpcomingHackathons}
        />
      </div>
    </main>
  );
}
