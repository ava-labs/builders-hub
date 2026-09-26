"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FLOOR, crestOf } from "@/components/explorer-v2/network/icm-map";
import type { Site } from "@/components/explorer-v2/network/newcomers";
import { GROUND, ROOF, type Theme } from "./palette";
import { YAW, type CityModel, type Outskirts } from "./model";
import { instanced } from "./instancing";
import { standingBox } from "./geometry";
import { massMaterial, RISE_S, TIME } from "./shaders";

/* The city's building sites, as the map draws them, in hairline steel: a
   new L1 still going up stands in scaffolding round its top storeys, and a
   district's newest site has the district's one tower crane beside it,
   its jib turning now and then to a new heading over the roofs; out past
   the Frontier, each L1 the P-Chain has created that runs no validators
   yet is a fenced lot with its first materials stacked on it, the first
   of them with a small crane of its own. A tower crane is built as the
   real thing, a lattice mast on its footing under the slewing jib with its
   counterweights and cab. */

type Part = { g: BufferGeometry; tone: "steel" | "iron" | "cab" | "weight" | "glass" };

/* a box between two points of the crane's frame, as thick as w */
function bar(a: Vector3, b: Vector3, w: number): BufferGeometry {
  const d = new Vector3().subVectors(b, a);
  const len = d.length();
  const g = new BoxGeometry(w, len, w).translate(0, len / 2, 0);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  return g.applyMatrix4(new Matrix4().compose(a, q, new Vector3(1, 1, 1)));
}
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** a tower crane's two halves, in its own frame, its jib out along +x: the mast that stands, and the top that slews */
function craneParts(mast: number, reach: number, k: number): { tower: Part[]; top: Part[] } {
  const mw = 3.2 * k;
  const r = mw / 2;
  const rail = 0.34 * k;
  const tower: Part[] = [{ g: box(-mw, 0, -mw, mw, 1.3 * k, mw), tone: "iron" }];
  // the mast's four rails, and the zigzag of bracing up each face
  const corners = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ];
  for (const [x, z] of corners) tower.push({ g: bar(new Vector3(x, 1.3 * k, z), new Vector3(x, mast, z), rail), tone: "steel" });
  const rungs = Math.max(2, Math.floor(mast / mw));
  for (let f = 0; f < 4; f++) {
    const [ax, az] = corners[f];
    const [bx, bz] = corners[(f + 1) % 4];
    for (let i = 0; i < rungs; i++) {
      const y0 = 1.3 * k + ((mast - 1.3 * k) * i) / rungs;
      const y1 = 1.3 * k + ((mast - 1.3 * k) * (i + 1)) / rungs;
      const [p, q] = i % 2 ? [new Vector3(ax, y0, az), new Vector3(bx, y1, bz)] : [new Vector3(bx, y0, bz), new Vector3(ax, y1, az)];
      tower.push({ g: bar(p, q, rail * 0.6), tone: "steel" });
    }
  }
  // the top: the slewing unit, the cat-head's A-frame, the jib, the counter-jib and its weights, the cab, the trolley and its hook
  const top: Part[] = [{ g: box(-mw * 0.75, 0, -mw * 0.75, mw * 0.75, 2.2 * k, mw * 0.75), tone: "steel" }];
  const apex = new Vector3(0, 9 * k, 0);
  top.push({ g: bar(new Vector3(-mw * 0.55, 2.2 * k, 0), apex, rail), tone: "steel" }, { g: bar(new Vector3(mw * 0.55, 2.2 * k, 0), apex, rail), tone: "steel" });
  const j0 = mw / 2;
  const h = 2.2 * k;
  const tip = new Vector3(reach, h, 0);
  const chord = (x: number) => h + 2.6 * k - 1.8 * k * ((x - j0) / Math.max(1, reach - j0));
  for (const z of [-r * 0.8, r * 0.8]) top.push({ g: bar(new Vector3(j0, h, z), new Vector3(reach, h, z), rail), tone: "steel" });
  top.push({ g: bar(new Vector3(j0, chord(j0), 0), new Vector3(reach, chord(reach), 0), rail), tone: "steel" });
  const bays = Math.max(3, Math.floor((reach - j0) / (3.2 * k)));
  for (let i = 0; i < bays; i++) {
    const x0 = j0 + ((reach - j0) * i) / bays;
    const x1 = j0 + ((reach - j0) * (i + 1)) / bays;
    for (const z of [-r * 0.8, r * 0.8]) top.push({ g: bar(new Vector3(i % 2 ? x1 : x0, h, z), new Vector3(i % 2 ? x0 : x1, chord(i % 2 ? x0 : x1), 0), rail * 0.55), tone: "steel" });
  }
  top.push({ g: bar(new Vector3(reach, h, 0), new Vector3(reach, chord(reach), 0), rail), tone: "steel" });
  // the pendant ties from the cat-head to the jib and back to the counter-jib
  top.push({ g: bar(apex, new Vector3(reach * 0.62, chord(reach * 0.62), 0), rail * 0.4), tone: "iron" });
  const counter = reach * 0.36 + 4 * k;
  top.push({ g: bar(new Vector3(-j0, h, -r * 0.7), new Vector3(-counter, h, -r * 0.7), rail), tone: "steel" }, { g: bar(new Vector3(-j0, h, r * 0.7), new Vector3(-counter, h, r * 0.7), rail), tone: "steel" });
  top.push({ g: bar(apex, new Vector3(-counter, h + 0.4, 0), rail * 0.4), tone: "iron" });
  top.push({ g: box(-counter, h - 3.6 * k, -r, -counter + 3.1 * k, h, r), tone: "weight" }, { g: box(-counter + 3.4 * k, h - 3.6 * k, -r, -counter + 6.5 * k, h, r), tone: "weight" });
  top.push({ g: box(j0, h - 2.9 * k, r * 0.2, j0 + 3.3 * k, h, r + 1.2 * k), tone: "cab" }, { g: box(j0 + 1.9 * k, h - 2.2 * k, r + 1.21 * k, j0 + 3.2 * k, h - 0.9 * k, r + 1.25 * k), tone: "glass" });
  const run = reach * 0.62;
  const drop = 11 * k;
  top.push({ g: box(run - 1.7 * k, h - 1.3 * k, -r * 0.8, run + 1.7 * k, h, r * 0.8), tone: "steel" });
  top.push({ g: bar(new Vector3(run, h - 1.3 * k, 0), new Vector3(run, h - drop, 0), 0.12 * k), tone: "iron" });
  top.push({ g: box(run - 1.3 * k, h - drop - 1.9 * k, -1 * k, run + 1.3 * k, h - drop, 1 * k), tone: "steel" });
  return { tower, top };
}

