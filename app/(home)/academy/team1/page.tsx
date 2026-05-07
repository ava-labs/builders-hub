import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { team1AcademyLandingPageConfig } from "./config";
import { Suspense } from "react";

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

export default function Team1AcademyPage(): React.ReactElement {
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

