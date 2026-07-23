"use client";

import React, { useMemo } from "react";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";

/**
 * Abstract live-network stage for the hero: one identified hub (Avalanche)
 * and anonymous sovereign L1 nodes on slowly counter-rotating orbits, with
 * red message pulses running the inner spokes. Brand proof lives in the
 * marquee below — this diagram only argues scale and liveness, so the node
 * count is the real P-Chain L1 count, not decoration.
 */

const SIZE = 600;
const C = SIZE / 2;
const RINGS = [
  { radius: 150, share: 0.25, duration: 140, reverse: false },
  { radius: 210, share: 0.33, duration: 180, reverse: true },
  { radius: 265, share: 0.42, duration: 230, reverse: false },
];

interface NodeSpec {
  x: number;
  y: number;
  r: number;
  filled: boolean;
}

function buildRing(count: number, radius: number, seed: number): NodeSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + seed;
    // deterministic jitter — no Math.random, so SSR and client agree; round
    // to 2dp so float→string serialization matches across environments too
    const jitter = ((i * 37 + seed * 101) % 23) - 11;
    const r = radius + jitter;
    return {
      x: Math.round((C + r * Math.cos(angle)) * 100) / 100,
      y: Math.round((C + r * Math.sin(angle)) * 100) / 100,
      r: 2.5 + ((i * 13 + seed * 7) % 3),
      filled: (i * 7 + seed * 3) % 4 === 0,
    };
  });
}

export default function AbstractNetwork({
  l1Count,
  backdrop = false,
}: {
  l1Count: number | null;
  /** Render as a hero backdrop: soft-glow hub instead of the solid disc,
      no label, dimmed orbits — type sits on top of it. */
  backdrop?: boolean;
}) {
  const total = l1Count ?? 60;

  const rings = useMemo(
    () =>
      RINGS.map((ring, ringIndex) => ({
        ...ring,
        nodes: buildRing(Math.max(4, Math.round(total * ring.share)), ring.radius, ringIndex + 1),
      })),
    [total],
  );

  const innerNodes = rings[0].nodes;
  // every other inner node gets a spoke + travelling pulse
  const pulseNodes = innerNodes.filter((_, i) => i % 2 === 0);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={`h-full w-auto max-w-full select-none ${backdrop ? "max-h-[880px] opacity-80" : "max-h-[640px]"}`}
        role="img"
        aria-label={`${total} sovereign L1 networks orbiting the Avalanche primary network`}
      >
        <defs>
          <filter id="v2-hub-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>
        {/* orbit guides */}
        {RINGS.map((ring) => (
          <circle
            key={ring.radius}
            cx={C}
            cy={C}
            r={ring.radius}
            fill="none"
            strokeDasharray="2 7"
            strokeWidth={1}
            className="stroke-zinc-200 dark:stroke-zinc-800"
          />
        ))}

        {/* self-contained keyframes: Tailwind can't see interpolated
            animate-[...] classes, so the orbit animation is plain CSS */}
        <style>{`
          @keyframes v2-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media (prefers-reduced-motion: reduce) { .v2-orbit { animation: none !important; } }
        `}</style>

        {/* rotating orbits */}
        {rings.map((ring, ringIndex) => (
          <g
            key={ring.radius}
            className="v2-orbit"
            style={{
              transformOrigin: `${C}px ${C}px`,
              animation: `v2-orbit ${ring.duration}s linear infinite${ring.reverse ? " reverse" : ""}`,
            }}
          >
            {/* inner ring carries the spokes and message pulses */}
            {ringIndex === 0 &&
              pulseNodes.map((node, i) => (
                <g key={`spoke-${i}`}>
                  <line
                    x1={C}
                    y1={C}
                    x2={node.x}
                    y2={node.y}
                    strokeWidth={1}
                    className="stroke-zinc-200 dark:stroke-zinc-800"
                  />
                  <circle r={2.2} fill="#E6212F">
                    <animateMotion
                      dur={`${3.2 + i * 0.9}s`}
                      begin={`${i * 1.3}s`}
                      repeatCount="indefinite"
                      path={`M ${C} ${C} L ${node.x} ${node.y}`}
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      keyTimes="0;0.1;0.85;1"
                      dur={`${3.2 + i * 0.9}s`}
                      begin={`${i * 1.3}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              ))}

            {ring.nodes.map((node, i) => (
              <circle
                key={i}
                cx={node.x}
                cy={node.y}
                r={node.r}
                strokeWidth={1.25}
                className={
                  node.filled
                    ? "fill-zinc-400 dark:fill-zinc-500"
                    : "fill-white stroke-zinc-400 dark:fill-zinc-950 dark:stroke-zinc-500"
                }
              />
            ))}
          </g>
        ))}

        {/* hub: the one identified network */}
        {backdrop ? (
          <>
            {/* soft glow so the headline can sit directly over the hub */}
            <circle cx={C} cy={C} r={80} fill="#E6212F" opacity={0.3} filter="url(#v2-hub-glow)">
              <animate attributeName="opacity" values="0.3;0.16;0.3" dur="5s" repeatCount="indefinite" />
            </circle>
            <circle cx={C} cy={C} r={5} fill="#E6212F">
              <animate attributeName="opacity" values="1;0.4;1" dur="2.5s" repeatCount="indefinite" />
            </circle>
          </>
        ) : (
          <>
            <circle cx={C} cy={C} r={40} fill="#E6212F">
              <animate attributeName="r" values="40;42;40" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={C}
              cy={C}
              r={52}
              fill="none"
              strokeWidth={1}
              className="stroke-[#E6212F]/40"
            >
              <animate attributeName="r" values="52;60;52" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0.15;0.6" dur="4s" repeatCount="indefinite" />
            </circle>
            {/* CSS fill beats the hardcoded presentation attributes in the logo paths */}
            <AvalancheLogo
              x={C - 19}
              y={C - 17}
              width={38}
              height={34}
              className="[&_path]:fill-white [&_polygon]:fill-white [&_rect]:fill-white"
            />
            <text
              x={C}
              y={C + 78}
              textAnchor="middle"
              fontSize={10}
              letterSpacing={2}
              className="fill-zinc-500 font-mono dark:fill-zinc-400"
            >
              PRIMARY NETWORK
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
