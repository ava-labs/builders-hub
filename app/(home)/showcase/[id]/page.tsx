import React from "react";
import { redirect } from "next/navigation";
import ProjectOverview from "../../../../components/showcase/ProjectOverview";
import { getProject } from "@/server/services/projects";
import { Project } from "@/types/showcase";
import { getUserBadgesByProjectId } from "@/server/services/project-badge";
import { getAuthSession } from "@/lib/auth/authSession";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Require authentication
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/showcase/${id}`);
  }

  // Showcase individual project pages are admin-only
  const userRoles = session.user.custom_attributes || [];
  const hasShowcaseRole = userRoles.includes('showcase') || userRoles.includes('devrel') || userRoles.includes('admin');

  if (!hasShowcaseRole) {
    // Render unauthorized message directly
    const { Alert, AlertDescription } = await import("@/components/ui/alert");
    const { AlertCircle } = await import("lucide-react");

    return (
      <main className="container relative max-w-[1400px] pb-16">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong className="font-semibold">Access Denied</strong>
              <p className="mt-2">
                You don't have permission to view this project. This section is only accessible to users with showcase, devrel, or admin roles.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const project = await getProject(id);
  const badges = await getUserBadgesByProjectId(id);

  return (
    <main className="container relative max-w-[1400px] pb-16">
      <ProjectOverview project={project as unknown as Project} badges={badges} />
    </main>
  );
}
