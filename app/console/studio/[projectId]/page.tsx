import { Suspense } from "react";
import type { Metadata } from "next";
import { DetailSkeleton } from "@/components/explorer-v2/ui";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";

export const metadata: Metadata = { title: "Studio project" };

export default async function StudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<DetailSkeleton label="Loading project" />}>
      <StudioWorkspace projectId={projectId} />
    </Suspense>
  );
}
