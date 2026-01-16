"use client";
import React, { useEffect, useState } from "react";
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
    const badgeDefaultImage = "/wolfie/wolfie-hack.png";
    const [badgeImage, setBadgeImage] = useState(badgeDefaultImage);

    useEffect(() => {
      if (image && image !== '') {
        setBadgeImage(image);
      }
    }, [image]);

    return (
      <group rotation={[0,0,0]}>
        <CircularFrame color="#999B9B" />
        <ImageDisc url={badgeImage} isUnlocked={!!is_unlocked} Disc={Disc} />
      </group>
    );
  }