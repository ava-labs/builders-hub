"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  Mesh,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  RGBADepthPacking,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  type Material,
} from "three";
import { PLATE, RING_IN } from "@/components/explorer-v2/network/icm-map";
import type { City } from "@/components/explorer-v2/network/city";
import type { Ground as Terrain } from "@/components/explorer-v2/network/ground";
import { GROUND, type Theme } from "./palette";
import { BLOCK_H, type Outskirts, type Tree } from "./model";
import { arcsOfPath, plateUv, polygonsOfPath, slabsOf, standingBox } from "./geometry";
import { groundMaterial, sectorUniforms, type SectorUniforms } from "./shaders";
import { instanced, treesOf } from "./instancing";
import { paintGround, PAINT_PX, type PaintInput } from "./paint";
import { HAZE_COLOR, HAZE_GLSL, MIST_COLOR } from "./haze";
import { OPENING } from "./warmup";

/* The ground: the plate, the board the city stands on, the abacus of the
   column under it (Pillar.tsx). Its top and every block's top read one
   paint (paint.ts); the blocks stand proud of the streets on their curbs,
   the river runs in its bed to the rim as a quiet line of glassy steel
   water, pale by day and dark with a sheen by night, with the bridges
   over it, and the trees and the outskirts' low blocks stand on it. A district lights under the cursor
   or the camera. A click on the ground steps back. The plan paints in once the column has landed
   (OPENING.paint, warmup.tsx): a wave out from downtown to the rim, soft at its front, takes the
   plate from its plain top to the paint, and what stands on it comes up as the wave passes. As the
   column rises, the plate comes up out of the air with it (haze.ts). */

/** the river's water, by day and by night: pale steel by day, a dark steel by night that keeps a sheen, and the light it takes */
const RIVER = {
  light: { color: "#B9C7D6", specular: "#FFFFFF" },
  dark: { color: "#1B2530", specular: "#5A6E84" },
};

/* the paint's wave: its front runs from the plate's middle out past the rim as OPENING.paint goes from 0 to 1, this share of the
   plate's radius wide. Each material that meets it: "paint" takes the plate's plain top to the paint (the plate and the blocks'
   tops, which rise with it), "grow" stands up from the plate (the curbs' walls, the bridges, the outskirts), "tree" grows from
   its own point, and "water" takes the plain top to the river's water and its sheen. What the wave has not reached draws
   nothing, in the frame and in the sun's shadow. Each fades into the column's air by its height in the world, as the column does */
const WAVE = 0.25;
const PAINT_GLSL = /* glsl */ `
uniform float uPaint;
varying vec2 vPaintXZ;
float paintOf( vec2 xz ) { return smoothstep( 0.0, 1.0, ( uPaint * ${(1 + WAVE).toFixed(2)} - length( xz ) / ${PLATE.toFixed(1)} ) / ${WAVE.toFixed(2)} ); }`;
type PaintMode = "paint" | "grow" | "tree" | "water";
type Air = { haze: { value: Color }; mist: { value: Color } };
function paintIn<M extends Material>(m: M, mode: PaintMode, air: Air, plain?: { value: Color }): M {
  const base = m.onBeforeCompile;
  const key = m.customProgramCacheKey();
  m.onBeforeCompile = (s, r) => {
    base.call(m, s, r);
    s.uniforms.uPaint = OPENING.paint;
    s.uniforms.uOpen = OPENING.column;
    s.uniforms.uAir = air.haze;
    s.uniforms.uMist = air.mist;
    if (plain) s.uniforms.uPlain = plain;
    const scale = mode === "tree" ? "transformed *= paintOf( vPaintXZ );" : mode === "water" ? "" : "transformed.y *= paintOf( vPaintXZ );";
    s.vertexShader = s.vertexShader.replace("#include <common>", `#include <common>${PAINT_GLSL}${HAZE_GLSL}\nvarying float vAir;\nvarying float vMist;`).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
#ifdef USE_INSTANCING
vPaintXZ = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xz;
#else
vPaintXZ = ( modelMatrix * vec4( position, 1.0 ) ).xz;
#endif
${scale}
#ifdef USE_INSTANCING
float airY = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).y;
#else
float airY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;
#endif
vAir = hazeAt( airY );
vMist = mistAt( airY );`,
    );
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>${PAINT_GLSL}\nuniform vec3 uAir;\nuniform vec3 uMist;\nvarying float vAir;\nvarying float vMist;${plain ? "\nuniform vec3 uPlain;" : ""}`)
      // the air after the light, as the column's
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.rgb = mix( mix( gl_FragColor.rgb, uAir, vAir ), uMist, vMist );");
    if (mode === "paint") s.fragmentShader = s.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = mix( uPlain, diffuseColor.rgb, paintOf( vPaintXZ ) );");
    else if (mode === "water")
      s.fragmentShader = s.fragmentShader
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix( uPlain, diffuseColor.rgb, paintOf( vPaintXZ ) );")
        .replace("#include <specularmap_fragment>", "#include <specularmap_fragment>\nspecularStrength *= paintOf( vPaintXZ );");
    else s.fragmentShader = s.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif ( paintOf( vPaintXZ ) < 0.01 ) discard;");
  };
  m.customProgramCacheKey = () => `${key}|paint-${mode}`;
  return m;
}
/** the sun's shadow of what stands on the plate, cast only once the wave has reached it */
const paintDepth = (mode: "grow" | "tree", air: Air) => paintIn(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), mode, air);

