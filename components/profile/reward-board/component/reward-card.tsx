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

const DISC = { radius: 1.3, segments: 200 };

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
        className={`w-full ${className ?? ""}`}
        style={{ userSelect: "none" }}
      >
        <div
          className="w-full h-[230px] cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <Canvas

            shadows={false}
            dpr={[1, 2]}
            camera={{ position: [0, 0, 4.1], fov: 45 }}
            frameloop="demand"
            gl={{
              antialias: true,
              alpha: true,
              outputColorSpace: THREE.SRGBColorSpace,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.8,

            }}

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
       
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="max-w-lg   bg-transparent shadow-none border-none  p-0 flex flex-col items-center"
          style={{ filter: "none", WebkitFilter: "none" }}
        >
          <div style={{ width: "100%", height: 250 }}>
            <Canvas
              className="block align-top"
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
            <div >
              <RequirementsPanel requirements={requirements as any} title={name} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
