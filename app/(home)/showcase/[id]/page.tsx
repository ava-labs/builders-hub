import React from "react";
import { getProject } from "@/server/services/projects";
import { getUserBadgesByProjectId } from "@/server/services/project-badge";
import { ShowcaseProjectAuthWrapper } from "@/components/showcase/ShowcaseProjectAuthWrapper";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  console.log('📍 [START] Showcase [id] page component started');

  const { id } = await params;
  console.log('📍 Project ID from params:', id);
  console.log('📍 Project ID type:', typeof id);

  console.log('🔄 Fetching project with id:', id);
  
  let project;
  let badges;

  try {
    project = await getProject(id);
    console.log('✅ Project loaded successfully:', project?.project_name);

    console.log('🔄 Fetching badges for project:', id);
    badges = await getUserBadgesByProjectId(id);
    console.log('✅ Badges loaded successfully:', badges?.length);
  } catch (error) {
    console.error('❌ Error loading project or badges:', error);
    throw error; // Re-throw to see Next.js error handling
  }

  console.log('🎨 Rendering ShowcaseProjectAuthWrapper component');

  return (
    <ShowcaseProjectAuthWrapper
      project={project}
      badges={badges}
      projectId={id}
    />
  );
}