/* a crane's half, merged, each part in its own paint */
function merged(parts: Part[], tones: Record<Part["tone"], Color>): BufferGeometry {
  const gs = parts.map(({ g, tone }) => {
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([tones[tone].r, tones[tone].g, tones[tone].b], i * 3);
    g.setAttribute("color", new Float32BufferAttribute(c, 3));
    return g.index ? g.toNonIndexed() : g;
  });
  const out = mergeGeometries(gs, false) ?? new BufferGeometry();
  gs.forEach((g) => g.dispose());
  return out;
}

/* a crane's jib heading at a time: a turn every CYCLE seconds to the next of its headings, eased as every motion of the city is, and held */
const CYCLE = 9;
const TURN = 3.5;
const headingOf = (c: CraneSpec, n: number) => c.yaw + Math.sin(n * 2.3 + c.slew * 40) * 0.9;
function jibAt(c: CraneSpec, t: number): number {
  const n = Math.floor(t / CYCLE);
  const u = Math.min(1, (t - n * CYCLE) / TURN);
  const e = u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
  return headingOf(c, n) + (headingOf(c, n + 1) - headingOf(c, n)) * e;
}

interface CraneSpec {
  key: string;
  x: number;
  y: number;
  z: number;
  mast: number;
  reach: number;
  k: number;
  /** its building's turn in the build-out, in the city's seconds */
  rise: number;
  /** its jib's heading at rest, and the seed of the headings it turns to */
  yaw: number;
  slew: number;
}

