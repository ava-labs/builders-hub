"use client";

import { AvalancheLogo } from "@/components/navigation/avalanche-logo";

interface ChartWatermarkProps {
  children: React.ReactNode;
  className?: string;
}

export function ChartWatermark({ children, className = "" }: ChartWatermarkProps) {
  return (
    <div className="relative">
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{ opacity: 0.15 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", transform: "scale(2)" }}>
          <AvalancheLogo className="size-10" fill="currentColor" />
          <span style={{ fontSize: "x-large", marginTop: "4px", fontWeight: 500 }}>Builder Hub</span>
        </div>
      </div>
      <div className={`relative z-10 ${className}`}>
        {children}
      </div>
    </div>
  );
}

export default ChartWatermark;

