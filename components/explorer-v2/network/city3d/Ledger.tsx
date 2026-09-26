"use client";

import { useEffect, useMemo } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, Mesh, MeshBasicMaterial, SRGBColorSpace } from "three";
import { PLATE, PLATE_T } from "@/components/explorer-v2/network/icm-map";
import type { PchainPulse } from "@/components/explorer-v2/network/pchain-pulse";
import type { Theme } from "./palette";
import { rimBand } from "./geometry";

/* The rim's caption: the P-Chain's newest block, its age and its day,
   cut into the plate's edge, the abacus of the column under it
   (Pillar.tsx), round the front; the words open the P-Chain explorer. The
   ledger's tiles are gone from the rim: the P-Chain's txs fly from the
   Trinity's P wing (Helicopters.tsx), and its history opens in the
   P-Chain's pane. The words are the brand's grey mono caps; only the
   block number is in its red. */

/** the rim's words run this far round the front, so they keep their shape on the rim */
const CAPTION = 0.9;
/** the words' band on the abacus's face, a little in from its top and its foot */
const CAPTION_Y: [number, number] = [-PLATE_T + 0.8, -0.8];
/** the words' grey, the brand's slate on the light stone by day and its block grey by night, and the block number's red */
const INK: Record<Theme, string> = { light: "#3B484B", dark: "#A2AFB2" };
const RED = "#E6212F";

export function Ledger({
  pulse,
  theme,
  font,
  onOpenChain,
  onRim,
}: {
  pulse: PchainPulse;
  theme: Theme;
  font: string;
  still?: boolean;
  /** the tiles' hover and click, gone with the tiles; the mount may still pass them */
  hovered?: string | null;
  onHover?: (hash: string | null) => void;
  onOpen?: (hash: string) => void;
  onOpenChain: () => void;
  /** the cursor is on the rim's words */
  onRim: (on: boolean) => void;
}) {
  // the rim's words: the newest block, its age, its day, and the way to the explorer
  const words = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 4096;
    c.height = 96;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return { c, t };
  }, []);
  const wordMat = useMemo(() => new MeshBasicMaterial({ map: words?.t ?? null, transparent: true, depthWrite: false, toneMapped: false }), [words]);
  const band = useMemo(() => new Mesh(rimBand(PLATE + 0.3, Math.PI / 2 - CAPTION / 2, Math.PI / 2 + CAPTION / 2, CAPTION_Y[0], CAPTION_Y[1]), wordMat), [wordMat]);
  const tip = pulse.txs[0] ?? null;
  const day = pulse.stats?.txCount24h ?? null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!words) return;
    const draw = () => {
      const { c, t } = words;
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, c.width, c.height);
      const age = (ts: number) => {
        const sec = Math.max(0, Math.floor(Date.now() / 1000 - ts));
        return sec < 60 ? `${sec} sec` : sec < 3600 ? `${Math.floor(sec / 60)} min` : `${Math.floor(sec / 3600)} h`;
      };
      // the caption in runs: the words in grey, the block number in red
      const block = tip ? tip.height.toLocaleString("en-US") : null;
      const ink = INK[theme];
      const runs: [string, string][] = block
        ? [["P-CHAIN · BLOCK ", ink], [block, RED], [` · ${age(tip!.ts)} ago`.toUpperCase(), ink]]
        : [["P-CHAIN", ink]];
      runs.push([`${day !== null ? ` · ${day.toLocaleString("en-US")} TXS IN 24H` : ""} →`, ink]);
      x.font = `700 62px ${font}`;
      x.textBaseline = "middle";
      // the words spaced as the map's, three tenths of an em apart, centred on the front
      const gap = 62 * 0.3;
      const chars = runs.flatMap(([text, ink]) => [...text].map((ch) => [ch, ink] as const));
      const widths = chars.map(([ch]) => x.measureText(ch).width + gap);
      let at = c.width / 2 - widths.reduce((a, b) => a + b, 0) / 2;
      chars.forEach(([ch, ink], i) => {
        x.fillStyle = ink;
        x.fillText(ch, at, c.height / 2 + 5);
        at += widths[i];
      });
      t.needsUpdate = true;
      invalidate();
    };
    draw();
    const id = setInterval(draw, 1000);
    return () => clearInterval(id);
  }, [words, tip, day, font, theme, invalidate]);

  useEffect(
    () => () => {
      band.geometry.dispose();
      wordMat.dispose();
      words?.t.dispose();
    },
    [band, wordMat, words],
  );

  return (
    <primitive
      object={band}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        onOpenChain();
      }}
      onPointerOver={() => onRim(true)}
      onPointerOut={() => onRim(false)}
    />
  );
}
