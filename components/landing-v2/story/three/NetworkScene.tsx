"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  MathUtils,
  Object3D,
  PlaneGeometry,
  QuadraticBezierCurve3,
  Vector3,
  type Group,
  type InstancedMesh,
  type LineBasicMaterial,
  type Mesh,
  type Texture,
} from "three";
import { MONO } from "../kit";
import { chainMark, markAtlas, plateNameCap, usePlateName, type ChainMark } from "./logos";
import { brandTone, PALETTE, shadedBox } from "./palette";
import type { SceneProps } from "./SceneFrame";

/* The network: every chain the explorer lists stands as a block in a cell
   on the P-Chain plate, busiest at the center. A block with an indexed
   count is as tall as its 30-day transactions; a chain with no indexed
   count stands at the base height, as a count of 0 does, so a height
   never claims a count the explorer does not have. Red messages travel
   the routes that carried ICM messages in the same 30 days, each as often
   as its share of the traffic.

   The scene keeps its own clock, which runs only while the box is on
   screen: the blocks rise once, from the center out, the first time the
   reader sees them, and the messages resume where they stopped. About
   10 s in, the messages slow to a stop and hold on their arcs, as the
   stills show; each pointer move over the drawing sets them flying for
   another 10 s, so nothing moves without end. The scene draws a frame
   only while something moves.

   Each block takes its company's color from its logo, and the logo lies
   on its roof. Blocks stand in steel at once; the colors and marks arrive
   when the logos have loaded. The plate's rim carries its name. */

export interface NetworkChain {
  id: string;
  name: string;
  /** 30-day transactions, or null when the chain is not indexed */
  txCount: number | null;
  /** the chain's logo URL (resolved by the page), or null for none */
  logo: string | null;
  /** the chain's explorer page, or null when the explorer has none */
  href: string | null;
}

export interface NetworkRoute {
  from: string;
  to: string;
  /** 30-day delivered messages */
  count: number;
}

export interface NetworkSceneProps {
  chains: NetworkChain[];
  routes: NetworkRoute[];
  /** chain ids that carry a name label */
  labelled: string[];
  /** false until the reader can see the box: the rise, the routes and the first messages wait for it */
  play?: boolean;
  /** a click on a block with an explorer page */
  onSelect?: (chain: NetworkChain) => void;
}

const CELL = 1;
const FOOT = 0.58;
const HUB_FOOT = 0.86;
/** the base height: a count of 0, or no indexed count */
const MIN_H = 0.14;
const MAX_H = 2.6;
const POOL = 96;
const TRIP_S = 1.9;
const ARC = 1.4;
/** the rise: each ring of cells starts this much after the one inside it, and grows for GROW_S */
const RING_S = 0.12;
const GROW_S = 0.9;
/** messages leave for this long at first, and again after each pointer move */
const SEND_S = 10;
/** the plate's rim past the outer cells: room for its name along the front-left edge */
const RIM = 0.4;
/** the plate's top face */
const PLATE_TOP = -0.01;
/** a mark's disc, as a share of its block's foot, and its rim's segments */
const MARK = 0.7;
const MARK_SEG = 32;
/** a mark or the name sits this far over the face it lies on, so the two never fight */
const DECAL_LIFT = 0.002;
/** the plate's name: its capital height on screen, px, and at most this share of the rim */
const NAME_CAP_PX = 8;
const NAME_FILL = 0.58;
/** the scene reports ready without the logos or the name after this long */
const READY_WAIT_MS = 3000;

interface Placed {
  id: string;
  name: string;
  logo: string | null;
  x: number;
  z: number;
  /** roof height */
  h: number;
  foot: number;
  /** grid rings from the center, for the rise order */
  ring: number;
}

/** the scene's own time, in seconds on screen, and when messages stop leaving */
interface SceneClock {
  t: number;
  until: number;
  /** the messages' own clock, which slows to a stop when the send window closes */
  m: number;
}

