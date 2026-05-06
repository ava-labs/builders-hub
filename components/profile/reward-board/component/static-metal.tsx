"use client";
import React from "react";
import { CircularFrame } from "./circular-frame";
import { ImageDisc } from "./image-disc";

const BADGE_DEFAULT_IMAGE = "/wolfie/wolfie-hack.png";

export function StaticMedal({
  image,
  is_unlocked,
  Disc,
}: {
  image: string;
  is_unlocked?: boolean;
  Disc: { radius: number; segments: number };
}) {
  const url = image && image !== "" ? image : BADGE_DEFAULT_IMAGE;

  return (
    <group rotation={[0, 0, 0]}>
      <CircularFrame color="#999B9B" />
      <ImageDisc url={url} isUnlocked={!!is_unlocked} Disc={Disc} />
    </group>
  );
}