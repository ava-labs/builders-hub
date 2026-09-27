"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  DoubleSide,
  FrontSide,
  InstancedMesh,
  Mesh,
  MeshDepthMaterial,
  RGBADepthPacking,
  WebGLRenderTarget,
  type Camera,
  type Group,
  type Material,
  type Object3D,
  type Scene,
  type Side,
  type Texture,
  type WebGLRenderer,
} from "three";
import { cityMounting, cityStood } from "@/components/explorer-v2/network/city-signal";
import { takeEnv } from "./Lighting";
import { TIME } from "./shaders";

/* The city's opening, and the scene's warm-up under it. The canvas
   shows once the sky, the sea, the column and the plate can draw (their
   programs compiled, their images up; on a cold cache, every program in
   the scene, each drawn once unseen), over the CSS sky under it. Once it has
   faded in, the column rises out of the cloud sea with the plate on its
   capital (OPENING.column, 1.4 s); the plate paints in once it has
   landed and the plan is in (OPENING.paint, 0.4 s); and the city's clock
   (WARM) starts halfway through the paint, so the towers rise from their
   first frame. A return in this tab, and a reader who asks for less
   motion, open on the city standing, over a short fade.
   No frame waits on a shader. Each program compiles in the GPU
   process's own threads (KHR_parallel_shader_compile, as three's
   compileAsync reads it), and a frame draws only what is ready: an
   object whose program is still compiling stays out of the frame, and
   out of the sun's shadow, until it is, and its textures go up a frame
   at a time before it first shows. Drawn before they were ready, the
   city's seventy programs held the main thread for half a second, and
   for seven seconds on a cold cache; and on a cold cache the GPU
   process holds the frames for a second more while it makes each
   program's pipeline at its first draw, which is why there all of it
   happens before the canvas shows.
   A part of the scene in a later Stage mounts after the one before it,
   in a task of its own, so no one task builds the whole city. */

/** the city's clock holds while `held` is set, at `from` seconds: 0 before the towers rise, or the city standing lit on a return.
    quiet: no program is compiling, so the GPU process has time for an image. unseen: the canvas has not shown yet, and what
    paints in it does not show either (a hundredth of its opacity), so a word may paint once there to make its pipelines */
export const WARM = { held: true, from: 0, quiet: false, unseen: true };

/** the opening, as the column, the plate and the camera read it: each value runs from 0 to 1 on the brand's curve */
export const OPENING = {
  /** the column's rise out of the cloud sea, from the end of the canvas's fade in: 0 under the frame, 1 landed */
  column: { value: 0 },
  /** the plate's paint, once the column has landed and the plan is in: 0 plain stone, 1 painted */
  paint: { value: 0 },
  /** a return in this tab: the city opens standing and lit, the camera at its shot */
  returning: false,
  /** the column rises on this visit (a first visit or a refresh, not a return or a reader who asks for less motion), and
      has not landed yet: the camera's first look follows it */
  rising: false,
};

/** how far the column rises, in world units: its capital starts this far under its place */
export const RISE_DEPTH = 700;
const COLUMN_MS = 1400;
const PAINT_MS = 400;
/* a cold shader cache (a first visit ever): the GPU process is so busy making programs that a question about one takes
   this long to answer (a warm one answers in well under a millisecond); two such answers say the cache is cold */
const SLOW_POLL_MS = 40;
/** how long the rest of the opening takes once the reader asks for something */
const HURRY_MS = 300;
/** the canvas's fade in: over the opening, and over a city that opens standing */
const FADE_MS = 360;
const QUICK_MS = 300;
/* the canvas's opacity before it shows */
const UNSEEN = "0.01";
/* an unseen pass that runs long (a slow GPU, software rendering, a program that never reports) still shows the canvas and
   plays the opening, what is left compiling as it rises; and the clock still runs */
const SHOW_BY_MS = 4000;
const RUN_BY_MS = 8000;

/* the city has stood once in this tab: a return to the page opens it standing */
let stood = false;

/* the opening's marks, in the page's clock, for the dev tools and the load checks: when the scene mounted, the canvas showed,
   the column landed, the plan came in (data) and the plate's textures were up for it (upload), the plate began to paint
   and was half painted, every program stood (programs), every stage had mounted, and the city's clock ran; with the gate
   that opened last before the paint and before the clock */