/** cells of a square spiral, center first */
function spiral(n: number): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  let x = 0;
  let z = 0;
  let leg = 1;
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let d = 0;
  while (out.length < n) {
    for (let rep = 0; rep < 2 && out.length < n; rep++) {
      for (let i = 0; i < leg && out.length < n; i++) {
        x += dirs[d][0];
        z += dirs[d][1];
        out.push([x, z]);
      }
      d = (d + 1) % 4;
    }
    leg++;
  }
  return out;
}

function layout(chains: NetworkChain[], routed: Set<string>): Placed[] {
  // busiest first; the id breaks ties, so the same data always draws the same plate
  const ranked = [...chains].sort((a, b) => (b.txCount ?? -1) - (a.txCount ?? -1) || a.id.localeCompare(b.id));
  const max = Math.max(1, ...ranked.map((c) => c.txCount ?? 0));
  // in each ring, the busiest chains stand level with the center, then behind it, then in front
  // (the camera sits at +x +z, so gx + gz > 0 is toward the reader)
  const cells = spiral(ranked.length).sort(
    ([ax, az], [bx, bz]) =>
      Math.max(Math.abs(ax), Math.abs(az)) - Math.max(Math.abs(bx), Math.abs(bz)) ||
      Math.abs(ax + az) - Math.abs(bx + bz) ||
      ax + az - (bx + bz),
  );
  // the front diagonal, (1,1), (2,2) and on, lies between the reader and the hub: it takes the
  // lowest chains with no ICM route, so no block hides the C-Chain and no arc runs down the line
  // of sight onto its leader
  const front = cells.filter(([gx, gz]) => gx === gz && gx > 0);
  const quiet = ranked.filter((c, i) => i > 0 && !routed.has(c.id)).reverse();
  const slot = new Map<string, [number, number]>();
  front.forEach((cell, k) => {
    if (quiet[k]) slot.set(quiet[k].id, cell);
  });
  const taken = new Set(slot.values());
  const rest = cells.filter((cell) => !taken.has(cell));
  let next = 0;
  return ranked.map((c, i) => {
    const [gx, gz] = slot.get(c.id) ?? rest[next++];
    // no indexed count stands at the base, with the 0 counts
    const share = c.txCount ? Math.log10(c.txCount + 1) / Math.log10(max + 1) : 0;
    return {
      id: c.id,
      name: c.name,
      logo: c.logo,
      x: gx * CELL,
      z: gz * CELL,
      h: MIN_H + (MAX_H - MIN_H) * share ** 1.6,
      foot: i === 0 ? HUB_FOOT : FOOT,
      ring: Math.max(Math.abs(gx), Math.abs(gz)),
    };
  });
}

/** the plate's side: the outer cells and a rim */
const plateSize = (extent: number) => extent * 2 + 1 + RIM * 2;

/** a block's roof at scene time t: each ring rises after the one inside it, eased out */
function heightAt(p: Placed, t: number, rising: boolean): number {
  const k = rising ? MathUtils.clamp((t - p.ring * RING_S) / GROW_S, 0, 1) : 1;
  return Math.max(0.001, p.h * (1 - (1 - k) ** 3));
}

let unitEdgeCache: Float32Array | null = null;
/** the twelve edges of a unit box on the origin, as line-segment vertices */
function unitEdges(): Float32Array {
  if (!unitEdgeCache) {
    const box = new BoxGeometry(1, 1, 1);
    const edges = new EdgesGeometry(box);
    unitEdgeCache = Float32Array.from(edges.getAttribute("position").array);
    box.dispose();
    edges.dispose();
  }
  return unitEdgeCache;
}

/** writes block i's edges at height h into one shared line buffer */
function writeEdges(out: Float32Array, i: number, p: Placed, h: number) {
  const unit = unitEdges();
  const o = i * unit.length;
  for (let v = 0; v < unit.length; v += 3) {
    out[o + v] = p.x + unit[v] * p.foot;
    out[o + v + 1] = (unit[v + 1] + 0.5) * h;
    out[o + v + 2] = p.z + unit[v + 2] * p.foot;
  }
}

