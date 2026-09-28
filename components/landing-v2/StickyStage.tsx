"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Plate, type PlateSpec } from "@/components/landing-v2/PillarPlate";
import PlateVideo from "@/components/landing-v2/PlateVideo";

/* ------------------------------------------------------------------ */
/* Sticky stage: a split screen, text scrolling left, plates held right */
/*                                                                      */
/* Each step is one screen of reading. The right half is pinned at full */
/* height, flush to the sheet's edge and exactly 4:5 wide so a photo    */
/* fills it without cropping. The change between steps is scrubbed by   */
/* scroll position, not fired by it: the next photo fades in over the   */
/* last while settling out of a slight zoom, then the drawings swap in  */
/* sequence at the step boundary so two never overlap. Scrolling back   */
/* plays it in reverse. Phones get each step's plate inline, edge to    */
/* edge, above its text.                                                */
/* ------------------------------------------------------------------ */

export interface StageStep {
  key: string;
  content: React.ReactNode;
  plate: PlateSpec;
}

// `pos` runs 0..n-1 as steps pass the viewport's middle: pos === i when
// step i is centred, and i + 0.5 is the boundary into the next step.

/** Drawing opacity for step i: hold through the step, hand off across
 *  the boundary (out over the last 15% of this step, in over the first
 *  15% of the next), so two drawings never share the plate. */
function handoff(i: number, n: number): [number[], number[]] {
  const input: number[] = [];
  const output: number[] = [];
  if (i > 0) {
    input.push(i - 0.5, i - 0.35);
    output.push(0, 1);
  } else {
    input.push(-1);
    output.push(1);
  }
  if (i < n - 1) {
    input.push(i + 0.35, i + 0.5);
    output.push(1, 0);
  } else {
    input.push(n);
    output.push(1);
  }
  return [input, output];
}

/* One step's plate: photo, scrim, and drawing move as a single layer, so
   a drawing traced onto its photo stays on its features while the layer
   settles out of its zoom. */
function StepLayer({
  i,
  n,
  pos,
  plate,
  still,
}: {
  i: number;
  n: number;
  pos: MotionValue<number>;
  plate: PlateSpec;
  still: boolean;
}) {
  // the ground fades in ahead of the boundary, so it is set before its drawing
  const opacity = useTransform(pos, i === 0 ? [-1, 0] : [i - 0.8, i - 0.35], i === 0 ? [1, 1] : [0, 1]);
  const scale = useTransform(pos, [i - 0.8, i - 0.2, i + 0.5], [1.1, 1, 1.02]);
  const [input, output] = handoff(i, n);
  const drawing = useTransform(pos, input, output);
  return (
    <>
      <motion.div data-plate className="absolute inset-0" style={{ opacity, scale: still ? 1 : scale }}>
        {plate.video ? (
          <PlateVideo video={plate.video} />
        ) : plate.photo ? (
          <Image src={plate.photo} alt="" fill sizes="50vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#2a2d33_0%,#101113_70%)]" />
        )}
        <div aria-hidden className="absolute inset-0 bg-zinc-950/35" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.75)_100%)]"
        />
        <motion.div
          style={{ opacity: drawing }}
          className="dark absolute inset-0 flex items-center justify-center px-[9%] py-[14%] [&_svg]:max-w-none"
        >
          {plate.drawing}
        </motion.div>
      </motion.div>
      <motion.div
        style={{ opacity: drawing }}
        className="absolute inset-x-0 bottom-0 flex items-center justify-between px-6 py-5 text-[12px] text-white/60"
      >
        <span className="tabular-nums">{plate.caption[0]}</span>
        <span>{plate.caption[1]}</span>
      </motion.div>
    </>
  );
}

// 5.375rem throughout = global navbar (3.5rem) + solutions subnav (30px):
// where the stage pins and how tall one step of reading is
export default function StickyStage({ steps, className = "" }: { steps: StageStep[]; className?: string }) {
  const reducedMotion = !!useReducedMotion();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const stepsRef = useRef<HTMLDivElement>(null);
  const n = steps.length;

  const { scrollYProgress } = useScroll({ target: stepsRef, offset: ["start center", "end center"] });
  const pos = useTransform(scrollYProgress, (p) => p * n - 0.5);

  useEffect(() => {
    // the step crossing the viewport's middle is the one being read; only
    // the text's emphasis follows this, the plates follow `pos`
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [n]);

  return (
    <div className={`relative -mx-5 md:-mx-6 lg:ml-0 lg:flex ${className}`}>
      <div ref={stepsRef} className="min-w-0 flex-1">
        {steps.map((step, i) => (
          <div
            key={step.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-step={i}
            className={`pb-16 transition-opacity duration-700 lg:flex lg:min-h-[calc(100vh-5.375rem)] lg:flex-col lg:justify-center lg:py-16 lg:pr-16 xl:pr-24 ${
              i === active ? "lg:opacity-100" : "lg:opacity-30"
            }`}
          >
            <Plate photo={step.plate.photo} video={step.plate.video} caption={step.plate.caption} className="mb-10 lg:hidden">
              {step.plate.drawing}
            </Plate>
            <div className="px-5 md:px-6 lg:px-0">{step.content}</div>
          </div>
        ))}
      </div>

      <div className="hidden shrink-0 lg:block lg:w-[min(50%,calc((100vh-5.375rem)*0.8))]">
        <div className="sticky top-[calc(var(--fd-banner-height,0px)+5.375rem)] h-[calc(100vh-5.375rem)] overflow-hidden bg-zinc-950">
          {steps.map((step, i) => (
            <StepLayer key={step.key} i={i} n={n} pos={pos} plate={step.plate} still={reducedMotion} />
          ))}
        </div>
      </div>
    </div>
  );
}
