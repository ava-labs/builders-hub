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
   letters are the brand's Aeonik caps, widely spaced, cut in: by day each
   a dark inset under a shadowed upper edge, with a light lip below, as
   light from above catches a carved letter; by night the inset a step
   lighter than the dark stone, as the moon's light catches a carving, so
   it reads from the city's view without glowing. It opens nothing; the
   cursor on it shows what it says and where it comes from. */

const MOTTO = "PER CONSENSUM AD ASTRA";
/** the words' band on the abacus's face, a little in from its top and its foot, and how far it runs round the rim */
const BAND_Y: [number, number] = [-PLATE_T + 0.8, -0.8];
const RUN = 0.36;
/** the band's canvas: its height in pixels, and as many across as keep the letters' shape on the rim */
const TALL = 192;
const WIDE = Math.round((TALL / (BAND_Y[1] - BAND_Y[0])) * RUN * (PLATE + 0.3));
/** the letters: their size, the space between them (three tenths of an em, as the old caption's), and the cut's depth, in canvas pixels */
const SIZE = 120;
const TRACK = 0.3;
const CUT = 2.5;
/* the cut in each theme: the letter's inset, its shadowed upper edge, its lit lip; by night the inset is the brand's block grey, faint, over the dark stone */
const CARVE: Record<Theme, { face: string; shade: string; lip: string }> = {
  light: { face: "rgba(59,72,75,0.55)", shade: "rgba(30,36,40,0.45)", lip: "rgba(255,255,255,0.95)" },
  dark: { face: "rgba(162,175,178,0.3)", shade: "rgba(0,0,0,0.5)", lip: "rgba(162,175,178,0.55)" },
};

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

  /* the letters, cut: the lit lip a little under each, the shadowed upper edge a little over it, the inset on top */
  useEffect(() => {
    if (!words) return;
    let live = true;
    const draw = () => {
      if (!live) return;
      const { c, t } = words;
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, c.width, c.height);
      x.font = `500 ${SIZE}px Aeonik, sans-serif`;
      x.textBaseline = "middle";
      const gap = SIZE * TRACK;
      const widths = [...MOTTO].map((ch) => x.measureText(ch).width + gap);
      const start = c.width / 2 - (widths.reduce((a, b) => a + b, 0) - gap) / 2;
      const k = CARVE[theme];
      for (const [ink, dy] of [
        [k.lip, CUT],
        [k.shade, -CUT * 0.6],
        [k.face, 0],
      ] as const) {
        x.fillStyle = ink;
        let at = start;
        [...MOTTO].forEach((ch, i) => {
          x.fillText(ch, at, c.height / 2 + 4 + dy);
          at += widths[i];
        });
      }
      t.needsUpdate = true;
      invalidate();
    };
    draw();
    // the face may land after the first draw
    document.fonts?.load(`500 ${SIZE}px Aeonik`).then(draw, () => {});
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
