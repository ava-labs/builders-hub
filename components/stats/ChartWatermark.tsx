"use client";

import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import type { WatermarkPosition, WatermarkLayer } from "./image-export/types";

interface ChartWatermarkProps {
  children: React.ReactNode;
  className?: string;
  scale?: "small" | "medium" | "large";
  visible?: boolean;
  opacity?: number;
  position?: WatermarkPosition;
  layer?: WatermarkLayer;
}

// Map position to absolute positioning styles
const getPositionStyles = (position: WatermarkPosition): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
  };

  switch (position) {
    case "top-left":
      return { ...baseStyle, top: "16px", left: "16px", transformOrigin: "top left" };
    case "top-center":
      return { ...baseStyle, top: "16px", left: "50%", transform: "translateX(-50%)", transformOrigin: "top center" };
    case "top-right":
      return { ...baseStyle, top: "16px", right: "16px", transformOrigin: "top right" };
    case "center-left":
      return { ...baseStyle, top: "50%", left: "16px", transform: "translateY(-50%)", transformOrigin: "center left" };
    case "center":
      return { ...baseStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)", transformOrigin: "center" };
    case "center-right":
      return { ...baseStyle, top: "50%", right: "16px", transform: "translateY(-50%)", transformOrigin: "center right" };
    case "bottom-left":
      return { ...baseStyle, bottom: "16px", left: "16px", transformOrigin: "bottom left" };
    case "bottom-center":
      return { ...baseStyle, bottom: "16px", left: "50%", transform: "translateX(-50%)", transformOrigin: "bottom center" };
    case "bottom-right":
      return { ...baseStyle, bottom: "16px", right: "16px", transformOrigin: "bottom right" };
    default:
      return { ...baseStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)", transformOrigin: "center" };
  }
};

export function ChartWatermark({
  children,
  className = "",
  scale = "large",
  visible = true,
  opacity = 0.15,
  position = "center",
  layer = "back",
}: ChartWatermarkProps) {
  // Scale values for different container sizes
  const scaleValues = {
    small: 1,
    medium: 1.5,
    large: 2,
  };

  const scaleTransform = scaleValues[scale];
  const positionStyles = getPositionStyles(position);

  // Combine scale with existing transform
  const combinedTransform = positionStyles.transform
    ? `${positionStyles.transform} scale(${scaleTransform})`
    : `scale(${scaleTransform})`;

  const watermarkZIndex = layer === "front" ? 20 : 0;
  const contentZIndex = layer === "front" ? 10 : 10;

  return (
    <div className="relative w-full h-full">
      {visible && (
        <div
          className="pointer-events-none"
          style={{
            ...positionStyles,
            transform: combinedTransform,
            opacity,
            zIndex: watermarkZIndex,
          }}
        >
          <AvalancheLogo className="size-8" fill="currentColor" />
          <span style={{ fontSize: "large", fontWeight: 500 }}>Builder Hub</span>
        </div>
      )}
      <div className={`relative ${className}`} style={{ zIndex: contentZIndex }}>
        {children}
      </div>
    </div>
  );
}

export default ChartWatermark;