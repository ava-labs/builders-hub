"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  MathUtils,
  PlaneGeometry,
  type BufferGeometry,
  type Group,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import type { MotionValue } from "framer-motion";
import { CAPTION, MONO } from "../kit";
import { plateNameCap, usePlateName } from "./logos";
import { PALETTE, shadedBox, type SceneTheme } from "./palette";
import type { SceneProps } from "./SceneFrame";
import {
  GAP_OPEN,
  GAP_SHUT,
  LABEL_H,
  LABEL_PITCH,
  LIFT,
  PLATE,
  PLATE_T,
  PLATE_Y,
  SIDE,
  THICK,
  UP_Y,
  VIEW,
  frameFor,
} from "./stackLayout";

/* Your L1 as an exploded drawing: the layers a team sets, stacked over the
   P-Chain plate every L1 registers on. Once the box is on screen the layers
   drop in, bottom first; the stack then opens as the drawing scrolls up, so
   each layer reads on its own. The validator set is red at rest; the layer
   the reader points at lifts and takes the red, and the plate's name and
   edges take it when the reader points at the plate. A click on a layer, its
   label or the plate opens its docs. Once the drop has played, the scene
   draws only when something moves. The plate's rim carries its name. */

export interface StackLayer {
  key: string;
  label: string;
  line: string;
  /** the docs page the layer opens */
  href: string;
}

/** what the reader points at: a layer's index, the plate, or nothing */
export type StackPoint = number | "plate" | null;

export interface StackSceneProps {
  layers: StackLayer[];
  /** the lit layer's index, the plate, or null */
  active: StackPoint;
  /** 0 = assembled, 1 = fully open */
  spread: MotionValue<number>;
  /** the reader points at a layer or the plate in the drawing, or leaves it */
  onPoint?: (point: StackPoint) => void;
  /** a click on a layer, its label or the plate; newTab when a modifier key is down */
  onSelect?: (point: Exclude<StackPoint, null>, newTab: boolean) => void;
  /** false draws the stack alone, centered (the narrow still) */
  labels?: boolean;
  /** false holds the drop, so it plays as the drawing is revealed, not before */
  play?: boolean;
  /** true holds the rig unturned: a link over the drawing has the keyboard's focus, and its ring is drawn at rest */
  rest?: boolean;
  /** true once the canvas, not the still, is what the box shows */
  shown?: boolean;
  /** the mouse's last place in the window, kept by the page from its load, so the scene knows it even before it mounts */
  pointerAt?: RefObject<[number, number] | null>;
}

// the drop: each layer falls this far onto the one below, bottom first; low
// enough that an open stack never leaves the frame as it falls
const FALL = 1.4;
const DROP_S = 0.75;
const DROP_STAGGER_S = 0.12;
// the plate's grid stops one 0.4 cell in from its edge: the rim between holds the plate's name
const GRID = PLATE - 0.8;
const RIM = (PLATE - GRID) / 2;
// the name's capital height on screen, px, and at most this share of the rim,
// so the letters stay clear of the rim's hairline
const NAME_CAP_PX = 8;
const NAME_FILL = 0.75;
// the scene reports ready without the name after this long
const READY_WAIT_MS = 3000;

/** what the frame callbacks read; one object per scene, written in place */
interface Shared {
  /** the scene's own clock, s: it counts only while the box is on screen */
  time: number;
  running: boolean;
  /** the box is on screen, whether or not the clock runs */
  visible: boolean;
  /** the drop has played */
  landed: boolean;
  active: StackPoint;
  spread: MotionValue<number>;
  gap: number;
  rest: boolean;
  /** the pointer is over the canvas, where R3F tracks what it hovers */
  inside: boolean;
  /** the layer whose label the pointer is over */
  onLabel: number | null;
  /** the part a middle-button press began on: the release opens it only there */
  middle: StackPoint;
  /** look again, on the next frame, at what is under a pointer that has not moved */
  recheck: () => void;
}

interface Geometry {
  layer: BufferGeometry;
  edges: BufferGeometry;
  /** a plain layer box: the hover target */
  box: BufferGeometry;
  plate: BufferGeometry;
  plateEdges: BufferGeometry;
}

