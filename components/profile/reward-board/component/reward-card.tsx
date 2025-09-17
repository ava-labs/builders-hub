"use client";
import React, { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { BadgeCardProps } from "../types/badgeCard";
import { BackFace } from "./back-face";
import { CircularFrame } from "./circular-frame";
import { RequirementsPanel } from "./requirement-panel";
import { ImageDisc } from "./image-disc";

const DISC = {
  radius: 0.92, 
  segments: 90,
};
type DragState = { x: number; y: number; rx: number; ry: number } | null;


export const RewardCard = ({
  name,
  description,
  className,
  image,
  is_unlocked,
  requirements,
}: BadgeCardProps) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const dragging = useRef<DragState>(null);
  const [baseRot, setBaseRot] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [, force] = useState(0);

  const sensitivity = 0.008;
  const maxTilt = Math.PI / 5;

  const applyRotation = (g: THREE.Group | null, x: number, y: number) => {
    if (!g) return;
    g.rotation.set(x, y, 0);
  };

  useEffect(() => {
    applyRotation(groupRef.current, baseRot.x, baseRot.y);
  }, [baseRot]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragging.current = {
      x: e.clientX,
      y: e.clientY,
      rx: baseRot.x,
      ry: baseRot.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    const nextY = dragging.current.ry + dx * sensitivity; // yaw
    const nextX = dragging.current.rx - dy * sensitivity; // pitch
    const clampedX = Math.max(-maxTilt, Math.min(maxTilt, nextX));
    setBaseRot({ x: clampedX, y: nextY });
    force((t) => t + 1);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    dragging.current = null;
  };
  const norm = (a: number) =>
    ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const yaw = norm(baseRot.y);
  const backVisible = yaw > Math.PI / 2 && yaw < (3 * Math.PI) / 2;
  const wrapperHeight = 280;
  return (
    <div
      className={`w-full max-w-sm mx-auto mb-0 pb-0 ${className ?? ""}`}
      style={{ userSelect: "none" }}
    >
      <div
        style={{
          width: "100%",
          height: wrapperHeight,
          cursor: dragging.current ? "grabbing" : "grab",
          touchAction: "none",
          filter: "none",
          WebkitFilter: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Canvas
          camera={{ position: [0, 0, 4.1], fov: 45 }}
          gl={{
            antialias: true,
            alpha: true,
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
          }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.85} />
          <directionalLight position={[2.2, 3, 5]} intensity={1.15} />
          <directionalLight position={[-3, -2, -4]} intensity={0.45} />

          <group
            ref={(node) => {
              groupRef.current = node;
              if (node) applyRotation(node, baseRot.x, baseRot.y);
            }}
          >
            <CircularFrame color="#999B9B" />
            <ImageDisc url={image} isUnlocked={!!is_unlocked} Disc={DISC}/>
            {backVisible && (
              <BackFace name={name} description={description} DISC={DISC} />
            )}
          </group>
        </Canvas>
      </div>

      {requirements && requirements.length > 0 && (
        <>
          <RequirementsPanel requirements={requirements as any} />
        </>
      )}
    </div>
  );
};
