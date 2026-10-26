"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { track } from "@/components/landing-v2/track";
import { BODY, Chapter, Figure, Lead, MONO, Reveal, TextLink, Title } from "./kit";
import { SceneFrame } from "./three/SceneFrame";
import type { StackLayer } from "./three/StackScene";

const StackScene = dynamic(() => import("./three/StackScene"), { ssr: false });

/* The chain is yours. The drawing names the layers a team sets, from
   the validator set on the P-Chain plate up to the virtual machine. Then
   what a chain of your own costs to run, and the way in. */

// bottom to top in the drawing; the text list reads top to bottom
const LAYERS: StackLayer[] = [
  { key: "validators", label: "Validator set", line: "Proof of authority, proof of stake or your own rules." },
  { key: "access", label: "Access", line: "Choose who may deploy contracts and who may transact." },
  { key: "gas", label: "Gas token", line: "Allocate it at genesis, mint more, burn fees or route them." },
  { key: "vm", label: "Virtual machine", line: "The EVM by default, or a VM in any language with gRPC." },
];

const STILL = { light: "/home/story/stack-light.webp", dark: "/home/story/stack-dark.webp" };
const STILL_NARROW = { light: "/home/story/stack-narrow-light.webp", dark: "/home/story/stack-narrow-dark.webp" };

const BUILD_HREF = "/console/create-l1";

export default function OwnChapter() {
  const drawingRef = useRef<HTMLDivElement>(null);
  // the layer the reader points at; at rest the validator set (index 0) holds the red
  const [active, setActive] = useState<number | null>(null);
  // the stack opens as the drawing scrolls in, and is open before it reaches the middle of the screen
  const { scrollYProgress } = useScroll({ target: drawingRef, offset: ["start end", "center center"] });
  const open = useTransform(scrollYProgress, [0.1, 0.65], [0, 1], { clamp: true });
  // the drop starts when the drawing is most of the way to the middle of the
  // screen, after the stack has opened, so the reader sees each layer land.
  // A page that loads past that point drops at once
  const [shown, setShown] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v >= 0.8) setShown(true);
  });
  useEffect(() => {
    if (scrollYProgress.get() >= 0.8) setShown(true);
  }, [scrollYProgress]);

  return (
    <Chapter id="own">
      {/* every width reads the claim, the drawing, the cost, then the way in.
          From lg the claim holds the left five columns, the drawing the right seven */}
      <div className="grid gap-y-12 lg:grid-cols-12 lg:items-center lg:gap-x-8">
        <Reveal title className="lg:col-span-5">
          <Title lead="Own the chain." rest="Set the rules" />
          <Lead className="mt-8">
            An Avalanche L1 is a blockchain for your application alone. It can require its validators to be in a
            given country, pass KYC/AML checks or hold a license.
          </Lead>
        </Reveal>

        <Reveal delay={0.08} className="-mx-5 md:mx-0 md:-my-12 lg:-my-20 lg:col-span-7">
          <div ref={drawingRef}>
            <SceneFrame
              Scene={StackScene}
              sceneProps={{ layers: LAYERS, active: active ?? 0, spread: open, onPoint: setActive, play: shown }}
              still={STILL}
              stillNarrow={STILL_NARROW}
              alt="An Avalanche L1 drawn as four layers over the P-Chain: validator set, access, gas token and virtual machine."
              aspect={1.12}
              aspectNarrow={780 / 720}
            />
          </div>
        </Reveal>
      </div>

      {/* phones: the layers as text, right after the drawing; from 768 px the drawing labels them */}
      <Reveal delay={0.08} className="mt-12 md:sr-only">
        <ol className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {[...LAYERS].reverse().map((layer) => (
            <li key={layer.key} className="flex flex-col gap-1 py-4">
              <span className={`${MONO} text-zinc-900 dark:text-zinc-100`}>{layer.label}</span>
              <span className={BODY}>{layer.line}</span>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={0.12} className="mt-16 md:mt-20 lg:mt-28">
        <div className="grid gap-12 border-t border-zinc-200 pt-12 max-md:border-t-0 max-md:pt-0 md:grid-cols-3 md:gap-8 dark:border-zinc-800">
          <Figure
            value={
              <>
                <span aria-hidden>&gt;</span>
                <span className="sr-only select-none">more than </span>99.9%
              </>
            }
            caption="less upfront cost to launch an L1 since the Etna upgrade in December 2024."
          />
          <Figure
            value={
              <>
                <span aria-hidden>~</span>
                <span className="sr-only select-none">about </span>1.33
              </>
            }
            unit="AVAX"
            caption="a month in P-Chain fees per L1 validator."
          />
          {/* no-break spaces keep each count with its unit */}
          <Figure
            value="2"
            unit="cores"
            caption={"with 4\u00a0GB of RAM and 100\u00a0GB of storage run an L1 validator under 10\u00a0TPS."}
          />
        </div>
        <div className="mt-14 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-6">
          <BrandButton
            href={BUILD_HREF}
            prefetchOnIntent
            onClick={() => track("home_cta_clicked", { section: "own", label: "Build an L1", href: BUILD_HREF })}
            className="w-full sm:w-auto"
          >
            Build an L1
          </BrandButton>
          <TextLink href="/docs/tooling/avalanche-deploy/deploy-l1" section="own">
            Run it in production
          </TextLink>
        </div>
      </Reveal>
    </Chapter>
  );
}
