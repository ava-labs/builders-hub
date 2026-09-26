"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";
import { PLATE, PLATE_T } from "@/components/explorer-v2/network/icm-map";
import { SEA_Y } from "./Backdrop";
import type { Theme } from "./palette";

/* The P-Chain as the ground under everything: the city's plate is the
   abacus of a giant Doric column of marble that rises out of the cloud
   sea, in Owen's marble. Under the plate its capital: the echinus swelling out to carry it,
   three annulets, the necking; under those the shaft, in twenty flutes,
   widening a little as it goes down, with a breath of entasis, its foot
   lost in the haze long before the clouds. One mesh, turned like a lathe
   with the flutes cut into it; the haze comes in after the light, so the
   lit marble fades into the air. It draws before the sky's sea, so the
   clouds lie over what is below them */

/** the shaft's radius under the capital: the plate overhangs it as an abacus does */
const SHAFT = PLATE * 0.74;
/** how far down the column runs: past the sea, so its foot is never seen */
const FOOT = SEA_Y - 600;
const FLUTES = 20;
/** segments round one flute, so its hollow turns smoothly */
const PER_FLUTE = 12;
/** a flute's depth, a share of the shaft's radius */
const FLUTE_DEPTH = 0.1;
/** Owen's marble: a square tile, this many round the shaft, and square down it */
const MARBLE_TILE = "/images/city3d/marble.webp";
const ROUND = 4;
const TILE = (2 * Math.PI * SHAFT) / ROUND;

/* the stone's tint over the marble, cool as the brand's grade: a cold white by day, graphite by
   night; and one red band round the necking, the brand's red band device, the column's only color */
const MARBLE: Record<Theme, { stone: string; haze: string }> = {
  light: { stone: "#F2F4F8", haze: "#E9EDF2" },
  dark: { stone: "#3B484B", haze: "#121A28" },
};
const BRAND_RED = "#E6212F";
/** the red band's height, under the annulets */
const BAND = 4;

/* the column's profile from the plate down: a height, a radius, and whether the flutes are cut there */
type Row = { y: number; r: number; fluted: boolean; band?: boolean };
function profile(): Row[] {
  const rows: Row[] = [];
  const top = -PLATE_T;
  // the abacus: the plate's own edge (a hair inside it, so the rim's words lie on it), then its underside to the echinus
  rows.push({ y: 0, r: PLATE - 0.4, fluted: false });
  rows.push({ y: top, r: PLATE - 0.4, fluted: false });
  // the echinus: a cushion from under the abacus's edge down to the shaft, swelling out
  const echinus = SHAFT * 0.24;
  const rTop = PLATE * 0.95;
  const rBot = SHAFT * 1.05;
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    rows.push({ y: top - u * echinus, r: rBot + (rTop - rBot) * Math.cos((u * Math.PI) / 2), fluted: false });
  }
  // three annulets: narrow rings stepped in
  let y = top - echinus;
  for (let k = 0; k < 3; k++) {
    rows.push({ y: y - 1, r: SHAFT * 1.035, fluted: false });
    rows.push({ y: y - 5, r: SHAFT * 1.035, fluted: false });
    rows.push({ y: y - 6, r: SHAFT * 1.012, fluted: false });
    y -= 7;
  }
  // the red band, a hair proud of the necking, then the necking, plain, then a groove where the flutes begin
  rows.push({ y: y - 0.5, r: SHAFT * 1.008, fluted: false, band: true });
  rows.push({ y: y - BAND, r: SHAFT * 1.008, fluted: false, band: true });
  rows.push({ y: y - BAND - 0.5, r: SHAFT, fluted: false });
  y -= BAND;
  rows.push({ y: y - 1, r: SHAFT, fluted: false });
  rows.push({ y: y - SHAFT * 0.12, r: SHAFT, fluted: false });
  y -= SHAFT * 0.12;
  rows.push({ y: y - 2, r: SHAFT * 0.985, fluted: false });
  rows.push({ y: y - 5, r: SHAFT, fluted: true });
  // the shaft: wider as it goes down, with its entasis
  const from = y - 5;
  const steps = 64;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    rows.push({ y: from + (FOOT - from) * t, r: SHAFT * (1 + 0.16 * t + 0.02 * Math.sin(Math.PI * t)), fluted: true });
  }
  return rows;
}

