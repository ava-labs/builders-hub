"use client";

import { motion } from "framer-motion";
import type { Actor } from "./data/types";
import type { StagePosition } from "./stage-layouts";

const variants = { idle: { opacity: 0.55 }, active: { opacity: 1 } };

export function StageActor({
  actor,
  pos,
  active,
}: {
  actor: Actor;
  pos: StagePosition;
  active: boolean;
}) {
  return (
    <motion.g variants={variants} animate={active ? "active" : "idle"} initial={false}>
      <rect
        x={pos.x}
        y={pos.y}
        width={pos.w}
        height={pos.h}
        strokeWidth={active ? 1.5 : 1}
        className={
          active
            ? "fill-white stroke-zinc-900 dark:fill-zinc-950 dark:stroke-zinc-100"
            : "fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700"
        }
      />
      {active ? (
        <rect x={pos.x} y={pos.y} width={4} height={pos.h} className="fill-[#E6212F]" />
      ) : null}
      <text
        x={pos.x + 18}
        y={pos.y + 38}
        className="fill-zinc-900 text-[15px] font-semibold dark:fill-zinc-50"
      >
        {actor.label}
      </text>
      {actor.sublabel
        ? actor.sublabel.split("\n").map((line, index) => (
            <text
              key={line}
              x={pos.x + 18}
              y={pos.y + 58 + index * 16}
              letterSpacing="1.2"
              className="fill-zinc-500 font-mono text-[9.5px] uppercase dark:fill-[#A2AFB2]"
            >
              {line}
            </text>
          ))
        : null}
    </motion.g>
  );
}