export function Sites({
  model,
  outskirts,
  rise,
  theme,
  still,
  onSite,
  onOpenSite,
}: {
  model: CityModel;
  outskirts: Outskirts;
  rise: Float32Array;
  theme: Theme;
  still: boolean;
  /** the site under the cursor */
  onSite: (site: Site | null) => void;
  onOpenSite: (site: Site) => void;
}) {
  const dark = theme === "dark";
  // one crane to a district, at its newest site, as the map has; and the outskirts' first site's small one
  const cranes = useMemo<CraneSpec[]>(() => {
    const newest = new Map<string | null, number>();
    model.buildings.forEach((b, i) => {
      if (b.n.newAt === null) return;
      const had = newest.get(b.n.district);
      if (had === undefined || (b.n.newAt ?? 0) > (model.buildings[had].n.newAt ?? 0)) newest.set(b.n.district, i);
    });
    const out: CraneSpec[] = [...newest.values()].map((i) => {
      const b = model.buildings[i];
      const w = b.n.w;
      return {
        key: b.id,
        x: b.x - w * 1.3,
        y: b.base,
        z: b.z - w * 0.35,
        mast: crestOf(w, b.n.h, b.form) + 12,
        reach: w * 1.7 + 8,
        k: 0.85,
        rise: rise[i] + RISE_S,
        yaw: Math.PI / 4,
        slew: 0.05 + (i % 3) * 0.012,
      };
    });
    const first = outskirts.sites[0];
    if (first) out.push({ key: "site", x: first.x - first.w * 0.25, y: 0, z: first.z - 1, mast: 22, reach: 16, k: 0.7, rise: 0.4, yaw: -Math.PI / 5, slew: 0.07 });
    return out;
  }, [model, outskirts, rise]);

  const mat = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), []);
  const built = useMemo(() => {
    // hairline steel, the brand's block gray; nothing yellow
    const tones = {
      steel: new Color(ROOF.crane[theme]),
      iron: new Color(dark ? "#6E7A80" : "#8A969A"),
      cab: new Color(dark ? "#C9D3DF" : "#F4F6F9"),
      weight: new Color(dark ? "#4F5B66" : "#6B777B"),
      glass: new Color(dark ? "#5A6A78" : "#3B484B"),
    };
    return cranes.map((c) => {
      const { tower, top } = craneParts(c.mast, c.reach, c.k);
      const t = new Mesh(merged(tower, tones), mat);
      const g = new Group();
      const head = new Mesh(merged(top, tones), mat);
      head.position.y = c.mast;
      g.add(t, head);
      g.position.set(c.x, c.y, c.z);
      // the mast casts its shadow; the jib slews, and the city's shadows are drawn once
      t.castShadow = true;
      t.receiveShadow = true;
      head.receiveShadow = true;
      return { spec: c, group: g, head };
    });
  }, [cranes, mat, theme, dark]);
  useEffect(
    () => () => {
      for (const b of built) b.group.traverse((o) => o instanceof Mesh && o.geometry.dispose());
    },
    [built],
  );

  // scaffolding round each new L1's top storeys, one storey over its roof
  const scaffold = useMemo(() => {
    const pts: number[] = [];
    const push = (a: Vector3, b: Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    model.buildings.forEach((b) => {
      if (b.n.newAt === null || b.n.role === "hub") return;
      const t = b.parts[b.parts.length - 1];
      const w = t.w + 0.9;
      const z0 = b.base + Math.max(t.z0, b.n.h - 2 * FLOOR);
      const z1 = b.base + b.n.h + FLOOR * 0.9;
      const c = [
        [b.x - w, b.z],
        [b.x, b.z + w],
        [b.x + w, b.z],
        [b.x, b.z - w],
      ];
      for (const [x, z] of c) push(new Vector3(x, z0, z), new Vector3(x, z1, z));
      for (let y = z0 + FLOOR; y <= z1 + 0.01; y += FLOOR)
        for (let i = 0; i < 4; i++) push(new Vector3(c[i][0], y, c[i][1]), new Vector3(c[(i + 1) % 4][0], y, c[(i + 1) % 4][1]));
      for (let i = 0; i < 4; i++) push(new Vector3(c[i][0], z1, c[i][1]), new Vector3(c[(i + 1) % 4][0], z1, c[(i + 1) % 4][1]));
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return new LineSegments(g, new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  }, [model]);
  useEffect(() => {
    (scaffold.material as LineBasicMaterial).color.set("#A2AFB2");
    (scaffold.material as LineBasicMaterial).opacity = dark ? 0.5 : 0.7;
  }, [scaffold, dark]);
  useEffect(() => () => scaffold.geometry.dispose(), [scaffold]);
  const newRise = useMemo(() => Math.max(0, ...model.buildings.map((b, i) => (b.n.newAt !== null ? rise[i] : 0))) + RISE_S, [model, rise]);

  // the outskirts' sites: each lot's first materials, and a clear box the cursor catches
  const pileMat = useMemo(() => massMaterial({ key: "pile", foot: 1 }), []);
  const pickMat = useMemo(() => new MeshBasicMaterial({ visible: false }), []);
  const piles = useMemo(() => {
    const list = outskirts.sites.flatMap((s) => [
      { b: -1, x: s.x - s.w * 0.45, y: 0, z: s.z + 2.4, sx: s.w * 0.28 * Math.SQRT2, sy: 2.2, sz: s.w * 0.28 * Math.SQRT2, yaw: YAW },
      { b: -1, x: s.x + s.w * 0.35, y: 0, z: s.z - 1.6, sx: s.w * 0.22 * Math.SQRT2, sy: 3.4, sz: s.w * 0.22 * Math.SQRT2, yaw: YAW },
    ]);
    return instanced(standingBox(), pileMat, list, [], { cast: true });
  }, [outskirts, pileMat]);
  const picks = useMemo(
    () => instanced(standingBox(), pickMat, outskirts.sites.map((s) => ({ b: -1, x: s.x, y: 0, z: s.z, sx: 26, sy: 26, sz: 26, yaw: YAW })), [], { receive: false }),
    [outskirts, pickMat],
  );
  useEffect(() => {
    pileMat.color.set(GROUND.pile[theme]);
  }, [pileMat, theme]);
  useEffect(
    () => () => {
      piles.geometry.dispose();
      picks.geometry.dispose();
    },
    [piles, picks],
  );

  const group = useRef<Group>(null);
  useFrame(() => {
    const t = TIME.value;
    for (const b of built) {
      b.group.visible = still || t > b.spec.rise;
      // the jib works as a crane does: it turns to a new heading, fast then slow, and holds there
      b.head.rotation.y = still ? b.spec.yaw : jibAt(b.spec, t);
    }
    scaffold.visible = still || t > newRise;
  });

  return (
    <group ref={group}>
      {built.map((b) => (
        <primitive key={b.spec.key} object={b.group} />
      ))}
      <primitive object={scaffold} />
      <primitive object={piles} />
      <primitive
        object={picks}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onSite(e.instanceId !== undefined ? outskirts.sites[e.instanceId]?.site ?? null : null);
        }}
        onPointerOut={() => onSite(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6 || e.instanceId === undefined) return;
          e.stopPropagation();
          const s = outskirts.sites[e.instanceId];
          if (s) onOpenSite(s.site);
        }}
      />
    </group>
  );
}

