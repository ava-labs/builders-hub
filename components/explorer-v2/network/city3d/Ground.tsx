"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
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

/* The ground: the plate, the board the city stands on, the abacus of the
   column under it (Pillar.tsx). Its top and every block's top read one
   paint (paint.ts); the blocks stand proud of the streets on their curbs,
   the river runs in its bed to the rim as a quiet line of dark, glassy
   steel-blue water with the bridges over it, and the trees and the
   outskirts' low blocks stand on it. A district lights under the cursor
   or the camera. A click on the ground steps back. */

/** the river's water, by day and by night: dark steel-blue glass, and the light it takes */
const RIVER = {
  light: { color: "#566A7F", specular: "#DCE4EE" },
  dark: { color: "#141D27", specular: "#3B4C5E" },
};

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
  useEffect(() => {
    if (!canvas || !texture) return;
    paintGround(canvas, { ...paint, theme });
    texture.needsUpdate = true;
    invalidate();
  }, [canvas, texture, paint, theme, invalidate]);

  const sectorU = useMemo<SectorUniforms>(() => sectorUniforms(), []);
  const mats = useMemo(() => {
    const top = texture ? groundMaterial(texture, sectorU, "ground") : new MeshLambertMaterial();
    return {
      top,
      lip: new MeshLambertMaterial({ color: 0xffffff }),
      water: new MeshPhongMaterial({ color: 0xffffff, specular: new Color("#FFFFFF"), shininess: 60 }),
      bridge: new MeshLambertMaterial({ color: 0xffffff }),
      bridgeSide: new MeshLambertMaterial({ color: 0xffffff }),
      tree: new MeshLambertMaterial({ color: 0xffffff }),
      trunk: new MeshLambertMaterial({ color: 0xffffff }),
      outskirt: new MeshLambertMaterial({ color: 0xffffff }),
    };
  }, [texture, sectorU]);

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
    // the outskirts' low plain blocks, and the trees
    const masses = instanced(
      standingBox(),
      mats.outskirt,
      outskirts.masses.map((m) => ({ b: -1, x: m.x, y: 0, z: m.z, sx: m.w * Math.SQRT2, sy: m.h, sz: m.w * Math.SQRT2, yaw: -Math.PI / 4 })),
      [],
      { cast: true },
    );
    const [crowns, trunks] = treesOf(trees, [], mats.tree, mats.trunk);
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
    mats.lip.color.set(GROUND.blockLip[t]);
    mats.water.color.set(RIVER[t].color);
    mats.water.specular.set(RIVER[t].specular);
    mats.bridge.color.set(GROUND.bridge[t]);
    mats.bridgeSide.color.set(GROUND.bridgeEdge[t]);
    mats.tree.color.set(GROUND.tree[t]);
    mats.trunk.color.set(GROUND.trunk[t]);
    mats.outskirt.color.set(GROUND.outskirt[t]);
    sectorU.uSectorColor.value.set(GROUND.district[t]);
  }, [theme, dark, mats, sectorU]);

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
      <primitive object={meshes.top} onClick={click} />
      <primitive object={meshes.blocks} onClick={click} />
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
