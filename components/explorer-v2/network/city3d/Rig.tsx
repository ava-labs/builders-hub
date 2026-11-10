"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { Box3, InstancedMesh, Matrix4, PerspectiveCamera, Raycaster, Spherical, Vector3, type Material } from "three";
import { PLATE } from "@/components/explorer-v2/network/icm-map";
import { TIME } from "./shaders";
import { OPENING } from "./warmup";
import type { CameraHandle, Inset } from "@/components/explorer-v2/network/icm-map";

/* The camera: a lens on a model city, as a visitor holds it. It opens at
   the map's own view, the plate seen from the front at the height of a
   true isometric drawing, and turns, tilts, zooms and pans with damping;
   it never goes under the ground or out past the plate. A shot frames
   what the app points at: the whole city, a district, a building, or
   downtown from its plaza to its flag. It flies there keeping the way the
   reader has turned the city, and back to where the reader left it. The
   city always stands centred in the room the app's panels leave. */

/** what the camera frames: the points it must hold in the room, how high it looks from, and how close it may come */
export interface Shot {
  key: string;
  points: Vector3[];
  /** the polar angle to look from, from straight above; unset keeps the reader's */
  polar?: number;
  /** the closest it comes, as a share of the whole city's distance */
  cap: number;
  /** a slower flight, for the close-up */
  slow?: boolean;
  /** the share of the room the shot may fill */
  fill?: number;
}

/** the lens: long, so the city reads as a model on a table, as the map's projection does */
export const FOV = 28;
/** the map's view: straight on at the plate's front, from 30 degrees up */
export const HOME_POLAR = (60 * Math.PI) / 180;
const UP = new Vector3(0, 1, 0);
// scratch, for the frame loop's read of the camera and a glide's pose
const tmpPos = new Vector3();
const tmpTarget = new Vector3();
const sphA = new Spherical();
const sphB = new Spherical();
/** how long a flight takes: to a district or a set, and the slow one into the close-up */
const FLIGHT_MS = 900;
const FLIGHT_SLOW_MS = 1300;

/* a cubic bezier ease as CSS writes it, solved for the curve's x by bisection */
function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
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
  };
}
/** the brand's ease, cubic-bezier(0.16, 1, 0.3, 1): a fast attack and a long decay, for the flights */
const ease = bezier(0.16, 1, 0.3, 1);
/** the opening's push into home: a smooth S (smootherstep, 6t^5 - 15t^4 + 10t^3), zero speed and zero acceleration at both
    ends, so the camera neither jumps off nor stops short; its top speed is 1.9 x its mean, halfway in */
const PUSH_EASE = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** the first look: farther out and higher than the home fit, settling into it once the city stands */
const SETTLE_OUT = 1.08;
const SETTLE_UP = 0.06;
const SETTLE_MS = 1400;
/** the establishing shot while the column rises (load's opening): wider and lower than home, aimed down the shaft, so the
    capital comes up through the haze with the cloud sea under the plate's place, and the landed city clear of the search
    bar (the downtown tower's top a fifth down the frame, the plate from a quarter to a half). The push into the home fit
    starts once the column has done most of its rise (0.7, about 240 ms in) and runs 1.6 s on a smooth S, so it takes the
    motion over as the plate slows and is home (within 1%) as the plate paints, before the downtown tower rises */
const RISE_LOOK = { down: 250, polar: 1.22, out: 1.35 };
const PUSH_AT = 0.7;
const PUSH_MS = 1600;
/** the opening's own word that its column is rising (load sets it on a first visit); without it the first look is the still one above */
const rising = () => OPENING.column.value < 1 && OPENING.rising;