const MARKS: Record<string, number> = {};
const HELD: { paint: string; clock: string } = { paint: "-", clock: "-" };
function mark(k: string, at = performance.now()) {
  if (MARKS[k] !== undefined) return;
  MARKS[k] = at;
  if (process.env.NODE_ENV === "production" || k !== "clock") return;
  const since = (x: string) => (MARKS[x] === undefined ? "-" : `${Math.round(MARKS[x] - MARKS.mount)}`);
  const last = (ks: string[]) => ks.reduce((a, b) => ((MARKS[b] ?? -1) > (MARKS[a] ?? -1) ? b : a));
  if (!MARKS.standing) {
    HELD.paint = last(["landed", "data", "upload"]);
    HELD.clock = MARKS.overdue !== undefined ? "overdue" : last(["painted", "programs", "staged"]);
  }
  const gates = ["shown", "landed", "data", "upload", "paint", "painted", "programs", "staged", "clock"].map((x) => `${x} ${since(x)}`).join(", ");
  console.info(`[city3d] opening, ms after mount: ${gates}${MARKS.standing ? " (standing)" : `; the paint waited on ${HELD.paint}, the clock on ${HELD.clock}`}`);
}
/* what the frame left out once the city stood, for the load checks: a standing city should leave nothing out; and how the
   warm-up read the cache (the first programs' times to stand) */
const HIDES: [number, number, string][] = [];
const DEV: { cold: boolean; slow: number; lat: number[]; polls: number[] } = { cold: false, slow: 0, lat: [], polls: [] };
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __opening?: object }).__opening = { marks: MARKS, held: HELD, hides: HIDES, dev: DEV, OPENING, WARM };

/* the images the scene has asked for and does not have yet (tile.ts): the canvas shows once they are up, so none of them
   goes up while the column rises */
const PENDING = new Set<Promise<unknown>>();

/** an image the scene waits for before it shows; one asked for once the canvas shows only goes up */
export function waitFor<T>(p: Promise<T>): Promise<T> {
  PENDING.add(p);
  const done = () => PENDING.delete(p);
  p.then(done, done);
  return p;
}

/* when the reader asked for something during the opening */
const HURRY: { at: number | null } = { at: null };

/** the reader's intent beats the show: a pick, a deep link or a click during the opening finishes it in 300 ms, and the
    city stands at once, lit, with no stagger; before the canvas shows, the city opens standing */
export function hurry() {
  HURRY.at ??= performance.now();
}

/* the brand's curve, cubic-bezier(0.16, 1, 0.3, 1), solved for x */
function brand(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * 0.16 + 3 * (1 - t) * t * t * 0.3 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t + 3 * (1 - t) * t * t + t * t * t;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    const v = bx(t);
    if (Math.abs(v - x) < 1e-5) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return by(t);
}

/* the column and all that stands on it, which the opening lifts */
const RISE: { group: Group | null } = { group: null };

/** the column, the plate and the city on it: the opening lifts them out of the cloud sea, RISE_DEPTH world units */
export function Rise({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    RISE.group = g;
    if (g) g.position.y = -RISE_DEPTH * (1 - OPENING.column.value);
    return () => {
      if (RISE.group === g) RISE.group = null;
    };
  }, []);
  return <group ref={ref}>{children}</group>;
}

/* whether the column is moving, and who waits for it to land */
const MOVING = { on: false, subs: new Set<() => void>() };

/** a value the scene takes only while the column stands still: what comes in as it rises waits until it has landed, so the
    work it makes (a new plan, the towers' meshes) holds no frame of the rise */
export function useSteady<T>(value: T): T {
  const [kept, setKept] = useState(value);
  const moving = MOVING.on;
  if (!moving && kept !== value) setKept(value);
  useEffect(() => {
    if (kept === value) return;
    const land = () => {
      if (!MOVING.on) setKept(value);
    };
    MOVING.subs.add(land);
    return () => {
      MOVING.subs.delete(land);
    };
  }, [kept, value]);
  return moving ? kept : value;
}

/* the stages: the one the warm-up has reached, the last one the scene has, who listens, and the parts of the city that
   mount after the first (what the canvas does not wait for) */
const STAGES = { step: 0, last: 0, subs: new Set<() => void>(), later: new Set<Group>() };
const subscribe = (fn: () => void) => {
  STAGES.subs.add(fn);
  return () => {
    STAGES.subs.delete(fn);
  };
};
const stepNow = () => STAGES.step;

/** a part of the scene that mounts at its stage: stage 0 with the canvas, each one after it in a task of its own. A part
    after stage 0 is the city, whose textures the plate's paint does not wait for */
export function Stage({ at, children }: { at: number; children: ReactNode }) {
  const step = useSyncExternalStore(subscribe, stepNow, () => 0);
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    STAGES.last = Math.max(STAGES.last, at);
  }, [at]);
  const on = step >= at;
  useLayoutEffect(() => {
    const g = ref.current;
    if (!on || !g || at < 1) return;
    STAGES.later.add(g);
    return () => {
      STAGES.later.delete(g);
    };
  }, [on, at]);
  return on ? <group ref={ref}>{children}</group> : null;
}