function useGeometry(theme: SceneTheme): Geometry {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(SIDE, THICK, SIDE);
    const plateBox = new BoxGeometry(PLATE, PLATE_T, PLATE);
    const plateEdges = new EdgesGeometry(plateBox);
    plateBox.dispose();
    return {
      layer: shadedBox(theme, SIDE, THICK, SIDE),
      edges: new EdgesGeometry(box),
      box,
      plate: shadedBox(theme, PLATE, PLATE_T, PLATE),
      plateEdges,
    };
  }, [theme]);
  // the GPU holds a geometry's buffers until it is disposed
  useEffect(() => () => Object.values(geometry).forEach((g: BufferGeometry) => g.dispose()), [geometry]);
  return geometry;
}

/** first in every frame: advance the scene's clock, and tell when the drop is over */
function Tick({ shared, end, onLanded }: { shared: Shared; end: number; onLanded: () => void }) {
  useFrame((_, dt) => {
    if (!shared.running || shared.landed) return;
    shared.time += Math.min(dt, 0.1);
    // the drop moves the layers under a pointer that has not moved; the last look comes after they land
    shared.recheck();
    if (shared.time >= end) {
      shared.landed = true;
      onLanded();
    }
  }, -2);
  return null;
}

/** call onReady once the first frame with the plate's name (`when`) is on the canvas */
function Ready({ when, onReady }: { when: boolean; onReady: () => void }) {
  const done = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  // a paused scene draws once more, so that frame is the one reported
  useEffect(() => {
    if (when) invalidate();
  }, [when, invalidate]);
  useFrame(() => {
    if (done.current || !when) return;
    done.current = true;
    // the frame is drawn after the callbacks; the next animation frame has it on screen
    requestAnimationFrame(() => onReady());
  });
  return null;
}

/**
 * On demand, ask for a frame when an input changes: none of these ask on
 * their own. And keep the hover true when the drawing moves under a pointer
 * that has not moved (a scroll, the stack opening, the rig turning): the
 * browser sends no pointer event then, and R3F raycasts only on one, so the
 * lit layer would not be the one a click opens.
 */
function Kick({
  shared,
  spread,
  active,
  running,
  rest,
  shown,
  pointerAt,
  point,
}: {
  shared: Shared;
  spread: MotionValue<number>;
  active: StackPoint;
  running: boolean;
  rest: boolean;
  shown: boolean;
  pointerAt?: RefObject<[number, number] | null>;
  point: (point: StackPoint) => void;
}) {
  const gl = useThree((s) => s.gl);
  const source = useThree((s) => s.events.connected as HTMLElement | undefined);
  const invalidate = useThree((s) => s.invalidate);
  const pointer = useThree((s) => s.pointer);
  useEffect(() => {
    const canvas = gl.domElement;
    if (!source) return;
    // the pointer turns the rig; R3F only records it
    const move = () => {
      shared.inside = true;
      invalidate();
    };
    // R3F keeps the last pointer when it leaves: center it, so the rig turns back to rest
    const leave = () => {
      shared.inside = false;
      pointer.set(0, 0);
      invalidate();
    };
    let queued = 0;
    const look = () => {
      queued = 0;
      const at = pointerAt?.current;
      // off screen nothing is pointed at; while a link has the keyboard's focus, the focus shows, not the pointer
      if (!at || !shared.visible || shared.rest) return;
      const [clientX, clientY] = at;
      const under = document.elementFromPoint(clientX, clientY);
      if (shared.onLabel !== null && !under?.closest(`[data-stack-label="${shared.onLabel}"]`)) {
        shared.onLabel = null;
        point(null);
      }
      // a move where the pointer is now makes R3F raycast again; off the canvas, a leave drops its hover
      if (under === canvas) canvas.dispatchEvent(new PointerEvent("pointermove", { clientX, clientY, bubbles: true }));
      else if (shared.inside) source.dispatchEvent(new PointerEvent("pointerleave", { clientX, clientY }));
    };
    shared.recheck = () => {
      if (!queued) queued = requestAnimationFrame(look);
    };
    const recheck = () => shared.recheck();
    window.addEventListener("scroll", recheck, { passive: true });
    source.addEventListener("pointermove", move);
    source.addEventListener("pointerleave", leave);
    const off = spread.on("change", () => {
      invalidate();
      recheck();
    });
    return () => {
      window.removeEventListener("scroll", recheck);
      source.removeEventListener("pointermove", move);
      source.removeEventListener("pointerleave", leave);
      off();
      cancelAnimationFrame(queued);
      shared.recheck = () => {};
    };
  }, [gl, source, invalidate, spread, pointer, shared, point, pointerAt]);
  useEffect(() => invalidate(), [active, running, rest, invalidate]);
  // the canvas takes over from the still, or a link gives the focus back: look at what the pointer is on
  useEffect(() => {
    if (shown && !rest) shared.recheck();
  }, [shown, rest, shared]);
  return null;
}

