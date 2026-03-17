"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const ProgramTimeline = dynamic(() => import("./ProgramTimeline"), {
  ssr: false,
});

export interface StageResult {
  projectName: string;
  stage1Result: string;
}

export default function ProgramTimelineWrapper() {
  const { status } = useSession();
  const [isParticipant, setIsParticipant] = useState(false);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/build-games/status")
      .then((res) => res.json())
      .then((data) => {
        setIsParticipant(!!data.isParticipant);
        setStageResults(data.stageResults ?? []);
      })
      .catch(() => {});
  }, [status]);

  return <ProgramTimeline isParticipant={isParticipant} stageResults={stageResults} />;
}