/** one line geometry with every block's twelve edges, so the hairlines are one draw */
function edgesOf(solid: Placed[]): BufferGeometry {
  const out = new Float32Array(solid.length * unitEdges().length);
  solid.forEach((p, i) => writeEdges(out, i, p, p.h));
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(out, 3));
  return g;
}

/** the plate's grid on the cell borders, so each chain sits in its own cell */
function gridOf(extent: number): BufferGeometry {
  const half = extent * CELL + CELL / 2;
  const out: number[] = [];
  for (let k = 0; k <= extent * 2 + 1; k++) {
    const at = -half + k * CELL;
    out.push(at, 0, -half, at, 0, half, -half, 0, at, half, 0, at);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return g;
}

/** a line geometry with one segment */
function segmentOf(a: [number, number, number], b: [number, number, number]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([...a, ...b], 3));
  return g;
}

/** frees a geometry the scene built once nothing draws it */
function useDisposed(geometry: BufferGeometry) {
  useEffect(() => () => geometry.dispose(), [geometry]);
}

/**
 * Advances the scene clock before anything reads it, only while the box is
 * on screen, and asks for the next frame while something moves: the rise,
 * the routes fading in, messages in flight. The messages' clock eases to a
 * stop over the send window's last 0.8 s, so they hold on their arcs, as
 * the stills show, and the scene draws nothing more.
 */
function Tick({ clock, running }: { clock: RefObject<SceneClock>; running: boolean }) {
  useFrame((state, dt) => {
    if (!running) return;
    const c = clock.current;
    const step = Math.min(dt, 0.1);
    c.t += step;
    const pace = MathUtils.clamp((c.until - c.t) / 0.8, 0, 1);
    c.m += step * pace;
    if (pace > 0) state.invalidate();
  }, -1);
  return null;
}

/** on demand, ask for a frame when an input changes: a pointer move sends messages again and turns the rig */
function Kick({ running }: { running: boolean }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const pointer = useThree((s) => s.pointer);
  useEffect(() => {
    const el = gl.domElement;
    const kick = () => invalidate();
    // a pointer that leaves the drawing lets the rig turn back to rest
    const leave = () => {
      pointer.set(0, 0);
      invalidate();
    };
    el.addEventListener("pointermove", kick);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", kick);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl, invalidate, pointer]);
  useEffect(() => invalidate(), [running, invalidate]);
  return null;
}

/**
 * Tells the frame its first full frame is on the canvas: the first frame
 * once the marks and the plate's name are in (`when`). useFrame runs before
 * the draw, the next animation frame after it.
 */
function Ready({ when, onReady }: { when: boolean; onReady?: () => void }) {
  const sent = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  // a paused scene draws once more, so that frame is the one reported
  useEffect(() => {
    if (when) invalidate();
  }, [when, invalidate]);
  useFrame(() => {
    if (sent.current || !when) return;
    sent.current = true;
    requestAnimationFrame(() => onReady?.());
  });
  return null;
}

function Blocks({
  solid,
  colors,
  rise,
  clock,
  theme,
  onHover,
  onSelect,
  onStood,
}: {
  solid: Placed[];
  /** each block's face tone: its company's color, or the steel face */
  colors: Color[];
  /** seconds on the scene clock until every block stands */
  rise: number;
  clock: RefObject<SceneClock>;
  theme: SceneProps["theme"];
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onStood: () => void;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const palette = PALETTE[theme];
  // a prop, not an arg: a theme switch swaps the geometry on the same mesh, which keeps its matrices
  const geometry = useMemo(() => shadedBox(theme, 1, 1, 1), [theme]);
  useDisposed(geometry);
  const edges = useMemo(() => edgesOf(solid), [solid]);
  useDisposed(edges);
  const dummy = useMemo(() => new Object3D(), []);
  // the mesh and the line buffer that already hold the standing form
  const wrote = useRef<{ mesh: InstancedMesh | null; edges: BufferGeometry | null }>({ mesh: null, edges: null });
  const stood = useRef(false);

  // the tone of each block multiplies its shaded faces; set before the first
  // frame, so the shader never recompiles when the logos' colors arrive
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    colors.forEach((c, i) => m.setColorAt(i, c));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    invalidate();
  }, [colors, invalidate]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.current.t;
    const rising = t < rise;
    // once the blocks stand, write them once per mesh and data: a new chain
    // count makes a new mesh, and a new mesh starts from identity matrices
    if (!rising && wrote.current.mesh === m && wrote.current.edges === edges) return;
    const position = edges.getAttribute("position") as BufferAttribute;
    const lines = position.array as Float32Array;
    solid.forEach((p, i) => {
      const h = heightAt(p, t, rising);
      dummy.position.set(p.x, h / 2, p.z);
      dummy.scale.set(p.foot, h, p.foot);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      // the hairlines rise with their face, on the same eased height
      writeEdges(lines, i, p, h);
    });
    m.instanceMatrix.needsUpdate = true;
    position.needsUpdate = true;
    if (rising) return;
    // the pointer test reads this sphere: take it from the standing blocks
    m.computeBoundingSphere();
    wrote.current = { mesh: m, edges };
    if (!stood.current) {
      stood.current = true;
      onStood();
    }
  });

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, solid.length]}
        geometry={geometry}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(e.instanceId !== undefined ? (solid[e.instanceId]?.id ?? null) : null);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          const id = e.instanceId !== undefined ? solid[e.instanceId]?.id : undefined;
          if (id) onSelect(id);
        }}
      >
        <meshBasicMaterial vertexColors polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </instancedMesh>
      <lineSegments geometry={edges} frustumCulled={false}>
        <lineBasicMaterial color={palette.edge} />
      </lineSegments>
    </>
  );
}

