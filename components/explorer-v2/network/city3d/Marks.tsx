"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import type { District } from "@/components/explorer-v2/network/districts";
import type { City } from "@/components/explorer-v2/network/city";
import type { Theme } from "./palette";
import type { CityModel } from "./model";

/* What the cursor and a pick mark on the ground, as the map marks them: a
   picked set's lot outlined in the explorer's blue, under
   its tower, and one ring that spreads out from it as it lands; the lot
   under the cursor, lighter. Downtown, picked, sends two red rings out
   across its plaza once the camera has landed on it. A picked tower keeps
   its district's glass, since its color says what it is for. */

/** the lot's reach and the ring's, over the tower's half-width, as the map draws them */
const LOT = 1.55;
const RING = 2.8;
/** the lines' width, in the plan's units */
const LINE = 0.9;
/** the ring spreads over this long, a moment after the pick */
const RIPPLE_S = 1.4;
const RIPPLE_AT = 0.15;
/** downtown's two rings, once the close-up has landed: their lag, how long each runs, and when the first starts */
const HUB_RINGS = [0, 0.26];
const HUB_RING_S = 1.5;
const HUB_RING_AT = 1.3;

/* the city's square turned to the plate: its corners at the plan's four points, half-diagonal 1 */
const CORNERS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/* a flat diamond: its fill, or its outline as a band `width` wide in from its edge */
function diamond(band: boolean): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(new Float32Array(band ? 24 : 12), 3));
  const idx: number[] = [];
  if (band)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      idx.push(i, j, 4 + i, j, 4 + j, 4 + i);
    }
  else idx.push(0, 2, 1, 0, 3, 2);
  g.setIndex(idx);
  return g;
}
/* sets a diamond's reach, and a band's width; an edge moves in by w as the half-diagonal shrinks by w * sqrt(2) */
function shape(g: BufferGeometry, r: number, width = 0) {
  const p = g.getAttribute("position") as Float32BufferAttribute;
  const inner = Math.max(0, r - width * Math.SQRT2);
  CORNERS.forEach(([x, z], i) => {
    p.setXYZ(i, x * r, 0, z * r);
    if (p.count > 4) p.setXYZ(4 + i, x * inner, 0, z * inner);
  });
  p.needsUpdate = true;
  g.computeBoundingSphere();
}

const mat = (opacity: number) => new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
/** the run of a spreading ring, in the brand's motion (fast attack, long decay): its reach and its strength at a share of its time */
const spread = (run: number): [number, number] => [0.12 + 0.88 * (1 - Math.pow(2, -10 * run)), run < 0.06 ? (run / 0.06) * 0.9 : 0.9 * Math.pow(1 - (run - 0.06) / 0.94, 2)];

