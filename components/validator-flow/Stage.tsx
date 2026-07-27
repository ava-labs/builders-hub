"use client";

import { motion } from "framer-motion";
import type { FlowDefinition } from "./data/types";
import { padStep } from "./format";
import {
  routeBetween,
  type RoutePoints,
  type StageLayout,
} from "./stage-layouts";
import { MessageToken } from "./MessageToken";
import { StageActor } from "./StageActor";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Stage({
  flow,
  stepIndex,
  layout,
  reducedMotion,
  className,
}: {
  flow: FlowDefinition;
  stepIndex: number;
  layout: StageLayout;
  reducedMotion: boolean;
  className: string;
}) {
  const step = flow.steps[stepIndex];
  const travel = step.travel;
  const route = travel ? routeBetween(layout, travel.from, travel.to) : null;
  const history = flow.steps
    .slice(0, stepIndex)
    .map((pastStep, index) =>
      pastStep.travel
        ? { index, route: routeBetween(layout, pastStep.travel.from, pastStep.travel.to) }
        : null,
    )
    .filter((entry): entry is { index: number; route: RoutePoints } => entry !== null);

  return (
    <svg
      viewBox={`0 ${layout.topCrop ?? 0} ${layout.viewBox.w} ${layout.viewBox.h - (layout.topCrop ?? 0)}`}
      className={className}
      role="img"
      aria-label={`${flow.title}. Step ${stepIndex + 1} of ${flow.steps.length}: ${step.title}`}
    >
      <defs>
        <marker
          id="vf2-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-[#E6212F]" />
        </marker>
        <marker
          id="vf2-arrow-past"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-zinc-300 dark:fill-zinc-700" />
        </marker>
      </defs>

      {layout.ruleXs.map((x) => (
        <line
          key={x}
          x1={x}
          y1={layout.topCrop ?? 0}
          x2={x}
          y2={layout.viewBox.h}
          strokeWidth={1}
          className="stroke-zinc-100 dark:stroke-zinc-900"
        />
      ))}

      {layout.zones.map((zone) => (
        <g key={zone.label}>
          <rect
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            strokeWidth={1}
            strokeDasharray={zone.kind === "pchain" ? "2 6" : undefined}
            style={zone.kind === "pchain" ? { fill: "rgba(162, 175, 178, 0.05)" } : undefined}
            className={
              zone.kind === "pchain"
                ? "stroke-[#A2AFB2] dark:stroke-[#3d4a4e]"
                : "fill-none stroke-zinc-300 dark:stroke-zinc-700"
            }
          />
          <text
            x={zone.x + 12}
            y={zone.y + 22}
            letterSpacing="2"
            className={
              zone.kind === "pchain"
                ? "fill-[#7c8b8f] font-mono text-[11px] uppercase dark:fill-[#8fa0a4]"
                : "fill-zinc-400 font-mono text-[11px] uppercase dark:fill-zinc-500"
            }
          >
            {zone.label}
          </text>
        </g>
      ))}

      {layout.dimension ? (
        <g>
          <line
            x1={layout.dimension.x0}
            y1={layout.dimension.y}
            x2={layout.dimension.x1}
            y2={layout.dimension.y}
            strokeWidth={1}
            className="stroke-zinc-300 dark:stroke-zinc-700"
          />
          <line
            x1={layout.dimension.x0}
            y1={layout.dimension.y - 4}
            x2={layout.dimension.x0}
            y2={layout.dimension.y + 4}
            strokeWidth={1}
            className="stroke-zinc-300 dark:stroke-zinc-700"
          />
          <line
            x1={layout.dimension.x1}
            y1={layout.dimension.y - 4}
            x2={layout.dimension.x1}
            y2={layout.dimension.y + 4}
            strokeWidth={1}
            className="stroke-zinc-300 dark:stroke-zinc-700"
          />
          <text
            x={(layout.dimension.x0 + layout.dimension.x1) / 2}
            y={layout.dimension.y - 6}
            textAnchor="middle"
            letterSpacing="1.5"
            className="fill-zinc-400 font-mono text-[8.5px] uppercase dark:fill-zinc-600"
          >
            {layout.dimension.label}
          </text>
        </g>
      ) : null}

      {history.map((entry) => (
        <path
          key={entry.index}
          d={`M ${entry.route.x0} ${entry.route.y0} Q ${entry.route.xm} ${entry.route.ym} ${entry.route.x1} ${entry.route.y1}`}
          fill="none"
          strokeWidth={1.2}
          markerEnd="url(#vf2-arrow-past)"
          className="stroke-zinc-300 dark:stroke-zinc-700"
        />
      ))}

      {route ? (
        <motion.path
          key={step.id}
          d={`M ${route.x0} ${route.y0} Q ${route.xm} ${route.ym} ${route.x1} ${route.y1}`}
          fill="none"
          strokeWidth={1.6}
          markerEnd="url(#vf2-arrow)"
          className="stroke-[#E6212F]"
          initial={{ pathLength: reducedMotion ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        />
      ) : null}

      {flow.actors.map((actor) => (
        <StageActor
          key={actor.id}
          actor={actor}
          pos={layout.actors[actor.id]}
          active={step.activeActors.includes(actor.id)}
        />
      ))}

      <MessageToken
        stepId={step.id}
        travel={travel}
        route={route}
        reducedMotion={reducedMotion}
      />

      {layout.ruleXs.length > 0 ? (
        <text
          x={40}
          y={layout.viewBox.h - 12}
          letterSpacing="1.5"
          className="fill-zinc-400 font-mono text-[7.5px] uppercase dark:fill-zinc-600"
        >
          DWG {flow.id.toUpperCase()} {"·"} SHEET {padStep(stepIndex + 1)} / {padStep(flow.steps.length)} {"·"} REV V2.0
        </text>
      ) : null}
    </svg>
  );
}
