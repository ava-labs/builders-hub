import ShowCaseCard from "@/components/showcase/ShowCaseCard";
import { getFilteredProjects } from "@/server/services/projects";
import { Project } from "@/types/showcase";

export default async function ShowCasePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
  }>;
}) {
  const { page } = await searchParams;
  const { projects, total } = await getFilteredProjects({
    page: page ?? 1,
    pageSize: 4,
  });
  return (
    <main className="container relative max-w-[1400px] py-4">
      <ShowCaseCard projects={projects as unknown as Project[]} />
    </main>
  );
}
