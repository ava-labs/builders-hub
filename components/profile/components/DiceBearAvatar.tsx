"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';

export interface AvatarSeed {
  backgroundColor?: string;
  hair?: string;
  eyes?: string;
  eyebrows?: string;
  nose?: string;
  mouth?: string;
  glasses?: string;
  earrings?: string;
  beard?: string;
  hairAccessories?: string;
  freckles?: string;
}

// Helper function to normalize seed with defaults
export function normalizeAvatarSeed(seed: AvatarSeed | null | undefined): AvatarSeed {
  if (!seed) {
    return {
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
  }
  
  return {
    backgroundColor: seed.backgroundColor || AVATAR_OPTIONS.backgroundColor[0],
    hair: seed.hair || AVATAR_OPTIONS.hair[0],
    eyes: seed.eyes || AVATAR_OPTIONS.eyes[0],
    eyebrows: seed.eyebrows || AVATAR_OPTIONS.eyebrows[0],
    nose: seed.nose || AVATAR_OPTIONS.nose[0],
    mouth: seed.mouth || AVATAR_OPTIONS.mouth[0],
    glasses: seed.glasses || AVATAR_OPTIONS.glasses[0],
    earrings: seed.earrings || AVATAR_OPTIONS.earrings[0],
    beard: seed.beard || AVATAR_OPTIONS.beard[0],
    hairAccessories: seed.hairAccessories || AVATAR_OPTIONS.hairAccessories[0],
    freckles: seed.freckles || AVATAR_OPTIONS.freckles[0],
  };
}

interface DiceBearAvatarProps {
  seed?: AvatarSeed | null;
  size?: "small" | "large" | "xlarge";
  className?: string;
  name?: string;
  profileProgress?: number;
  showProgress?: boolean;
}

// Available options for each trait (lorelei style)
export const AVATAR_OPTIONS = {
  backgroundColor: [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
    'a8e6cf', 'ffd3b6', 'ffaaa5', 'ff8b94', 'c9c9ff'
  ],
  hair: [
    'variant01', 'variant02', 'variant03', 'variant04', 'variant05',
    'variant06', 'variant07', 'variant08', 'variant09', 'variant10',
    'variant11', 'variant12', 'variant13', 'variant14', 'variant15',
    'variant16', 'variant17', 'variant18', 'variant19', 'variant20',
    'variant21', 'variant22', 'variant23', 'variant24', 'variant25',
    'variant26', 'variant27', 'variant28', 'variant29', 'variant30',
    'variant31', 'variant32', 'variant33', 'variant34', 'variant35',
    'variant36', 'variant37', 'variant38', 'variant39', 'variant40',
    'variant41', 'variant42', 'variant43', 'variant44', 'variant45',
    'variant46', 'variant47', 'variant48'
  ],
  eyes: [
    'variant01', 'variant02', 'variant03', 'variant04', 'variant05',
    'variant06', 'variant07', 'variant08', 'variant09', 'variant10',
    'variant11', 'variant12', 'variant13', 'variant14', 'variant15',
    'variant16', 'variant17', 'variant18', 'variant19', 'variant20',
    'variant21', 'variant22', 'variant23', 'variant24'
  ],
  eyebrows: [
    'variant01', 'variant02', 'variant03', 'variant04', 'variant05',
    'variant06', 'variant07', 'variant08', 'variant09', 'variant10',
    'variant11', 'variant12', 'variant13'
  ],
  nose: [
    'variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06'
  ],
  mouth: [
    'happy01', 'happy02', 'happy03', 'happy04', 'happy05',
    'happy06', 'happy07', 'happy08', 'happy09', 'happy10',
    'happy11', 'happy12', 'happy13', 'happy14', 'happy15',
    'happy16', 'happy17', 'happy18',
    'sad01', 'sad02', 'sad03', 'sad04', 'sad05',
    'sad06', 'sad07', 'sad08', 'sad09'
  ],
  glasses: [
    'none', 'variant01', 'variant02', 'variant03', 'variant04', 'variant05'
  ],
  earrings: [
    'none', 'variant01', 'variant02', 'variant03'
  ],
  beard: [
    'none', 'variant01', 'variant02'
  ],
  hairAccessories: [
    'none', 'flowers'
  ],
  freckles: [
    'none', 'variant01'
  ],
};

export function DiceBearAvatar({
  seed,
  size = "large",
  className = "",
  name,
  profileProgress = 0,
  showProgress = false,
}: DiceBearAvatarProps) {
  const [svgDataUri, setSvgDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Size configurations
  const sizeConfig = {
    small: {
      container: "h-10 w-10",
      avatar: "h-12 w-12",
      textSize: "text-lg",
      svg: 40,
      center: 20,
      radius: 18,
    },
    large: {
      container: "h-40 w-40",
      avatar: "h-32 w-32",
      textSize: "text-3xl",
      svg: 160,
      center: 80,
      radius: 70,
    },
    xlarge: {
      container: "h-60 w-80",
      avatar: "h-60 w-60",
      textSize: "text-5xl",
      svg: 256,
      center: 128,
      radius: 110,
    },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (profileProgress / 100) * circumference;

  // Get progress color based on percentage
  const getProgressColor = () => {
    if (profileProgress < 40) {
      return {
        gradientStart: "#ef4444",
        gradientEnd: "#dc2626",
        shadowColor: "rgba(239, 68, 68, 0.3)",
      };
    } else if (profileProgress <= 80) {
      return {
        gradientStart: "#FCD34D",
        gradientEnd: "#FBBF24",
        shadowColor: "rgba(252, 211, 77, 0.3)",
      };
    } else {
      return {
        gradientStart: "#4D7C0F",
        gradientEnd: "#65A30D",
        shadowColor: "rgba(77, 124, 15, 0.3)",
      };
    }
  };

  const progressColor = getProgressColor();
  const uniqueId = `avatar-progress-${size}-${profileProgress}`;

  useEffect(() => {
    if (!seed) {
      setIsLoading(false);
      return;
    }

    try {
      // Normalize seed to ensure all properties are present
      const normalizedSeed = normalizeAvatarSeed(seed);
      
      // Create avatar with specific options
      // Note: backgroundColor should be passed without # symbol (just hex string)
      const bgColor = normalizedSeed.backgroundColor || AVATAR_OPTIONS.backgroundColor[0];
      const bgColorValue = bgColor.startsWith('#') ? bgColor.slice(1) : bgColor;
      
      // Build avatar options - handle 'none' for optional accessories
      const glassesValue = normalizedSeed.glasses || AVATAR_OPTIONS.glasses[0];
      const earringsValue = normalizedSeed.earrings || AVATAR_OPTIONS.earrings[0];
      const beardValue = normalizedSeed.beard || AVATAR_OPTIONS.beard[0];
      const hairAccessoriesValue = normalizedSeed.hairAccessories || AVATAR_OPTIONS.hairAccessories[0];
      const frecklesValue = normalizedSeed.freckles || AVATAR_OPTIONS.freckles[0];
      
      const avatarOptions: any = {
        size: config.svg,
        backgroundColor: [bgColorValue],
        hair: [normalizedSeed.hair || AVATAR_OPTIONS.hair[0]],
        eyes: [normalizedSeed.eyes || AVATAR_OPTIONS.eyes[0]],
        eyebrows: [normalizedSeed.eyebrows || AVATAR_OPTIONS.eyebrows[0]],
        nose: [normalizedSeed.nose || AVATAR_OPTIONS.nose[0]],
        mouth: [normalizedSeed.mouth || AVATAR_OPTIONS.mouth[0]],
      };
      
      // Add optional accessories only if not 'none'
      if (glassesValue !== 'none') {
        avatarOptions.glasses = [glassesValue];
        avatarOptions.glassesProbability = 100;
      } else {
        avatarOptions.glassesProbability = 0;
      }
      
      if (earringsValue !== 'none') {
        avatarOptions.earrings = [earringsValue];
        avatarOptions.earringsProbability = 100;
      } else {
        avatarOptions.earringsProbability = 0;
      }
      
      if (beardValue !== 'none') {
        avatarOptions.beard = [beardValue];
        avatarOptions.beardProbability = 100;
      } else {
        avatarOptions.beardProbability = 0;
      }
      
      if (hairAccessoriesValue !== 'none') {
        avatarOptions.hairAccessories = [hairAccessoriesValue];
        avatarOptions.hairAccessoriesProbability = 100;
      } else {
        avatarOptions.hairAccessoriesProbability = 0;
      }
      
      if (frecklesValue !== 'none') {
        avatarOptions.freckles = [frecklesValue];
        avatarOptions.frecklesProbability = 100;
      } else {
        avatarOptions.frecklesProbability = 0;
      }

      const avatar = createAvatar(lorelei, avatarOptions);

      // Convert to SVG string and then to data URI
      // Using encodeURIComponent instead of btoa to handle Unicode characters
      const svg = avatar.toString();
      const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      setSvgDataUri(dataUri);
      setIsLoading(false);
    } catch (error) {
      console.error("Error generating DiceBear avatar:", error);
      console.error("Avatar options used:", {
        backgroundColor: seed?.backgroundColor,
        hair: seed?.hair,
        eyes: seed?.eyes,
      });
      setIsLoading(false);
    }
  }, [seed, config.svg]);

  // If no seed or loading, show fallback
  if (!seed || isLoading) {
    return (
      <div className={`relative ${config.container} ${className}`}>
        {showProgress && (
          <svg
            className="absolute inset-0 rotate-180 transform"
            width={config.svg}
            height={config.svg}
          >
            <defs>
              <linearGradient id={`gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={progressColor.gradientStart} stopOpacity="1" />
                <stop offset="100%" stopColor={progressColor.gradientEnd} stopOpacity="1" />
              </linearGradient>
              <filter id={`shadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
                <feOffset dx="0" dy="0" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <circle
              cx={config.center}
              cy={config.center}
              r={config.radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={size === "small" ? "2" : size === "large" ? "4" : "6"}
              className="text-muted opacity-20"
            />
            <circle
              cx={config.center}
              cy={config.center}
              r={config.radius}
              fill="none"
              stroke={`url(#gradient-${uniqueId})`}
              strokeWidth={size === "small" ? "3" : size === "large" ? "6" : "8"}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#shadow-${uniqueId})`}
              className="transition-all duration-500 ease-out"
              style={{
                filter: `drop-shadow(0 2px 4px ${progressColor.shadowColor})`
              }}
            />
          </svg>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar className={`${config.avatar} relative z-10`}>
            <AvatarFallback className={config.textSize}>
              {name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${config.container} ${className}`}>
      {showProgress && (
        <svg
          className="absolute inset-0 rotate-180 transform"
          width={config.svg}
          height={config.svg}
        >
          <defs>
            <linearGradient id={`gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={progressColor.gradientStart} stopOpacity="1" />
              <stop offset="100%" stopColor={progressColor.gradientEnd} stopOpacity="1" />
            </linearGradient>
            <filter id={`shadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
              <feOffset dx="0" dy="0" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={config.center}
            cy={config.center}
            r={config.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={size === "small" ? "2" : "4"}
            className="text-muted opacity-20"
          />
          <circle
            cx={config.center}
            cy={config.center}
            r={config.radius}
            fill="none"
            stroke={`url(#gradient-${uniqueId})`}
            strokeWidth={size === "small" ? "3" : "6"}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#shadow-${uniqueId})`}
            className="transition-all duration-500 ease-out"
            style={{
              filter: `drop-shadow(0 2px 4px ${progressColor.shadowColor})`
            }}
          />
        </svg>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <Avatar className={`${config.avatar} relative z-10`}>
          {svgDataUri ? (
            <AvatarImage src={svgDataUri} alt="Avatar" />
          ) : (
            <AvatarFallback className={config.textSize}>
              {name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          )}
        </Avatar>
      </div>
    </div>
  );
}