interface Decal {
  p: Placed;
  /** the mark's cell in the atlas: left, bottom, width, height in UV */
  cell: [number, number, number, number];
}

const DISC = MARK_SEG + 1;

/** one geometry with every mark's disc, so the marks are one draw: a fan per disc, its UVs on the mark's cell */
function decalsOf(decals: Decal[]): BufferGeometry {
  const pos = new Float32Array(decals.length * DISC * 3);
  const uv = new Float32Array(decals.length * DISC * 2);
  const index = new Uint32Array(decals.length * MARK_SEG * 3);
  decals.forEach(({ p, cell: [u0, v0, su, sv] }, d) => {
    const r = (p.foot * MARK) / 2;
    const y = p.h + DECAL_LIFT;
    for (let k = 0; k < DISC; k++) {
      // vertex 0 is the center, then the rim
      const a = ((k - 1) / MARK_SEG) * Math.PI * 2;
      const dx = k === 0 ? 0 : Math.cos(a);
      const dz = k === 0 ? 0 : Math.sin(a);
      const o = d * DISC + k;
      pos.set([p.x + dx * r, y, p.z + dz * r], o * 3);
      // the mark faces the camera: its right is screen right (+x, -z), its up runs into the drawing (-x, -z)
      const lx = (dx - dz) / Math.SQRT2;
      const ly = (-dx - dz) / Math.SQRT2;
      uv.set([u0 + ((lx + 1) / 2) * su, v0 + ((ly + 1) / 2) * sv], o * 2);
    }
    for (let k = 0; k < MARK_SEG; k++) {
      const c = d * DISC;
      // wound to face up
      index.set([c, c + 1 + ((k + 1) % MARK_SEG), c + 1 + k], (d * MARK_SEG + k) * 3);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(index, 1));
  return g;
}

/** every chain's logo on a disc on its block's roof, rising with it */
function Decals({
  decals,
  texture,
  rise,
  clock,
  theme,
}: {
  decals: Decal[];
  texture: Texture;
  rise: number;
  clock: RefObject<SceneClock>;
  theme: SceneProps["theme"];
}) {
  const geometry = useMemo(() => decalsOf(decals), [decals]);
  useDisposed(geometry);
  const wrote = useRef<BufferGeometry | null>(null);
  useFrame(() => {
    const t = clock.current.t;
    const rising = t < rise;
    // the discs follow the rise on the blocks' own height; once they stand, once per geometry
    if (!rising && wrote.current === geometry) return;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const arr = position.array as Float32Array;
    decals.forEach(({ p }, d) => {
      const y = heightAt(p, t, rising) + DECAL_LIFT;
      for (let k = 0; k < DISC; k++) arr[(d * DISC + k) * 3 + 1] = y;
    });
    position.needsUpdate = true;
    if (!rising) wrote.current = geometry;
  });
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial map={texture} color={PALETTE[theme].mark} />
    </mesh>
  );
}

/**
 * The plate's name, painted on its rim along the front-left edge (z = +half),
 * reading toward the front corner. It sits on the edge's middle: a narrow
 * box crops the plate's side corners, never that.
 */
function PlateName({
  extent,
  name,
  theme,
}: {
  extent: number;
  name: NonNullable<ReturnType<typeof usePlateName>>;
  theme: SceneProps["theme"];
}) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(name.aspect, 1);
    // flat on the plate, face up, the letters' up into the plate (-z)
    g.rotateX(-Math.PI / 2);
    return g;
  }, [name]);
  useDisposed(geometry);
  // the same size on screen at every zoom, inside the rim
  useFrame(({ camera }) => {
    mesh.current?.scale.setScalar(plateNameCap(camera, NAME_CAP_PX, RIM * NAME_FILL) / name.cap);
  });
  return (
    <mesh ref={mesh} geometry={geometry} position={[0, PLATE_TOP + DECAL_LIFT, extent + CELL / 2 + RIM / 2]}>
      <meshBasicMaterial color={PALETTE[theme].plateInk} alphaMap={name.texture} transparent depthWrite={false} />
    </mesh>
  );
}

