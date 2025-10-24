"use client";
import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { BadgeCardProps } from "../types/badgeCard";
import { RequirementsPanel } from "./requirement-panel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { StaticMedal } from "./static-metal";
import { AutoRotateMedal } from "./auto-rotate-badge";

const DISC = { radius: 0.92, segments: 90 };

export const RewardCard = ({
  name,
  description,
  className,
  image,
  is_unlocked,
  requirements,
}: BadgeCardProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`w-full max-w-sm mx-auto ${className ?? ""}`}
        style={{ userSelect: "none" }}
      >
        <div
          style={{ width: "100%", height: 300, cursor: "pointer" }}
          onClick={() => setOpen(true)}
          title="details"
        >
          <Canvas
            shadows={false}
            dpr={[1, 2]}
            camera={{ position: [0, 0, 4.1], fov: 45 }}
            frameloop="demand"
            gl={{
              antialias: false,
              alpha: true,
              outputColorSpace: THREE.SRGBColorSpace,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.8,

            }}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={1} />
            <directionalLight position={[2.2, 3, 5]} intensity={1.15} />
            <directionalLight position={[-3, -2, -4]} intensity={0.45} />
            <StaticMedal image={image} is_unlocked={is_unlocked} Disc={DISC} />
          </Canvas>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <VisuallyHidden>
          <DialogTitle>{name ?? "Badge details"}</DialogTitle>
        </VisuallyHidden>
        <DialogContent
          hideCloseButton={true}
          onOpenAutoFocus={(e) => e.preventDefault()} 
          onCloseAutoFocus={(e) => e.preventDefault()}  
          className="max-w-lg w-[360px]  bg-transparent shadow-none border-none  p-0 flex flex-col items-center gap-6"
          style={{ filter: "none", WebkitFilter: "none" }}
        >
          <div style={{ width: "100%", height: 360 }}>
            <Canvas
              dpr={[1, 2]}
              camera={{ position: [0, 0, 4.3], fov: 45 }}
              gl={{
                antialias: true,
                alpha: true,
                outputColorSpace: THREE.SRGBColorSpace,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.0,
              }}
              style={{ background: "transparent" }}
            >
              <ambientLight intensity={0.9} />
              <directionalLight position={[2.5, 3, 5]} intensity={1.2} />
              <directionalLight position={[-3, -2, -4]} intensity={0.5} />
              <AutoRotateMedal
                name={name}
                description={description}
                image={image}
                is_unlocked={is_unlocked}
                speed={0.35}
                Disc={DISC}
              />
            </Canvas>
          </div>

          {requirements && requirements.length > 0 && (
            <div className="w-full">
              <RequirementsPanel requirements={requirements as any} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