interface Room {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/* where the camera stands to hold a shot's points in the room, looking from az and polar: its target, and its distance */
export function frameOf(points: Vector3[], az: number, polar: number, size: { width: number; height: number }, room: Room, fill = 0.94): { target: Vector3; d: number } {
  const dir = new Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
  const f = dir.clone().negate();
  const r = new Vector3().crossVectors(f, UP).normalize();
  const u = new Vector3().crossVectors(r, f).normalize();
  const k = size.height / 2 / Math.tan((FOV * Math.PI) / 360);
  const hw = (room.w / 2) * fill;
  const hh = (room.h / 2) * fill;
  const target = points.reduce((a, p) => a.add(p), new Vector3()).multiplyScalar(1 / Math.max(1, points.length));
  const cam = new Vector3();
  const v = new Vector3();
  let d = 1000;
  for (let pass = 0; pass < 4; pass++) {
    // the last pass measures only: the target it centred on is the one the distance is for
    const last = pass === 3;
    const fits = (dist: number) => {
      cam.copy(target).addScaledVector(dir, dist);
      for (const p of points) {
        v.subVectors(p, cam);
        const z = v.dot(f);
        if (z < 1) return false;
        if (Math.abs((v.dot(r) / z) * k) > hw || Math.abs((v.dot(u) / z) * k) > hh) return false;
      }
      return true;
    };
    let lo = 1;
    let hi = 60000;
    for (let i = 0; i < 42; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    d = hi;
    if (last) break;
    // centre the shot: move the target by the middle of what it holds on screen
    cam.copy(target).addScaledVector(dir, d);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      v.subVectors(p, cam);
      const z = v.dot(f);
      const x = (v.dot(r) / z) * k;
      const y = (v.dot(u) / z) * k;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    target.addScaledVector(r, (((x0 + x1) / 2) * d) / k).addScaledVector(u, (((y0 + y1) / 2) * d) / k);
  }
  return { target, d };
}

export function Rig({
  shot,
  home,
  inset,
  still,
  onDrag,
  onFlight,
  standsAt,
  cameraRef,
}: {
  shot: Shot;
  /** the whole city's shot, which sets how close the others may come */
  home: Shot;
  inset: Inset;
  still: boolean;
  onDrag: (dragging: boolean) => void;
  /** a flight is under way (true), or it landed or the reader took the camera (false): the app holds hover while it flies */
  onFlight?: (flying: boolean) => void;
  /** the city's clock time at which it stands (the schedule's liveAt): the first look settles into the home fit then */
  standsAt?: number;
  /** the app's handle on the reader's camera, for its Escape */
  cameraRef?: RefObject<CameraHandle | null>;
}) {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const room = useMemo<Room>(
    () => ({ x0: inset.left, y0: inset.top, w: Math.max(160, size.width - inset.left - inset.right), h: Math.max(160, size.height - inset.top - inset.bottom) }),
    [inset.left, inset.right, inset.top, inset.bottom, size.width, size.height],
  );
  // the reader's own view of the whole city, once they have turned it
  const mine = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  const shotWas = useRef<string | null>(null);
  const roomWas = useRef("");
  /* a flight under way, as the call that issues it again: camera-controls
     halts a transition at any pointerdown, so a click (a press that moves
     nothing) must not end it. The press's own move tells a click from a
     drag; touched marks the reader's input (a drag that moved, or the
     wheel, for which camera-controls reports no control) until the camera rests */
  const flight = useRef<(() => void) | null>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // the press that became a drag: the app heard onDrag(true) for it, so it hears onDrag(false) at its release (a plain click hears neither)
  const dragged = useRef(false);
  const touched = useRef(false);
  /* a flight under way, and who waits for it to land (the app arms the
     live pane then). The landing is read from the camera's own motion, in
     the frame loop: camera-controls' rest event waits out the damping's
     tail, a second and more after the eye sees the camera stop */
  const inFlight = useRef(false);
  const settlers = useRef<Array<{ since: number; done: () => void }>>([]);
  const pose = useRef({ pos: new Vector3(), target: new Vector3(), quietSince: 0, moving: false });
  const flightTimer = useRef<number | null>(null);
  const settle = () => {
    inFlight.current = false;
    // a landed flight has nothing left to resume
    flight.current = null;
    onFlight?.(false);
  };
  const takeOff = () => {
    pose.current.quietSince = performance.now();
    pose.current.moving = false;
    inFlight.current = true;
    onFlight?.(true);
    // a flight that never reports its landing (a paused loop, a lost rest) lands by the clock, so hover is never held for good
    if (flightTimer.current) window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(() => {
      if (inFlight.current) settle();
    }, 4500);
  };
  /* a glide: the camera's own tween between two poses on the brand's ease. It drives camera-controls pose by
     pose, so it lands exactly where it aimed and on time, and the reader's drag or wheel ends it */
  const glide = useRef<{ p0: Vector3; t0: Vector3; p1: Vector3; t1: Vector3; at: number; ms: number; ease: (x: number) => number } | null>(null);
  // the home pose the first look settles into once the city stands
  const settleTo = useRef<{ pos: Vector3; target: Vector3; onColumn: boolean } | null>(null);
  const glideTo = (pos: Vector3, target: Vector3, ms: number, curve: (x: number) => number = ease) => {
    const c = ref.current;
    if (!c) return;
    glide.current = { p0: c.getPosition(new Vector3(), false), t0: c.getTarget(new Vector3(), false), p1: pos.clone(), t1: target.clone(), at: performance.now(), ms, ease: curve };
    flight.current = null;
    takeOff();
  };

  // the room's centre is the lens's: the city stands in what the panels leave
  const offset = useRef<{ x: number; y: number } | null>(null);
  useFrame((_, dt) => {
    /* the camera's motion, read each frame (the current pose, not the
       transition's end that camera-controls hands out by default): a
       flight lands once the camera has moved and then stood for 120 ms (a
       flight to the pose it holds, after 400 ms), and those who wait for
       the landing hear it once the camera stands, but not before the
       flight they asked about could start */
    const c = ref.current;
    if (c) {
      // a glide under way: the pose for this frame, and its exact landing
      const g = glide.current;
      if (g) {
        const k = g.ease(Math.min(1, (performance.now() - g.at) / g.ms));
        // the target moves straight; the eye orbits it, its distance and angles eased, the short way round
        tmpTarget.lerpVectors(g.t0, g.t1, k);
        sphA.setFromVector3(tmpPos.subVectors(g.p0, g.t0));
        sphB.setFromVector3(tmpPos.subVectors(g.p1, g.t1));
        let dTheta = sphB.theta - sphA.theta;
        if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
        if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
        sphA.radius += (sphB.radius - sphA.radius) * k;
        sphA.phi += (sphB.phi - sphA.phi) * k;
        sphA.theta += dTheta * k;
        tmpPos.setFromSpherical(sphA).add(tmpTarget);
        void c.setLookAt(tmpPos.x, tmpPos.y, tmpPos.z, tmpTarget.x, tmpTarget.y, tmpTarget.z, false);
        invalidate();
        if (k >= 1) {
          glide.current = null;
          settle();
          for (const s of settlers.current.splice(0)) s.done();
        }
      }
      // the first look settles into the home fit once the city stands (or, through the column's rise, as the column nears its rest), unless the reader already has the camera or the app flew elsewhere
      if (settleTo.current && (settleTo.current.onColumn ? OPENING.column.value >= PUSH_AT : standsAt !== undefined && TIME.value >= standsAt)) {
        const s = settleTo.current;
        settleTo.current = null;
        if (!touched.current && shotWas.current === "home") glideTo(s.pos, s.target, s.onColumn ? PUSH_MS : SETTLE_MS, s.onColumn ? PUSH_EASE : ease);
      }
      const q = pose.current;
      const rate = (c.getPosition(tmpPos, false).distanceTo(q.pos) + c.getTarget(tmpTarget, false).distanceTo(q.target)) / Math.max(dt, 1 / 240);
      q.pos.copy(tmpPos);
      q.target.copy(tmpTarget);
      const now = performance.now();
      if (rate > 25) {
        q.moving = true;
        q.quietSince = now;
      }
      const quiet = now - q.quietSince > 120;
      if (inFlight.current && (q.moving ? quiet : now - q.quietSince > 400)) settle();
      // the reader's own view of the whole city, once their wheel or drag has settled (camera-controls' rest comes late, or not at all for the wheel)
      if (touched.current && quiet && !inFlight.current && shotWas.current === "home") {
        touched.current = false;
        mine.current = { pos: c.getPosition(new Vector3()), target: c.getTarget(new Vector3()) };
      }
      if (quiet && settlers.current.length) {
        const waiting = settlers.current;
        settlers.current = waiting.filter((s) => now - s.since < 200);
        for (const s of waiting) if (now - s.since >= 200) s.done();
      }
    }
    const want = { x: room.x0 + room.w / 2 - size.width / 2, y: room.y0 + room.h / 2 - size.height / 2 };
    const o = (offset.current ??= { ...want });
    const k = still ? 1 : 0.12;
    const nx = o.x + (want.x - o.x) * k;
    const ny = o.y + (want.y - o.y) * k;
    const moved = Math.abs(nx - o.x) > 0.01 || Math.abs(ny - o.y) > 0.01 || !camera.view || camera.view.fullWidth !== size.width || camera.view.fullHeight !== size.height;
    o.x = Math.abs(want.x - nx) < 0.05 ? want.x : nx;
    o.y = Math.abs(want.y - ny) < 0.05 ? want.y : ny;
    if (moved) {
      camera.setViewOffset(size.width, size.height, -o.x, -o.y, size.width, size.height);
      invalidate();
    }
  });

  /* a flight to a shot: from where the reader has turned the city, or straight from the map's view */
  const fly = (to: Shot, animate: boolean, straight = false, settleIn = false) => {
    const c = ref.current;
    if (!c) return;
    c.smoothTime = to.slow ? 0.62 : 0.42;
    const az = straight ? 0 : c.azimuthAngle;
    const polar = to.polar ?? Math.min(1.22, Math.max(0.75, c.polarAngle));
    const homeD = frameOf(home.points, az, HOME_POLAR, size, room, home.fill).d;
    const { target, d: fit } = frameOf(to.points, az, polar, size, room, to.fill);
    const d = Math.max(fit, homeD * to.cap);
    const dir = new Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    const pos = target.clone().addScaledVector(dir, d);
    if (settleIn) {
      // the first look stands farther out and higher than the fit, and settles into it once the city stands; through the
      // column's rise it stands long and low instead, aimed down the shaft, and settles as the column lands
      const onColumn = rising();
      const up = onColumn ? RISE_LOOK.polar : Math.max(0.2, polar - SETTLE_UP);
      const look = onColumn ? target.clone().setY(target.y - RISE_LOOK.down) : target;
      const from = look.clone().addScaledVector(new Vector3(Math.sin(up) * Math.sin(az), Math.cos(up), Math.sin(up) * Math.cos(az)), d * (onColumn ? RISE_LOOK.out : SETTLE_OUT));
      void c.setLookAt(from.x, from.y, from.z, look.x, look.y, look.z, false);
      settleTo.current = { pos, target, onColumn };
      invalidate();
      return;
    }
    // a flight is the camera's own glide on the brand's ease; a still reader's camera stands there at once
    if (animate) glideTo(pos, target, to.slow ? FLIGHT_SLOW_MS : FLIGHT_MS);
    else {
      void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
      flight.current = null;
    }
    invalidate();
  };
  // the app's Escape takes a moved camera home, to the map's own view
  const [moved, setMoved] = useState(false);
  useImperativeHandle(
    cameraRef,
    () => ({
      moved,
      home: () => {
        mine.current = null;
        setMoved(false);
        // during the opening, Escape cuts straight home: no push, no flight
        const cut = !!settleTo.current;
        settleTo.current = null;
        fly(home, !still && !cut, true);
      },
      settled: () => new Promise<void>((done) => settlers.current.push({ since: performance.now(), done })),
    }),
    // the flight reads the room and the shots fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moved, home, room, still],
  );

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const roomKey = `${room.w}|${room.h}`;
    const first = shotWas.current === null;
    const sameShot = shotWas.current === shot.key;
    if (sameShot && roomWas.current === roomKey) return;
    // a new room at home refits only while the reader has not framed the city their own way
    if (sameShot && shot.key === "home" && mine.current) {
      roomWas.current = roomKey;
      return;
    }
    // back home to the reader's own view, the camera still counts as moved: Escape may take it to the map's
    if (!sameShot) setMoved(shot.key === "home" && !!mine.current);
    shotWas.current = shot.key;
    roomWas.current = roomKey;
    // during the opening (its push still to come), a pick, a district, a search or a deep link cuts straight to its pose
    const cut = !first && !!settleTo.current;
    if (cut) settleTo.current = null;
    const animate = !first && !still && !cut;
    if (shot.key === "home" && mine.current) {
      c.smoothTime = 0.42;
      const { pos, target } = mine.current;
      if (animate) glideTo(pos, target, FLIGHT_MS);
      else void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
      invalidate();
    } else {
      // the first look settles into the home fit once the city stands; a return in this tab opens standing, at its shot, with no settle and no flight
      fly(shot, animate, first, first && shot.key === "home" && !still && !OPENING.returning);
    }
    // the room is read with the shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, room, still]);

  // the city stays on its plate: the target never leaves it. A shot may centre under the ground, which moves the city up the room
  const bounds = useMemo(() => new Box3(new Vector3(-PLATE, -160, -PLATE), new Vector3(PLATE, 260, PLATE)), []);
  useEffect(() => {
    ref.current?.setBoundary(bounds);
  }, [bounds]);

  /* the reader's input at the canvas: a press's move tells a click from a
     drag, and the wheel is a move of the camera in its own right */
  // in development only, the camera probes (scratchpad/qp/cam3d-*.mjs) read the controls and the renderer each frame
  const glDebug = useThree((s) => s.gl);
  const sceneDebug = useThree((s) => s.scene);
  const frameloopDebug = useThree((s) => s.frameloop);
  const eventsDebug = useThree((s) => s.events);
  const raycasterDebug = useThree((s) => s.raycaster);
  const internalDebug = useThree((s) => s.internal);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __city3d?: unknown }).__city3d = {
        controls: ref.current,
        gl: glDebug,
        scene: sceneDebug,
        frameloop: frameloopDebug,
        events: eventsDebug,
        raycaster: raycasterDebug,
        internal: internalDebug,
        opening: OPENING,
        size,
        still,
        // the rig's own state, read live
        state: () => ({ shot: shotWas.current, inFlight: inFlight.current, glide: !!glide.current, settleTo: !!settleTo.current, touched: touched.current, press: press.current, mine: !!mine.current, moved }),
      };
  });

  /* in development only, a watchdog for the pointer's reach. R3F tests only the objects in its interaction list that still
     carry their tag (__r3f, with handlers) and stand in the scene; one that lost either takes no hits, and hover over it dies.
     The towers' pick mesh also answers a ray from the camera to three of its own boxes each second; a miss is logged as it changes */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const seen = new Set<string>();
    const ray = new Raycaster();
    const at = new Vector3();
    const m = new Matrix4();
    let was = "";
    const id = window.setInterval(() => {
      for (const o of internalDebug.interaction) {
        const tag = (o as unknown as { __r3f?: { eventCount: number; root?: unknown } }).__r3f;
        const why = !tag ? "no __r3f" : !tag.eventCount ? "eventCount 0" : !tag.root ? "no root" : !o.parent ? "no parent" : null;
        if (why && !seen.has(o.uuid + why)) {
          seen.add(o.uuid + why);
          console.warn(`[city3d] pointer zombie: ${o.type} ${o.uuid.slice(0, 6)} ${why} (interaction ${internalDebug.interaction.length})`);
        }
      }
      let pick: InstancedMesh | null = null;
      sceneDebug.traverse((o) => {
        const im = o as InstancedMesh;
        if (im.isInstancedMesh && (im.material as Material).visible === false && (!pick || im.count > pick.count)) pick = im;
      });
      if (!pick) return;
      const pm = pick as InstancedMesh;
      let tested = 0;
      let misses = 0;
      for (let i = 0; i < pm.count && tested < 3; i++) {
        pm.getMatrixAt(i, m);
        // a folded box (the hub's) is not there to hit
        if (m.elements[5] < 1) continue;
        tested++;
        at.setFromMatrixPosition(m).applyMatrix4(pm.matrixWorld);
        at.y += m.elements[5] * 0.5;
        ray.set(camera.position, at.clone().sub(camera.position).normalize());
        if (ray.intersectObject(pm, false).length === 0) misses++;
      }
      const tag = !!(pm as unknown as { __r3f?: unknown }).__r3f;
      const line = `${pm.uuid.slice(0, 6)}:${pm.count}:${internalDebug.interaction.includes(pm)}:${tag}:${misses}/${tested}`;
      if (line !== was) {
        was = line;
        console.warn(`[city3d] pick self-test: mesh ${pm.uuid.slice(0, 6)} count ${pm.count} inInteraction ${internalDebug.interaction.includes(pm)} tag ${tag} misses ${misses} of ${tested} (sphere r ${pm.boundingSphere ? pm.boundingSphere.radius.toFixed(0) : "null"})`);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [internalDebug, sceneDebug, camera]);

  const dom = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      press.current = { x: e.clientX, y: e.clientY, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) {
        p.moved = true;
        // the reader is dragging: the app hears it now, not at the press, so a plain click costs it no render; a glide ends where it is, so the drag is not fought frame by frame
        dragged.current = true;
        onDrag(true);
        glide.current = null;
        settleTo.current = null;
      }
    };
    const onWheel = () => {
      touched.current = true;
      // the reader has the camera: a halted flight is not resumed, a glide ends where it is, the first look does not settle
      flight.current = null;
      glide.current = null;
      settleTo.current = null;
      setMoved(true);
      onFlight?.(false);
    };
    /* a drag ends on any release, wherever it lands: a pointerup or pointercancel anywhere (heard in the capture
       phase, before an overlay can stop it), a move with no button held (a release the page never heard), the
       window's blur or a hidden tab. camera-controls' own listener sits on the document in the bubble phase, so
       without this a swallowed release left the drag open, the cursor grabbing and the towers deaf, until the next drag */
    const end = () => {
      if (!press.current) return;
      ref.current?.cancel();
      press.current = null;
      if (dragged.current) {
        dragged.current = false;
        onDrag(false);
      }
    };
    const onMoveAnywhere = (e: PointerEvent) => {
      if (press.current && e.buttons === 0) end();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") end();
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("pointermove", onMoveAnywhere, true);
    window.addEventListener("blur", end);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("pointermove", onMoveAnywhere, true);
      window.removeEventListener("blur", end);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [dom, onFlight, onDrag]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      // the floor: no closer than a street's width from what it looks at, and never straight down on the roofs; every shot fits above it (the close-up lands near 800)
      minDistance={140}
      maxDistance={5200}
      minPolarAngle={0.2}
      maxPolarAngle={1.42}
      smoothTime={0.42}
      draggingSmoothTime={0.14}
      dollyToCursor
      dollySpeed={0.4}
      azimuthRotateSpeed={0.7}
      polarRotateSpeed={0.6}
      restThreshold={0.004}
      onControlStart={() => {
        // the app hears the drag once the press has moved (onMove), not here at the press
        const c = ref.current;
        if (c) c.smoothTime = 0.3;
      }}
      onControlEnd={() => {
        if (dragged.current) {
          dragged.current = false;
          onDrag(false);
        }
        const c = ref.current;
        // a press that moved nothing is a click: it does not move the camera, and a flight it halted goes on
        if (!press.current?.moved) {
          flight.current?.();
          return;
        }
        touched.current = true;
        // the reader took the camera: a halted flight is not resumed, a glide ends where it is, the first look does not settle
        flight.current = null;
        glide.current = null;
        settleTo.current = null;
        setMoved(true);
        onFlight?.(false);
        if (c && shotWas.current === "home") mine.current = { pos: c.getPosition(new Vector3()), target: c.getTarget(new Vector3()) };
      }}
      onRest={() => {
        /* a rest inside a flight is not its landing: a glide sets each pose with setLookAt(..., false), which leaves no
           transition, so camera-controls reports a rest one frame after its wake, at the glide's start. The glide's own end,
           the frame loop's motion read and the 4.5 s timer land the flight */
        if (glide.current || inFlight.current) return;
        flight.current = null;
        settle();
        // the wheel's move and a drag's damping settle here: the reader's own view of the whole city
        if (!touched.current) return;
        touched.current = false;
        const c = ref.current;
        if (c && shotWas.current === "home") mine.current = { pos: c.getPosition(new Vector3()), target: c.getTarget(new Vector3()) };
      }}
    />
  );
}