/** the arc a message flies from the rim of the sender's logo disc to the rim of the receiver's, so it never covers a logo */
function arcOf(a: Placed, b: Placed): QuadraticBezierCurve3 {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ra = (a.foot * MARK) / 2;
  const rb = (b.foot * MARK) / 2;
  const p0 = new Vector3(a.x + (dx / len) * ra, a.h, a.z + (dz / len) * ra);
  const p1 = new Vector3(b.x - (dx / len) * rb, b.h, b.z - (dz / len) * rb);
  const mid = p0.clone().add(p1).multiplyScalar(0.5);
  mid.y = Math.max(a.h, b.h) + ARC + p0.distanceTo(p1) * 0.12;
  return new QuadraticBezierCurve3(p0, mid, p1);
}

/** every route as one faint line, so a message's path reads before it flies; it fades in as the blocks stand */
function Routes({
  placed,
  routes,
  rise,
  clock,
  theme,
}: {
  placed: Placed[];
  routes: NetworkRoute[];
  rise: number;
  clock: RefObject<SceneClock>;
  theme: SceneProps["theme"];
}) {
  const material = useRef<LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const byId = new Map(placed.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const out: number[] = [];
    for (const r of routes) {
      const a = byId.get(r.from);
      const b = byId.get(r.to);
      if (!a || !b) continue;
      // one line per pair: both directions fly the same arc
      const key = [a.id, b.id].sort().join("~");
      if (seen.has(key)) continue;
      seen.add(key);
      const pts = arcOf(a, b).getPoints(32);
      for (let i = 0; i < pts.length - 1; i++) out.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(out, 3));
    return g;
  }, [placed, routes]);
  useDisposed(geometry);
  useFrame(() => {
    if (material.current) material.current.opacity = MathUtils.clamp((clock.current.t - rise + 0.3) / 0.5, 0, 1);
  });
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={material} color={PALETTE[theme].route} transparent opacity={0} />
    </lineSegments>
  );
}

