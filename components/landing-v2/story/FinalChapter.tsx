"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { CAPTION, Chapter, Lead, MONO, Reveal, TextLink, Title } from "./kit";

/* The first objection, answered: final in a second or less, with no
   reorgs. A ruler in real time, one line for both chains: two transactions
   leave at 0 together. The L1's is final first, under 500 ms (the figure
   AvaCloud publishes for the L1s it runs, avacloud.io/en/technology); the
   C-Chain's goes on to about one second (the exchange integration guide).
   The ruler is the proof, so its marks carry the chapter's figures. */

// the ruler spans one and a half seconds; the C-Chain is final at one
const SPAN_MS = 1500;
const FINAL_MS = 1000;
// the L1 mark: final before 500 ms
const L1_MS = 500;
// a beat at 0 so the eye finds the start, then the trips, then each mark lights
const LEAD_MS = 300;
const LIT_MS = 300;

const TICKS = [0, 0.5, 1, 1.5];

interface Mark {
  chain: string;
  ms: number;
  /** the figure: its sign (read out as `said`) and its seconds */
  sign: string;
  said: string;
  seconds: string;
  /** the mark the chapter is about: it takes the red */
  accent: boolean;
}

// left to right: the L1 is final first
const MARKS: Mark[] = [
  { chain: "Your L1", ms: L1_MS, sign: "<", said: "under", seconds: "0.5", accent: true },
  { chain: "C-Chain", ms: FINAL_MS, sign: "~", said: "about", seconds: "1", accent: false },
];

const at = (ms: number) => `${(ms / SPAN_MS) * 100}%`;

// rest: the final pose (server, reduced motion, after a run); start: the pose
// a run leaves from; run: one trip each, which ends on the final pose
type Pose = "rest" | "start" | "run";

