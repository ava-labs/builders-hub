"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
  type Intersection,
  type Material,
  type Raycaster,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import { HUB_ID, type Route } from "@/components/explorer-v2/network/icm-map";
import type { City } from "@/components/explorer-v2/network/city";
import { FLEET, GLASS3, type Theme } from "./palette";
import { BLOCK_H } from "./model";
import { countOf, durOf, type RouteStreets } from "./lanes";
import { TIME } from "./shaders";

/* The city's ICM traffic in 3D, as the map's fleet drives it: each route's
   vehicles run sender to receiver in their lane, on the right, at the
   city's one speed, as many as the route is busy. Each is an autonomous
   pod: a low matte capsule with a pale canopy and one thin light strip
   along each flank, the only light it shows: its sender's district hue,
   or the brand's red on a route to or from the C-Chain. A busy route runs
   longer pods of the same family among them, for its buses and trucks.
   A pod eases out of its sender's lot and settles into its receiver's
   with the brand's ease, and drives the lane between at an even speed. The
   whole fleet is two instanced meshes, its shells and its canopies, and the GPU
   drives it: each lane is a row of a float texture, and each part finds its
   place on its lane from the city's clock, so no frame moves a pod from
   script. The cursor finds a route by its lane or by one of its pods: the
   route lights its lane and its pods' strips in blue, and the rest drive
   on, muted, as any hover leaves them. */

type Kind = "car" | "van" | "bus" | "truck";
/* each kind's pod, in widths of the pod: its length, and its canopy's length,
   width and place along it. A bus and a truck are the car's pod drawn out,
   the truck's canopy a short one over its nose */
const PODS: Record<Kind, { length: number; canopy: { length: number; width: number; x: number } }> = {
  car: { length: 2.2, canopy: { length: 1.2, width: 0.72, x: 0.1 } },
  van: { length: 2.6, canopy: { length: 1.45, width: 0.74, x: 0.2 } },
  bus: { length: 4.1, canopy: { length: 3.2, width: 0.76, x: 0.05 } },
  truck: { length: 3.9, canopy: { length: 1.05, width: 0.74, x: 1.15 } },
};
/* the pod's section, in its widths: its clearance over the road, its body's halves
   under and over its widest line, and its canopy's height against its width */
const CLEAR = 0.07;
const LOWER = 0.13;
const UPPER = 0.25;
const EQUATOR = CLEAR + LOWER;
const ROOF = EQUATOR + UPPER;
const CANOPY_H = 0.9;
/** a pod's width at a lot of 46, as the map's cars' */
const WIDTH = 4.5;
const LOT = 46;
/** a vehicle's size against its street, at a lot of 46, as the map's */
const SIZE = 1.1;
/** the part of a pod's length it takes to leave its lot, and to settle into the receiver's */
const RAMP_OUT = 0.55;
const RAMP_IN = 0.9;

interface Vehicle {
  route: number;
  kind: Kind;
  /** its width, in the plan's units */
  width: number;
  begin: number;
  /** a turn of its loop, in seconds: out of the lot, along the lane, into the other lot */
  period: number;
  /** the time it takes to leave its lot and to drive the lane after it, and each ramp's share of the lane */
  out: number;
  cruise: number;
  outShare: number;
  inShare: number;
}

/* the brand's ease, cubic-bezier(0.16, 1, 0.3, 1): its curve's time found by
   Newton's method, its value then 1 - (1 - s)^3. Its slope at 0 is 6.25, so a
   ramp of it that meets the lane's even speed takes 6.25 times as long as the
   same stretch at that speed */
function brandEase(x: number): number {
  const v = Math.min(1, Math.max(0, x));
  let s = v;
  for (let i = 0; i < 6; i++) {
    const r = 1 - s;
    const bx = 0.48 * s * r * r + 0.9 * s * s * r + s * s * s;
    const dx = 0.48 * r * (1 - 3 * s) + 0.9 * s * (2 - 3 * s) + 3 * s * s;
    if (Math.abs(dx) < 1e-6) break;
    s = Math.min(1, Math.max(0, s - (bx - v) / dx));
  }
  return 1 - (1 - s) ** 3;
}
const EASE_SLOPE = 6.25;

/* how far along its lane a pod is at t into its loop, as a share of the lane:
   eased out of the sender's lot from rest, even along the lane, eased into the
   receiver's to rest, its speed unbroken where they meet */
