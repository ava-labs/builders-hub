"use client";

import { motion } from "framer-motion";
import type { Actor } from "./data/types";
import type { StagePosition } from "./stage-layouts";

const variants = {
  idle: { opacity: 0.55 },
  active: { opacity: 1 },
};

export function StageActor({
  actor,
  pos,
  active,
}: {
  actor: Actor;
  pos: StagePosition;
  active: boolean;
}) {
  const cx = pos.x + pos.w / 2;
  return (
    <motion.g variants={variants} animate={active ? "active" : "idle"} initial={false}>
      <rect
        x={pos.x}
        y={pos.y}
        width={pos.w}
        height={pos.h}
        rx={10}
        strokeWidth={active ? 2 : 1.25}
        className={
          active
            ? "fill-red-50 stroke-red-500 dark:fill-red-950/40 dark:stroke-red-400"
            : "fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700"
        }
      />
      <text
        x={cx}
        y={pos.y + (actor.sublabel ? pos.h / 2 - 4 : pos.h / 2 + 5)}
        textAnchor="middle"
        className="fill-zinc-900 text-[15px] font-semibold dark:fill-zinc-100"
      >
        {actor.label}
      </text>
      {actor.sublabel ? (
        <text
          x={cx}
          y={pos.y + pos.h / 2 + 17}
          textAnchor="middle"
          className="fill-zinc-500 text-[11px] dark:fill-zinc-400"
        >
          {actor.sublabel}
        </text>
      ) : null}
    </motion.g>
  );
}
