"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { PLATE } from "@/components/explorer-v2/network/icm-map";
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
// scratch, for the frame loop's read of the camera
const tmpPos = new Vector3();
const tmpTarget = new Vector3();

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
  const fly = (to: Shot, animate: boolean, straight = false) => {
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
    void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, animate);
    flight.current = animate ? () => fly(to, true, straight) : null;
    if (animate) takeOff();
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
        fly(home, !still, true);
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
    const animate = !first && !still;
    if (shot.key === "home" && mine.current) {
      c.smoothTime = 0.42;
      const { pos, target } = mine.current;
      void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, animate);
      flight.current = animate ? () => void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true) : null;
      if (animate) takeOff();
      invalidate();
    } else fly(shot, animate, first);
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
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __city3d?: unknown }).__city3d = { controls: ref.current, gl: glDebug, scene: sceneDebug, frameloop: frameloopDebug, size, still };
  });

  const dom = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      press.current = { x: e.clientX, y: e.clientY, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) p.moved = true;
    };
    const onWheel = () => {
      touched.current = true;
      // the reader has the camera: a halted flight is not resumed
      flight.current = null;
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
  }, [dom, onFlight]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={70}
      maxDistance={5200}
      minPolarAngle={0.06}
      maxPolarAngle={1.42}
      smoothTime={0.42}
      draggingSmoothTime={0.14}
      dollyToCursor
      dollySpeed={0.4}
      azimuthRotateSpeed={0.7}
      polarRotateSpeed={0.6}
      restThreshold={0.004}
      onControlStart={() => {
        onDrag(true);
        const c = ref.current;
        if (c) c.smoothTime = 0.3;
      }}
      onControlEnd={() => {
        onDrag(false);
        const c = ref.current;
        // a press that moved nothing is a click: it does not move the camera, and a flight it halted goes on
        if (!press.current?.moved) {
          flight.current?.();
          return;
        }
        touched.current = true;
        // the reader took the camera: a halted flight is not resumed
        flight.current = null;
        setMoved(true);
        onFlight?.(false);
        if (c && shotWas.current === "home") mine.current = { pos: c.getPosition(new Vector3()), target: c.getTarget(new Vector3()) };
      }}
      onRest={() => {
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