/* where the river leaves the board: its water's points out at the ledger's round, in a run each side */
function mouthsOf(terrain: Terrain): { a: number; w: number }[] {
  if (!terrain.river) return [];
  const angles = polygonsOfPath(terrain.river.water)
    .flat()
    .filter(([x, y]) => Math.hypot(x, y) > RING_IN - 40)
    .map(([x, y]) => Math.atan2(y, x))
    .sort((a, b) => a - b);
  if (!angles.length) return [];
  // split the angles where they jump, and join the last run to the first across the turn
  const runs: number[][] = [[angles[0]]];
  for (let i = 1; i < angles.length; i++) {
    if (angles[i] - angles[i - 1] > 0.2) runs.push([]);
    runs[runs.length - 1].push(angles[i]);
  }
  if (runs.length > 1 && angles[0] + Math.PI * 2 - angles[angles.length - 1] < 0.2) runs[0].push(...runs.pop()!.map((a) => a - Math.PI * 2));
  return runs.slice(0, 2).map((r) => {
    const lo = Math.min(...r);
    const hi = Math.max(...r);
    return { a: (lo + hi) / 2, w: Math.max(14, (hi - lo) * RING_IN * 0.8) };
  });
}

/* the river's last reach, from the end of its bed out to the rim: a flat strip at the water's height */
function channelsOf(mouths: { a: number; w: number }[]): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const m of mouths) {
    const at = (r: number, s: number) => {
      const a = m.a + (s * m.w * 0.55) / r;
      return [r * Math.cos(a), 0.13, r * Math.sin(a)];
    };
    const A = at(RING_IN - 16, -1);
    const B = at(RING_IN - 16, 1);
    const C = at(PLATE - 0.3, 1);
    const D = at(PLATE - 0.3, -1);
    for (const q of [A, C, B, A, D, C]) {
      pos.push(q[0], q[1], q[2]);
      uv.push(q[0], -q[2]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function Ground({
  city,
  terrain,
  outskirts,
  trees,
  paint,
  theme,
  sector,
  onGround,
}: {
  city: City;
  terrain: Terrain;
  outskirts: Outskirts;
  trees: Tree[];
  paint: Omit<PaintInput, "theme">;
  theme: Theme;
  /** the district lit on the ground: its arc and how strongly */
  sector: { arc: [number, number, number, number]; on: boolean };
  onGround: () => void;
}) {
  const dark = theme === "dark";
  const gl = useThree((s) => s.gl);
  const canvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = PAINT_PX;
    return c;
  }, []);
  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.flipY = false;
    t.minFilter = LinearMipmapLinearFilter;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [canvas, gl]);
  const invalidate = useThree((s) => s.invalidate);
  // painted as it mounts, before any frame: a frame that drew it first put up the blank canvas, and the plate showed black
  useLayoutEffect(() => {
    if (!canvas || !texture) return;
    paintGround(canvas, { ...paint, theme });
    texture.needsUpdate = true;
    invalidate();
  }, [canvas, texture, paint, theme, invalidate]);

  const sectorU = useMemo<SectorUniforms>(() => sectorUniforms(), []);
  // the plate's top before the plan is painted on it, and the column's air
  const plain = useMemo(() => ({ value: new Color() }), []);
  const air = useMemo<Air>(() => ({ haze: { value: new Color() }, mist: { value: new Color() } }), []);
  const mats = useMemo(() => {
    const top = texture ? groundMaterial(texture, sectorU, "ground") : new MeshLambertMaterial();
    return {
      top: paintIn(top, "paint", air, plain),
      lip: paintIn(new MeshLambertMaterial({ color: 0xffffff }), "grow", air),
      water: paintIn(new MeshPhongMaterial({ color: 0xffffff, specular: new Color("#FFFFFF"), shininess: 60 }), "water", air, plain),
      bridge: paintIn(new MeshLambertMaterial({ color: 0xffffff }), "grow", air),
      bridgeSide: paintIn(new MeshLambertMaterial({ color: 0xffffff }), "grow", air),
      tree: paintIn(new MeshLambertMaterial({ color: 0xffffff }), "tree", air),
      trunk: paintIn(new MeshLambertMaterial({ color: 0xffffff }), "tree", air),
      outskirt: paintIn(new MeshLambertMaterial({ color: 0xffffff }), "grow", air),
      growDepth: paintDepth("grow", air),
      treeDepth: paintDepth("tree", air),
    };
  }, [texture, sectorU, plain, air]);

  const meshes = useMemo(() => {
    // the plate's top and its rim
    const disc = new CircleGeometry(PLATE, 160).rotateX(-Math.PI / 2);
    const uv = disc.getAttribute("uv");
    const pos = disc.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = plateUv(pos.getX(i), pos.getZ(i));
      uv.setXY(i, u, v);
    }
    const top = new Mesh(disc, mats.top);
    top.receiveShadow = true;
    // the blocks on their curbs: their tops read the paint, their walls the lip's shade
    const blocks = new Mesh(slabsOf(city.blocks.map((b) => ({ a0: b.a0, a1: b.a1, r0: b.r0 + 1.5, r1: b.r1 - 1.5 })), BLOCK_H), [mats.top, mats.lip]);
    blocks.castShadow = true;
    blocks.receiveShadow = true;
    blocks.customDepthMaterial = mats.growDepth;
    // the river in its bed, a little under the banks, and the bridges over it
    const water: Mesh[] = [];
    if (terrain.river) {
      const channels = new Mesh(channelsOf(mouthsOf(terrain)), mats.water);
      channels.receiveShadow = true;
      water.push(channels);
      for (const poly of polygonsOfPath(terrain.river.water)) {
        const s = new Shape(poly.map(([x, y]) => new Vector2(x, -y)));
        const g = new ShapeGeometry(s, 1).rotateX(-Math.PI / 2).translate(0, 0.12, 0);
        const m = new Mesh(g, mats.water);
        m.receiveShadow = true;
        water.push(m);
      }
    }
    const bridges = new Mesh(slabsOf(terrain.river ? arcsOfPath(terrain.river.bridges) : [], 0.9, 0.5), [mats.bridge, mats.bridgeSide]);
    bridges.castShadow = true;
    bridges.receiveShadow = true;
    bridges.customDepthMaterial = mats.growDepth;
    // the outskirts' low plain blocks, and the trees
    const masses = instanced(
      standingBox(),
      mats.outskirt,
      outskirts.masses.map((m) => ({ b: -1, x: m.x, y: 0, z: m.z, sx: m.w * Math.SQRT2, sy: m.h, sz: m.w * Math.SQRT2, yaw: -Math.PI / 4 })),
      [],
      { cast: true },
    );
    const [crowns, trunks] = treesOf(trees, [], mats.tree, mats.trunk);
    masses.customDepthMaterial = mats.growDepth;
    crowns.customDepthMaterial = mats.treeDepth;
    return { top, blocks, water, bridges, masses, crowns, trunks };
  }, [city, terrain, outskirts, trees, mats]);
  useEffect(
    () => () => {
      for (const m of [meshes.top, meshes.blocks, meshes.bridges, meshes.masses, meshes.crowns, meshes.trunks, ...meshes.water]) m.geometry.dispose();
    },
    [meshes],
  );

  useEffect(() => {
    const t = theme;
    plain.value.set(GROUND.plateTop[t]);
    air.haze.value.set(HAZE_COLOR[t]);
    air.mist.value.set(MIST_COLOR[t]);
    mats.lip.color.set(GROUND.blockLip[t]);
    mats.water.color.set(RIVER[t].color);
    mats.water.specular.set(RIVER[t].specular);
    mats.bridge.color.set(GROUND.bridge[t]);
    mats.bridgeSide.color.set(GROUND.bridgeEdge[t]);
    mats.tree.color.set(GROUND.tree[t]);
    mats.trunk.color.set(GROUND.trunk[t]);
    mats.outskirt.color.set(GROUND.outskirt[t]);
    sectorU.uSectorColor.value.set(GROUND.district[t]);
  }, [theme, dark, mats, sectorU, plain, air]);

  // the district's light eases in and out
  useFrame((_, dt) => {
    const want = sector.on ? 0.08 : 0;
    const a = sectorU.uSectorAlpha;
    a.value += (want - a.value) * Math.min(1, dt * 8);
    if (sector.on) sectorU.uSector.value = sector.arc;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    onGround();
  };
  return (
    <group>
      {/* keyed by their meshes, so a rebuilt ground still takes clicks (Buildings.tsx) */}
      <primitive key={meshes.top.uuid} object={meshes.top} onClick={click} />
      <primitive key={meshes.blocks.uuid} object={meshes.blocks} onClick={click} />
      {meshes.water.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={meshes.bridges} />
      <primitive object={meshes.masses} />
      <primitive object={meshes.crowns} />
      <primitive object={meshes.trunks} />
    </group>
  );
}
