"use client"

import { HackathonStage } from "@/types/hackathon-stage";
import { JSX, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Stages from "./Stages";
import { HackathonHeader } from "@/types/hackathons";

type Props = {
  stages: HackathonStage[];
  hackathon: HackathonHeader;
  renderInPreview?: boolean
};

export default function StagesSection({ stages, hackathon, renderInPreview }: Props): JSX.Element {
  const { status, data: session } = useSession();
  const [isParticipant, setIsParticipant] = useState(false);
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/build-games/status")
      .then((res) => res.json())
      .then((data) => {
        setIsParticipant(!!data.isParticipant);
      })
      .catch(() => { });
  }, [status]);
  return (
    <Stages stages={stages} isParticipant={isParticipant} hackathon={hackathon} renderInPreview={renderInPreview} />
  );
}