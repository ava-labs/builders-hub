import { Suspense } from "react";
import type { Metadata } from "next";
import { StudioWorkspace, WorkspaceSkeleton } from "@/components/studio/StudioWorkspace";

export const metadata: Metadata = { title: "Studio project" };

export default async function StudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <StudioWorkspace projectId={projectId} />
    </Suspense>
  );
}