/** a click opens a new tab with a modifier key down, as a link does */
const newTab = (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => e.metaKey || e.ctrlKey || e.shiftKey;

/** the pointer cursor while the reader points at something that opens */
function usePointCursor(onPoint?: (point: StackPoint) => void) {
  const gl = useThree((s) => s.gl);
  return useCallback(
    (point: StackPoint) => {
      gl.domElement.style.cursor = point === null ? "" : "pointer";
      onPoint?.(point);
    },
    [gl, onPoint],
  );
}

function Layer({
  index,
  layer,
  shared,
  geometry,
  theme,
  onPoint,
  onSelect,
  labels,
}: {
  index: number;
  layer: StackLayer;
  shared: Shared;
  geometry: Geometry;
  theme: SceneTheme;
  onPoint: (point: StackPoint) => void;
  onSelect?: StackSceneProps["onSelect"];
  labels: RefObject<HTMLDivElement | null> | null;
}) {
  const rest = useRef<Group>(null);
  const hit = useRef<Mesh>(null);
  const gl = useThree((s) => s.gl);
  const pointer = useThree((s) => s.pointer);
  const invalidate = useThree((s) => s.invalidate);
  const lift = useRef<Group>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const line = useRef<LineBasicMaterial>(null);
  const tag = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const rule = useRef<HTMLSpanElement>(null);
  const palette = PALETTE[theme];
  const tones = useMemo(
    () => ({
      face: new Color(palette.face),
      red: new Color(palette.red),
      edge: new Color(palette.edge),
      redEdge: new Color(palette.redEdge),
    }),
    [palette],
  );
  // the first frame already shows the rest pose's red
  const lit = useRef(shared.active === index ? 1 : 0);

  // before drei's Html reads the positions (priority 0), so a label never trails its layer by a frame
  useFrame((state, dt) => {
    const outer = rest.current;
    const inner = lift.current;
    if (!outer || !inner) return;
    const intro = MathUtils.clamp((shared.time - index * DROP_STAGGER_S) / DROP_S, 0, 1);
    const spread = shared.spread.get();
    const gap = MathUtils.lerp(GAP_SHUT, shared.gap, spread);
    const to = shared.active === index ? 1 : 0;
    // after an idle spell the first dt is the whole spell: clamp it, so the ease starts gently
    lit.current = MathUtils.damp(lit.current, to, 10, Math.min(dt, 1 / 30));
    if (Math.abs(lit.current - to) < 0.001) lit.current = to;
    else state.invalidate();
    outer.position.y = index * (THICK + gap) + (1 - intro) ** 3 * FALL;
    // the lift grows with the spread, so a shut stack never intersects
    inner.position.y = lit.current * LIFT * spread;
    // the hover target spans the rest place and the lift above it, so a lift
    // never moves the layer out from under the pointer and its lifted top still opens it
    if (hit.current) {
      hit.current.scale.y = 1 + (LIFT * spread) / THICK;
      hit.current.position.y = (LIFT * spread) / 2;
    }
    mat.current?.color.copy(tones.face).lerp(tones.red, lit.current);
    line.current?.color.copy(tones.edge).lerp(tones.redEdge, lit.current);
    if (tag.current && text.current) {
      // a label shows once its layer has landed and the stack is open enough to hold it
      const pitch = (THICK + gap) * UP_Y * state.camera.zoom;
      const show = MathUtils.smoothstep(pitch, LABEL_H, LABEL_PITCH) * MathUtils.smoothstep(intro, 0.6, 1);
      tag.current.style.opacity = show.toFixed(3);
      // a label that is not there takes no clicks
      text.current.style.pointerEvents = show > 0.5 ? "auto" : "none";
    }
    // the leader's red comes and goes with its layer's
    if (rule.current) rule.current.style.opacity = lit.current.toFixed(3);
  }, -1);

  return (
    <group ref={rest}>
      {/* the hover target holds the layer's rest place: a lift never moves it out from under the pointer */}
      <mesh
        ref={hit}
        geometry={geometry.box}
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPoint(index);
        }}
        // a pointer that moved onto a label keeps the label's light
        onPointerOut={() => {
          if (shared.onLabel === null) onPoint(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          // a drag is not a click (R3F's own threshold)
          if (e.delta <= 2) onSelect?.(index, newTab(e.nativeEvent));
        }}
        // the middle button opens a new tab, as on a link: press and release on the same part
        onPointerDown={(e) => {
          if (e.nativeEvent.button !== 1) return;
          e.stopPropagation();
          shared.middle = index;
        }}
        onPointerUp={(e) => {
          if (e.nativeEvent.button !== 1) return;
          e.stopPropagation();
          if (shared.middle === index) onSelect?.(index, true);
          shared.middle = null;
        }}
      />
      <group ref={lift}>
        <mesh geometry={geometry.layer}>
          <meshBasicMaterial
            ref={mat}
            vertexColors
            color={palette.face}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
        <lineSegments geometry={geometry.edges}>
          <lineBasicMaterial ref={line} color={palette.edge} />
        </lineSegments>
      </group>
      {/* the label is a sibling of the lift: it holds its place, so labels never touch.
          It sits in the label layer, outside R3F's event source, so its pointer events
          never reach the raycaster. Its text opens the layer's docs for the pointer; the
          links over the drawing (StackLinks) serve the keyboard and screen readers */}
      {labels && (
        <Html
          portal={labels as RefObject<HTMLElement>}
          position={[SIDE / 2, 0, -SIDE / 2]}
          style={{ pointerEvents: "none" }}
          zIndexRange={[10, 0]}
        >
          <div ref={tag} className="flex -translate-y-1/2 items-center gap-3 pl-3" style={{ opacity: 0 }}>
            <span className="relative h-px w-12 shrink-0 bg-zinc-300 dark:bg-zinc-700">
              <span ref={rule} className="absolute inset-0" style={{ backgroundColor: palette.red, opacity: 0 }} />
            </span>
            <span
              ref={text}
              data-stack-label={index}
              className="flex w-56 cursor-pointer flex-col gap-0.5"
              style={{ pointerEvents: "none" }}
              onPointerEnter={() => {
                shared.onLabel = index;
                onPoint(index);
              }}
              onPointerLeave={(e) => {
                shared.onLabel = null;
                onPoint(null);
                // straight off the drawing, the rig turns back to rest; onto the canvas, R3F's next move sets it
                if (e.relatedTarget !== gl.domElement) {
                  pointer.set(0, 0);
                  invalidate();
                }
              }}
              onPointerMove={(e) => {
                // the rig turns after the pointer over a label too
                const box = gl.domElement.getBoundingClientRect();
                pointer.set(((e.clientX - box.left) / box.width) * 2 - 1, 1 - ((e.clientY - box.top) / box.height) * 2);
                invalidate();
              }}
              onClick={(e) => onSelect?.(index, newTab(e))}
              onAuxClick={(e) => {
                if (e.button === 1) onSelect?.(index, true);
              }}
            >
              <span className={`${MONO} text-zinc-900 dark:text-zinc-100`}>{layer.label}</span>
              <span className={CAPTION}>{layer.line}</span>
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Plate({
  geometry,
  theme,
  name,
  shared,
  onPoint,
  onSelect,
}: {
  geometry: Geometry;
  theme: SceneTheme;
  name: ReturnType<typeof usePlateName>;
  shared: Shared;
  onPoint: (point: StackPoint) => void;
  onSelect?: StackSceneProps["onSelect"];
}) {
  const palette = PALETTE[theme];
  const edge = useRef<LineBasicMaterial>(null);
  const ink = useRef<MeshBasicMaterial>(null);
  const tones = useMemo(
    () => ({
      edge: new Color(palette.edge),
      redEdge: new Color(palette.redEdge),
      ink: new Color(palette.plateInk),
      red: new Color(palette.red),
    }),
    [palette],
  );
  const lit = useRef(shared.active === "plate" ? 1 : 0);
  useFrame((state, dt) => {
    const to = shared.active === "plate" ? 1 : 0;
    lit.current = MathUtils.damp(lit.current, to, 10, Math.min(dt, 1 / 30));
    if (Math.abs(lit.current - to) < 0.001) lit.current = to;
    else state.invalidate();
    edge.current?.color.copy(tones.edge).lerp(tones.redEdge, lit.current);
    ink.current?.color.copy(tones.ink).lerp(tones.red, lit.current);
  }, -1);
  return (
    <group position={[0, PLATE_Y, 0]}>
      <mesh
        geometry={geometry.plate}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPoint("plate");
        }}
        onPointerOut={() => {
          if (shared.onLabel === null) onPoint(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta <= 2) onSelect?.("plate", newTab(e.nativeEvent));
        }}
        onPointerDown={(e) => {
          if (e.nativeEvent.button !== 1) return;
          e.stopPropagation();
          shared.middle = "plate";
        }}
        onPointerUp={(e) => {
          if (e.nativeEvent.button !== 1) return;
          e.stopPropagation();
          if (shared.middle === "plate") onSelect?.("plate", true);
          shared.middle = null;
        }}
      >
        <meshBasicMaterial
          vertexColors
          color={palette.plate}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={geometry.plateEdges}>
        <lineBasicMaterial ref={edge} color={palette.edge} />
      </lineSegments>
      {/* inset one 0.4 cell: a grid line on the plate's edge would fight its hairline and stipple it */}
      <gridHelper args={[GRID, 10, palette.grid, palette.grid]} position={[0, PLATE_T / 2 + 0.001, 0]} />
      {name && <PlateName name={name} theme={theme} ink={ink} />}
    </group>
  );
}

/** the plate's name, painted on its rim along the front-left edge (z = +PLATE / 2), reading toward the front corner */
function PlateName({
  name,
  theme,
  ink,
}: {
  name: NonNullable<ReturnType<typeof usePlateName>>;
  theme: SceneTheme;
  ink: RefObject<MeshBasicMaterial | null>;
}) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(name.aspect, 1);
    // flat on the plate, face up, the letters' up into the plate (-z)
    g.rotateX(-Math.PI / 2);
    return g;
  }, [name]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // the same size on screen at every zoom, inside the rim
  useFrame(({ camera }) => {
    mesh.current?.scale.setScalar(plateNameCap(camera, NAME_CAP_PX, RIM * NAME_FILL) / name.cap);
  });
  // on the edge's middle, as in the network drawing
  return (
    <mesh ref={mesh} geometry={geometry} position={[0, PLATE_T / 2 + 0.002, GRID / 2 + RIM / 2]}>
      <meshBasicMaterial ref={ink} color={PALETTE[theme].plateInk} alphaMap={name.texture} transparent depthWrite={false} />
    </mesh>
  );
}

