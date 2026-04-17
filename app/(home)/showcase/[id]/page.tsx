import React from "react";
import { getProject } from "@/server/services/projects";
import { getUserBadgesByProjectId } from "@/server/services/project-badge";
import { ShowcaseProjectAuthWrapper } from "@/components/showcase/ShowcaseProjectAuthWrapper";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasShowcaseRole } from "@/lib/auth/roles";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getAuthSession();

  // When unauthenticated, return a minimal page.
  // AutoLoginModalTrigger (in layout) will open the LoginModal automatically.
  // After login, LoginModalWrapper redirects back here triggering a full reload.
  if (!session?.user?.id) {
    return (
      <main className="container relative max-w-[1400px] pb-16 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!hasShowcaseRole(session.user.custom_attributes)) {
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
    <ShowcaseProjectAuthWrapper
      project={project}
      badges={badges}
      projectId={id}
    />
  );
}
