"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import type { FlowDefinition } from "./data/types";
import { desktopLayout } from "./stage-layouts";
import { beatStartFraction, progressToStepIndex } from "./scroll-logic";
import { useFlowState } from "./use-flow-state";
import { FlowHeader } from "./FlowHeader";
import { Stage } from "./Stage";
import { StepRail } from "./StepRail";
import { StepPanel } from "./StepPanel";

/** Pin below the full chrome stack: campaign banner (when present) + navbar + docs subnav. */
const STICKY_TOP = "calc(var(--fd-banner-height, 0px) + 7rem)";
/** The viewport space left below the chrome; the board centers vertically inside it. */
const STICKY_HEIGHT = "calc(100vh - var(--fd-banner-height, 0px) - 7rem)";
/** 29rem = chrome below the banner + header + compact rail + card strip + padding; 0.62 = stage viewBox ratio. */
const STAGE_MAX_WIDTH = "min(100%, calc((100vh - var(--fd-banner-height, 0px) - 29rem) / 0.62))";
/** Scroll distance per step. */
const BEAT_VH = 55;
const CARD_WIDTH = 520;
const CARD_GAP = 24;

export function ScrollFlow({
  flow,
  reducedMotion,
}: {
  flow: FlowDefinition;
  reducedMotion: boolean;
}) {
  const { state, dispatch } = useFlowState();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const cardX = useTransform(
    scrollYProgress,
    [0, 1],
    [0, -(flow.steps.length - 1) * (CARD_WIDTH + CARD_GAP)],
  );

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setStepIndex((previous) => {
      const next = progressToStepIndex(value, flow.steps.length);
      return next === previous ? previous : next;
    });
  });

  const scrollToBeat = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const scrollable = track.offsetHeight - window.innerHeight;
    const target = top + beatStartFraction(index, flow.steps.length) * scrollable + 2;
    window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div ref={trackRef} className="relative" style={{ height: `${flow.steps.length * BEAT_VH}vh` }}>
      <div
        className="flex items-center"
        style={{ position: "sticky", top: STICKY_TOP, height: STICKY_HEIGHT }}
      >
        <div className="w-full">
          <div
            className="mx-auto border-y border-x border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95"
            style={{ maxWidth: "max(58rem, calc((100vh - var(--fd-banner-height, 0px) - 29rem) / 0.62 + 3rem))" }}
          >
            <FlowHeader flowId={flow.id} stepIndex={stepIndex} stepCount={flow.steps.length} />
            <div className="px-4 py-3">
              <div className="mx-auto" style={{ maxWidth: STAGE_MAX_WIDTH }}>
                <Stage
                  flow={flow}
                  stepIndex={stepIndex}
                  layout={desktopLayout}
                  reducedMotion={reducedMotion}
                  className="h-auto w-full select-none"
                />
              </div>
            </div>
            <StepRail
              steps={flow.steps}
              currentIndex={stepIndex}
              onSelect={scrollToBeat}
              compact
            />
            <div className="overflow-hidden border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <motion.div className="flex" style={{ x: cardX, gap: `${CARD_GAP}px`, width: "max-content" }}>
                {flow.steps.map((panelStep, index) => (
                  <div
                    key={panelStep.id}
                    style={{ width: CARD_WIDTH }}
                    className={
                      index === stepIndex
                        ? "shrink-0 opacity-100 transition-opacity duration-300"
                        : "pointer-events-none shrink-0 opacity-50 transition-opacity duration-300"
                    }
                  >
                    <div className="max-h-[40vh] overflow-y-auto">
                      <StepPanel
                        dense
                        step={panelStep}
                        stepNumber={index + 1}
                        stepCount={flow.steps.length}
                        operatorOpen={Boolean(state.expanded[`${panelStep.id}:operator`])}
                        failuresOpen={Boolean(state.expanded[`${panelStep.id}:failures`])}
                        onToggle={(section) =>
                          dispatch({ type: "toggle", section: `${panelStep.id}:${section}` })
                        }
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
