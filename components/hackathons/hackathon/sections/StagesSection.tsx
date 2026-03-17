"use client"

import { HackathonStage } from "@/types/hackathon-stage";
import { JSX, useState } from "react";
import Stages from "./Stages";

type Props = {
  stages: HackathonStage[];
};

export default function StagesSection({ stages }: Props): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const onStageClick = (index: number): void => {
    setSelectedIndex(index);
  };

  return (
    <Stages />
  );
}