interface Trip {
  lane: number;
  start: number;
}

function Messages({
  placed,
  routes,
  rise,
  clock,
  theme,
}: {
  placed: Placed[];
  routes: NetworkRoute[];
  rise: number;
  clock: RefObject<SceneClock>;
  theme: SceneProps["theme"];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const lanes = useMemo(() => {
    const byId = new Map(placed.map((p) => [p.id, p]));
    const max = Math.max(1, ...routes.map((r) => r.count));
    return routes
      .map((r) => {
        const a = byId.get(r.from);
        const b = byId.get(r.to);
        if (!a || !b) return null;
        // a route sends as often as the square root of its share: the quiet routes still show
        const perSecond = 0.1 + 1.4 * Math.sqrt(r.count / max);
        // the arc is shared by both directions; a message flies it from its own sender
        const forward = a.id < b.id;
        const curve = forward ? arcOf(a, b) : arcOf(b, a);
        return { curve, forward, perSecond };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [placed, routes]);
  const trips = useRef<Trip[]>([]);
  const owed = useRef<number[]>([]);
  const last = useRef<number | null>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const at = useMemo(() => new Vector3(), []);

  // new lanes: the trips in flight name lanes that no longer exist
  useLayoutEffect(() => {
    trips.current = [];
    owed.current = lanes.map((_, i) => (i * 0.37) % 1);
  }, [lanes]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    // the messages' own clock: it holds still once the send window closes, so the trips hold on their arcs
    const now = clock.current.m;
    const step = now - (last.current ?? now);
    last.current = now;
    // the first messages leave as the blocks finish standing; a held clock sends nothing (step is 0)
    if (clock.current.t >= rise - 0.2) {
      lanes.forEach((lane, i) => {
        owed.current[i] = (owed.current[i] ?? 0) + lane.perSecond * step;
        while (owed.current[i] >= 1) {
          owed.current[i] -= 1;
          if (trips.current.length < POOL) trips.current.push({ lane: i, start: now });
        }
      });
    }
    trips.current = trips.current.filter((t) => now - t.start < TRIP_S);
    for (let k = 0; k < POOL; k++) {
      const trip = trips.current[k];
      const lane = trip ? lanes[trip.lane] : undefined;
      if (!trip || !lane) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(k, dummy.matrix);
        continue;
      }
      const u = (now - trip.start) / TRIP_S;
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      lane.curve.getPoint(lane.forward ? e : 1 - e, at);
      dummy.position.copy(at);
      const s = 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.1));
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={PALETTE[theme].red} toneMapped={false} />
    </instancedMesh>
  );
}

function Plate({ extent, theme }: { extent: number; theme: SceneProps["theme"] }) {
  const palette = PALETTE[theme];
  const size = plateSize(extent);
  const plate = useMemo(() => shadedBox(theme, size, 0.06, size), [theme, size]);
  useDisposed(plate);
  const grid = useMemo(() => gridOf(extent), [extent]);
  useDisposed(grid);
  return (
    <group position={[0, -0.04, 0]}>
      <mesh geometry={plate}>
        <meshBasicMaterial vertexColors color={palette.plate} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <lineSegments geometry={grid} position={[0, 0.032, 0]}>
        <lineBasicMaterial color={palette.grid} />
      </lineSegments>
    </group>
  );
}

/**
 * The hub label's leader: a vertical hairline from the back rim of its logo
 * disc up to the lifted label. Both ends sit on that rim, so the line stays
 * vertical and rises from the top of the logo on screen, never through it.
 */
function Leader({ p, top, theme }: { p: Placed; top: number; theme: SceneProps["theme"] }) {
  const geometry = useMemo(() => {
    const o = (p.foot * MARK) / 2 / Math.SQRT2;
    return segmentOf([p.x - o, p.h, p.z - o], [p.x - o, top, p.z - o]);
  }, [p, top]);
  useDisposed(geometry);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={PALETTE[theme].edge} />
    </lineSegments>
  );
}

function Rig({ extent, children }: { extent: number; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const { size, camera } = useThree();
  useLayoutEffect(() => {
    if (!("zoom" in camera)) return;
    // the plate's diagonal spans the box width; from the plate's front corner
    // to the hub's lifted label, the drawing is about 0.5 spans tall
    const span = plateSize(extent) * Math.SQRT2;
    camera.zoom = Math.min(size.width / (span * 0.92), size.height / (span * 0.56));
    camera.updateProjectionMatrix();
  }, [size, camera, extent]);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const to = state.pointer.x * 0.12;
    // after an idle spell the first dt is the whole spell: clamp it, so the turn starts gently
    g.rotation.y = MathUtils.damp(g.rotation.y, to, 2.5, Math.min(dt, 1 / 30));
    if (Math.abs(g.rotation.y - to) > 0.0005) state.invalidate();
  });
  return <group ref={group}>{children}</group>;
}

