import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { team1AcademyLandingPageConfig } from "./config";
import { Suspense } from "react";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasTeam1AcademyAccess } from "@/lib/auth/roles";
import { AuthLoading } from "@/components/ui/auth-loading";
import { AccessDenied } from "@/components/ui/access-denied";

export const metadata: Metadata = createMetadata({
  title: "Team1 Academy",
  description:
    "Explore Team1 courses and jump between fundamentals, technical paths, and event organizing.",
  openGraph: {
    url: "/academy/team1",
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Team1 Academy",
    },
  },
  twitter: {
    images: {
      url: "/api/og/academy",
      width: 1200,
      height: 630,
      alt: "Team1 Academy",
    },
  },
});

export default async function Team1AcademyPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();

  // Anonymous: render a minimal layout. AutoLoginModalTrigger (mounted in the
  // (home) layout) matches /academy/team1 against its protectedPaths list and
  // opens the login modal automatically.
  if (!session?.user?.id) {
    return <AuthLoading />;
  }

  if (!hasTeam1AcademyAccess(session.user.custom_attributes)) {
    return (
      <AccessDenied message="The Team1 Academy is only accessible to Team1 members." />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
        </div>
      }
    >
      <AcademyLayout config={team1AcademyLandingPageConfig} />
    </Suspense>
  );
}

