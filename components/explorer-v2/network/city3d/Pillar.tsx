"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial, type Texture } from "three";
import { PLATE, PLATE_T } from "@/components/explorer-v2/network/icm-map";
import { FOOT, HAZE_COLOR, HAZE_GLSL, MIST_COLOR } from "./haze";
import type { Theme } from "./palette";
import { loadTile, whiteTile } from "./tile";
import { OPENING } from "./warmup";

/* The P-Chain as the ground under everything: the city's plate is the
   abacus of a giant Doric column of marble that rises out of the cloud
   sea, in Owen's marble. The abacus runs deeper than the plate, under a
   crisp chamfer; under it the capital: the echinus swelling out to carry
   it, three flat annulets stepped in with a dark groove cut behind each,
   the brand's red band, the necking; under those the shaft, in twenty
   flutes, widening a little as it goes down, with a breath of entasis,
   its foot lost in the haze long before the clouds. One mesh, turned like
   a lathe with the flutes cut into it, its sharp edges kept sharp; the
   marble is laid along the profile, so every face carries it, and its
   veins lie a hair under the face. The haze comes in after the light, so the
   lit marble fades into the air (haze.ts). The haze stands in the world, not
   on the stone, so a column that moves up comes out of it. It draws before
   the sky's sea, so the clouds lie over what is below them */

/** the shaft's radius under the capital: the plate overhangs it as an abacus does */
const SHAFT = PLATE * 0.74;
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
  light: { stone: "#F2F4F8", haze: HAZE_COLOR.light },
  dark: { stone: "#3B484B", haze: HAZE_COLOR.dark },
};
const BRAND_RED = "#E6212F";
/** the abacus: its depth under the plate's top, deeper than the plate so the rim that carries the motto has weight, and the chamfer under its face */
const ABACUS = PLATE_T + 4;
const CHAMFER = 1.4;
/** the annulets: three flat fillets, each this tall, at these radii over the shaft's, stepping in; a groove cut in behind each face under it, this tall and this deep */
const FILLET = 8;
const FILLET_R = [1.05, 1.036, 1.022];
const GROOVE_H = 2.6;
const GROOVE_D = 3;
/** the red band's height, flush with the necking under the annulets */
const BAND = 8;
/** the shade the stone takes where it is cut in, at its deepest (the grooves), and how far its veins lie under its face */
const SHADE = 0.62;
const RELIEF = 24;

/* the column's profile from the plate down: a height, a radius, whether the flutes are cut there, the red band, and the shade where the stone is cut in */
type Row = { y: number; r: number; fluted: boolean; band: boolean; shade: number };
function profile(): Row[] {
  const rows: Row[] = [];
  const add = (y: number, r: number, o: Partial<Row> = {}) => rows.push({ y, r, fluted: false, band: false, shade: 0, ...o });
  // a crease: the same point again, so the faces either side keep their own normals and its edge stays sharp; the stone may change its band or shade there
  const crease = (o: Partial<Row> = {}) => rows.push({ ...rows[rows.length - 1], ...o });
  // the abacus: the plate's own edge (a hair inside it, so the rim's words lie on it), deeper than the plate, a chamfer under its face
  const rA = PLATE - 0.4;
  add(0, rA);
  add(-(ABACUS - CHAMFER), rA);
  crease();
  add(-ABACUS, rA - CHAMFER);
  // its underside in to the echinus, in the overhang's shade
  crease({ shade: 0.3 });
  const echinus = SHAFT * 0.24;
  const rTop = PLATE * 0.95;
  const rBot = SHAFT * FILLET_R[0];
  add(-ABACUS, rTop, { shade: 0.4 });
  crease({ shade: 0.4 });
  // the echinus: a cushion from under the abacus down to the annulets, swelling out, darker where the abacus hangs over it
  for (let i = 1; i <= 14; i++) {
    const u = i / 14;
    add(-ABACUS - u * echinus, rBot + (rTop - rBot) * Math.cos((u * Math.PI) / 2), { shade: 0.4 * Math.max(0, 1 - u / 0.45) });
  }
  // three annulets, each a flat face, then in over its groove, down its back, and out along its floor to the next face; the red band after the last
  let y = -ABACUS - echinus;
  crease();
  for (let k = 0; k < 3; k++) {
    const next = k < 2 ? SHAFT * FILLET_R[k + 1] : SHAFT;
    add(y - FILLET, SHAFT * FILLET_R[k]);
    crease({ shade: 1 });
    add(y - FILLET, next - GROOVE_D, { shade: 1 });
    crease();
    add(y - FILLET - GROOVE_H, next - GROOVE_D, { shade: 1 });
    crease();
    y -= FILLET + GROOVE_H;
    add(y, next, { shade: 1 });
    crease(k < 2 ? { shade: 0 } : { band: true, shade: 0 });
  }
  // the red band, flush with the necking, its edges sharp; the necking, plain; a groove where the flutes begin
  add(y - BAND, SHAFT, { band: true });
  crease({ band: false });
  y -= BAND;
  add(y - SHAFT * 0.12, SHAFT);
  y -= SHAFT * 0.12;
  add(y - 2, SHAFT * 0.985, { shade: 0.5 });
  add(y - 5, SHAFT, { fluted: true });
  // the shaft: wider as it goes down, with its entasis
  const from = y - 5;
  const steps = 64;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    add(from + (FOOT - from) * t, SHAFT * (1 + 0.16 * t + 0.02 * Math.sin(Math.PI * t)), { fluted: true });
  }
  return rows;
}

/* the column is turned once for the page: a second mount, and a return to the page, builds nothing */
let column: BufferGeometry | null = null;