/**
 * A chain's name on a chip, so arcs and edges never cut the text. A block's
 * label leaves from the roof corner on the outer side of the drawing, with a
 * short leader; the hub's label stands over the arc fan at `lift`, on a 3D
 * leader of its own.
 */
function Label({ p, strong, shown, lift }: { p: Placed; strong: boolean; shown: boolean; lift: number | null }) {
  const chip = `whitespace-nowrap bg-white px-1.5 py-0.5 dark:bg-zinc-950 ${MONO} ${
    strong ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
  }`;
  const fade = `pointer-events-none transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-0"}`;
  if (lift !== null) {
    return (
      <Html position={[p.x, lift, p.z]} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <span className={`block -translate-x-1/2 -translate-y-full ${chip} ${fade}`}>{p.name}</span>
      </Html>
    );
  }
  // screen right is +x and -z from this camera: a block right of the center labels to the right
  const right = p.x - p.z >= 0;
  const half = p.foot / 2;
  const corner: [number, number, number] = right ? [p.x + half, p.h, p.z - half] : [p.x - half, p.h, p.z + half];
  return (
    <Html position={corner} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
      <span className={`flex -translate-y-1/2 items-center ${right ? "" : "-translate-x-full flex-row-reverse"} ${fade}`}>
        <span className="h-px w-4 shrink-0 bg-zinc-400 dark:bg-zinc-600" />
        <span className={chip}>{p.name}</span>
      </span>
    </Html>
  );
}

