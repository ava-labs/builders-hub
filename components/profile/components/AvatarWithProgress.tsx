"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarWithProgressProps {
  image?: string;
  name?: string;
  profileProgress: number;
  size?: "small" | "large";
  showHover?: boolean;
  onEdit?: () => void;
}

export function AvatarWithProgress({
  image,
  name,
  profileProgress,
  size = "large",
  showHover = false,
  onEdit,
}: AvatarWithProgressProps) {
  // Size configurations
  const sizeConfig = {
    small: {
      container: "h-10 w-10",
      svg: 40,
      center: 20,
      radius: 18,
      avatar: "h-8 w-8",
      textSize: "text-lg",
    },
    large: {
      container: "h-40 w-40",
      svg: 160,
      center: 80,
      radius: 70,
      avatar: "h-32 w-32",
      textSize: "text-3xl",
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
  const uniqueId = `progress-${size}-${profileProgress}`;

  return (
    <div className={`relative ${config.container}`}>
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
        {/* Background circle */}
        <circle
          cx={config.center}
          cy={config.center}
          r={config.radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === "small" ? "2" : "4"}
          className="text-muted opacity-20"
        />
        {/* Progress circle */}
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
      <div className="absolute inset-0 flex items-center justify-center">
        <Avatar className={`${config.avatar} relative z-10`}>
          <AvatarImage
            src={image && image.trim() !== "" ? image : "/images/default_Avatar.svg"}
            alt="Profile"
          />
          <AvatarFallback className={config.textSize}>
            {name?.charAt(0).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

