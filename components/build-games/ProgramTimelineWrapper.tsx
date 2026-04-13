"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api/client";
import dynamic from "next/dynamic";

const ProgramTimeline = dynamic(() => import("./ProgramTimeline"), {
  ssr: false,
});

export interface StageResult {
  projectName: string;
  stage1Result: string | null;
  stage2Result: string | null;
}

export default function ProgramTimelineWrapper() {
  const { status } = useSession();
  const [isParticipant, setIsParticipant] = useState(false);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;

    apiFetch<{ isParticipant: boolean; stageResults?: StageResult[] }>("/api/build-games/status")
      .then((data) => {
        setIsParticipant(!!data.isParticipant);
        setStageResults(data.stageResults ?? []);
      })
      .catch(() => {});
  }, [status]);

  return <ProgramTimeline isParticipant={isParticipant} stageResults={stageResults} />;
}
