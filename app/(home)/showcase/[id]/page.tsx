import { redirect } from "next/navigation";
import { getProject } from "@/server/services/projects";
import { getUserBadgesByProjectId } from "@/server/services/project-badge";
import { ShowcaseProjectAuthWrapper } from "@/components/showcase/ShowcaseProjectAuthWrapper";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasPermission } from "@/lib/auth/rolePermissions";

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

  if (!hasPermission(session, { resource: "showcase", action: "read" })) {
    redirect("/");
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
