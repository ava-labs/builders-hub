"use client";
import React, {  } from "react";
import { CircularFrame } from "./circular-frame";
import { ImageDisc } from "./image-disc";


export function StaticMedal({
    image,
    is_unlocked,
    Disc,
  }: {
    image: string;
    is_unlocked?: boolean;
    Disc: { radius: number; segments: number }
  }) {
    return (
      <group rotation={[0,0,0]}>
        <CircularFrame color="#999B9B" />
        <ImageDisc url={image} isUnlocked={!!is_unlocked} Disc={Disc} />
      </group>
    );
  }