export function Pillar({ theme }: { theme: Theme }) {
  const geometry = useMemo(() => {
    const rows = profile();
    const seg = FLUTES * PER_FLUTE;
    const positions: number[] = [];
    const uvs: number[] = [];
    const fades: number[] = [];
    // how deep in its flute each point lies, 0 on an arris: the hollows darken and the arrises catch a line of light
    const cavities: number[] = [];
    const bands: number[] = [];
    const drop = rows[rows.length - 1].y;
    for (const row of rows) {
      // into the air: thin at first, whole by the foot
      const t = row.y / drop;
      const f = Math.min(1, Math.max(0, (t - 0.1) / 0.62));
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        // a flute's hollow between two sharp arrises
        const phase = (j % PER_FLUTE) / PER_FLUTE;
        const hollow = Math.pow(Math.sin(Math.PI * phase), 0.8);
        const r = row.fluted ? row.r * (1 - FLUTE_DEPTH * hollow) : row.r;
        cavities.push(row.fluted ? hollow : 0);
        bands.push(row.band ? 1 : 0);
        positions.push(Math.cos(a) * r, row.y, Math.sin(a) * r);
        uvs.push((j / seg) * ROUND, -row.y / TILE);
        fades.push(f * f * (3 - 2 * f));
      }
    }
    const index: number[] = [];
    const w = seg + 1;
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * w + j;
        const b = a + w;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    g.setAttribute("fade", new BufferAttribute(new Float32Array(fades), 1));
    g.setAttribute("cavity", new BufferAttribute(new Float32Array(cavities), 1));
    g.setAttribute("band", new BufferAttribute(new Float32Array(bands), 1));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, []);

  const haze = useMemo(() => ({ value: new Color() }), []);
  const red = useMemo(() => ({ value: new Color(BRAND_RED) }), []);
  const material = useMemo(() => {
    const m = new MeshLambertMaterial();
    // the haze after the light: the lit marble fades into the air it stands in
    m.onBeforeCompile = (s) => {
      s.uniforms.uHaze = haze;
      s.uniforms.uRed = red;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float fade;\nattribute float cavity;\nattribute float band;\nvarying float vFade;\nvarying float vCavity;\nvarying float vBand;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = fade;\nvCavity = cavity;\nvBand = band;");
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uHaze;\nuniform vec3 uRed;\nvarying float vFade;\nvarying float vCavity;\nvarying float vBand;")
        // the band's red is the stone's own color there, so it takes the light as the stone does
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix( diffuseColor.rgb, uRed, step( 0.5, vBand ) );")
        .replace(
          "#include <opaque_fragment>",
          // the flute's hollow in its own shade, a line of light on each arris, then the haze
          "#include <opaque_fragment>\ngl_FragColor.rgb *= mix( 1.06, 0.74, smoothstep( 0.0, 1.0, vCavity ) );\ngl_FragColor.rgb += 0.06 * pow( 1.0 - vCavity, 10.0 ) * step( 0.001, vCavity + 0.0005 );\ngl_FragColor.rgb = mix( gl_FragColor.rgb, uHaze, vFade );",
        );
    };
    return m;
  }, [haze]);

  // the marble, once the page has it; the plain stone shows until then
  useEffect(() => {
    let live = true;
    let tex: Texture | null = null;
    new TextureLoader().load(MARBLE_TILE, (t) => {
      if (!live) return t.dispose();
      t.colorSpace = SRGBColorSpace;
      t.wrapS = t.wrapT = RepeatWrapping;
      t.anisotropy = 8;
      tex = t;
      material.map = t;
      material.needsUpdate = true;
    });
    return () => {
      live = false;
      tex?.dispose();
    };
  }, [material]);

  useEffect(() => {
    material.color.set(MARBLE[theme].stone);
    haze.value.set(MARBLE[theme].haze);
  }, [material, haze, theme]);

  const mesh = useMemo(() => {
    const m = new Mesh(geometry, material);
    // after the sky (-20, which draws with no depth test) and before the sea (-19), so the clouds lie over its foot
    m.renderOrder = -19.5;
    m.frustumCulled = false;
    m.receiveShadow = true;
    return m;
  }, [geometry, material]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <primitive object={mesh} />;
}