function Rig({
  count,
  labels,
  shared,
  children,
}: {
  count: number;
  labels: boolean;
  shared: Shared;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  // the label column is fixed px and the drawing is in units, so the framing is worked out per size
  useLayoutEffect(() => {
    const { zoom, gap, target } = frameFor(size.width, size.height, count, labels);
    shared.gap = gap;
    camera.position.set(target[0] + VIEW[0], target[1] + VIEW[1], target[2] + VIEW[2]);
    camera.lookAt(...target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    invalidate();
  }, [size, camera, count, labels, shared, invalidate]);
  // a small turn after the pointer, before drei's Html reads the positions;
  // none while a link over the drawing has the keyboard's focus
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const to = shared.rest ? 0 : state.pointer.x * 0.1;
    g.rotation.y = MathUtils.damp(g.rotation.y, to, 3, Math.min(dt, 1 / 30));
    if (Math.abs(g.rotation.y - to) > 0.0005) {
      state.invalidate();
      // the drawing turns under the pointer: what it points at can change
      if (shared.inside) shared.recheck();
    }
  }, -1);
  return <group ref={group}>{children}</group>;
}

function Stack({
  layers,
  active,
  spread,
  onPoint,
  onSelect,
  labels,
  labelLayer,
  rest,
  shown,
  pointerAt,
  visible,
  theme,
  running,
  onReady,
  onLanded,
}: Required<Omit<StackSceneProps, "onPoint" | "onSelect" | "play" | "pointerAt">> &
  Pick<StackSceneProps, "onPoint" | "onSelect" | "pointerAt"> &
  SceneProps & { labelLayer: RefObject<HTMLDivElement | null>; visible: boolean; onLanded: () => void }) {
  const [shared] = useState<Shared>(() => ({
    time: 0,
    running,
    visible,
    landed: false,
    active,
    spread,
    gap: GAP_OPEN,
    rest,
    inside: false,
    onLabel: null,
    middle: null,
    recheck: () => {},
  }));
  // the frame callbacks read the newest props from here
  shared.running = running;
  shared.visible = visible;
  shared.active = active;
  shared.spread = spread;
  shared.rest = rest;
  const geometry = useGeometry(theme);
  const point = usePointCursor(onPoint);
  const end = (layers.length - 1) * DROP_STAGGER_S + DROP_S;
  const name = usePlateName();
  // a face that never loads must not hold the scene back
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), READY_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      <Tick shared={shared} end={end} onLanded={onLanded} />
      <Kick
        shared={shared}
        spread={spread}
        active={active}
        running={running}
        rest={rest}
        shown={shown}
        pointerAt={pointerAt}
        point={point}
      />
      <Ready when={name !== null || late} onReady={onReady} />
      <Rig count={layers.length} labels={labels} shared={shared}>
        <Plate geometry={geometry} theme={theme} name={name} shared={shared} onPoint={point} onSelect={onSelect} />
        {layers.map((layer, i) => (
          <Layer
            key={layer.key}
            index={i}
            layer={layer}
            shared={shared}
            geometry={geometry}
            theme={theme}
            onPoint={point}
            onSelect={onSelect}
            labels={labels ? labelLayer : null}
          />
        ))}
      </Rig>
    </>
  );
}

