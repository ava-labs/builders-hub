"use client";

import React from "react";
import { ConnectionStatus, TokenInfo, statusColors } from "@/hooks/useICTTWorkbench";
import { cn } from "@/lib/utils";

interface ConnectionLineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  status: ConnectionStatus;
  token?: TokenInfo;
  onClick?: () => void;
  isSelected?: boolean;
  isDeploying?: boolean;
}

export function ConnectionLine({
  startX,
  startY,
  endX,
  endY,
  status,
  token,
  onClick,
  isSelected = false,
  isDeploying = false,
}: ConnectionLineProps) {
  // Calculate control points for a curved line
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Add some curve based on the distance
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular offset for curve
  const curveFactor = Math.min(distance * 0.15, 50);
  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;

  const controlX = midX + Math.cos(perpAngle) * curveFactor;
  const controlY = midY + Math.sin(perpAngle) * curveFactor;

  // Path for the curved line
  const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

  // Status-based colors
  const getStrokeColor = () => {
    switch (status) {
      case "live":
        return "#22c55e"; // green-500
      case "collateralized":
        return "#a855f7"; // purple-500
      case "registered":
        return "#3b82f6"; // blue-500
      case "remote-deployed":
        return "#f97316"; // orange-500
      case "home-deployed":
        return "#eab308"; // yellow-500
      default:
        return "#71717a"; // zinc-500
    }
  };

  const strokeColor = getStrokeColor();
  const isAnimated = status === "live" || status === "registered";
  const showPulse = isDeploying || (status !== "not-started" && status !== "live");

  // Calculate position for the token label
  const labelX = controlX;
  const labelY = controlY - 10;

  return (
    <g className={cn("cursor-pointer group", onClick && "hover:opacity-80")} onClick={onClick}>
      {/* Glow effect for selected/live connections */}
      {(isSelected || status === "live") && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isSelected ? 12 : 8}
          strokeLinecap="round"
          opacity={0.2}
          className="blur-sm"
        />
      )}

      {/* Pulsing glow for in-progress deployments */}
      {showPulse && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          className="animate-pulse opacity-30"
        />
      )}

      {/* Background line (thicker for click target) */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
      />

      {/* Main connection line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSelected ? 4 : 2.5}
        strokeLinecap="round"
        strokeDasharray={status === "not-started" ? "8,4" : undefined}
        className={cn(
          "transition-all duration-300",
          isSelected && "stroke-[4]"
        )}
      />

      {/* Animated particles for live connections */}
      {isAnimated && (
        <>
          <circle r="3" fill={strokeColor}>
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              path={pathD}
            />
          </circle>
          <circle r="3" fill={strokeColor}>
            <animateMotion
              dur="3s"
              repeatCount="indefinite"
              path={pathD}
              begin="1.5s"
            />
          </circle>
        </>
      )}

      {/* Direction arrows */}
      <defs>
        <marker
          id={`arrow-${status}`}
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L6,3 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* Token label on the line */}
      {token && (
        <g>
          {/* Background pill */}
          <rect
            x={labelX - 20}
            y={labelY - 8}
            width={40}
            height={16}
            rx={8}
            fill="rgba(39, 39, 42, 0.9)"
            stroke={strokeColor}
            strokeWidth={1}
            className="transition-all duration-200"
          />
          {/* Token symbol text */}
          <text
            x={labelX}
            y={labelY + 3}
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="500"
            className="select-none pointer-events-none"
          >
            {token.symbol}
          </text>
        </g>
      )}

      {/* Hover highlight */}
      <path
        d={pathD}
        fill="none"
        stroke="white"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0}
        className="group-hover:opacity-10 transition-opacity duration-200"
      />
    </g>
  );
}

export default ConnectionLine;
