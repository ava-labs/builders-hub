"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, useTexture,Text  } from "@react-three/drei";
import * as THREE from "three";
import type { BadgeCardProps } from "../types/badgeCard";
import { BackFaceText } from "./back-face";

// ===== Tamaños afinados para "medalla" =====
const FRAME = {
  majorRadius: 1.0, // radio del aro
  tubeRadius: 0.1, // grosor del aro
  tubularSegments: 80,
  radialSegments: 26,
};
const DISC = {
  radius: 0.92, // radio del disco (imagen)
  segments: 96,
};
type DragState = { x: number; y: number; rx: number; ry: number } | null;

// ---------- Frontal: imagen circular ----------
function ImageDisc({ url, isUnlocked }: { url: string; isUnlocked: boolean }) {
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return (
    <mesh position={[0, 0, 0.01]}>
      <circleGeometry args={[DISC.radius, DISC.segments]} />
      <meshPhysicalMaterial
        map={texture}
        roughness={0.65}
        metalness={0.0}
        clearcoat={0.05}
        clearcoatRoughness={0.6}
        transparent={false}
        color={isUnlocked ? 0xffffff : 0x9e9e9e}
        toneMapped
      />
    </mesh>
  );
}

// ---------- Aro con grosor ----------
function CircularFrame({ color = "#999B9B" }: { color?: string }) {
  return (
    <mesh>
      <torusGeometry
        args={[
          FRAME.majorRadius,
          FRAME.tubeRadius,
          FRAME.radialSegments,
          FRAME.tubularSegments,
        ]}
      />
      <meshPhysicalMaterial
        roughness={0.35}
        metalness={0.85}
        envMapIntensity={1.0}
        color={color}
        clearcoat={0.6}
        clearcoatRoughness={0.25}
      />
    </mesh>
  );
}
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
  const [baseRot, setBaseRot] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [_, force] = useState(0);

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
    dragging.current = { x: e.clientX, y: e.clientY, rx: baseRot.x, ry: baseRot.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    const nextY = dragging.current.ry + dx * sensitivity;
    const nextX = dragging.current.rx - dy * sensitivity;
    const clampedX = Math.max(-maxTilt, Math.min(maxTilt, nextX));
    setBaseRot({ x: clampedX, y: nextY });
    force((t) => t + 1);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    dragging.current = null;
  };
  
  const wrapperHeight = 320;

  return (
    <div className={`w-full max-w-sm mx-auto ${className ?? ""}`} style={{ userSelect: "none" }}>
      <div
        style={{
          width: "100%",
          height: wrapperHeight,
          cursor: dragging.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Canvas
          camera={{ position: [0, 0, 4.1], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
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
            {/* Frente: disco con imagen */}
            <ImageDisc url={image} isUnlocked={!!is_unlocked} />

   
          </group>
        </Canvas>
      </div>
    </div>
  );
};
