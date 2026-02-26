"use client";
import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { BadgeCardProps } from "../types/badgeCard";
import { RequirementsPanel } from "./requirement-panel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AutoRotateMedal } from "./auto-rotate-badge";
import { Lock, CheckCircle2 } from "lucide-react";

const DISC = { radius: 1.3, segments: 200 };

export const RewardCard = ({
  name,
  description,
  className,
  image,
  is_unlocked,
  isSecret,
  requirements,
}: BadgeCardProps) => {
  const isSecretLocked = isSecret && !is_unlocked;
  const [open, setOpen] = useState(false);

  const imageClass = isSecretLocked
    ? "brightness-0"
    : !is_unlocked
      ? "grayscale opacity-50"
      : "";

  return (
    <>
      <div
        className={`w-full ${className ?? ""}`}
        style={{ userSelect: "none" }}
      >
        <div
          className={`w-full h-[230px] flex items-center justify-center ${isSecretLocked ? "cursor-default" : "cursor-pointer"}`}
          onClick={() => !isSecretLocked && setOpen(true)}
        >
          <div
            className="relative w-[170px] h-[170px] rounded-full overflow-hidden"
            style={{
              border: "3px solid #999B9B",
              background: "#52525B",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image || "/wolfie/wolfie-hack.png"}
              alt={isSecretLocked ? "???" : name}
              className={`w-full h-full object-cover ${imageClass}`}
              loading="lazy"
            />
          </div>
        </div>
        <div className="text-center mt-1 px-2">
          <div className="flex items-center justify-center gap-1.5">
            {is_unlocked ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            )}
            <span className={`text-sm font-medium truncate ${is_unlocked ? "text-gray-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"}`}>
              {isSecretLocked ? "???" : name}
            </span>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <VisuallyHidden>
          <DialogTitle>{name ?? "Badge details"}</DialogTitle>
        </VisuallyHidden>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="max-w-lg bg-transparent shadow-none border-none p-0 flex flex-col items-center"
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
            <div>
              <RequirementsPanel requirements={requirements as any} title={name} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