/* what three keeps per material and texture, as the warm-up reads it */
interface Program {
  isReady: () => boolean;
  getUniforms: () => unknown;
  name?: string;
  program?: WebGLProgram;
  vertexShader?: WebGLShader;
  fragmentShader?: WebGLShader;
}
/* a program three has used once: its first use asks the GPU process for its logs and waits on the answer, 5 to 15 ms each
   while the GPU process compiles the rest, so the warm-up makes it, a few a frame */
const USED = new WeakSet<Program>();
/* a program found ready, which three keeps as ready too: not asked again */
const READY = new WeakSet<Program>();
interface MaterialState {
  programs?: Map<string, Program>;
  uniforms?: Record<string, { value: unknown } | undefined>;
}
interface TextureState {
  __version?: number;
}
type Props = { get: (o: unknown) => unknown };

type Drawn = Object3D & { material: Material | Material[]; isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };
const isDrawn = (o: Object3D): o is Drawn => {
  const d = o as Drawn;
  return !!(d.isMesh || d.isPoints || d.isLine || d.isSprite) && !!d.material;
};

/** an object the frame draws, as the warm-up knows it: its materials at the versions it compiled them, and their programs */
interface Rec {
  src: Material | Material[];
  vers: number[];
  mats: Material[];
  programs: Program[] | null;
  depth: Program[] | null;
  shown: boolean;
}

/* a transparent material drawn from both sides renders twice a frame, back then front, and bumps its version each time:
   its version says nothing, so its programs stand once they are made */
const twoPass = (m: Material) => m.transparent && m.side === DoubleSide && !m.forceSinglePass;

function sameAs(rec: Rec, o: Drawn): boolean {
  const src = o.material;
  if (rec.src !== src) return false;
  const list = Array.isArray(src) ? src : [src];
  if (list.length !== rec.vers.length) return false;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (rec.vers[i] !== m.version + (m.visible ? 0 : 0.5) && !(rec.programs && twoPass(m))) return false;
  }
  return true;
}
const versOf = (o: Drawn) => (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.version + (m.visible ? 0 : 0.5));
const matsOf = (o: Drawn) => (Array.isArray(o.material) ? o.material : [o.material]).filter((m) => m && m.visible);

/* the sun's shadow draws each caster with a depth material, its own or three's, set up from each of the caster's
   materials as three's shadow map sets it up; the warm-up compiles the same programs, into a target as the shadow does */
const SHADOW_SIDE: Record<number, Side> = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide };
type Mapped = Material & { map?: Texture | null; alphaMap?: Texture | null; displacementMap?: Texture | null; displacementScale?: number; displacementBias?: number; wireframe?: boolean };
function depthSetup(m: Material) {
  const d = m as Mapped;
  return {
    visible: m.visible,
    wireframe: !!d.wireframe,
    side: m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : SHADOW_SIDE[m.side],
    alphaMap: d.alphaMap ?? null,
    alphaTest: m.alphaToCoverage ? 0.5 : m.alphaTest,
    map: d.map ?? null,
    clipShadows: m.clipShadows,
    clippingPlanes: m.clippingPlanes,
    clipIntersection: m.clipIntersection,
    displacementMap: d.displacementMap ?? null,
    displacementScale: d.displacementScale ?? 1,
    displacementBias: d.displacementBias ?? 0,
  };
}
const setupKey = (s: ReturnType<typeof depthSetup>) => `${s.side}|${!!s.map}|${!!s.alphaMap}|${s.alphaTest}|${!!s.displacementMap}|${s.wireframe}`;