function shareAt(v: Vehicle, t: number): number {
  const into = v.period - v.out - v.cruise;
  if (t < v.out) return v.outShare * (1 - brandEase(1 - t / v.out));
  if (t < v.out + v.cruise) return v.outShare + ((1 - v.outShare - v.inShare) * (t - v.out)) / v.cruise;
  return 1 - v.inShare + v.inShare * brandEase((t - v.out - v.cruise) / into);
}

/* the pod: a capsule a width across and 2.2 long, its ends round, flattened
   to a low section and centred on its widest line; the shader draws its
   straight flanks out for a longer pod, so its ends keep their shape */
function podGeometry(): BufferGeometry {
  const g = new CapsuleGeometry(0.5, 1.2, 8, 24).rotateZ(-Math.PI / 2);
  const p = g.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, y >= 0 ? (y / 0.5) * UPPER : (y / 0.5) * LOWER);
  }
  g.computeVertexNormals();
  return g;
}

/* Where each part of the fleet is, worked out on the GPU. A lane is a row
   of uLanes: its first texel holds its samples' count and its length, the
   rest one sample a unit of its length (x, height, z and heading). A part
   instance carries its pod's route, start, loop and width (aRun), its ramps
   (aMove: the time out of the lot, the time along the lane, and each ramp's
   share of the lane), and its own place and size on the pod (aBox, aDim) */
const PLACE = /* glsl */ `
uniform sampler2D uLanes;
uniform float uTime;
uniform float uLiveAt;
attribute vec4 aRun;
attribute vec4 aMove;
attribute vec4 aBox;
attribute vec3 aDim;
varying float vFade;
vec3 vehAt;
float vehCos;
float vehSin;
bool vehGone;
float brandEase( float x ) {
  float v = clamp( x, 0.0, 1.0 );
  float s = v;
  for ( int i = 0; i < 6; i++ ) {
    float r = 1.0 - s;
    float bx = 0.48 * s * r * r + 0.9 * s * s * r + s * s * s;
    float dx = 0.48 * r * ( 1.0 - 3.0 * s ) + 0.9 * s * ( 2.0 - 3.0 * s ) + 3.0 * s * s;
    s = clamp( s - ( bx - v ) / max( dx, 1e-4 ), 0.0, 1.0 );
  }
  float r = 1.0 - s;
  return 1.0 - r * r * r;
}
void placeVehicle() {
  int row = int( aRun.x );
  vec4 head = texelFetch( uLanes, ivec2( 0, row ), 0 );
  float t = uTime - uLiveAt - aRun.y;
  vehGone = t < 0.0 || head.x < 2.0 || aDim.x <= 0.0;
  if ( vehGone ) {
    vFade = 0.0;
    return;
  }
  float tt = mod( t, aRun.z );
  float into = aRun.z - aMove.x - aMove.y;
  float u;
  if ( tt < aMove.x ) u = aMove.z * ( 1.0 - brandEase( 1.0 - tt / aMove.x ) );
  else if ( tt < aMove.x + aMove.y ) u = aMove.z + ( 1.0 - aMove.z - aMove.w ) * ( tt - aMove.x ) / aMove.y;
  else u = 1.0 - aMove.w + aMove.w * brandEase( ( tt - aMove.x - aMove.y ) / into );
  float f = clamp( u, 0.0, 1.0 ) * ( head.x - 1.0 );
  int k0 = int( floor( f ) );
  int k1 = min( k0 + 1, int( head.x ) - 1 );
  float w = f - float( k0 );
  vec4 a = texelFetch( uLanes, ivec2( k0 + 1, row ), 0 );
  vec4 b = texelFetch( uLanes, ivec2( k1 + 1, row ), 0 );
  vehAt = mix( a.xyz, b.xyz, w );
  float d = b.w - a.w;
  d -= 6.2831853 * floor( ( d + 3.1415927 ) / 6.2831853 );
  float yaw = a.w + d * w;
  vehCos = cos( yaw );
  vehSin = sin( yaw );
  // it comes in with a sharp attack as it leaves, and goes with a long decay as it settles
  vFade = brandEase( tt / ( 0.45 * aMove.x ) ) * ( 1.0 - brandEase( ( tt - aRun.z + 0.55 * into ) / ( 0.55 * into ) ) );
}
/* a part's scale on the pod, in the pod's widths */
vec3 partScale() {
  #ifdef VEH_POD
  return vec3( aDim.z, aDim.y * aDim.z, aDim.z );
  #else
  return aDim;
  #endif
}
/* a point of a part, from its unit shape to the plan */
vec3 vehPoint( vec3 p ) {
  if ( vehGone ) return vec3( 0.0, -1e4, 0.0 );
  #ifdef VEH_POD
  // a longer pod: only its straight flanks draw out, so its round ends keep their shape
  if ( abs( p.x ) > 0.5999 ) p.x += sign( p.x ) * ( aDim.x - 2.2 ) * 0.5;
  #endif
  vec3 l = ( aBox.xyz + p * partScale() ) * aRun.w;
  return vehAt + vec3( l.x * vehCos - l.z * vehSin, l.y, l.x * vehSin + l.z * vehCos );
}
vec3 vehNormal( vec3 n ) {
  n = normalize( n / max( partScale(), vec3( 1e-4 ) ) );
  return vec3( n.x * vehCos - n.z * vehSin, n.y, n.x * vehSin + n.z * vehCos );
}
`;
/* the fade: a fine dither of a part's pixels, as the towers' veil, so it needs no sorting */
const FADE = /* glsl */ `
varying float vFade;
`;
const FADE_DISCARD = /* glsl */ `
if ( vFade < 0.999 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) > vFade ) discard;
`;

