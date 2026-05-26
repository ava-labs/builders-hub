import React from "react";
import { getProject } from "@/server/services/projects";
import { getUserBadgesByProjectId } from "@/server/services/project-badge";
import { ShowcaseProjectAuthWrapper } from "@/components/showcase/ShowcaseProjectAuthWrapper";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasShowcaseRole } from "@/lib/auth/roles";
import { AccessDenied } from "@/components/ui/access-denied";

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
    return (
      <AccessDenied message="You don't have permission to view this project. This section is only accessible to users with showcase, devrel, or admin roles." />
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
