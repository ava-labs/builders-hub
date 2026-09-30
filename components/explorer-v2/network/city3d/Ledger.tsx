"use client";

import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, Mesh, MeshBasicMaterial, SRGBColorSpace, type Vector3 } from "three";
import { PLATE, PLATE_T } from "@/components/explorer-v2/network/icm-map";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import type { Theme } from "./palette";
import { rimBand } from "./geometry";
import { HAZE_GLSL } from "./haze";
import { OPENING } from "./warmup";

/* The rim's inscription: the motto the Avalanche mainnet's genesis
   carries, "Per consensum ad astra", cut into the plate's edge, the abacus
   of the column under it (Pillar.tsx), once round the front and once
   round the back, so a camera turned round the city finds it too. The
   letters are the brand's Aeonik caps in bold, widely spaced across the
   band, cut in as a V: the cut's floor a step darker than the stone, its
   upper and left walls in shadow and its lower and right walls in the
   light, as the sun from the upper left lights the city, with the
   stone's grain showing through; by night the lit walls take the moon's
   grey, so the words read from the city's view without glowing. It opens
   nothing; the cursor on it shows what it says and where it comes from. */

const MOTTO = "PER CONSENSUM AD ASTRA";
/** the words' band on the abacus's face, a little in from its top and its foot, and how far it runs round the rim */
const BAND_Y: [number, number] = [-PLATE_T + 0.8, -0.8];
const RUN = 0.55;
/** the band's canvas: its height in pixels, and as many across as keep the letters' shape on the rim */
const TALL = 192;
const WIDE = Math.round((TALL / (BAND_Y[1] - BAND_Y[0])) * RUN * (PLATE + 0.3));
/** the letters: bold caps, their size and the space between them (six tenths of an em), in canvas pixels */
const SIZE = 144;
const TRACK = 0.6;
const FONT = `700 ${SIZE}px Aeonik, sans-serif`;
/** how far each wall reaches into a stroke and how soft it is, and the lit edge of the stone under each letter, in canvas pixels */
const WALL = 6;
const SOFT = 7;
const LIP = 2;
/* the cut in each theme: its floor, its shadowed walls, its lit walls, the stone's lit edge under it; by night the lit
   walls are the brand's block grey, as the moon lights a carving */
const CARVE: Record<Theme, { floor: string; shade: string; lit: string; lip: string }> = {
  light: { floor: "rgba(70,80,86,0.3)", shade: "rgba(22,28,32,0.75)", lit: "rgba(255,255,255,0.8)", lip: "rgba(255,255,255,0.45)" },
  dark: { floor: "rgba(0,0,0,0.3)", shade: "rgba(0,0,0,0.65)", lit: "rgba(162,175,178,0.6)", lip: "rgba(162,175,178,0.25)" },
};

/** a blank canvas the size of another */
function sheet(like: HTMLCanvasElement): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = like.width;
  c.height = like.height;
  return [c, c.getContext("2d")!];
}

