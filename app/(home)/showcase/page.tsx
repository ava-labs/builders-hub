import ShowCaseCard from "@/components/showcase/ShowCaseCard";
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
  }>;
}) {
  const { page, event, track, recordsByPage } = await searchParams;
  console.log("page", page);
  const { projects, total } = await getFilteredProjects({
    page: page ? Number(page) : 1,
    pageSize: recordsByPage ? Number(recordsByPage) : 12,
    event: event,
    track: track,
  });
  const initialFilters: ProjectFilters = {
    page: page ? Number(page) : 1,
    event: event,
    track: track,
    recordsByPage: recordsByPage ? parseInt(recordsByPage) : 12,
  };
  return (
    <main className="container relative max-w-[1400px] py-4">
      <ShowCaseCard
        projects={projects as unknown as Project[]}
        initialFilters={initialFilters}
        totalProjects={total}
      />
    </main>
  );
}
