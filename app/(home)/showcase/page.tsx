import ShowCaseCard from "@/components/showcase/ShowCaseCard";
import { getFilteredHackathons } from "@/server/services/hackathons";
import { getFilteredProjects } from "@/server/services/projects";
import { ProjectFilters } from "@/types/project";
import { Project } from "@/types/showcase";
import { getAuthSession } from "@/lib/auth/authSession";
import { redirect } from "next/navigation";
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
  }>;
}) {
  const session = await getAuthSession();

  // Require authentication
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fshowcase");
  }

  // Check if user has required role (showcase, devrel, or admin)
  const userRoles = session.user.custom_attributes || [];
  const hasShowcaseRole = userRoles.includes('showcase') || userRoles.includes('devrel') || userRoles.includes('admin');

  if (!hasShowcaseRole) {
    // Render unauthorized message directly
    return (
      <main className="container relative max-w-[1400px] pt-4 pb-16">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong className="font-semibold">Access Denied</strong>
              <p className="mt-2">
                You don't have permission to view the showcase. This section is only accessible to users with showcase, devrel, or admin roles.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const { page, event, track, recordsByPage, search, winningProjects } =
    await searchParams;
  const boolWinningProjects = winningProjects == "true" ? true : false;

  // Showcase page - show all projects without member filtering
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