export default function StackScene({
  labels = true,
  play = true,
  rest = false,
  shown = false,
  running,
  onReady,
  ...props
}: StackSceneProps & SceneProps) {
  // the loop runs every frame only while the drop plays on screen; otherwise
  // the scene draws on demand (off screen too, so its first frame is ready)
  const [landed, setLanded] = useState(false);
  const onLanded = useCallback(() => setLanded(true), []);
  // a canvas that is ready with its box on screen (a reload, a fast scroll)
  // stays hidden behind the still until its intro is over (SceneFrame). The
  // drop plays then, unseen, so the canvas fades in on the still's pose
  const [unseen, setUnseen] = useState(false);
  const onScreen = useRef(running);
  useEffect(() => {
    onScreen.current = running;
  }, [running]);
  const ready = useCallback(() => {
    if (onScreen.current) setUnseen(true);
    onReady();
  }, [onReady]);
  const on = running && (play || unseen);
  const labelLayer = useRef<HTMLDivElement>(null);
  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        flat
        camera={{ zoom: 60, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        frameloop={on && !landed ? "always" : "demand"}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <Stack
          {...props}
          labels={labels}
          labelLayer={labelLayer}
          rest={rest}
          shown={shown}
          visible={running}
          running={on}
          onReady={ready}
          onLanded={onLanded}
        />
      </Canvas>
      {/* the labels' layer: over the canvas, but outside R3F's event source, so a
          pointer on a label never reaches the raycaster with the label's offsets */}
      <div ref={labelLayer} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
