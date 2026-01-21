"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DiceBearAvatar, AvatarSeed, AVATAR_OPTIONS } from "./DiceBearAvatar";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/hooks/use-toast";

interface NounAvatarEditorProps {
  currentSeed?: AvatarSeed | null;
  nounAvatarEnabled?: boolean;
  onSave: (seed: AvatarSeed, enabled: boolean) => Promise<void>;
}

export function NounAvatarEditor({
  currentSeed,
  nounAvatarEnabled = false,
  onSave,
}: NounAvatarEditorProps) {
  const [seed, setSeed] = useState<AvatarSeed | null>(
    currentSeed || {
      backgroundColor: AVATAR_OPTIONS.backgroundColor[0],
      hair: AVATAR_OPTIONS.hair[0],
      eyes: AVATAR_OPTIONS.eyes[0],
      eyebrows: AVATAR_OPTIONS.eyebrows[0],
      nose: AVATAR_OPTIONS.nose[0],
      mouth: AVATAR_OPTIONS.mouth[0],
      glasses: AVATAR_OPTIONS.glasses[0],
      earrings: AVATAR_OPTIONS.earrings[0],
      beard: AVATAR_OPTIONS.beard[0],
      hairAccessories: AVATAR_OPTIONS.hairAccessories[0],
      freckles: AVATAR_OPTIONS.freckles[0],
    }
  );
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Get max values for each trait
  const maxValues = {
    backgroundColor: AVATAR_OPTIONS.backgroundColor.length,
    hair: AVATAR_OPTIONS.hair.length,
    eyes: AVATAR_OPTIONS.eyes.length,
    eyebrows: AVATAR_OPTIONS.eyebrows.length,
    nose: AVATAR_OPTIONS.nose.length,
    mouth: AVATAR_OPTIONS.mouth.length,
    glasses: AVATAR_OPTIONS.glasses.length,
    earrings: AVATAR_OPTIONS.earrings.length,
    beard: AVATAR_OPTIONS.beard.length,
    hairAccessories: AVATAR_OPTIONS.hairAccessories.length,
    freckles: AVATAR_OPTIONS.freckles.length,
  };

  // Update seed when currentSeed changes
  useEffect(() => {
    if (currentSeed) {
      setSeed(currentSeed);
    }
  }, [currentSeed]);

  // Trait adjustment functions
  const adjustTrait = (trait: keyof AvatarSeed, direction: 'prev' | 'next') => {
    if (!seed) return;
    
    const options = AVATAR_OPTIONS[trait];
    const currentValue = seed[trait];
    let currentIndex = currentValue ? options.indexOf(currentValue) : 0;
    
    // If current value is not in options, use first option
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % options.length;
    } else {
      newIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
    }
    
    setSeed({ ...seed, [trait]: options[newIndex] });
  };

  // Get current position for a trait (1-indexed)
  const getTraitPosition = (trait: keyof AvatarSeed): { current: number; total: number } => {
    if (!seed) return { current: 0, total: 0 };
    
    const options = AVATAR_OPTIONS[trait];
    const currentValue = seed[trait];
    let currentIndex = currentValue ? options.indexOf(currentValue) : 0;
    
    // If current value is not in options, use first option
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    return {
      current: currentIndex + 1,
      total: options.length,
    };
  };

  const handleSave = async () => {
    if (!seed) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/user/noun-avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, enabled: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save avatar");
      }

      await onSave(seed, true);

    } catch (error) {
      console.error("Error saving avatar:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Trait labels
  const traitLabels = {
    hair: "Hair",
    eyes: "Eyes",
    eyebrows: "Eyebrows",
    nose: "Nose",
    mouth: "Mouth",
    glasses: "Glasses",
    earrings: "Earrings",
    beard: "Beard",
    hairAccessories: "Hair Accessories",
    freckles: "Freckles",
    backgroundColor: "Background",
  };

  // Trait order - lorelei style
  const traitOrder: (keyof AvatarSeed)[] = [
    'hair', 'eyes', 'eyebrows', 'nose', 'mouth', 'glasses', 
    'earrings', 'beard', 'hairAccessories', 'freckles', 'backgroundColor'
  ];

  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          My Avatar
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Customize your  Avatar
        </p>
      </div>

      {/* Layout with Trait Controls Grid */}
      <div className="flex flex-col gap-8 mb-6">
        {/* Trait Controls - 3 Columns Grid */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {traitOrder.map((trait) => (
            <div
              key={trait}
              className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-900 dark:border-zinc-700 rounded-lg"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => adjustTrait(trait, 'prev')}
                className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-0"
              >
                <ChevronLeft className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
              </Button>
              
              <div className="flex flex-col items-center flex-1 text-center">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {traitLabels[trait]}
                </span>
                {seed && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    ({getTraitPosition(trait).current}/{getTraitPosition(trait).total})
                  </span>
                )}
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => adjustTrait(trait, 'next')}
                className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-0"
              >
                <ChevronRight className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
              </Button>
            </div>
          ))}
        </div>

        {/* Avatar Preview - Centered Below Controls */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-64 h-64 bg-[#F3F3F3] dark:bg-zinc-800 rounded-lg flex items-center justify-center p-8">
            <DiceBearAvatar seed={seed} size="large" />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <LoadingButton
          type="button"
          onClick={handleSave}
          isLoading={isSaving}
          loadingText="Saving..."
          variant="red"
          className="flex items-center gap-2"
        >
          Save
        </LoadingButton>
      </div>
    </div>
  );
}