/* a stock material that draws the fleet's parts where the lanes put them; `more` edits the shaders after */
function driven<T extends Material>(m: T, uniforms: Record<string, { value: unknown }>, key: string, defines: string[] = [], more?: (s: WebGLProgramParametersWithUniforms) => void): T {
  m.onBeforeCompile = (s: WebGLProgramParametersWithUniforms) => {
    Object.assign(s.uniforms, uniforms);
    const lit = s.vertexShader.includes("#include <beginnormal_vertex>");
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\n${defines.map((d) => `#define ${d}`).join("\n")}\n${PLACE}`)
      .replace("void main() {", "void main() {\nplaceVehicle();")
      .replace("#include <begin_vertex>", "vec3 transformed = vehPoint( vec3( position ) );");
    if (lit) s.vertexShader = s.vertexShader.replace("#include <beginnormal_vertex>", "vec3 objectNormal = vehNormal( vec3( normal ) );");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>\n${FADE}`).replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${FADE_DISCARD}`);
    more?.(s);
  };
  m.customProgramCacheKey = () => `city3d-traffic-${key}`;
  return m;
}

/* the pod's light: a thin strip along each flank, just over its widest line, painted
   on the shell itself so it follows its curve; its color is the pod's own (aGlow), and
   it is the one part of a pod that lights itself */
const STRIP_Y = 0.045;
const STRIP_HALF = 0.016;
function strip(s: WebGLProgramParametersWithUniforms) {
  s.vertexShader = s.vertexShader
    .replace("#include <common>", "#include <common>\nattribute vec3 aGlow;\nvarying vec3 vGlow;\nvarying vec3 vPod;")
    .replace("void main() {\nplaceVehicle();", "void main() {\nplaceVehicle();\nvGlow = aGlow;\nvPod = vec3( position );");
  s.fragmentShader = s.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vGlow;\nvarying vec3 vPod;")
    .replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
float podEdge = fwidth( vPod.y ) * 1.2;
float podBand = ( 1.0 - smoothstep( ${STRIP_HALF.toFixed(3)}, ${STRIP_HALF.toFixed(3)} + podEdge, abs( vPod.y - ${STRIP_Y.toFixed(3)} ) ) ) * ( 1.0 - smoothstep( 0.7, 0.8, abs( vPod.x ) ) );
diffuseColor.rgb = mix( diffuseColor.rgb, vGlow, podBand );`,
    )
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * podBand;");
}

/** a texture's width every WebGL2 device takes: a longer lane is sampled more sparsely to fit */
const MAX_SAMPLES = 2047;

