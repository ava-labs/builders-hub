"use client";

import { AvalancheLogo } from "@/components/navigation/avalanche-logo";

interface ChartWatermarkProps {
  children: React.ReactNode;
  className?: string;
  scale?: "small" | "medium" | "large";
  visible?: boolean;
  opacity?: number;
}

export function ChartWatermark({
  children,
  className = "",
  scale = "large",
  visible = true,
  opacity = 0.15,
}: ChartWatermarkProps) {
  // Scale values for different container sizes
  const scaleValues = {
    small: 1,
    medium: 1.5,
    large: 2,
  };

  const scaleTransform = scaleValues[scale];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {visible && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ opacity }}
        >
          <div
            className="flex items-center gap-2 whitespace-nowrap"
            style={{ transform: `scale(${scaleTransform})` }}
          >
            <AvalancheLogo className="size-8" fill="currentColor" />
            <span style={{ fontSize: "large", fontWeight: 500 }}>Builder Hub</span>
          </div>
        </div>
      )}
      <div className={`relative z-10 ${className}`}>
        {children}
      </div>
    </div>
  );
}

export default ChartWatermark;