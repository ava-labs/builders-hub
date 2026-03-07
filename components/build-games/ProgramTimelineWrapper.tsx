"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const ProgramTimeline = dynamic(() => import("./ProgramTimeline"), {
  ssr: false,
});

export default function ProgramTimelineWrapper() {
  const { status } = useSession();
  const [isParticipant, setIsParticipant] = useState(false);
  const [stage1Result, setStage1Result] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/build-games/status")
      .then((res) => res.json())
      .then((data) => {
        setIsParticipant(!!data.isParticipant);
        setStage1Result(data.stage1Result ?? null);
        setProjectName(data.participant?.projectName ?? null);
      })
      .catch(() => {});
  }, [status]);

  return <ProgramTimeline isParticipant={isParticipant} stage1Result={stage1Result} projectName={projectName} />;
}