/** a shape in one ink: the shape's alpha, the ink's color */
function inked(shape: HTMLCanvasElement, ink: string): HTMLCanvasElement {
  const [c, x] = sheet(shape);
  x.drawImage(shape, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = ink;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** one wall of the cut: the stone round the letters, moved by (dx, dy) and softened, kept where it falls inside them. The
    stone is drawn off the sheet and only its shadow lands on it, the one soft copy a 2D canvas makes everywhere */
function wall(letters: HTMLCanvasElement, stone: HTMLCanvasElement, ink: string, dx: number, dy: number): HTMLCanvasElement {
  const [c, x] = sheet(letters);
  const off = c.width + 64;
  x.shadowColor = ink;
  x.shadowBlur = SOFT;
  x.shadowOffsetX = off + dx;
  x.shadowOffsetY = dy;
  x.drawImage(stone, -off, 0);
  x.shadowColor = "transparent";
  x.globalCompositeOperation = "destination-in";
  x.drawImage(letters, 0, 0);
  return c;
}

export function Ledger({ theme }: { theme: Theme }) {
  const words = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = WIDE;
    c.height = TALL;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return { c, t };
  }, []);
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({ map: words?.t ?? null, transparent: true, depthWrite: false, toneMapped: false });
    // the words go into the air with the stone they are carved in (haze.ts)
    m.onBeforeCompile = (s) => {
      s.uniforms.uOpen = OPENING.column;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", `#include <common>${HAZE_GLSL}\nvarying float vHaze;`)
        .replace("#include <project_vertex>", "#include <project_vertex>\nfloat wy = ( modelMatrix * vec4( transformed, 1.0 ) ).y;\nvHaze = max( hazeAt( wy ), mistAt( wy ) );");
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vHaze;")
        .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.a *= 1.0 - vHaze;");
    };
    return m;
  }, [words]);
  // the band round the front, and its copy round the back
  const bands = useMemo(() => {
    const g = rimBand(PLATE + 0.3, Math.PI / 2 - RUN / 2, Math.PI / 2 + RUN / 2, BAND_Y[0], BAND_Y[1]);
    const front = new Mesh(g, material);
    const back = new Mesh(g, material);
    back.rotation.y = Math.PI;
    return [front, back];
  }, [material]);
  const invalidate = useThree((s) => s.invalidate);

  /* the letters, cut: their shape once, then the floor, the walls in shadow and in light, and the stone's lit edge under them */
  useEffect(() => {
    if (!words) return;
    let live = true;
    const draw = () => {
      if (!live) return;
      const { c, t } = words;
      const [letters, lx] = sheet(c);
      lx.font = FONT;
      lx.textBaseline = "middle";
      const gap = SIZE * TRACK;
      const widths = [...MOTTO].map((ch) => lx.measureText(ch).width + gap);
      const run = widths.reduce((a, b) => a + b, 0) - gap;
      // the words keep a tenth of the band clear at each end; a face wider than planned is drawn smaller to fit
      const fit = Math.min(1, (c.width * 0.8) / run);
      lx.setTransform(fit, 0, 0, fit, c.width / 2 - (run * fit) / 2, c.height / 2 + 6);
      let at = 0;
      [...MOTTO].forEach((ch, i) => {
        lx.fillText(ch, at, 0);
        at += widths[i];
      });
      const [stone, sx] = sheet(c);
      sx.fillRect(0, 0, c.width, c.height);
      sx.globalCompositeOperation = "destination-out";
      sx.drawImage(letters, 0, 0);
      const k = CARVE[theme];
      // the stone's lit edge: the letters moved down, kept where they fall on the stone
      const [lip, px] = sheet(c);
      px.drawImage(inked(letters, k.lip), 0, LIP);
      px.globalCompositeOperation = "destination-out";
      px.drawImage(letters, 0, 0);
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(inked(letters, k.floor), 0, 0);
      x.drawImage(wall(letters, stone, k.shade, WALL * 0.6, WALL), 0, 0);
      x.drawImage(wall(letters, stone, k.lit, -WALL * 0.5, -WALL), 0, 0);
      x.drawImage(lip, 0, 0);
      t.needsUpdate = true;
      invalidate();
    };
    draw();
    // the face may land after the first draw
    document.fonts?.load(FONT).then(draw, () => {});
    return () => {
      live = false;
    };
  }, [words, theme, invalidate]);

  useEffect(
    () => () => {
      bands[0].geometry.dispose();
      material.dispose();
      words?.t.dispose();
    },
    [bands, material, words],
  );

  // the tip stands on the band's top edge over the cursor, so it never hides the letters
  const [at, setAt] = useState<Vector3 | null>(null);
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setAt(e.point.clone().setY(BAND_Y[1] + 0.4));
  };
  return (
    <group>
      {/* keyed by their meshes, so rebuilt bands still take the cursor (Buildings.tsx) */}
      {bands.map((b) => (
        <primitive key={b.uuid} object={b} onPointerOver={over} onPointerMove={over} onPointerOut={() => setAt(null)} />
      ))}
      {at && (
        <Html position={at} zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <div className="-translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap">
            <TipPlate>
              <p className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">Through consensus, to the stars</p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-500">From the Avalanche mainnet genesis</p>
            </TipPlate>
          </div>
        </Html>
      )}
    </group>
  );
}
