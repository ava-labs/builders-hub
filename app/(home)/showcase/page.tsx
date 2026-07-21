import ShowCaseCard from "@/components/showcase/ShowCaseCard";
import { getFilteredHackathons } from "@/server/services/hackathons";
import { getFilteredProjects } from "@/server/services/projects";
import { ProjectFilters } from "@/types/project";
import { Project } from "@/types/showcase";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasShowcaseRole } from "@/lib/auth/roles";
import { AuthLoading } from "@/components/ui/auth-loading";
import { AccessDenied } from "@/components/ui/access-denied";
import { HiringCta } from "@/components/ecosystem-careers/HiringCta";

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

  // When unauthenticated, return a minimal page.
  // AutoLoginModalTrigger (in layout) will open the LoginModal automatically.
  // After login, LoginModalWrapper redirects back here triggering a full reload.
  if (!session?.user?.id) {
    return <AuthLoading />;
  }

  if (!hasShowcaseRole(session.user.custom_attributes)) {
    return (
      <AccessDenied message="You don't have permission to view the showcase. This section is only accessible to users with showcase, devrel, or admin roles." />
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
    <main className="container relative max-w-[1400px] pt-4 pb-16 space-y-6">
      <HiringCta variant="banner" />
      <ShowCaseCard
        projects={projects as unknown as Project[]}
        initialFilters={initialFilters}
        totalProjects={total}
        events={events.hackathons}
      />
    </main>
  );
}
