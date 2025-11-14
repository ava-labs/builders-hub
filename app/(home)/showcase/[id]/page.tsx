import React from "react";
import ProjectOverview from "../../../../components/showcase/ProjectOverview";
import { getProject } from "@/server/services/projects";
import { Project } from "@/types/showcase";
import { getProjectBadges, getUserBadgesByProjectId } from "@/server/services/project-badge";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  const badges = await getUserBadgesByProjectId(id);
  
  return (
    <main className="container relative max-w-[1400px] pb-16">
      <ProjectOverview project={project as unknown as Project} badges={badges} />
    </main>
  );
}