/* the fleet's lanes as a float texture: a row a route, its count and length first, then its samples, evenly along it */
function laneTexture(streets: RouteStreets[], heights: Float32Array[]): DataTexture {
  const count = (n: number) => Math.min(n, MAX_SAMPLES);
  const w = 1 + Math.max(2, ...streets.map((s) => count(s.lane.x.length)));
  const h = Math.max(1, streets.length);
  const data = new Float32Array(w * h * 4);
  streets.forEach((s, r) => {
    const { x, z, yaw, length } = s.lane;
    const n = x.length;
    const m = count(n);
    const o = r * w * 4;
    data[o] = m;
    data[o + 1] = length;
    for (let k = 0; k < m; k++) {
      const j = m === n ? k : Math.round((k * (n - 1)) / Math.max(1, m - 1));
      const i = o + (k + 1) * 4;
      data[i] = x[j];
      data[i + 1] = heights[r][j];
      data[i + 2] = z[j];
      data[i + 3] = yaw[j];
    }
  });
  const t = new DataTexture(data, w, h, RGBAFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** a lane's ribbon, each side of its middle, as a share of a lot */
const RIBBON = 0.09;
/** the ribbon's samples, a few units apart along the lane */
const RIBBON_STEP = 3;

/* every lane as a flat ribbon just over its road, all in one geometry: the
   surface the cursor finds a route by, and, for the route under it, the lane
   it lights. Each triangle knows its route */
function ribbonsOf(streets: RouteStreets[], heights: Float32Array[], half: number): { geometry: BufferGeometry; faces: Int32Array } {
  const pos: number[] = [];
  const route: number[] = [];
  const side: number[] = [];
  const along: number[] = [];
  const index: number[] = [];
  const faces: number[] = [];
  streets.forEach((s, r) => {
    const { x, z, yaw, length } = s.lane;
    const n = x.length;
    if (n < 2) return;
    const base = pos.length / 3;
    let count = 0;
    for (let k = 0; ; k = Math.min(n - 1, k + RIBBON_STEP)) {
      // the lane's right hand, on a plan whose z runs toward the viewer
      const rx = -Math.sin(yaw[k]);
      const rz = Math.cos(yaw[k]);
      const y = heights[r][k] + 0.08;
      pos.push(x[k] - rx * half, y, z[k] - rz * half, x[k] + rx * half, y, z[k] + rz * half);
      route.push(r, r);
      side.push(-1, 1);
      const s0 = (length * k) / (n - 1);
      along.push(s0, s0);
      count++;
      if (k === n - 1) break;
    }
    for (let j = 0; j + 1 < count; j++) {
      const a = base + j * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      faces.push(r, r);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aRoute", new Float32BufferAttribute(route, 1));
  g.setAttribute("aSide", new Float32BufferAttribute(side, 1));
  g.setAttribute("aAlong", new Float32BufferAttribute(along, 1));
  g.setIndex(new BufferAttribute(pos.length / 3 > 65535 ? new Uint32Array(index) : new Uint16Array(index), 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return { geometry: g, faces: Int32Array.from(faces) };
}

/* the lit lane: the hovered route's ribbon in blue, soft at its edges, a slow flow
   running along it toward the receiver; every other route's ribbon folds away */
const LIT_LANE = {
  vertexShader: /* glsl */ `
    attribute float aRoute;
    attribute float aSide;
    attribute float aAlong;
    uniform float uHot;
    varying float vSide;
    varying float vAlong;
    void main() {
      vSide = aSide;
      vAlong = aAlong;
      if ( abs( aRoute - uHot ) > 0.5 ) {
        gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
        return;
      }
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uAlpha;
    uniform float uTime;
    varying float vSide;
    varying float vAlong;
    void main() {
      float edge = 1.0 - smoothstep( 0.45, 1.0, abs( vSide ) );
      float flow = 0.72 + 0.28 * smoothstep( 0.0, 0.35, fract( ( vAlong - uTime * 26.0 ) / 22.0 ) );
      gl_FragColor = vec4( uColor, uAlpha * edge * flow );
      #include <colorspace_fragment>
    }`,
};

/* where a pod is now, from the city's clock, as the shader finds it; null while it waits */
function poseOf(v: Vehicle, t0: number, lane: RouteStreets["lane"] | undefined, h: Float32Array | undefined): { x: number; y: number; z: number; yaw: number } | null {
  const t = t0 - v.begin;
  if (t < 0 || !lane || !h || lane.x.length < 2) return null;
  const f = Math.min(1, Math.max(0, shareAt(v, t % v.period))) * (lane.x.length - 1);
  const k0 = Math.floor(f);
  const k1 = Math.min(k0 + 1, lane.x.length - 1);
  const w = f - k0;
  let d = lane.yaw[k1] - lane.yaw[k0];
  d -= 2 * Math.PI * Math.floor((d + Math.PI) / (2 * Math.PI));
  return {
    x: lane.x[k0] + (lane.x[k1] - lane.x[k0]) * w,
    y: h[k0] + (h[k1] - h[k0]) * w,
    z: lane.z[k0] + (lane.z[k1] - lane.z[k0]) * w,
    yaw: lane.yaw[k0] + d * w,
  };
}

/* how far along a ray it meets a box, the ray in the box's frame; null when it misses */
function slab(o: [number, number, number], d: [number, number, number], lo: [number, number, number], hi: [number, number, number]): number | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return null;
      continue;
    }
    let ta = (lo[a] - o[a]) / d[a];
    let tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t1 < 0 ? null : Math.max(0, t0);
}

/** the brand's red, on every route to or from the C-Chain */
const RED = new Color("#E6212F");

export function Traffic({
  routes,
  streets,
  city,
  on,
  blue,
  theme,
  still,
  liveAt,
  hovered = null,
  onHoverRoute,
  frozen,
}: {
  routes: Route[];
  streets: RouteStreets[];
  city: City;
  /** each route's sender's brand color, when it has one; the pods wear their district's hue instead */
  inks?: (string | null)[];
  /** each route is lit: one of its ends is in what the search, a cut, a hover or the camera's district shows; the rest keep driving, muted */
  on: boolean[];
  /** one of each route's ends is the picked chain */
  blue: boolean[];
  theme: Theme;
  still: boolean;
  /** when the city moves, in its seconds */
  liveAt: number;
  /** the route the city lights, by key: the one under the cursor */
  hovered?: string | null;
  /** the route under the cursor, by key, and where on it the cursor found it; null once it leaves */
  onHoverRoute?: (key: string | null, at?: Vector3) => void;
  /** the hover holds while this is set: the camera flies, or the reader drags it */
  frozen?: { current: boolean };
}) {
  const dark = theme === "dark";
  const scale = Math.min(1.25, Math.max(0.6, city.lot / LOT));
  // each route's pods: as many as it is busy, each leaving in turn, a turn of its loop apart; the whole city cruises at one speed
  const fleet = useMemo(() => {
    const out: Vehicle[] = [];
    routes.forEach((r, i) => {
      const roll = diceOf(r.key);
      const count = countOf(r.heat);
      const L = Math.max(1, streets[i]?.lane.length ?? 1);
      const speed = L / durOf(r);
      const start = 1.5 + i * 0.05;
      const width = WIDTH * scale * SIZE * (0.92 + 0.16 * r.heat);
      // the ramps a car's pod takes, for every pod of the route, so they share one loop and keep their spacing
      const long = PODS.car.length * width;
      const outD = Math.min(RAMP_OUT * long, 0.2 * L);
      const inD = Math.min(RAMP_IN * long, 0.25 * L);
      const outT = (EASE_SLOPE * outD) / speed;
      const cruise = (L - outD - inD) / speed;
      const period = outT + cruise + (EASE_SLOPE * inD) / speed;
      for (let k = 0; k < count; k++) {
        const kind: Kind = r.heat >= 0.6 && k === 1 ? (roll() < 0.5 ? "bus" : "truck") : r.heat >= 0.3 && k % 2 === 1 ? "van" : "car";
        out.push({ route: i, kind, width, begin: start + (k / count) * period, period, out: outT, cruise, outShare: outD / L, inShare: inD / L });
      }
    });
    return out;
  }, [routes, streets, scale]);

  // each lane's height: on the street, or up on a block's curb where it runs into a lot
  const heights = useMemo(() => {
    const inBlock = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      return city.blocks.some((b) => r > b.r0 + 1 && r < b.r1 - 1 && (((a - b.a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) <= b.a1 - b.a0);
    };
    return streets.map((s) => {
      const n = s.lane.x.length;
      const raw = new Float32Array(n);
      for (let k = 0; k < n; k++) raw[k] = inBlock(s.lane.x[k], s.lane.z[k]) ? BLOCK_H : 0;
      const out = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        let t = 0;
        let c = 0;
        for (let j = Math.max(0, k - 2); j <= Math.min(n - 1, k + 2); j++) {
          t += raw[j];
          c++;
        }
        out[k] = t / c + 0.02;
      }
      return out;
    });
  }, [streets, city]);

  // the uniforms every part reads, shared: the lanes, the city's clock, and when the city moves
  const shared = useMemo(() => ({ uLanes: { value: null as DataTexture | null }, uTime: TIME, uLiveAt: { value: 0 } }), []);
  const lanes = useMemo(() => laneTexture(streets, heights), [streets, heights]);
  useEffect(() => {
    shared.uLanes.value = lanes;
    return () => lanes.dispose();
  }, [lanes, shared]);
  useEffect(() => {
    shared.uLiveAt.value = liveAt;
  }, [liveAt, shared]);

  const mats = useMemo(
    () => ({
      body: driven(new MeshLambertMaterial({ color: 0xffffff }), shared, "pod-body", ["VEH_POD"], strip),
      canopy: driven(new MeshPhongMaterial({ color: new Color("#EBF0FA"), specular: new Color("#5C6674"), shininess: 60 }), shared, "pod-canopy", ["VEH_POD"]),
    }),
    [shared],
  );
  // the canopy catches the sky, as the towers' glass does (Lighting.tsx)
  mats.canopy.userData.cityEnv = 0.35;
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) m.dispose();
    },
    [mats],
  );

  // one instanced mesh a part, its instances a pod's in turn; each carries its pod's run and ramps, and its own place on the pod
  const meshes = useMemo(() => {
    const n = fleet.length;
    const make = (geo: BufferGeometry, mat: Material, per: number, part: (v: Vehicle, k: number) => { box: number[]; dim: number[] }, color: boolean) => {
      const count = Math.max(1, n * per);
      const run = new Float32Array(count * 4);
      const move = new Float32Array(count * 4);
      const box = new Float32Array(count * 4);
      const dim = new Float32Array(count * 3);
      fleet.forEach((v, i) => {
        for (let k = 0; k < per; k++) {
          const j = i * per + k;
          const p = part(v, k);
          run.set([v.route, v.begin, v.period, v.width], j * 4);
          move.set([v.out, v.cruise, v.outShare, v.inShare], j * 4);
          box.set(p.box, j * 4);
          dim.set(p.dim, j * 3);
        }
      });
      geo.setAttribute("aRun", new InstancedBufferAttribute(run, 4));
      geo.setAttribute("aMove", new InstancedBufferAttribute(move, 4));
      geo.setAttribute("aBox", new InstancedBufferAttribute(box, 4));
      geo.setAttribute("aDim", new InstancedBufferAttribute(dim, 3));
      const m = new InstancedMesh(geo, mat, count);
      m.count = n ? count : 0;
      m.frustumCulled = false;
      m.receiveShadow = true;
      // the fleet is found by its lanes' surface, not by these
      m.raycast = () => {};
      if (color) m.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
      return m;
    };
    const body = make(podGeometry(), mats.body, 1, (v) => ({ box: [0, EQUATOR, 0, 0], dim: [PODS[v.kind].length, 1, 1] }), true);
    body.geometry.setAttribute("aGlow", new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
    return {
      body,
      canopy: make(
        podGeometry(),
        mats.canopy,
        1,
        (v) => {
          const c = PODS[v.kind].canopy;
          return { box: [c.x, ROOF - 0.055, 0, 0], dim: [c.length / c.width, CANOPY_H, c.width] };
        },
        false,
      ),
    };
  }, [fleet, mats]);
  useEffect(
    () => () => {
      for (const m of Object.values(meshes)) {
        m.geometry.dispose();
        m.dispose();
      }
    },
    [meshes],
  );

  /* the fleet's paint: a matte shell, and strips in the sender's district hue, or
     the brand's red on a route to or from the C-Chain; blue for the hovered route
     and the picked set's. A route that is not lit drives on, its strips 70% toward
     the road's grey and its shell a little */
  useEffect(() => {
    const road = new Color(FLEET.roadLo[theme]);
    const shell = new Color(dark ? "#3B484B" : "#A2AFB2");
    const lifted = new Color(dark ? "#5f9dff" : "#0061E2");
    const hot = hovered ? routes.findIndex((r) => r.key === hovered) : -1;
    const glows = routes.map((r, i) => {
      if (i === hot || blue[i]) return lifted;
      if (r.from === HUB_ID || r.to === HUB_ID) return RED;
      const d = city.lots.get(r.from)?.district ?? "frontier";
      return new Color(GLASS3[d][theme]);
    });
    const glow = meshes.body.geometry.getAttribute("aGlow") as InstancedBufferAttribute;
    fleet.forEach((v, i) => {
      const lit = hot >= 0 ? v.route === hot : on[v.route];
      meshes.body.setColorAt(i, shell.clone().lerp(road, lit ? 0 : 0.3));
      const g = glows[v.route].clone().lerp(road, lit ? 0 : 0.7);
      glow.setXYZ(i, g.r, g.g, g.b);
    });
    glow.needsUpdate = true;
    if (meshes.body.instanceColor) meshes.body.instanceColor.needsUpdate = true;
  }, [fleet, meshes, routes, city, blue, on, theme, dark, hovered]);

  /* the pick surface: the lanes' ribbons, drawn only as the hovered route's lit lane. The
     cursor finds a route on them, or on one of its pods where that stands now; the pods
     are sought only as the pointer moves, so no frame spends script on them */
  const now = useRef({ fleet, streets, heights, liveAt, still });
  now.current = { fleet, streets, heights, liveAt, still };
  const pick = useMemo(() => {
    const { geometry, faces } = ribbonsOf(streets, heights, RIBBON * city.lot);
    const material = new ShaderMaterial({
      uniforms: { uHot: { value: -1 }, uColor: { value: new Color("#0061E2") }, uAlpha: { value: 0.5 }, uTime: TIME },
      ...LIT_LANE,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    material.visible = false;
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.raycast = (raycaster: Raycaster, intersects: Intersection[]) => {
      const found: Intersection[] = [];
      Mesh.prototype.raycast.call(mesh, raycaster, found);
      for (const h of found) if (h.faceIndex != null && faces[h.faceIndex] !== undefined) intersects.push({ ...h, instanceId: faces[h.faceIndex] });
      const { fleet: vs, streets: ss, heights: hs, liveAt: at, still: held } = now.current;
      if (held) return;
      const { origin: o, direction: d } = raycaster.ray;
      const t0 = TIME.value - at;
      for (const v of vs) {
        const q = poseOf(v, t0, ss[v.route]?.lane, hs[v.route]);
        if (!q) continue;
        const c = Math.cos(q.yaw);
        const sn = Math.sin(q.yaw);
        // the ray in the pod's frame: +x ahead, +z to its right
        const ox = o.x - q.x;
        const oz = o.z - q.z;
        const half = (PODS[v.kind].length / 2) * v.width;
        const t = slab([ox * c + oz * sn, o.y - q.y, -ox * sn + oz * c], [d.x * c + d.z * sn, d.y, -d.x * sn + d.z * c], [-half, 0, -v.width / 2], [half, (ROOF + 0.12) * v.width, v.width / 2]);
        if (t === null || t < raycaster.near || t > raycaster.far) continue;
        intersects.push({ distance: t, point: new Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), object: mesh, instanceId: v.route } as Intersection);
      }
    };
    return mesh;
  }, [streets, heights, city.lot]);
  useEffect(
    () => () => {
      pick.geometry.dispose();
      (pick.material as ShaderMaterial).dispose();
    },
    [pick],
  );
  // the lit lane follows the hover and the theme: the brand's blue by day, a paler blue at night
  useEffect(() => {
    const m = pick.material as ShaderMaterial;
    const hot = hovered ? routes.findIndex((r) => r.key === hovered) : -1;
    m.uniforms.uHot.value = hot;
    m.uniforms.uColor.value.set(dark ? "#5f9dff" : "#0061E2");
    m.uniforms.uAlpha.value = dark ? 0.55 : 0.45;
    m.visible = hot >= 0;
  }, [pick, hovered, routes, dark]);
  const hoveredKey = useRef(hovered);
  hoveredKey.current = hovered;
  // a route under the cursor, unless the hover holds; the same one again asks nothing
  const over = (e: ThreeEvent<PointerEvent>) => {
    if (frozen?.current || e.instanceId === undefined) return;
    const key = routes[e.instanceId]?.key ?? null;
    if (key && key !== hoveredKey.current) onHoverRoute?.(key, e.point.clone());
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    const key = e.instanceId === undefined ? null : routes[e.instanceId]?.key ?? null;
    if (key && key === hoveredKey.current) onHoverRoute?.(null);
  };

  const shown = !still && fleet.length > 0;
  return (
    <>
      <group visible={shown}>
        <primitive object={meshes.body} />
        <primitive object={meshes.canopy} />
      </group>
      {/* beside the fleet, so a still reader's lanes still answer the cursor */}
      <primitive object={pick} onPointerOver={over} onPointerMove={over} onPointerOut={out} />
    </>
  );
}
