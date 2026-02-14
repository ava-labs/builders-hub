import ShowCaseCard from "@/components/showcase/ShowCaseCard";
import { getFilteredHackathons } from "@/server/services/hackathons";
import { getFilteredProjects } from "@/server/services/projects";
import { ProjectFilters } from "@/types/project";
import { Project } from "@/types/showcase";
import { getAuthSession } from "@/lib/auth/authSession";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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
    error?: string;
  }>;
}) {
  console.log('📍 [START] Showcase list page');

  const session = await getAuthSession();
  console.log('📍 Showcase list - Session exists?', !!session);
  console.log('📍 Showcase list - Session.user.id:', session?.user?.id);

  const { page, event, track, recordsByPage, search, winningProjects, error } =
    await searchParams;
  const boolWinningProjects = winningProjects == "true" ? true : false;

  // Get user roles for authorization - showcase is admin-only
  console.log('📍 Showcase list - custom_attributes:', session?.user?.custom_attributes);
  const userRoles = session?.user?.custom_attributes || [];
  console.log('📍 Showcase list - userRoles:', userRoles);

  const hasShowcaseRole = userRoles.includes('showcase') || userRoles.includes('devrel') || userRoles.includes('admin');
  console.log('📍 Showcase list - hasShowcaseRole?', hasShowcaseRole);

  // Showcase page is admin-only - show all projects without member filtering
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
      {error === "unauthorized" && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view the showcase. This section is only accessible to admins.
          </AlertDescription>
        </Alert>
      )}
      <ShowCaseCard
        projects={projects as unknown as Project[]}
        initialFilters={initialFilters}
        totalProjects={total}
        events={events.hackathons}
      />
    </main>
  );
}
