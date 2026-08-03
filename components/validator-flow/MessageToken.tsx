"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MessageKind, MessageTravel } from "./data/types";
import type { RoutePoints } from "./stage-layouts";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BURST_OFFSETS = [-36, -18, 0, 18, 36];

function TokenGlyph({ kind }: { kind: MessageKind }) {
  switch (kind) {
    case "evm-tx":
      return <rect x={-8} y={-8} width={16} height={16} className="fill-[#E6212F]" />;
    case "pchain-tx":
      return (
        <rect
          x={-8}
          y={-8}
          width={16}
          height={16}
          strokeWidth={1}
          className="fill-[#A2AFB2] stroke-zinc-600 dark:stroke-zinc-300"
        />
      );
    case "warp-l1-sourced":
      return <path d="M -12 -7 H 4 L 12 0 L 4 7 H -12 Z" className="fill-[#E6212F]" />;
    case "warp-pchain-sourced":
      return (
        <path
          d="M -12 -7 H 4 L 12 0 L 4 7 H -12 Z"
          strokeWidth={1.5}
          className="fill-white stroke-[#E6212F] dark:fill-zinc-950"
        />
      );
    case "signatures":
      return <circle r={4} className="fill-[#E6212F]" />;
  }
}

function TravelLabel({ label }: { label: string }) {
  return (
    <text
      y={-18}
      textAnchor="middle"
      paintOrder="stroke"
      strokeWidth={3}
      letterSpacing="1"
      className="fill-zinc-700 stroke-white font-mono text-[9px] uppercase dark:fill-zinc-200 dark:stroke-zinc-950"
    >
      {label}
    </text>
  );
}

function SignatureBurst({
  route,
  reducedMotion,
  label,
}: {
  route: RoutePoints;
  reducedMotion: boolean;
  label: string;
}) {
  return (
    <>
      {BURST_OFFSETS.map((offset, index) => (
        <motion.g
          key={offset}
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
                  y: [route.y0, route.ym + offset, route.y1],
                  opacity: 1,
                }
          }
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={
            reducedMotion
              ? { duration: 0.2 }
              : {
                  x: { duration: 0.9, ease: "easeInOut", delay: index * 0.12 },
                  y: { duration: 0.9, ease: "easeInOut", delay: index * 0.12 },
                  opacity: { duration: 0.25, delay: index * 0.12 },
                }
          }
        >
          <circle r={4} className="fill-[#E6212F]" />
          {index === 2 ? <TravelLabel label={label} /> : null}
        </motion.g>
      ))}
    </>
  );
}

export function MessageToken({
  stepId,
  travel,
  route,
  reducedMotion,
}: {
  stepId: string;
  travel: MessageTravel | undefined;
  route: RoutePoints | null;
  reducedMotion: boolean;
}) {
  return (
    <AnimatePresence mode="wait">
      {travel && route ? (
        travel.kind === "signatures" ? (
          <motion.g key={stepId} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <SignatureBurst route={route} reducedMotion={reducedMotion} label={travel.label} />
          </motion.g>
        ) : (
          <motion.g
            key={stepId}
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
                    x: { duration: 1.0, ease: EASE_OUT },
                    y: { duration: 1.0, ease: EASE_OUT },
                    opacity: { duration: 0.3 },
                  }
            }
          >
            <TokenGlyph kind={travel.kind} />
            <TravelLabel label={travel.label} />
          </motion.g>
        )
      ) : null}
    </AnimatePresence>
  );
}
