"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { famOf } from "@/components/explorer-v2/network/icm-map";
import type { PchainPulse, PulseTx } from "@/components/explorer-v2/network/pchain-pulse";
import { useTxTargets } from "@/components/explorer-v2/network/tx-targets";
import type { CityModel } from "./model";
import type { Theme } from "./palette";
import { HUB_REACH, cDropAt, padAt } from "./HubTower";
import { TIME } from "./shaders";

/* The P-Chain's couriers: small eVTOL drones. Each tx that lands sends one
   up from the helipad on the Trinity's P wing (padAt, HubTower.tsx) with
   its message: to the roof of the L1 an operation acts on, or across to
   the C wing's roof (cDropAt) for the Primary Network's staking,
   delegation and rewards, and for an L1 the city does not stand. It
   rises straight off the pad, flies straight across, and comes straight
   down to hover over the roof, a pale beam under it as it descends; a
   thin ring opens on the roof as the message lands, and it flies home the
   same way. Every leg moves on the brand's ease, quick away and long to
   settle, and the drone holds level: it neither tilts nor bobs, and its
   rotors are still rings. The AVAX that crosses between the chains runs
   over the tower's bridge instead. They go as the map sends them: one a
   poll, and one every GAP_S at most, so a burst of txs sends one and a
   load sends none but the newest. A reader who asks for less motion sees
   none. */

/** the least time between two take-offs, and the longest a tx waits for its turn, as the map's HELI_GAP_MS and HELI_WAIT_MS */
const GAP_S = 5;
const WAIT_S = 6;
/** drones in the air at once, at most */
const POOL = 3;
const PRIMARY = "11111111111111111111111111111111LpoYY";
/** how fast it climbs and comes down, and flies across, in units a second, and each leg's time's bounds */
const RATE = 70;
const SPEED = 150;
const UP_S: [number, number] = [0.9, 2.2];
const ACROSS_S: [number, number] = [1.2, 3];
const DOWN_S: [number, number] = [0.7, 1.8];
/** how long it holds over the roof, the ring opening */
const HOLD_S = 1.1;
/** how high it cruises over the pad or the roof, and hovers over the roof */
const CRUISE = 22;
const HOVER = 12;
/** the drone's size over its drawing */
const SCALE = 1.4;
/** the ring on the roof: its spread and fade, and the beam's fade after it lands */
const RING_S = 1.3;
const BEAM_OUT_S = 0.45;
/** the lines' widths, in CSS pixels */
const RING_W = 1.25;
const BEAM_W = 1.6;
const RING_N = 72;

/* the drone's colors, from the brand: the body and arms slate, the canopy dark glass, the rotor rings slate by day and the block grey by night, so they read as its parts, the nav light red, the beam pale blue, the ring blue */
const BODY = "#3B484B";
const CANOPY = "#1E2327";
const ROTOR: Record<Theme, string> = { light: "#3B484B", dark: "#A2AFB2" };
const NAV = "#E6212F";
const BEAM: Record<Theme, [string, string]> = { light: ["#749DD3", "#C5CFF5"], dark: ["#749DD3", "#C5CFF5"] };
const RING: Record<Theme, string> = { light: "#0061E2", dark: "#5F9DFF" };

/* the brand's ease, cubic-bezier(0.16, 1, 0.3, 1): quick away, long to settle */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x;
      const d = dX(t);
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - e / d));
    }
    return Y(t);
  };
}
const EASE = bezier(0.16, 1, 0.3, 1);

interface Course {
  key: string;
  /** take-off, on the page's clock in seconds; unset while it waits for the city to stand */
  t0: number | null;
  tx: PulseTx;
  /** set at take-off: where it hovers, where its message lands, the ring's size there, its cruise, its heading, and its legs' times */
  over?: Vector3;
  drop?: Vector3;
  ring?: number;
  cruise?: number;
  yaw?: number;
  legs?: number[];
}

