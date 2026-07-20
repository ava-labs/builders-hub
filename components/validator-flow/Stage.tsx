"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { FlowDefinition, FlowStep, MessageKind } from "./data/types";
import { routeBetween, type StageLayout } from "./stage-layouts";
import { StageActor } from "./StageActor";

const KIND_CLASS: Record<MessageKind, string> = {
  "warp-l1-sourced": "fill-red-500",
  "warp-pchain-sourced": "fill-purple-500",
  "evm-tx": "fill-blue-500",
  "pchain-tx": "fill-emerald-600",
  signatures: "fill-amber-500",
};

const STROKE_CLASS: Record<MessageKind, string> = {
  "warp-l1-sourced": "stroke-red-500",
  "warp-pchain-sourced": "stroke-purple-500",
  "evm-tx": "stroke-blue-500",
  "pchain-tx": "stroke-emerald-600",
  signatures: "stroke-amber-500",
};

const MESSAGE_KINDS = Object.keys(KIND_CLASS) as readonly MessageKind[];

export function Stage({
  flow,
  step,
  layout,
  reducedMotion,
}: {
  flow: FlowDefinition;
  step: FlowStep;
  layout: StageLayout;
  reducedMotion: boolean;
}) {
  const travel = step.travel;
  const route = travel ? routeBetween(layout, travel.from, travel.to) : null;
  return (
    <svg
      viewBox={`0 0 ${layout.viewBox.w} ${layout.viewBox.h}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label={`${flow.title}. ${step.title}`}
    >
      <defs>
        <marker
          id="vf-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-zinc-300 dark:fill-zinc-600" />
        </marker>
        {MESSAGE_KINDS.map((kind) => (
          <marker
            key={kind}
            id={`vf-arrow-${kind}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={KIND_CLASS[kind]} />
          </marker>
        ))}
      </defs>
      {layout.zones.map((zone) => (
        <g key={zone.label}>
          <rect
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            rx={16}
            strokeDasharray="6 6"
            className="fill-zinc-100/70 stroke-zinc-200 dark:fill-zinc-800/40 dark:stroke-zinc-700"
          />
          <text
            x={zone.x + 14}
            y={zone.y + 24}
            className="fill-zinc-400 text-[12px] font-medium uppercase tracking-wide dark:fill-zinc-500"
          >
            {zone.label}
          </text>
        </g>
      ))}
      {flow.steps
        .filter((s) => s.travel)
        .map((s) => {
          const r = routeBetween(layout, s.travel!.from, s.travel!.to);
          const active = s.id === step.id;
          return (
            <path
              key={s.id}
              d={`M ${r.x0} ${r.y0} Q ${r.xm} ${r.ym} ${r.x1} ${r.y1}`}
              fill="none"
              strokeWidth={active ? 2.5 : 1.25}
              markerEnd={
                active ? `url(#vf-arrow-${s.travel!.kind})` : "url(#vf-arrow)"
              }
              className={
                active
                  ? STROKE_CLASS[s.travel!.kind]
                  : "stroke-zinc-200 opacity-60 dark:stroke-zinc-700"
              }
            />
          );
        })}
      {flow.actors.map((actor) => (
        <StageActor
          key={actor.id}
          actor={actor}
          pos={layout.actors[actor.id]}
          active={step.activeActors.includes(actor.id)}
        />
      ))}
      <AnimatePresence mode="wait">
        {travel && route ? (
          <motion.g
            key={step.id}
            initial={
              reducedMotion
                ? { x: route.x1, y: route.y1, opacity: 0 }
                : { x: route.x0, y: route.y0, opacity: 0 }
            }
            animate={
              reducedMotion
                ? { x: route.x1, y: route.y1, opacity: 1 }
                : {
                    x: [route.x0, route.xm, route.x1],
                    y: [route.y0, route.ym, route.y1],
                    opacity: 1,
                  }
            }
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={
              reducedMotion
                ? { duration: 0.2 }
                : {
                    x: { duration: 1.1, ease: "easeInOut" },
                    y: { duration: 1.1, ease: "easeInOut" },
                    opacity: { duration: 0.3 },
                  }
            }
          >
            <circle r={9} className={KIND_CLASS[travel.kind]} />
            <text
              y={-16}
              textAnchor="middle"
              paintOrder="stroke"
              strokeWidth={3}
              className="fill-zinc-700 stroke-white text-[11px] font-semibold dark:fill-zinc-100 dark:stroke-zinc-900"
            >
              {travel.label}
            </text>
          </motion.g>
        ) : null}
      </AnimatePresence>
    </svg>
  );
}
