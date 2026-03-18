"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DiceBearAvatar, AvatarSeed, AVATAR_OPTIONS } from "./DiceBearAvatar";
import Modal from "@/components/ui/Modal";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/hooks/use-toast";

interface NounAvatarConfigProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentSeed?: AvatarSeed | null;
  nounAvatarEnabled?: boolean;
  onSave: (seed: AvatarSeed, enabled: boolean) => Promise<void>;
}

export function NounAvatarConfig({
  isOpen,
  onOpenChange,
  currentSeed,
  nounAvatarEnabled = false,
  onSave,
}: NounAvatarConfigProps) {
  const [seed, setSeed] = useState<AvatarSeed | null>(currentSeed || null);
  const [enabled, setEnabled] = useState(nounAvatarEnabled);
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Initialize seed if not exists
  useEffect(() => {
    if (isOpen && !seed) {
      // Generate a default seed
      const defaultSeed: AvatarSeed = {
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
      };
      setSeed(defaultSeed);
    }
  }, [isOpen, seed]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSeed(currentSeed || {
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
      });
      setEnabled(nounAvatarEnabled);
    }
  }, [isOpen, currentSeed, nounAvatarEnabled]);

  // Trait adjustment functions
  const adjustTrait = (trait: keyof AvatarSeed, direction: 'prev' | 'next') => {
    if (!seed) return;
    
    const options = AVATAR_OPTIONS[trait];
    const currentValue = seed[trait] || options[0];
    let currentIndex = options.indexOf(currentValue);
    
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
    const currentValue = seed[trait] || options[0];
    let currentIndex = options.indexOf(currentValue);
    
    // If current value is not in options, use first option
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    return {
      current: currentIndex + 1,
      total: options.length,
    };
  };

  // Generate random seed
  const generateRandomSeed = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/user/noun-avatar/generate-seed");
      if (!response.ok) {
        throw new Error("Failed to generate seed");
      }
      const data = await response.json();
      setSeed(data.seed);
      toast({
        title: "New avatar generated!",
        description: "Click 'Save' to apply this avatar.",
      });
    } catch (error) {
      console.error("Error generating seed:", error);
      toast({
        title: "Error",
        description: "Failed to generate new avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate seed from user ID (deterministic)
  const generateDeterministicSeed = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/user/noun-avatar/generate-seed?deterministic=true");
      if (!response.ok) {
        throw new Error("Failed to generate seed");
      }
      const data = await response.json();
      setSeed(data.seed);
      toast({
        title: "Deterministic avatar generated!",
        description: "This avatar will always be the same for your account.",
      });
    } catch (error) {
      console.error("Error generating seed:", error);
      toast({
        title: "Error",
        description: "Failed to generate avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    // Ensure seed is not null before proceeding
    const seedToSave = seed || {
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
    };

    setIsSaving(true);
    try {
      const response = await fetch("/api/user/noun-avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seedToSave, enabled: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save avatar");
      }

      await onSave(seedToSave, true);

      onOpenChange(false);
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

  const renderContent = () => {
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
      <div className="flex flex-col items-center gap-6">
        {/* Avatar Preview - Centered */}
        <div className="flex flex-col items-center justify-center">
          <div className="rounded-lg flex items-center justify-center p-6">
            <DiceBearAvatar seed={seed} size="xlarge" />
          </div>
        </div>

        {/* Trait Controls - 3 Columns */}
        {seed && (
          <div className="grid grid-cols-3 gap-3 w-full max-w-3xl">
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
        )}
      </div>
    );
  };

  const renderFooter = () => {
    return (
      <div className="flex justify-end w-full">
        <LoadingButton
          type="button"
          onClick={handleSave}
          isLoading={isSaving}
          loadingText="Saving..."
          variant="red"
        >
          Save
        </LoadingButton>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Configure Your Avatar"
      description="Generate and customize your unique avatar."
      content={renderContent()}
      footer={renderFooter()}
      className="bg-white dark:bg-zinc-900 text-black dark:text-white  lg:w-[80%] lg:max-w-[600px]"
    />
  );
}

