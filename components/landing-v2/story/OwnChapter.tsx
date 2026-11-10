"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { HoverPrefetchLink } from "@/components/landing-v2/HoverPrefetchLink";
import { track } from "@/components/landing-v2/track";
import { BODY, Chapter, FOCUS, Figure, Lead, MONO, Reveal, TextLink, Title } from "./kit";
import { StackLinks } from "./StackLinks";
import { SceneFrame } from "./three/SceneFrame";
import type { StackLayer, StackPoint } from "./three/StackScene";

const StackScene = dynamic(() => import("./three/StackScene"), { ssr: false });

/* The chain is yours. The drawing names the layers a team sets, from
   the validator set on the P-Chain plate up to the virtual machine; each
   layer, and the plate, opens its docs. Then what a chain of your own costs
   to run, and the way in. */

// bottom to top in the drawing; the text list reads top to bottom
const LAYERS: StackLayer[] = [
  {
    key: "validators",
    label: "Validator set",
    line: "Proof of authority, proof of stake or your own rules.",
    href: "/docs/avalanche-l1s#we-need-custom-validator-management",
  },
  {
    key: "access",
    label: "Access",
    line: "Choose who may deploy contracts and who may transact.",
    href: "/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1#restricting-smart-contract-deployers",
  },
  {
    key: "gas",
    label: "Gas token",
    line: "Allocate it at genesis, mint more, burn fees or route them.",
    href: "/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1#setting-the-genesis-allocation",
  },
  {
    key: "vm",
    label: "Virtual machine",
    line: "The EVM by default, or a VM in any language with gRPC.",
    href: "/docs/primary-network/virtual-machines#custom-vms-on-avalanche",
  },
];
const PLATE = { label: "P-Chain", href: "/docs/primary-network/platformvm-architecture" };

const STILL = { light: "/home/story/stack-light.webp", dark: "/home/story/stack-dark.webp" };
const STILL_NARROW = { light: "/home/story/stack-narrow-light.webp", dark: "/home/story/stack-narrow-dark.webp" };

const BUILD_HREF = "/console/create-l1";

