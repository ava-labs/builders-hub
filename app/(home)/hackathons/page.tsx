import type { HackathonsFilters, HackathonStatus } from '@/types/hackathons';
import Hackathons from '@/components/hackathons/Hackathons';
import { getFilteredHackathons } from '@/server/services/hackathons';

export const revalidate = 3600;
export const dynamicParams = true;

export default async function HackathonsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; location?: string; status?: HackathonStatus | null }>;
}) {
  const { page, location, status } = await searchParams;
  const { hackathons, total } =  await getFilteredHackathons({
    page: page ?? 1,
    pageSize: 4,
    location: location,
    status: status,
  });

  const initialFilters: HackathonsFilters = {
    page: page ?? 1,
    location: location,
    status: status as (HackathonStatus | null),
  };

  return (
    <main className='container relative max-w-[1400px] py-4 lg:py-16 '>
      <div className='border border-zinc-300 dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md'>
        <Hackathons
          initialHackathons={hackathons}
          initialFilters={initialFilters}
          totalHackathons={hackathons.length}
        />
      </div>
    </main>
  );
}
