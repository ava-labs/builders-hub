"use client";

import React from "react";
import { motion, MotionValue, useTransform } from "framer-motion";

/**
 * Scroll-assembled diagram of a sovereign L1: core chain appears first,
 * validator nodes populate a ring, then a boundary seals around the set.
 * All timing is expressed as ranges over the parent section's scroll
 * progress (0..1) so the assembly stays locked to the pinned viewport.
 */

const SIZE = 480;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RING_R = 128;
const BOUNDARY_R = 196;
const VALIDATOR_COUNT = 8;

function polar(i: number, n: number, r: number) {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function ValidatorNode({
  progress,
  index,
  staticMode,
}: {
  progress: MotionValue<number>;
  index: number;
  staticMode: boolean;
}) {
  const { x, y } = polar(index, VALIDATOR_COUNT, RING_R);
  const start = 0.36 + index * 0.026;
  const opacity = useTransform(progress, [start, start + 0.05], [0, 1]);

  return (
    <motion.g style={staticMode ? undefined : { opacity }}>
      {/* spoke to core */}
      <line
        x1={CX}
        y1={CY}
        x2={x}
        y2={y}
        className="stroke-zinc-300 dark:stroke-zinc-700"
        strokeWidth={1}
      />
      <circle
        cx={x}
        cy={y}
        r={11}
        className="fill-white dark:fill-zinc-950 stroke-zinc-400 dark:stroke-zinc-500"
        strokeWidth={1.25}
      />
      <circle cx={x} cy={y} r={3} className="fill-zinc-500 dark:fill-zinc-400" />
    </motion.g>
  );
}

export default function L1Assembly({
  progress,
  staticMode = false,
}: {
  progress: MotionValue<number>;
  staticMode?: boolean;
}) {
  // Beat 1 — the chain core
  const coreOpacity = useTransform(progress, [0.04, 0.12], [0, 1]);

  // Beat 2 — dimension callout lands after the validator ring populates
  const dimensionOpacity = useTransform(progress, [0.56, 0.62], [0, 1]);

  // Beat 3 — the boundary seals
  const boundaryPath = useTransform(progress, [0.68, 0.9], [0, 1]);
  const boundaryOpacity = useTransform(progress, [0.66, 0.7], [0, 1]);
  const boundaryLabelOpacity = useTransform(progress, [0.9, 0.96], [0, 1]);
  const guideOpacity = useTransform(progress, [0.34, 0.4], [0, 1]);

  // Radial dimension line, drawn between node spokes (22.5° off-axis)
  const dimAngle = -Math.PI / 2 + Math.PI / 8;
  const dimStart = { x: CX + 40 * Math.cos(dimAngle), y: CY + 40 * Math.sin(dimAngle) };
  const dimEnd = { x: CX + RING_R * Math.cos(dimAngle), y: CY + RING_R * Math.sin(dimAngle) };
  const dimLabel = { x: CX + (RING_R + 34) * Math.cos(dimAngle), y: CY + (RING_R + 34) * Math.sin(dimAngle) };

  const s = (mv: MotionValue<number>) => (staticMode ? undefined : mv);

  return (
    <div className="relative w-full max-w-[480px] mx-auto select-none">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto"
        role="img"
        aria-label="Diagram of a sovereign L1: a chain core, its validator set, and a sealed network boundary"
      >
        {/* drafting crosshair at the sheet origin */}
        <motion.g className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} style={{ opacity: s(coreOpacity) }}>
          <line x1={CX - 52} y1={CY} x2={CX - 44} y2={CY} />
          <line x1={CX + 44} y1={CY} x2={CX + 52} y2={CY} />
          <line x1={CX} y1={CY - 52} x2={CX} y2={CY - 44} />
          <line x1={CX} y1={CY + 44} x2={CX} y2={CY + 52} />
        </motion.g>

        {/* faint guide ring for the validator orbit */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={RING_R}
          fill="none"
          strokeDasharray="2 6"
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth={1}
          style={{ opacity: s(guideOpacity) }}
        />

        {/* radial dimension callout — the drawing gets measured */}
        <motion.g style={{ opacity: s(dimensionOpacity) }}>
          <line
            x1={dimStart.x}
            y1={dimStart.y}
            x2={dimEnd.x}
            y2={dimEnd.y}
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth={1}
          />
          <circle cx={dimEnd.x} cy={dimEnd.y} r={2} className="fill-zinc-400 dark:fill-zinc-500" />
          <text
            x={dimLabel.x}
            y={dimLabel.y}
            textAnchor="middle"
            className="fill-zinc-500 dark:fill-zinc-400 font-mono"
            fontSize={9}
            letterSpacing={1.5}
          >
            8 VALIDATORS
          </text>
          <text
            x={dimLabel.x}
            y={dimLabel.y + 13}
            textAnchor="middle"
            className="fill-zinc-400 dark:fill-zinc-500 font-mono"
            fontSize={9}
            letterSpacing={1.5}
          >
            EQUAL WEIGHT
          </text>
        </motion.g>

        {/* validator set */}
        {Array.from({ length: VALIDATOR_COUNT }, (_, i) => (
          <ValidatorNode key={i} progress={progress} index={i} staticMode={staticMode} />
        ))}

        {/* chain core */}
        <motion.g style={staticMode ? undefined : { opacity: coreOpacity }}>
          <circle
            cx={CX}
            cy={CY}
            r={34}
            className="fill-white dark:fill-zinc-950 stroke-zinc-900 dark:stroke-zinc-100"
            strokeWidth={1.5}
          />
          <circle cx={CX} cy={CY} r={5} fill="#E6212F">
            <animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </motion.g>

        {/* boundary: drawn stroke seals the network */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={BOUNDARY_R}
          fill="none"
          className="stroke-zinc-900 dark:stroke-zinc-100"
          strokeWidth={1.5}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`}
          style={
            staticMode ? undefined : { pathLength: boundaryPath, opacity: boundaryOpacity }
          }
        />
      </svg>

      {/* core label sits under the diagram in the document, over it visually */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={staticMode ? undefined : { opacity: coreOpacity }}
      >
        <span className="mt-24 font-mono text-[10px] tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          YOUR L1
        </span>
      </motion.div>

      {/* boundary modes */}
      <motion.div
        className="mt-6 flex items-center justify-center gap-6 font-mono text-[10px] tracking-[0.18em]"
        style={staticMode ? undefined : { opacity: boundaryLabelOpacity }}
      >
        <span className="text-zinc-400 dark:text-zinc-500">PUBLIC</span>
        <span className="text-zinc-400 dark:text-zinc-500">PERMISSIONED</span>
        <span className="text-zinc-900 dark:text-zinc-100 border-b border-[#E6212F] pb-0.5">
          PRIVATE
        </span>
      </motion.div>

      {/* drawing title block */}
      <motion.div
        className="absolute bottom-10 right-0 border border-zinc-300 font-mono text-[9px] leading-none tracking-[0.14em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        style={staticMode ? undefined : { opacity: coreOpacity }}
      >
        {[
          ["DWG", "SOVEREIGN L1"],
          ["SCALE", "1 : 1"],
          ["REV", "MAINNET"],
        ].map(([k, v]) => (
          <div key={k} className="flex divide-x divide-zinc-300 border-b border-zinc-300 last:border-b-0 dark:divide-zinc-700 dark:border-zinc-700">
            <span className="w-14 px-2 py-1.5">{k}</span>
            <span className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300">{v}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