/* the drone, nose along +x: a flat hexagonal body under a dark glass canopy, four arms out to four ducted rotors, their ducts still rings; one geometry with its colors in it, and the rings' vertices kept so the theme can paint them */
function droneOf(): BufferGeometry {
  const parts: [BufferGeometry, string][] = [];
  parts.push([new CylinderGeometry(2.3, 2.3, 0.7, 6).rotateY(Math.PI / 6), BODY]);
  parts.push([new CylinderGeometry(1.25, 1.55, 0.45, 6).rotateY(Math.PI / 6).translate(0.25, 0.55, 0), CANOPY]);
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    parts.push([new BoxGeometry(2.6, 0.24, 0.34).translate(3.3, 0, 0).rotateY(-a), BODY]);
    parts.push([new TorusGeometry(1.35, 0.1, 6, 36).rotateX(Math.PI / 2).translate(4.5 * c, 0.05, -4.5 * s), "rotor"]);
    parts.push([new CylinderGeometry(0.28, 0.28, 0.3, 10).translate(4.5 * c, 0.05, -4.5 * s), BODY]);
  }
  // the skids it sets down on
  for (const z of [-1.1, 1.1]) parts.push([new BoxGeometry(2.8, 0.12, 0.14).translate(0, -0.75, z), BODY]);
  const rings: [number, number][] = [];
  let at = 0;
  const colored = parts.map(([g, hex]) => {
    const flat = g.index ? g.toNonIndexed() : g;
    const n = flat.getAttribute("position").count;
    if (hex === "rotor") rings.push([at, n]);
    at += n;
    const c = new Color(hex === "rotor" ? ROTOR.light : hex);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    flat.setAttribute("color", new Float32BufferAttribute(col, 3));
    return flat;
  });
  const g = mergeGeometries(colored, false)!;
  g.userData.rings = rings;
  return g;
}

/* a line on screen, as wide in pixels however far it runs: each point's two sides stand off it across its direction on screen; brighter toward the line's far end */
const LINE_VERTEX = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSide;
  attribute float aS;
  uniform vec2 uRes;
  uniform float uWidth;
  varying float vS;
  varying float vSide;
  void main() {
    vec4 c0 = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4( position + aDir, 1.0 );
    vec2 s0 = c0.xy / c0.w * uRes * 0.5;
    vec2 s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 d = s1 - s0;
    d = length( d ) < 1e-4 ? vec2( 1.0, 0.0 ) : normalize( d );
    c0.xy += vec2( -d.y, d.x ) * aSide * uWidth * 0.5 / ( uRes * 0.5 ) * c0.w;
    gl_Position = c0;
    vS = aS;
    vSide = aSide;
  }`;
const LINE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uAlpha;
  uniform float uFalloff;
  varying float vS;
  varying float vSide;
  void main() {
    // uFalloff 0 keeps the line even; else it brightens toward its far end, where the drone is
    float near = uFalloff > 0.0 ? pow( clamp( vS, 0.0, 1.0 ), uFalloff ) : 1.0;
    vec3 c = mix( uColor, uHot, uFalloff > 0.0 ? near : 0.0 );
    float edge = 1.0 - smoothstep( 0.55, 1.0, abs( vSide ) );
    gl_FragColor = vec4( c, uAlpha * edge * ( uFalloff > 0.0 ? 0.25 + 0.75 * near : 1.0 ) );
    #include <colorspace_fragment>
  }`;

function lineMaterial(res: { value: Vector2 }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRes: res, uWidth: { value: 1 }, uAlpha: { value: 0 }, uFalloff: { value: 0 }, uColor: { value: new Color() }, uHot: { value: new Color() } },
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    // the line's sides are set on screen, so its triangles face either way
    side: DoubleSide,
  });
}