export function Marks({ model, city, hover, pick, focus, theme, still }: { model: CityModel; city: City; hover: number; pick: number; focus: District | null; theme: Theme; still: boolean }) {
  const dark = theme === "dark";
  const parts = useMemo(() => {
    const flat = (g: BufferGeometry, m: MeshBasicMaterial) => {
      const o = new Mesh(g, m);
      o.renderOrder = 1;
      o.visible = false;
      o.frustumCulled = false;
      return o;
    };
    return {
      pickFill: flat(diamond(false), mat(0.08)),
      pickLine: flat(diamond(true), mat(0.7)),
      ripple: flat(diamond(true), mat(0)),
      hoverFill: flat(diamond(false), mat(0.04)),
      hoverLine: flat(diamond(true), mat(0.32)),
      hub: HUB_RINGS.map(() => flat(new RingGeometry(0.985, 1, 128).rotateX(-Math.PI / 2), mat(0))),
    };
  }, []);
  const all = [parts.pickFill, parts.pickLine, parts.ripple, parts.hoverFill, parts.hoverLine, ...parts.hub];
  useEffect(
    () => () => {
      for (const o of [parts.pickFill, parts.pickLine, parts.ripple, parts.hoverFill, parts.hoverLine, ...parts.hub]) {
        o.geometry.dispose();
        (o.material as MeshBasicMaterial).dispose();
      }
    },
    [parts],
  );
  // the explorer's blue, and downtown's red
  useEffect(() => {
    const blue = new Color(dark ? "#5F9DFF" : "#0061E2");
    for (const o of [parts.pickFill, parts.pickLine, parts.ripple, parts.hoverFill, parts.hoverLine]) (o.material as MeshBasicMaterial).color.copy(blue);
    for (const o of parts.hub) (o.material as MeshBasicMaterial).color.set(dark ? "#FF5A64" : "#E6212F");
    (parts.pickFill.material as MeshBasicMaterial).opacity = dark ? 0.1 : 0.08;
    (parts.pickLine.material as MeshBasicMaterial).opacity = dark ? 0.75 : 0.7;
  }, [parts, dark]);

  /* a mark lies on its tower's lot, over the block's top, sized to the tower; a set
     out of the district in view is not marked, and downtown marks itself with its rings */
  const markable = (b: number) => {
    const bd = model.buildings[b];
    return bd && bd.n.role !== "hub" && (focus === null || bd.n.district === focus) ? bd : null;
  };
  const pickAt = useRef(0);
  useEffect(() => {
    pickAt.current = performance.now();
    const bd = markable(pick);
    if (!bd) return;
    shape(parts.pickFill.geometry, bd.n.w * LOT);
    shape(parts.pickLine.geometry, bd.n.w * LOT, LINE);
    // the ring's line is the map's width at its full reach
    shape(parts.ripple.geometry, 1, LINE / (bd.n.w * RING));
    for (const o of [parts.pickFill, parts.pickLine, parts.ripple]) o.position.set(bd.x, bd.base + 0.06, bd.z);
    // the building list is read with the pick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, parts, model, focus]);
  useEffect(() => {
    const bd = hover === pick ? null : markable(hover);
    if (!bd) return;
    shape(parts.hoverFill.geometry, bd.n.w * LOT);
    shape(parts.hoverLine.geometry, bd.n.w * LOT, LINE);
    for (const o of [parts.hoverFill, parts.hoverLine]) o.position.set(bd.x, bd.base + 0.06, bd.z);
    // the building list is read with the hover
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, pick, parts, model, focus]);

  useFrame(() => {
    const t = (performance.now() - pickAt.current) / 1000;
    const picked = markable(pick);
    parts.pickFill.visible = parts.pickLine.visible = !!picked;
    // the ring: out from the lot, bright at once, fading long to its run's end
    const run = (t - RIPPLE_AT) / RIPPLE_S;
    parts.ripple.visible = !!picked && !still && run > 0 && run < 1;
    if (picked && parts.ripple.visible) {
      const [k, a] = spread(run);
      const r = picked.n.w * RING * k;
      parts.ripple.scale.set(r, 1, r);
      (parts.ripple.material as MeshBasicMaterial).opacity = a;
    }
    const hovered = hover === pick ? null : markable(hover);
    parts.hoverFill.visible = parts.hoverLine.visible = !!hovered;
    // downtown picked: its two rings out across the plaza once the camera has landed
    const hub = model.buildings[pick];
    parts.hub.forEach((o, i) => {
      const run2 = (t - HUB_RING_AT - HUB_RINGS[i]) / HUB_RING_S;
      o.visible = !still && !!hub && hub.n.role === "hub" && focus === null && run2 > 0 && run2 < 1;
      if (!o.visible) return;
      const [k, a] = spread(run2);
      const r = city.core * 0.96 * k;
      o.position.set(hub.x, hub.base + 0.08, hub.z);
      o.scale.set(r, 1, r);
      (o.material as MeshBasicMaterial).opacity = a;
    });
  });

  return (
    <group>
      {all.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  );
}
