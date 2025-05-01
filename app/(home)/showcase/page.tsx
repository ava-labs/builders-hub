import ShowCaseCard from "@/components/showcase/ShowCaseCard";
import { getFilteredHackathons } from "@/server/services/hackathons";
import { getFilteredProjects } from "@/server/services/projects";
import { ProjectFilters } from "@/types/project";
import { Project } from "@/types/showcase";

export default async function ShowCasePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
    event?: string;
    track?: string;
    recordsByPage?: string;
    search?: string;
    winningProjects?: string;
  }>;
}) {
  const { page, event, track, recordsByPage, search, winningProjects } =
    await searchParams;
  const boolWinningProjects = winningProjects == "true" ? true : false;
  const { projects, total } = await getFilteredProjects({
    page: page ? Number(page) : 1,
    pageSize: recordsByPage ? Number(recordsByPage) : 12,
    event: event,
    track: track,
    search: search,
    winningProjects: boolWinningProjects,
  });
  const initialFilters: ProjectFilters = {
    page: page ? Number(page) : 1,
    event: event,
    track: track,
    recordsByPage: recordsByPage ? parseInt(recordsByPage) : 12,
    search: search,
    winningProjecs: boolWinningProjects,
  };
  const events = await getFilteredHackathons({});
  return (
    <main className="container relative max-w-[1400px] pt-4 pb-16">
      <ShowCaseCard
        projects={projects as unknown as Project[]}
        initialFilters={initialFilters}
        totalProjects={total}
        events={events.hackathons}
      />
    </main>
  );
}