function FinalityRuler() {
  const ref = useRef<HTMLDivElement>(null);
  // the run plays once when the whole ruler sits in the top three quarters
  // of the screen, and is armed again only after the ruler leaves the
  // screen, so it never loops in view
  const watched = useInView(ref, { amount: 1, margin: "0px 0px -25% 0px" });
  const onScreen = useInView(ref);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Pose>("rest");
  useEffect(() => {
    if (reduced) return;
    if (watched) setPhase("run");
    else if (!onScreen) setPhase("start");
  }, [watched, onScreen, reduced]);

  const pose: Pose = reduced ? "rest" : phase;

  // transform and opacity only, so a run lays nothing out; fill mode both
  // holds the start pose through the lead beat and the final pose after.
  // Time is the axis, so every trip moves at the same speed: a trip to a
  // mark lasts as long as the mark's time
  const fill: CSSProperties =
    pose === "start"
      ? { transform: "scaleX(0)" }
      : {
          transform: "scaleX(1)",
          animation: pose === "run" ? `v2-story-final-fill ${FINAL_MS}ms linear ${LEAD_MS}ms both` : undefined,
        };
  // a trip's wrapper spans 0 to its mark with the block on its right edge,
  // and slides in from one width to the left: overhang on the left adds no
  // scroll width, overhang on the right would widen the page
  const trip = (m: Mark): CSSProperties =>
    pose === "start"
      ? { transform: "translateX(-100%)" }
      : {
          transform: "translateX(0)",
          animation: pose === "run" ? `v2-story-final-tx ${m.ms}ms linear ${LEAD_MS}ms both` : undefined,
        };
  const lit = (m: Mark): CSSProperties =>
    pose === "start"
      ? { opacity: 0.25 }
      : {
          opacity: 1,
          animation: pose === "run" ? `v2-story-final-lit ${LIT_MS}ms ease-out ${LEAD_MS + m.ms}ms both` : undefined,
        };

  return (
    <div
      ref={ref}
      role="figure"
      aria-label="Time to finality on one axis from 0 to 1.5 seconds: an L1 under 0.5 seconds, the C-Chain about 1 second"
      className="relative select-none"
    >
      {/* each mark: its figure, the chain, and a line down to the track; the
          L1's figure and line take the red, the chain names stay in ink */}
      <div className="relative h-32 md:h-36 lg:h-40">
        {MARKS.map((m) => (
          <div
            key={m.chain}
            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: at(m.ms) }}
          >
            <div className="flex flex-col items-center gap-3" style={lit(m)}>
              <p
                className={`v2-heading whitespace-nowrap text-3xl leading-none tracking-[-0.04em] md:text-4xl lg:text-5xl ${m.accent ? "text-[#E6212F]" : "text-zinc-900 dark:text-zinc-50"}`}
              >
                <span aria-hidden>{m.sign}</span>
                <span className="sr-only select-none">{m.said} </span>
                {m.seconds}
                <span aria-hidden>{"\u202F"}s</span>
                <span className="sr-only select-none"> seconds</span>
              </p>
              <span className={`whitespace-nowrap text-zinc-900 dark:text-zinc-50 ${MONO}`}>{m.chain}</span>
            </div>
            <span
              aria-hidden
              className={`mt-3 h-6 w-px ${m.accent ? "bg-[#E6212F]" : "bg-zinc-400 dark:bg-zinc-600"}`}
            />
          </div>
        ))}
      </div>

      {/* the track, the stretch the transactions cover, and the
          transactions: blocks on the right edge of wrappers that span 0
          to their mark, so the end pose lands on it */}
      <div aria-hidden className="relative h-px w-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="absolute inset-y-0 left-0 origin-left bg-zinc-900 dark:bg-zinc-100"
          style={{ width: at(FINAL_MS), ...fill }}
        />
        {/* the trips ride together until 0.5 s, so the L1's red block goes on top */}
        {MARKS.map((m) => (
          <div
            key={m.chain}
            className={`absolute inset-y-0 left-0 ${m.accent ? "z-10" : ""}`}
            style={{ width: at(m.ms), ...trip(m) }}
          >
            <span
              className={`absolute left-full top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 ${m.accent ? "bg-[#E6212F]" : "bg-zinc-900 dark:bg-zinc-100"}`}
            />
          </div>
        ))}
      </div>

      {/* the time scale: a tick at each half second, numbers only at the
          ends, since the marks above carry their own figures; mono without
          the uppercase, so the unit stays "s", and a narrow space so the
          number keeps its unit close */}
      <div aria-hidden className="relative h-10">
        {TICKS.map((s) => (
          <span
            key={s}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center first:translate-x-0 first:items-start last:-translate-x-full last:items-end"
            style={{ left: at(s * 1000) }}
          >
            <span className="h-2 w-px bg-zinc-300 dark:bg-zinc-700" />
            {(s === 0 || s * 1000 === SPAN_MS) && (
              <span className="mt-2 whitespace-nowrap font-mono text-xs tabular-nums tracking-normal text-zinc-500 dark:text-zinc-400">
                {`${s}\u202Fs`}
              </span>
            )}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes v2-story-final-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes v2-story-final-tx { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes v2-story-final-lit { from { opacity: 0.25; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default function FinalChapter() {
  return (
    <Chapter id="final">
      <Reveal>
        <Title lead="Final in a second or less." rest="No reorgs" />
        <Lead className="mt-8">
          A transaction is final when consensus accepts its block. Apps and exchanges need no extra confirmations.
        </Lead>
      </Reveal>

      <Reveal delay={0.1} className="mt-16 md:mt-20">
        <FinalityRuler />
        <p className={`mt-6 max-w-3xl ${CAPTION}`}>
          <span className="motion-reduce:hidden">Shown at true speed. </span>Sources: AvaCloud for its L1s, the
          Avalanche docs for the <span className="whitespace-nowrap">C-Chain</span>.
        </p>
        <div className="mt-10">
          <TextLink href="/docs/primary-network/exchange-integration#determining-finality" section="final">
            How finality works
          </TextLink>
        </div>
      </Reveal>
    </Chapter>
  );
}