export function Pillar({ theme }: { theme: Theme }) {
  const gl = useThree((s) => s.gl);
  const geometry = useMemo(() => {
    if (column) return column;
    const rows = profile();
    const seg = FLUTES * PER_FLUTE;
    const positions: number[] = [];
    const uvs: number[] = [];
    // how deep in its flute each point lies, 0 on an arris: the hollows darken and the arrises catch a line of light
    const cavities: number[] = [];
    const bands: number[] = [];
    const shades: number[] = [];
    // the marble laid along the profile, by its length, so the rings, the echinus and the abacus carry it as the shaft does
    let along = 0;
    rows.forEach((row, i) => {
      if (i > 0) along += Math.hypot(row.y - rows[i - 1].y, row.r - rows[i - 1].r);
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        // a flute's hollow between two sharp arrises
        const phase = (j % PER_FLUTE) / PER_FLUTE;
        const hollow = Math.pow(Math.sin(Math.PI * phase), 0.8);
        const r = row.fluted ? row.r * (1 - FLUTE_DEPTH * hollow) : row.r;
        cavities.push(row.fluted ? hollow : 0);
        bands.push(row.band ? 1 : 0);
        shades.push(row.shade);
        positions.push(Math.cos(a) * r, row.y, Math.sin(a) * r);
        uvs.push((j / seg) * ROUND, along / TILE);
      }
    });
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
    g.setAttribute("cavity", new BufferAttribute(new Float32Array(cavities), 1));
    g.setAttribute("band", new BufferAttribute(new Float32Array(bands), 1));
    g.setAttribute("shade", new BufferAttribute(new Float32Array(shades), 1));
    g.setIndex(index);
    g.computeVertexNormals();
    column = g;
    return g;
  }, []);

  const haze = useMemo(() => ({ value: new Color() }), []);
  const mist = useMemo(() => ({ value: new Color() }), []);
  const red = useMemo(() => ({ value: new Color(BRAND_RED) }), []);
  const material = useMemo(() => {
    // a white map until the marble comes, so its coming compiles nothing
    const m = new MeshLambertMaterial({ map: whiteTile() });
    // the haze after the light: the lit marble fades into the air it stands in, by its height in the world (haze.ts)
    m.onBeforeCompile = (s) => {
      s.uniforms.uHaze = haze;
      s.uniforms.uMist = mist;
      s.uniforms.uRed = red;
      s.uniforms.uOpen = OPENING.column;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", `#include <common>${HAZE_GLSL}\nattribute float cavity;\nattribute float band;\nattribute float shade;\nvarying float vFade;\nvarying float vMist;\nvarying float vCavity;\nvarying float vBand;\nvarying float vShade;`)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCavity = cavity;\nvBand = band;\nvShade = shade;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nfloat wy = ( modelMatrix * vec4( transformed, 1.0 ) ).y;\nvFade = hazeAt( wy );\nvMist = mistAt( wy );",
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
uniform vec3 uHaze;
uniform vec3 uMist;
uniform vec3 uRed;
varying float vFade;
varying float vMist;
varying float vCavity;
varying float vBand;
varying float vShade;
// a face tipped by a height's change across the pixel, as three's bump map tips it
vec3 veinNormal( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir ) {
  vec3 vSigmaX = normalize( dFdx( surf_pos ) );
  vec3 vSigmaY = normalize( dFdy( surf_pos ) );
  vec3 R1 = cross( vSigmaY, surf_norm );
  vec3 R2 = cross( surf_norm, vSigmaX );
  float fDet = dot( vSigmaX, R1 ) * faceDir;
  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
  return normalize( abs( fDet ) * surf_norm - vGrad );
}`,
        )
        // the band's red is the stone's own color there, so it takes the light as the stone does
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix( diffuseColor.rgb, uRed, step( 0.5, vBand ) );")
        // the marble's veins a hair under its face: the face tipped by the change of the stone's tone across the pixel, with no look-up of its own
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>\nnormal = veinNormal( - vViewPosition, normal, vec2( dFdx( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ), dFdy( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ) ) * ${RELIEF.toFixed(1)}, faceDirection );`,
        )
        .replace(
          "#include <opaque_fragment>",
          // the flute's hollow in its own shade, a line of light on each arris, the capital's grooves and overhang in theirs, then the haze
          `#include <opaque_fragment>\ngl_FragColor.rgb *= mix( 1.06, 0.74, smoothstep( 0.0, 1.0, vCavity ) );\ngl_FragColor.rgb += 0.06 * pow( 1.0 - vCavity, 10.0 ) * step( 0.001, vCavity + 0.0005 );\ngl_FragColor.rgb *= 1.0 - ${SHADE.toFixed(2)} * vShade;\ngl_FragColor.rgb = mix( gl_FragColor.rgb, uHaze, vFade );\ngl_FragColor.rgb = mix( gl_FragColor.rgb, uMist, vMist );`,
        );
    };
    return m;
  }, [haze, mist]);

  // the marble, once the page has it and it is on the GPU (tile.ts); the plain stone shows until then
  useEffect(() => {
    let live = true;
    let tex: Texture | null = null;
    const blank = material.map;
    void loadTile(gl, MARBLE_TILE, 8).then((t) => {
      if (!t) return;
      if (!live) return t.dispose();
      tex = t;
      material.map = t;
    });
    return () => {
      live = false;
      tex?.dispose();
      blank?.dispose();
    };
  }, [material, gl]);

  useEffect(() => {
    material.color.set(MARBLE[theme].stone);
    haze.value.set(MARBLE[theme].haze);
    mist.value.set(MIST_COLOR[theme]);
  }, [material, haze, mist, theme]);

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
