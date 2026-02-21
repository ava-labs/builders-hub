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

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/build-games/status")
      .then((res) => res.json())
      .then((data) => {
        setIsParticipant(!!data.isParticipant);
      })
      .catch(() => {});
  }, [status]);

  return <ProgramTimeline isParticipant={isParticipant} />;
}