export default function OwnChapter() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const drawingRef = useRef<HTMLDivElement>(null);
  // the part the pointer is on and the part a link over the drawing has the
  // keyboard's focus on. The newer one shows, and the other shows when it
  // ends; at rest the validator set (index 0) holds the red
  const hover = useRef<StackPoint>(null);
  const focus = useRef<StackPoint>(null);
  const [point, setPoint] = useState<StackPoint>(null);
  // true while the canvas shows, not the still. The ref is current at once:
  // a late pointer event from the still's links (gone at the handover) must not clear the scene's hover
  const [scene, setScene] = useState(false);
  const sceneNow = useRef(false);
  const onShown = useCallback((to: boolean) => {
    sceneNow.current = to;
    setScene(to);
  }, []);
  // a link over the drawing has the keyboard's focus: the scene holds its rig at rest, where the link's ring is drawn
  const [focused, setFocused] = useState(false);
  // the mouse's last place in the window, from the page's load: the scene looks under it when the
  // drawing moves under a mouse that has not (the canvas mounts and takes over from the still later).
  // A mouse that leaves the window, or a window that loses focus, has no place
  const pointerAt = useRef<[number, number] | null>(null);
  useEffect(() => {
    const track = (e: PointerEvent) => {
      if (e.isTrusted && e.pointerType !== "touch") pointerAt.current = [e.clientX, e.clientY];
    };
    const away = (e: Event) => {
      if (e.type === "blur" || !(e as PointerEvent).relatedTarget) pointerAt.current = null;
    };
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerout", away, { passive: true });
    window.addEventListener("blur", away);
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerout", away);
      window.removeEventListener("blur", away);
    };
  }, []);
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
  // the links' focus rings are drawn on the open stack; a shut one hides them
  const [opened, setOpened] = useState(false);
  useMotionValueEvent(open, "change", (v) => setOpened(v > 0.99));
  useEffect(() => setOpened(open.get() > 0.99), [open]);

  const select = useCallback(
    (to: Exclude<StackPoint, null>, newTab: boolean) => {
      const { label, href } = to === "plate" ? PLATE : LAYERS[to];
      track("home_cta_clicked", { section: "own", label, href });
      if (newTab) window.open(href, "_blank", "noopener");
      else router.push(href);
    },
    [router],
  );
  // the page the reader points at loads ahead of the click
  useEffect(() => {
    if (point !== null) router.prefetch((point === "plate" ? PLATE : LAYERS[point]).href);
  }, [point, router]);
  // leaving a part keeps its light while the pointer is still on the drawing,
  // so a move from one part to the next (across a label's leader, or the gap
  // between two labels) never flashes the rest pose; off the drawing, the light rests
  const overDrawing = useRef(false);
  const pointAt = useCallback((to: StackPoint) => {
    hover.current = to;
    if (to !== null || !overDrawing.current) setPoint(to ?? focus.current);
  }, []);
  useEffect(() => {
    const el = drawingRef.current;
    if (!el) return;
    const enter = () => {
      overDrawing.current = true;
    };
    const leave = () => {
      overDrawing.current = false;
      hover.current = null;
      setPoint(focus.current);
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  const pointAtStill = useCallback(
    (to: StackPoint) => {
      if (!sceneNow.current) pointAt(to);
    },
    [pointAt],
  );
  // a link over the canvas takes the keyboard's focus while the stack is
  // still shut: bring the drawing to the middle of the screen, where it is open
  const focusAt = useCallback(
    (to: StackPoint) => {
      focus.current = to;
      setPoint(to ?? hover.current);
      setFocused(to !== null);
      if (to === null || !scene || open.get() >= 1) return;
      requestAnimationFrame(() =>
        drawingRef.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }),
      );
    },
    [scene, open, reduced],
  );

  return (
    <Chapter id="own">
      {/* every width reads the claim, the drawing, the cost, then the way in.
          From lg the claim holds the left five columns, the drawing the right seven */}
      <div className="grid gap-y-12 lg:grid-cols-12 lg:items-center lg:gap-x-8">
        <Reveal className="lg:col-span-5">
          <Title lead="Own the chain." rest="Set the rules" />
          <Lead className="mt-8">
            An Avalanche L1 is a blockchain for your application alone. It can require its validators to be in a
            given country, pass KYC/AML checks or hold a license.
          </Lead>
        </Reveal>

        <Reveal delay={0.1} className="-mx-5 md:mx-0 md:-my-12 lg:-my-20 lg:col-span-7">
          <div ref={drawingRef} className="relative">
            <SceneFrame
              Scene={StackScene}
              sceneProps={{
                layers: LAYERS,
                active: point ?? 0,
                spread: open,
                onPoint: pointAt,
                onSelect: select,
                play: shown,
                rest: focused,
                shown: scene,
                pointerAt,
              }}
              still={STILL}
              stillNarrow={STILL_NARROW}
              alt="An Avalanche L1 drawn as four layers over the P-Chain: validator set, access, gas token and virtual machine."
              aspect={1.12}
              aspectNarrow={780 / 720}
              onShown={onShown}
            />
            <StackLinks
              layers={LAYERS}
              plate={PLATE}
              scene={scene}
              active={point}
              rings={!scene || opened}
              onPoint={pointAtStill}
              onFocusPoint={focusAt}
              onSelect={select}
            />
          </div>
        </Reveal>
      </div>

      {/* phones: the layers as links, right after the drawing; from 768 px the drawing labels them and its links serve screen readers */}
      <Reveal delay={0.1} className="mt-12 md:hidden">
        <ol className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {[...LAYERS].reverse().map((layer) => (
            <li key={layer.key}>
              <HoverPrefetchLink
                href={layer.href}
                onClick={() => track("home_cta_clicked", { section: "own", label: layer.label, href: layer.href })}
                className={`group flex items-center justify-between gap-4 py-4 ${FOCUS}`}
              >
                <span className="flex flex-col gap-1">
                  <span className={`${MONO} text-zinc-900 dark:text-zinc-100`}>{layer.label}</span>
                  <span className={BODY}>{layer.line}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500"
                />
              </HoverPrefetchLink>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={0.15} className="mt-16 md:mt-20 lg:mt-28">
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
