"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { hasShowcaseRole } from "@/lib/auth/roles";
import ProjectOverview from "./ProjectOverview";
import { Project } from "@/types/showcase";
import { UserBadge } from "@/types/badge";

interface ShowcaseProjectAuthWrapperProps {
  project: Project;
  badges: UserBadge[];
  projectId: string;
}

export function ShowcaseProjectAuthWrapper({
  project,
  badges,
  projectId,
}: ShowcaseProjectAuthWrapperProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openLoginModal } = useLoginModalTrigger();

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.id) {
      // Show login modal instead of redirecting
      const currentUrl = window.location.href;
      openLoginModal(currentUrl);
      return;
    }

    if (!hasShowcaseRole(session.user.custom_attributes)) {
      router.push("/showcase?error=unauthorized");
      return;
    }
  }, [session, status, router, openLoginModal, projectId]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="container relative max-w-[1400px] pb-16 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't render content if not authenticated (modal will be shown)
  if (!session?.user?.id) {
    return (
      <div className="container relative max-w-[1400px] pb-16 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please sign in to view this project.</p>
      </div>
    );
  }

  if (!hasShowcaseRole(session.user.custom_attributes)) {
    return null;
  }

  // Render the project overview if authenticated and authorized
  return (
    <main className="container relative max-w-[1400px] pb-16">
      <ProjectOverview project={project} badges={badges} />
    </main>
  );
}