/* a polyline as a line of quads, each point's share of the way along it */
function lineOf(points: Vector3[], closed: boolean): BufferGeometry {
  const pos: number[] = [];
  const dir: number[] = [];
  const side: number[] = [];
  const at: number[] = [];
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = new Vector3().subVectors(b, a).normalize();
    const s0 = i / n;
    const s1 = (i + 1) / n;
    for (const [p, sd, sv] of [
      [a, -1, s0],
      [a, 1, s0],
      [b, 1, s1],
      [a, -1, s0],
      [b, 1, s1],
      [b, -1, s1],
    ] as const) {
      pos.push(p.x, p.y, p.z);
      dir.push(d.x, d.y, d.z);
      side.push(sd);
      at.push(sv);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aDir", new Float32BufferAttribute(dir, 3));
  g.setAttribute("aSide", new Float32BufferAttribute(side, 1));
  g.setAttribute("aS", new Float32BufferAttribute(at, 1));
  return g;
}

export function Helicopters({
  model,
  pulse,
  theme,
  still,
  liveAt,
}: {
  model: CityModel;
  pulse: PchainPulse;
  theme: Theme;
  still: boolean;
  /** when the city stands, on the city's clock: none flies before it */
  liveAt: number;
}) {
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  // the P wing's helipad, where each flight starts and ends, and the C wing's roof, where the Primary Network's messages land
  const hub = model.buildings[model.hub];
  const pad = useMemo(() => (hub ? new Vector3(...padAt(model)) : null), [model, hub]);
  const cDrop = useMemo(() => (hub ? new Vector3(...cDropAt(model)) : null), [model, hub]);
  // only the txs that fly need their L1 named
  const flying = useMemo(() => pulse.txs.filter((t) => t.fresh), [pulse.txs]);
  const targets = useTxTargets(flying);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const res = useMemo(() => ({ value: new Vector2(1, 1) }), []);
  const kit = useMemo(() => {
    const body = droneOf();
    const bodyMat = new MeshLambertMaterial({ vertexColors: true });
    const navGeo = new SphereGeometry(0.34, 10, 6).translate(2.05, 0.3, 0);
    const navMat = new MeshBasicMaterial({ color: NAV, toneMapped: false });
    // the beam: a unit line from the roof (0) up to the drone (1), stretched each frame
    const beamGeo = lineOf([new Vector3(0, 0, 0), new Vector3(0, 1, 0)], false);
    const ringGeo = lineOf(
      Array.from({ length: RING_N }, (_, i) => new Vector3(Math.cos((i / RING_N) * Math.PI * 2), 0, Math.sin((i / RING_N) * Math.PI * 2))),
      true,
    );
    const craft = Array.from({ length: POOL }, () => {
      const g = new Group();
      g.scale.setScalar(SCALE);
      g.add(new Mesh(body, bodyMat), new Mesh(navGeo, navMat));
      const beam = new Mesh(beamGeo, lineMaterial(res));
      const ring = new Mesh(ringGeo, lineMaterial(res));
      (beam.material as ShaderMaterial).uniforms.uFalloff.value = 1.6;
      for (const o of [g, beam, ring]) {
        o.visible = false;
        o.frustumCulled = false;
      }
      beam.renderOrder = ring.renderOrder = 4;
      return { g, beam, ring };
    });
    return { body, bodyMat, navGeo, navMat, beamGeo, ringGeo, craft };
  }, [res]);
  useEffect(
    () => () => {
      for (const d of [kit.body, kit.navGeo, kit.beamGeo, kit.ringGeo]) d.dispose();
      kit.bodyMat.dispose();
      kit.navMat.dispose();
      for (const c of kit.craft) for (const o of [c.beam, c.ring]) (o.material as ShaderMaterial).dispose();
    },
    [kit],
  );
  useEffect(() => {
    // the rotor rings in the theme's color, on the one body every drone shares
    const col = kit.body.getAttribute("color") as Float32BufferAttribute;
    const ring = new Color(ROTOR[theme]);
    for (const [from, n] of kit.body.userData.rings as [number, number][]) for (let i = from; i < from + n; i++) col.setXYZ(i, ring.r, ring.g, ring.b);
    col.needsUpdate = true;
    for (const c of kit.craft) {
      const b = (c.beam.material as ShaderMaterial).uniforms;
      b.uColor.value.set(BEAM[theme][0]);
      b.uHot.value.set(BEAM[theme][1]);
      (c.ring.material as ShaderMaterial).uniforms.uColor.value.set(RING[theme]);
    }
  }, [theme, kit]);

  /* the courses: each fresh tx is weighed once, when it first shows; it flies if it is the poll's first and its turn comes soon enough */
  const courses = useRef<Course[]>([]);
  const weighed = useRef(new Set<string>());
  const sentAt = useRef(-Infinity);
  useEffect(() => {
    if (still) return;
    const now = performance.now() / 1000;
    let sent = 0;
    for (const t of flying) {
      if (weighed.current.has(t.hash)) continue;
      weighed.current.add(t.hash);
      // the AVAX that crosses between the chains runs over the tower's bridge, not by air
      if (famOf(t.type) === "move") continue;
      const start = Math.max(now + 0.3 + t.lane * 0.7, sentAt.current + GAP_S);
      if (sent > 0 || start - now > WAIT_S) continue;
      sent += 1;
      sentAt.current = start;
      // the newest at load flies once the city stands
      courses.current.push({ key: t.hash, t0: t.replay ? null : start, tx: t });
    }
  }, [flying, still]);

  /* where a tx's message goes: the roof of the L1 it acts on, else the C wing's roof; it hovers clear of what stands on the roof */
  const aim = (t: PulseTx): { over: Vector3; drop: Vector3; ring: number } | null => {
    if (!hub) return null;
    const subnet = famOf(t.type) === "l1" ? targetsRef.current.get(t.hash) : undefined;
    const b = subnet && subnet !== PRIMARY ? model.buildings.find((x) => x.n.subnetId === subnet) : undefined;
    if (b) {
      const roof = b.base + Math.max(...b.parts.map((q) => q.z1), 0);
      const drop = new Vector3(b.x, roof + 0.3, b.z);
      return { over: drop.clone().setY(Math.max(roof + HOVER, b.base + b.crest + 8)), drop, ring: Math.max(6, b.n.w * 1.15) };
    }
    // the C wing's roof, in front of its spire; the drone hovers over the spire's light
    const drop = cDrop ? cDrop.clone().setY(cDrop.y + 0.3) : new Vector3(hub.x, hub.base + hub.crest + 0.3, hub.z);
    return { over: drop.clone().setY(hub.base + hub.crest + HUB_REACH + 9), drop, ring: hub.n.w * 0.55 };
  };

  const P = useMemo(() => new Vector3(), []);
  useFrame(() => {
    res.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
    const dpr = gl.getPixelRatio();
    const now = performance.now() / 1000;
    const standing = TIME.value >= liveAt;
    for (const c of courses.current) {
      if (c.t0 === null && standing) c.t0 = Math.max(now + 0.8, sentAt.current + GAP_S);
      if (c.t0 !== null && !standing) c.t0 = Math.max(c.t0, now + 0.1);
    }
    courses.current = courses.current.filter((c) => c.t0 === null || c.legs === undefined || now - c.t0 < c.legs[c.legs.length - 1] + 0.2);
    kit.craft.forEach((k, i) => {
      const c = courses.current[i];
      k.g.visible = k.beam.visible = k.ring.visible = false;
      if (!c || !pad || c.t0 === null || now < c.t0) return;
      // its course, set once as it takes off
      if (!c.legs) {
        const aimed = aim(c.tx);
        if (!aimed) return;
        c.over = aimed.over;
        c.drop = aimed.drop;
        c.ring = aimed.ring;
        c.cruise = Math.max(pad.y, aimed.over.y) + CRUISE;
        c.yaw = Math.atan2(-(aimed.over.z - pad.z), aimed.over.x - pad.x);
        const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));
        const up = clamp((c.cruise - pad.y) / RATE, UP_S);
        const across = clamp(Math.hypot(aimed.over.x - pad.x, aimed.over.z - pad.z) / SPEED, ACROSS_S);
        const down = clamp((c.cruise - aimed.over.y) / RATE, DOWN_S);
        // the legs' ends: up, across, down to hover, held, up, back across, down onto the pad
        const d = [up, across, down, HOLD_S, down, across, up];
        c.legs = d.map((_, j) => d.slice(0, j + 1).reduce((a, b) => a + b, 0));
      }
      const legs = c.legs;
      const over = c.over!;
      const drop = c.drop!;
      const cruise = c.cruise!;
      const s = now - c.t0;
      if (s >= legs[6]) return;
      const leg = legs.findIndex((e) => s < e);
      const from = leg === 0 ? 0 : legs[leg - 1];
      const u = EASE((s - from) / (legs[leg] - from));
      // where it is on each leg: [x, z] over the pad or the roof, and its height
      const atPad = leg === 0 || leg === 6;
      const atRoof = leg === 2 || leg === 3 || leg === 4;
      let along = atPad ? 0 : atRoof ? 1 : leg === 1 ? u : 1 - u;
      let y = cruise;
      if (leg === 0) y = pad.y + (cruise - pad.y) * u;
      else if (leg === 2) y = cruise + (over.y - cruise) * u;
      else if (leg === 3) y = over.y;
      else if (leg === 4) y = over.y + (cruise - over.y) * u;
      else if (leg === 6) y = cruise + (pad.y - cruise) * u;
      along = Math.min(1, Math.max(0, along));
      P.set(pad.x + (over.x - pad.x) * along, y, pad.z + (over.z - pad.z) * along);
      k.g.visible = true;
      // level, facing the roof it serves the whole way; its skids stand on the pad at the start and the end
      k.g.position.copy(P).setY(y + 0.75 * SCALE);
      k.g.rotation.set(0, c.yaw!, 0);
      // the beam: under it while it comes down to the roof, gone soon after it holds
      const beamA = leg === 2 ? Math.min(1, (s - from) / 0.25) : leg === 3 ? Math.max(0, 1 - (s - legs[2]) / BEAM_OUT_S) : 0;
      if (beamA > 0.01) {
        const bu = (k.beam.material as ShaderMaterial).uniforms;
        k.beam.visible = true;
        k.beam.position.copy(drop);
        k.beam.scale.set(1, Math.max(0.01, y - drop.y), 1);
        bu.uAlpha.value = beamA * 0.9;
        bu.uWidth.value = BEAM_W * dpr;
      }
      // the ring: it opens on the roof as it arrives over it, quick at first, and fades long
      const since = s - legs[2];
      if (since >= 0 && since < RING_S) {
        const k2 = since / RING_S;
        const ru = (k.ring.material as ShaderMaterial).uniforms;
        k.ring.visible = true;
        k.ring.position.copy(drop);
        k.ring.scale.setScalar(c.ring! * (0.55 + 0.45 * EASE(k2)));
        ru.uAlpha.value = Math.exp(-3 * k2) * (1 - k2);
        ru.uWidth.value = RING_W * dpr;
      }
    });
  });

  if (still || !pad) return null;
  return (
    <group>
      {kit.craft.map((k, i) => (
        <group key={i}>
          <primitive object={k.g} />
          <primitive object={k.beam} />
          <primitive object={k.ring} />
        </group>
      ))}
    </group>
  );
}
