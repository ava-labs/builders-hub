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
  console.log('📍 [START] Showcase [id] page component started');

  const { id } = await params;
  console.log('📍 Project ID from params:', id);
  console.log('📍 Project ID type:', typeof id);

  // Require authentication
  console.log('📍 Getting server session...');
  const session = await getAuthSession();

  console.log('📍 Session exists?', !!session);
  console.log('📍 Session object:', JSON.stringify(session, null, 2));
  console.log('📍 Session.user exists?', !!session?.user);
  console.log('📍 Session.user.id:', session?.user?.id);

  if (!session?.user?.id) {
    console.log('❌ No session.user.id, redirecting to login');
    redirect(`/login?callbackUrl=/showcase/${id}`);
  }

  // Showcase individual project pages are admin-only
  console.log('📍 Checking user roles...');
  console.log('📍 session.user.custom_attributes raw:', session.user.custom_attributes);
  console.log('📍 session.user.custom_attributes type:', typeof session.user.custom_attributes);
  console.log('📍 session.user.custom_attributes is array?', Array.isArray(session.user.custom_attributes));

  const userRoles = session.user.custom_attributes || [];
  console.log('📍 userRoles after default:', userRoles);
  console.log('📍 userRoles length:', userRoles.length);
  console.log('📍 userRoles JSON:', JSON.stringify(userRoles));

  // Check each role individually
  const hasShowcase = userRoles.includes('showcase');
  const hasDevrel = userRoles.includes('devrel');
  const hasAdmin = userRoles.includes('admin');

  console.log('📍 Has "showcase" role?', hasShowcase);
  console.log('📍 Has "devrel" role?', hasDevrel);
  console.log('📍 Has "admin" role?', hasAdmin);

  const hasShowcaseRole = hasShowcase || hasDevrel || hasAdmin;
  console.log('📍 Has ANY showcase role?', hasShowcaseRole);

  if (!hasShowcaseRole) {
    console.log('❌ Access denied - no showcase role, redirecting to /showcase');
    redirect("/showcase?error=unauthorized");
  }

  console.log('✅ Access granted! Loading project...');

  let project;
  let badges;

  try {
    console.log('🔄 Fetching project with id:', id);
    project = await getProject(id);
    console.log('✅ Project loaded successfully:', project?.project_name);

    console.log('🔄 Fetching badges for project:', id);
    badges = await getUserBadgesByProjectId(id);
    console.log('✅ Badges loaded successfully:', badges?.length);
  } catch (error) {
    console.error('❌ Error loading project or badges:', error);
    throw error; // Re-throw to see Next.js error handling
  }

  console.log('🎨 Rendering ProjectOverview component');

  return (
    <main className="container relative max-w-[1400px] pb-16">
      <ProjectOverview project={project as unknown as Project} badges={badges} />
    </main>
  );
}