export default function NetworkScene({
  chains,
  routes,
  labelled,
  theme,
  running,
  onReady,
  play = true,
  onSelect,
}: NetworkSceneProps & SceneProps) {
  // a canvas that mounts with the box already on screen (a reload, a fast scroll) plays the rise behind the
  // still, so the still hands over to standing blocks, never to a flat plate
  const [early] = useState(running);
  const on = running && (play || early);
  const placed = useMemo(() => layout(chains, new Set(routes.flatMap((r) => [r.from, r.to]))), [chains, routes]);
  const extent = useMemo(() => Math.max(1, ...placed.map((p) => Math.max(Math.abs(p.x), Math.abs(p.z)))), [placed]);
  const rise = useMemo(() => Math.max(0, ...placed.map((p) => p.ring)) * RING_S + GROW_S, [placed]);
  // the hub is where the most routes meet; its label stands over the fan of arcs
  const { hub, lift } = useMemo(() => {
    const byId = new Map(placed.map((p) => [p.id, p]));
    const ends = new Map<string, number>();
    let top = 0;
    for (const r of routes) {
      const a = byId.get(r.from);
      const b = byId.get(r.to);
      if (!a || !b) continue;
      for (const id of [a.id, b.id]) ends.set(id, (ends.get(id) ?? 0) + 1);
      for (const pt of arcOf(a, b).getPoints(16)) top = Math.max(top, pt.y);
    }
    const best = [...ends.entries()].sort((x, y) => y[1] - x[1])[0];
    const hubPlaced = best ? byId.get(best[0]) : undefined;
    return { hub: hubPlaced ?? null, lift: hubPlaced ? Math.max(top, hubPlaced.h) + 0.3 : 0 };
  }, [placed, routes]);
  const clock = useRef<SceneClock>({ t: 0, until: SEND_S, m: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [stood, setStood] = useState(false);
  const named = placed.filter((p) => labelled.includes(p.id) || p.id === hoverId);
  const byId = useMemo(() => new Map(chains.map((c) => [c.id, c])), [chains]);
  const hoverLinks = onSelect !== undefined && hoverId !== null && !!byId.get(hoverId)?.href;
  const select = (id: string) => {
    const chain = byId.get(id);
    if (chain?.href && onSelect) onSelect(chain);
  };
  const hubNamed = hub !== null && named.some((p) => p.id === hub.id);

  // the logos load together after mount; a chain without one keeps the steel face and no mark
  const [marks, setMarks] = useState<Map<string, ChainMark> | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(chains.map((c) => chainMark(c.logo).then((m) => [c.id, m] as const))).then((all) => {
      if (live) setMarks(new Map(all.flatMap(([id, m]) => (m ? [[id, m] as const] : []))));
    });
    return () => {
      live = false;
    };
  }, [chains]);
  const atlas = useMemo(() => {
    const own = marks ? placed.flatMap((p) => (marks.has(p.id) ? [{ p, mark: marks.get(p.id) as ChainMark }] : [])) : [];
    const made = markAtlas(own.map((o) => o.mark));
    return made && { texture: made.texture, decals: own.map(({ p }, i): Decal => ({ p, cell: made.cells[i] })) };
  }, [marks, placed]);
  useEffect(() => () => atlas?.texture.dispose(), [atlas]);
  const colors = useMemo(() => {
    const face = new Color(PALETTE[theme].face);
    return placed.map((p) => {
      const own = marks?.get(p.id)?.color;
      return (own && brandTone(own, theme)) ?? face;
    });
  }, [placed, marks, theme]);
  const name = usePlateName();
  // a logo that never answers must not hold the scene back
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), READY_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Canvas
      orthographic
      flat
      camera={{ position: [10, 7.2, 10], zoom: 40, near: 0.1, far: 200 }}
      // the page mounts the canvas only from 768 px up, at 2x at most; below that only the narrow still's
      // render runs, at 3x, so its logos stay sharp on phones
      dpr={[1, window.innerWidth < 768 ? 3 : 2]}
      frameloop="demand"
      style={{ cursor: hoverLinks ? "pointer" : undefined }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.55, 0)}
      onPointerMove={() => {
        // a reader at the drawing gets another 10 s of messages
        const c = clock.current;
        c.until = Math.max(c.until, c.t + SEND_S);
      }}
    >
      <Tick clock={clock} running={on} />
      <Kick running={on} />
      <Ready when={(marks !== null && name !== null) || late} onReady={onReady} />
      <Rig extent={extent}>
        <Plate extent={extent} theme={theme} />
        {name && <PlateName extent={extent} name={name} theme={theme} />}
        <Blocks
          solid={placed}
          colors={colors}
          rise={rise}
          clock={clock}
          theme={theme}
          onHover={setHoverId}
          onSelect={select}
          onStood={() => setStood(true)}
        />
        {atlas && <Decals decals={atlas.decals} texture={atlas.texture} rise={rise} clock={clock} theme={theme} />}
        <Routes placed={placed} routes={routes} rise={rise} clock={clock} theme={theme} />
        <Messages placed={placed} routes={routes} rise={rise} clock={clock} theme={theme} />
        {stood && hub && hubNamed && <Leader p={hub} top={lift} theme={theme} />}
        {named.map((p) => (
          <Label key={p.id} p={p} strong={p.id === hoverId} shown={stood} lift={p.id === hub?.id ? lift : null} />
        ))}
      </Rig>
    </Canvas>
  );
}
