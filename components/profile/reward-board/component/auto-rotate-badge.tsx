"use client";
import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BackFace } from "./back-face";
import { CircularFrame } from "./circular-frame";
import { ImageDisc } from "./image-disc";
export function AutoRotateMedal({
  name,
  description,
  image,
  is_unlocked,
  Disc,
}: {
  name: string;
  description?: string;
  image: string;
  is_unlocked?: boolean;
  Disc: { radius: number; segments: number };
  speed?: number;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const badgeDefaultImage = "/wolfie/wolfie-hack.png";
  const [badgeImage, setBadgeImage] = useState(badgeDefaultImage);

  useEffect(() => {
    if (image && image !== '') {
      setBadgeImage(image);
    }
  }, [image]);

  useFrame((state, delta) => {
    const g = groupRef.current;

    if (!g) return;
    g.rotation.y += delta;
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.25;
  });

  return (
    <group ref={groupRef}>
      <CircularFrame color="#999B9B" />
      <ImageDisc url={badgeImage} isUnlocked={!!is_unlocked} Disc={Disc}  />
      <BackFace name={name} description={description} DISC={Disc} />
    </group>
  );
}