/* the texture slots of three's own materials */
const SLOTS = ["map", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap", "lightMap", "metalnessMap", "normalMap", "roughnessMap", "specularMap", "gradientMap", "matcap"];

interface Warm {
  recs: WeakMap<Object3D, Rec>;
  /** what has its programs but has not used them all: the frame's spare time uses them, so an object that shows later
      (the night's lights by day, a part not drawn yet) costs its frame nothing */
  idle: Set<Drawn>;
  queue: Drawn[];
  queued: WeakSet<Object3D>;
  /** three's own depth material as the shadow sets it up for a caster, one per setup */
  depths: Map<string, MeshDepthMaterial>;
  /** a stand-in of each caster's kind for its depth material, which the compile reads as the shadow reads the caster */
  proxies: WeakMap<Object3D, Map<Material, Object3D>>;
  target: WebGLRenderTarget | null;
  mountAt: number;
  /** how long the unseen pass may run before the canvas shows anyway */
  showBy: number;
  /** when the canvas showed, and the column started to rise */
  shownAt: number | null;
  /** when the plate started to paint */
  paintAt: number | null;
  /** the city opens standing: a return, or a reader who asked for something before the canvas showed */
  standing: boolean;
  /** where the opening stood when the reader asked for something */
  hurried: { at: number; column: number } | null;
  /** the district names' opacity as last set */
  words: number;
  /** what the frame left out, as last counted: a change redraws the sun's map */
  out: number;
  /** the last frame drew every program it had */
  drawn: boolean;
  /** when each program was asked for, until it stands, and how long the first ones took: a cold cache shows here */
  born: WeakMap<Program, number>;
  known: WeakSet<Program>;
  lat: number[];
  /** the readiness checks that waited on the GPU process */
  slow: number;
  /** since when every program stands, if it does */
  quietAt: number | null;
  /** the city's clock runs, for good */
  released: boolean;
  stepping: boolean;
  frame: number;
  /** what fades in */
  faded: HTMLElement | null;
}

const freshWarm = (): Warm => ({
  recs: new WeakMap(),
  idle: new Set(),
  queue: [],
  queued: new WeakSet(),
  depths: new Map(),
  proxies: new WeakMap(),
  target: null,
  mountAt: 0,
  showBy: SHOW_BY_MS,
  shownAt: null,
  paintAt: null,
  standing: false,
  hurried: null,
  words: -1,
  out: -1,
  drawn: false,
  born: new WeakMap(),
  known: new WeakSet(),
  lat: [],
  slow: 0,
  quietAt: null,
  released: false,
  stepping: false,
  frame: 0,
  faded: null,
});

/** hold: the plan has not come in, so the plate waits, plain. still: a reader who asks for less motion, or a GPU that cannot
    keep up: the city opens standing, with no rise. from: the clock's time, in seconds, at which the city stands lit, where a
    return or a hurried opening starts it. fade: what fades in with the canvas, the scene's words and tooltip with it (the
    canvas alone when unset). words: the district names and the towers' words, which fade in with the plate's paint */
export function Warmup({ hold = false, still = false, from = 0, fade, words }: { hold?: boolean; still?: boolean; from?: number; fade?: RefObject<HTMLElement | null>; words?: RefObject<HTMLElement | null> }) {
  const gl = useThree((s) => s.gl) as WebGLRenderer;
  const invalidate = useThree((s) => s.invalidate);
  const warm = useRef<Warm | null>(null);
  // a hot reload keeps the ref of an older warm-up, whose state may lack what this one keeps: it starts again, on the city
  // standing, since the city stood before the reload
  if (warm.current && !(warm.current.idle instanceof Set)) warm.current = { ...freshWarm(), standing: true, mountAt: performance.now() };
  warm.current ??= freshWarm();
  // a return in this tab, known before the scene's parts mount: the camera and the sky read it as they do
  useState(() => {
    OPENING.returning = stood;
    OPENING.rising = !stood && !still;
    return null;
  });
  const now = useRef({ hold, still, from });
  now.current = { hold, still, from };

  // a new city: its clock holds, its stages start again, and its canvas stands clear until what it first draws is ready
  useLayoutEffect(() => {
    /* three's shader check asks the GPU process for each program's logs at its first use and waits on the answer, up to a
       third of a second each on a cold cache; the warm-up checks instead that each program linked (checkProgram) */
    gl.debug.checkShaderErrors = false;
    WARM.held = true;
    WARM.unseen = true;
    STAGES.step = 0;
    MOVING.on = false;
    /* the canvas stands clear at a hundredth, not at nothing, on a layer of its own from the first frame: the browser
       composites it, and paints what lies over it, as it will through the fade, so the pipelines its own GPU work needs for
       that are made unseen (on a cold cache, a second and more at the show). Over the page's sky, which the canvas's first
       frame matches, a hundredth does not show */
    const el = fade?.current ?? gl.domElement;
    el.style.willChange = "opacity";
    el.style.opacity = UNSEEN;
    const st = warm.current;
    if (st) {
      st.faded = el;
      st.mountAt = performance.now();
      // in dev, the load checks can shorten the cap (localStorage city3d-showby, in ms), to play the slow GPU's path
      if (process.env.NODE_ENV !== "production") {
        try {
          const by = Number(window.localStorage.getItem("city3d-showby"));
          if (by > 0) st.showBy = by;
        } catch {
          /* no storage: the cap stands */
        }
      }
    }
    for (const k in MARKS) delete MARKS[k];
    HELD.paint = HELD.clock = "-";
    DEV.polls.length = 0;
    mark("mount");
    cityMounting();
    const said = words?.current;
    return () => {
      WARM.held = true;
      WARM.unseen = true;
      STAGES.step = 0;
      STAGES.last = 0;
      MOVING.on = false;
      HURRY.at = null;
      el.style.opacity = "";
      el.style.transition = "";
      el.style.willChange = "";
      if (said) said.style.opacity = "";
      st?.target?.dispose();
      st?.depths.forEach((d) => d.dispose());
    };
  }, [gl, fade, words]);

  useFrame(({ scene, camera }) => {
    const st = warm.current!;
    const t0 = performance.now();
    const props = gl.properties as unknown as Props;
    const shadows = gl.shadowMap.enabled;
    const { hold, still, from } = now.current;
    // a reader who asks for something before the canvas shows gets the city standing; after, the rest of the opening in 300 ms
    if (HURRY.at !== null && st.shownAt === null) st.standing = true;
    if (HURRY.at !== null && st.shownAt !== null && !st.hurried) st.hurried = { at: HURRY.at, column: OPENING.column.value };
    const standing = OPENING.returning || still || st.standing;
    WARM.from = OPENING.returning || st.standing || st.hurried ? from : 0;

    /* the opening's clock: the column rises once the canvas has faded in (the first beat is the sky and the sea, an empty
       frame), and the plate paints once it has landed and the plan is in */
    const h = st.hurried;
    const riseAt = st.shownAt === null ? null : st.shownAt + FADE_MS;
    const column = standing ? 1 : riseAt === null ? 0 : h ? h.column + (1 - h.column) * brand((t0 - h.at) / HURRY_MS) : brand((t0 - riseAt) / COLUMN_MS);
    const paintMs = h && st.paintAt !== null && st.paintAt >= h.at ? HURRY_MS : PAINT_MS;
    OPENING.column.value = column;
    if (standing || column >= 1) OPENING.rising = false;
    OPENING.paint.value = standing ? 1 : st.paintAt === null ? 0 : brand((t0 - st.paintAt) / paintMs);
    const moving = !standing && st.shownAt !== null && column < 1;
    if (moving !== MOVING.on) {
      MOVING.on = moving;
      for (const fn of [...MOVING.subs]) fn();
    }
    if (RISE.group && RISE.group.position.y !== -RISE_DEPTH * (1 - column)) {
      RISE.group.position.y = -RISE_DEPTH * (1 - column);
      // the plate and what stands on it cast: the sun's map follows them up, and holds still once they have landed
      gl.shadowMap.needsUpdate = true;
    }
    const w = words?.current;
    if (w && st.words !== OPENING.paint.value) {
      st.words = OPENING.paint.value;
      w.style.opacity = String(st.words);
    }
    const painting = st.paintAt !== null && t0 - st.paintAt < paintMs;
    // the frame's budget for the warm-up: wide while the canvas stands clear or the plate waits still, narrow while anything moves
    const budget = st.shownAt === null ? 36 : moving || painting || st.released ? 6 : 24;

    /* what the frame draws, and what of it is new or changed since the warm-up compiled it; a change to what already
       shows goes first, so it is back in this frame when its program stands. What does not show yet (the night's stars
       by day, a part that comes later) compiles too, while the canvas stands clear and a few times a second after */
    const list: Drawn[] = [];
    scene.traverseVisible((o) => {
      if (isDrawn(o)) list.push(o);
    });
    // before the plate paints: what is the city, which the canvas does not wait for, and the rest, the sky, the sea and the plate
    const later = new Set<Object3D>();
    if (st.paintAt === null) for (const g of STAGES.later) g.traverse((o) => later.add(o));
    const look: Drawn[] = [...list];
    if (!st.released || st.frame++ % 15 === 0) {
      const drawnNow = new Set<Object3D>(list);
      scene.traverse((o) => {
        if (isDrawn(o) && !drawnNow.has(o)) look.push(o);
      });
    }
    for (const o of look) {
      const mats = matsOf(o);
      for (const m of mats) takeEnv(m);
      const rec = st.recs.get(o);
      if (rec && sameAs(rec, o)) continue;
      const shown = rec?.shown ?? false;
      st.recs.set(o, { src: o.material, vers: versOf(o), mats, programs: null, depth: null, shown });
      if (st.queued.has(o)) continue;
      st.queued.add(o);
      // a change to what shows goes first, and so does an object whose materials have their programs: it costs little
      if (shown || mats.every((m) => programsOf(props, m).length > 0)) st.queue.unshift(o);
      else st.queue.push(o);
    }
    if (st.queue.length) compileSome(gl, st, scene, camera, t0, shadows, budget);

    // what is not ready stays out of this frame; what shows for the first time takes its textures up first, one a frame
    let busy = st.queue.length > 0;
    const hidden: Drawn[] = [];
    const unshadowed: Drawn[] = [];
    const why: string[] = [];
    let uploaded = false;
    // the plate's own textures, painted again for the plan, go up before it paints in
    let pending = false;
    let uses = 0;
    const use = (ps: Program[]) => {
      for (const p of ps) {
        if (USED.has(p)) continue;
        if (uses > 0 && performance.now() - t0 >= budget) return false;
        // checked before its first use, which lets its shaders go
        if (process.env.NODE_ENV !== "production") checkProgram(gl, p);
        p.getUniforms();
        USED.add(p);
        uses++;
      }
      return true;
    };
    /* a program's readiness, asked of the GPU process: an answer that takes long means it is busy making programs, which
       is what a cold cache looks like (a warm one answers at once, however late the main thread asks). Each program is
       asked once a frame, and after one slow answer the rest wait for the next frame */
    const asked = new Map<Program, boolean>();
    let slowNow = false;
    const ready = (p: Program) => {
      if (READY.has(p)) return true;
      const was = asked.get(p);
      if (was !== undefined) return was;
      if (slowNow) return false;
      const a = performance.now();
      const r = p.isReady();
      const ms = performance.now() - a;
      if (ms > SLOW_POLL_MS) {
        st.slow++;
        slowNow = true;
      }
      if (process.env.NODE_ENV !== "production" && ms > 10 && DEV.polls.length < 30) DEV.polls.push(Math.round(ms));
      asked.set(p, r);
      if (r) READY.add(p);
      return r;
    };
    // the time to stand runs to now: on a cold cache the check that finds a program ready may itself wait on the GPU process
    const seen = (ps: Program[]) => {
      for (const p of ps) {
        const b = st.born.get(p);
        if (b === undefined) continue;
        st.born.delete(p);
        if (st.lat.length < 12) st.lat.push(performance.now() - b);
      }
    };
    for (const o of list) {
      const rec = st.recs.get(o)!;
      // a material that is never drawn (a pick proxy) compiles nothing, and its object is never hidden: it takes the pointer
      if (!rec.mats.length) continue;
      if (rec.programs?.every(ready)) seen(rec.programs);
      if (!rec.programs || !rec.programs.every(ready) || !use(rec.programs)) {
        o.visible = false;
        hidden.push(o);
        if (process.env.NODE_ENV !== "production") why.push(`${nameOf(o)}:${!rec.programs ? "q" : rec.programs.every(ready) ? "u" : "c"}${rec.shown ? "!" : ""}`);
        busy = true;
        continue;
      }
      if (!rec.shown || (st.paintAt === null && !later.has(o))) {
        const up = texturesOf(rec.mats, props).filter((t) => (props.get(t) as TextureState).__version !== t.version);
        while (up.length && (!uploaded || st.shownAt === null) && performance.now() - t0 < budget) {
          gl.initTexture(up.shift()!);
          uploaded = true;
        }
        if (up.length) {
          if (rec.shown) {
            pending = true;
          } else {
            o.visible = false;
            hidden.push(o);
            if (process.env.NODE_ENV !== "production") why.push(`${nameOf(o)}:t`);
            busy = true;
            continue;
          }
        }
        rec.shown = true;
      }
      if (shadows && o.castShadow && (!(rec.depth ?? []).every(ready) || !use(rec.depth ?? []))) {
        o.castShadow = false;
        unshadowed.push(o);
        busy = true;
      }
    }

    // the frame's spare time: the programs of what does not show yet are used now, so its first frame waits on nothing
    for (const o of st.idle) {
      if (performance.now() - t0 >= budget) break;
      const rec = st.recs.get(o);
      const ps = rec?.programs ? [...rec.programs, ...(rec.depth ?? [])] : null;
      if (!ps) {
        st.idle.delete(o);
        continue;
      }
      if (!ps.every(ready)) continue;
      let all = true;
      for (const p of ps) {
        if (USED.has(p)) continue;
        if (performance.now() - t0 >= budget) {
          all = false;
          break;
        }
        if (process.env.NODE_ENV !== "production") checkProgram(gl, p);
        p.getUniforms();
        USED.add(p);
      }
      if (all) st.idle.delete(o);
    }
    if (process.env.NODE_ENV !== "production" && st.released && (hidden.length || unshadowed.length) && HIDES.length < 2000)
      HIDES.push([Math.round(t0), hidden.length + unshadowed.length / 1000, why.slice(0, 6).join(" ")]);
    // what shows or casts changed: the sun's map draws it
    const out = hidden.length * 4096 + unshadowed.length;
    if (out !== st.out) {
      st.out = out;
      gl.shadowMap.needsUpdate = true;
    }
    /* while the canvas stands clear the map draws every frame: each caster's depth program draws before the city shows, and
       its first draw (a pipeline the GPU makes on a cold cache, a tenth of a second and more) holds no frame of the rise */
    if (st.shownAt === null && shadows) gl.shadowMap.needsUpdate = true;
    gl.render(scene, camera);
    for (const o of hidden) o.visible = true;
    for (const o of unshadowed) o.castShadow = true;
    // a frame that left nothing out has drawn every program: the next may show
    st.drawn = !hidden.length && !unshadowed.length;

    // the stages mount one after another, each in its own task, while the canvas stands clear: a frame comes between them
    // only when one is due
    const staged = STAGES.step >= STAGES.last;
    if (!staged && !st.stepping) {
      st.stepping = true;
      const next = () => {
        STAGES.step++;
        for (const fn of STAGES.subs) fn();
        if (STAGES.step < STAGES.last) setTimeout(next, 0);
        else st.stepping = false;
      };
      setTimeout(next, 0);
    }
    /* every stage has mounted, the images are up, and the sky, the sea, the column and the plate stand: the canvas fades
       in, and the column starts to rise while the city's programs compile. On a cold cache (the GPU process was slow to
       answer, SLOW_POLL_MS) it waits for every program to stand and draw once: there the GPU process makes each
       program's pipeline at its first draw and holds the frames while it does, which may not fall in the rise. A city
       that opens standing waits for all of it too */
    const sorted = [...st.lat].sort((a, b) => a - b);
    const cold = st.slow >= 2;
    if (process.env.NODE_ENV !== "production" && st.shownAt === null) Object.assign(DEV, { cold, slow: st.slow, lat: sorted.map(Math.round) });
    WARM.quiet = !busy || !cold;
    const all = !busy && st.drawn;
    const late = t0 - st.mountAt > st.showBy;
    if (st.shownAt === null && ((staged && !PENDING.size && (standing || cold ? all : !hidden.some((o) => !later.has(o)))) || late)) {
      st.shownAt = performance.now();
      WARM.unseen = false;
      mark("shown", st.shownAt);
      if (standing) mark("standing", st.shownAt);
      const el = st.faded ?? gl.domElement;
      el.style.transition = `opacity ${standing ? QUICK_MS : FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      el.style.opacity = "1";
    }
    // the column has landed (or the reader asked), the plan is in and the plate is painted for it: the plate paints in
    if (column >= 1 && st.shownAt !== null) mark("landed");
    if (!hold) mark("data");
    if (!hold && !pending) mark("upload");
    if (staged) mark("staged");
    if (busy) st.quietAt = null;
    else st.quietAt ??= t0;
    if (!standing && st.paintAt === null && (column >= 1 || h) && !hold && !pending) {
      st.paintAt = performance.now();
      mark("paint", st.paintAt);
    }
    // the paint is half done and every program stands: the clock runs, and downtown rises first; a hurried city waits for all of it
    const painted = standing || (st.paintAt !== null && t0 - st.paintAt >= (h ? paintMs : PAINT_MS / 2) && column >= 1);
    if (painted && st.shownAt !== null) mark("painted");
    const overdue = st.shownAt !== null && t0 - st.shownAt > RUN_BY_MS && !hold;
    if (!st.released && st.shownAt !== null && ((painted && !busy && !hold && staged) || overdue)) {
      st.released = true;
      stood = true;
      if (!(painted && !busy && !hold && staged)) mark("overdue");
      mark("programs", st.quietAt ?? t0);
      mark("clock");
    }
    WARM.held = !st.released;
    // the towers are up and lit: the app's later work may come in
    if (st.released && TIME.value >= from - 1) cityStood();
    if (busy || !st.released || moving || painting) invalidate();
  }, 1);

  return null;
}

/* in dev, a program that did not link says so, with its logs: the link's status comes with what three asked the GPU process
   at the program's first use, so only a broken program waits on its logs */
function checkProgram(gl: WebGLRenderer, p: Program) {
  const ctx = gl.getContext();
  if (!p.program || ctx.getProgramParameter(p.program, ctx.LINK_STATUS)) return;
  const log = (s?: WebGLShader) => (s ? ctx.getShaderInfoLog(s)?.trim() : "") || "";
  console.error(`[city3d] the program ${p.name ?? ""} did not link\n${ctx.getProgramInfoLog(p.program)?.trim() ?? ""}\nvertex: ${log(p.vertexShader)}\nfragment: ${log(p.fragmentShader)}`);
}

/* an object as the dev log names it: its own name or its nearest named parent's, and its material's */
function nameOf(o: Object3D): string {
  let n: Object3D | null = o;
  while (n && !n.name) n = n.parent;
  const m = (o as Drawn).material;
  const mat = Array.isArray(m) ? m[0] : m;
  return `${n?.name || o.type}/${mat?.name || mat?.type || "?"}${(mat as { customProgramCacheKey?: () => string })?.customProgramCacheKey?.().replace("city3d-", "").slice(0, 20) ?? ""}`;
}

/* the programs a material has, for every object that draws it */
function programsOf(props: Props, m: Material): Program[] {
  const s = props.get(m) as MaterialState;
  return s.programs ? [...s.programs.values()] : [];
}

function texturesOf(mats: Material[], props: Props): Texture[] {
  const out = new Set<Texture>();
  const take = (v: unknown) => {
    const t = v as (Texture & { isTexture?: boolean; isRenderTargetTexture?: boolean; isCubeTexture?: boolean; isVideoTexture?: boolean }) | null | undefined;
    if (!t || !t.isTexture || t.version === 0 || !t.image || t.isRenderTargetTexture || t.isCubeTexture || t.isVideoTexture) return;
    if ((t.image as { complete?: boolean }).complete === false) return;
    out.add(t);
  };
  for (const m of mats) {
    const r = m as unknown as Record<string, unknown>;
    for (const k of SLOTS) take(r[k]);
    const u = (m as { uniforms?: Record<string, { value: unknown } | undefined> }).uniforms;
    if (u) for (const k in u) take(u[k]?.value);
    const pu = (props.get(m) as MaterialState).uniforms;
    if (pu) for (const k in pu) take(pu[k]?.value);
  }
  return [...out];
}

/* the queue's programs, made until the frame's budget is spent (one object at the least): each object's for the frame, and
   a caster's for the sun's shadow. The GPU process compiles them in its own threads; the frames after this one check them.
   A program takes three a couple of milliseconds to write (eight on a slow CPU): while the canvas stands clear the budget
   is wide, and once the city shows it keeps the frame short */
function compileSome(gl: WebGLRenderer, st: Warm, scene: Scene, camera: Camera, t0: number, shadows: boolean, budget: number) {
  const props = gl.properties as unknown as Props;
  const done: Drawn[] = [];
  const root = {
    traverse(cb: (o: Object3D) => void) {
      while (st.queue.length && (done.length === 0 || performance.now() - t0 < budget)) {
        const o = st.queue.shift()!;
        st.queued.delete(o);
        cb(o);
        done.push(o);
      }
    },
    traverseVisible() {},
  } as unknown as Object3D;
  gl.compile(root, camera, scene);
  for (const o of done) {
    const rec = st.recs.get(o);
    if (rec) rec.programs = rec.mats.flatMap((m) => programsOf(props, m));
    // a program made here for the first time: how long it takes to stand says whether the cache is cold
    for (const p of rec?.programs ?? []) {
      if (st.known.has(p)) continue;
      st.known.add(p);
      st.born.set(p, t0);
    }
    st.idle.add(o);
  }
  if (!shadows) return;
  const jobs: { proxy: Object3D; setup: (() => void) | null; rec: Rec | undefined; mat: Material }[] = [];
  for (const o of done) {
    if (!o.castShadow || !(o as Mesh).isMesh) continue;
    const rec = st.recs.get(o);
    const custom = (o as Mesh).customDepthMaterial;
    for (const m of rec?.mats ?? []) {
      const s = depthSetup(m);
      let mat: Material;
      let setup: (() => void) | null = null;
      if (custom) {
        mat = custom;
        setup = () => Object.assign(custom, s);
      } else {
        const k = setupKey(s);
        let d = st.depths.get(k);
        if (!d) st.depths.set(k, (d = Object.assign(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), s)));
        mat = d;
      }
      let byMat = st.proxies.get(o);
      if (!byMat) st.proxies.set(o, (byMat = new Map()));
      let proxy = byMat.get(mat);
      if (!proxy) {
        const src = o as InstancedMesh;
        if (src.isInstancedMesh) {
          const p = new InstancedMesh(src.geometry, mat, 1);
          p.instanceColor = src.instanceColor;
          p.morphTexture = src.morphTexture;
          proxy = p;
        } else proxy = new Mesh((o as Mesh).geometry, mat);
        byMat.set(mat, proxy);
      }
      jobs.push({ proxy, setup, rec, mat });
    }
  }
  if (!jobs.length) return;
  st.target ??= new WebGLRenderTarget(1, 1);
  const was = gl.getRenderTarget();
  gl.setRenderTarget(st.target);
  const shadowRoot = {
    traverse(cb: (o: Object3D) => void) {
      for (const j of jobs) {
        j.setup?.();
        cb(j.proxy);
      }
    },
    traverseVisible() {},
  } as unknown as Object3D;
  gl.compile(shadowRoot, camera, scene);
  gl.setRenderTarget(was);
  for (const j of jobs) if (j.rec) j.rec.depth = [...(j.rec.depth ?? []), ...programsOf(props, j.mat)];
}
