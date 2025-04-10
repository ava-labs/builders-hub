import React from "react";
import ProjectOverview from "../../../../components/showcase/ProjectOverview";
import { getProject } from "@/server/services/projects";
import { Project } from "@/types/showcase";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  return (
    <main className="container relative max-w-[1400px] pb-16">
      <ProjectOverview project={project as unknown as Project} />
    </main>
  );
}
