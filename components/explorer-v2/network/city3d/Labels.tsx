"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, InstancedBufferAttribute, InstancedMesh, Matrix4, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Sphere, Vector3, type Color, type Intersection, type Raycaster, type ShaderMaterial } from "three";
import { logoAt, type Inset } from "@/components/explorer-v2/network/icm-map";
import type { Building, CityModel } from "./model";
import type { Theme } from "./palette";
import { badgeMaterial, PLAQUE_MAX_PX, TIME } from "./shaders";
import { WARM } from "./warmup";

/* The words and marks over the model: each district's name round the
   city's edge, which opens the district; in a district, every set's name
   over its roof; each chain's logo as a plaque on its roof, facing the
   camera; and the tooltip's anchor, which follows its building across the
   screen. The names are the page's own text, over the canvas; the logos
   are one atlas, drawn in the scene, so a nearer tower hides them. */

/** a building's roof plaque: its size in world units (0 when it has none), and the height over the crest it stands at */
export const plaqueOf = (b: Building) => (b.n.role === "hub" || !b.n.logo ? 0 : b.n.role === "talker" ? 15 : 12);
export const PLAQUE_LIFT = 0.4;
/** where a set's plaque stands (and the words that stand on it): its plan's anchor (a stadium's roof ring), else its massing's top over its ground point */
export const plaqueAt = (b: Building) => (b.anchor ? new Vector3(b.anchor[0], b.anchor[1] + PLAQUE_LIFT, b.anchor[2]) : new Vector3(b.x, b.base + b.crest + PLAQUE_LIFT, b.z));

/** the halo the map's words wear, so they read over the roofs */
export const HALO = "[text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_7px_#fff] dark:[text-shadow:0_0_3px_#09090b,0_0_3px_#09090b,0_0_8px_#09090b]";

/** a word placed over the scene: its point, and the lifts it may take, in pixels, to stand clear of the words placed before it */
export interface Tag {
  key: string;
  at: Vector3;
  lifts: number[];
  /** it fades out, so it holds no place */
  ghost?: boolean;
  /** it stands out from the city's middle, as the map's district names do round its edge */
  out?: boolean;
  /** it hangs under its point */
  below?: boolean;
  /** it shows from this time on the city's clock: its building has risen */
  from?: number;
  /** it fades out while the camera flies, and in once it lands */
  fade?: boolean;
  /** the building it names, whose veil it wears */
  b?: number;
  /** standing out, it goes only over or under its point, never beside it */
  vertical?: boolean;
  /** it carries a rule of its lift's height to its point (the element's own, out of its flow: its words are measured without it) */
  rule?: boolean;
  /** a plaque of this size stands on its point: the word stands on the plaque's top */
  clear?: number;
  /** it flies beside its rule as a flag does, its near edge on the rule, out from the city's middle */
  flag?: boolean;
  /** it keeps clear of the kept parts and inside the frame's room, clear of the app's bars and panels */
  avoid?: boolean;
}

/** a part of the scene no word may cover: a box in the world, or a roof plaque of a size on its point; its owner's word may stand on it */
export type Keep = { owner: string; min: Vector3; max: Vector3 } | { owner: string; at: Vector3; plaque: number };

/** each building's veil, 1 where it stands whole and less where it stands in front of the picked one; `version` moves when it changes */
export interface VeilState {
  b: Float32Array;
  version: number;
}

type Box = [number, number, number, number];
/** a flag's side: over its point, out to the right or the left of its rule; or level with its plaque, beside it */
type FlagSide = "right" | "left" | "beside-right" | "beside-left";
/** where a word stands: its flag's side (none for a plain word), and its lift, or a flag's level leader's length beside its plaque */
type Spot = { f: FlagSide | null; l: number };
/** a flag's level leaders beside its plaque, when no lift over it fits */
const BESIDE = [10, 22];

/** a roof plaque on screen, as the badge shader stands it: its world size (capped to PLAQUE_MAX_PX), lifted by half of it and drawn half of it toward the eye;
    writes its top's middle and its radius, in pixels, into `out` ([x, y, r]), or returns false when it is behind the camera */
function plaqueOnScreen(at: Vector3, plaque: number, camera: PerspectiveCamera, focal: number, w: number, h: number, tmp: Vector3, out: number[]): boolean {
  tmp.copy(at).applyMatrix4(camera.matrixWorldInverse);
  if (tmp.z > -1) return false;
  const size = Math.min(plaque, (PLAQUE_MAX_PX * -tmp.z) / focal);
  tmp.y += size;
  tmp.z += size * 0.5;
  const r = (0.5 * size * focal) / Math.max(1, -tmp.z);
  tmp.applyMatrix4(camera.projectionMatrix);
  out[0] = (tmp.x * 0.5 + 0.5) * w;
  out[1] = (-tmp.y * 0.5 + 0.5) * h;
  out[2] = r;
  return true;
}

/** where a word stands: the side of its point, and its spot there */
type Side = "up" | "down" | "left" | "right";
type Place = { side: Side; spot: Spot };
const samePlace = (a: Place | null, b: Place | null) => a === b || (!!a && !!b && a.side === b.side && a.spot.f === b.spot.f && a.spot.l === b.spot.l);
/** how long the camera stands after a gesture before a word may move, and how long a word takes to fade out or in when it must, in seconds */
const HOLD_S = 0.3;
const FADE_S = 0.15;
/** how far past the city's middle a word's point must go before the word crosses to the point's other side, in pixels */
const FLIP_PX = 16;
/** the least clear room between two words, in pixels, so no two names ever touch */
const GAP = 2;

/** places the scene's words each frame: each beside its point, lifted clear of
    those placed before it, or out of sight. A word holds its place (its side of
    its point and its lift) through a whole gesture: while the reader presses on
    the city, and until the camera has stood HOLD_S after it, so no word jumps in
    a drag, a zoom or a flight. At rest it takes the place it fits best; a word
    that must move fades out where it stands and in where it goes, in the brand's
    motion, and a word changes sides only once its point is clearly past the turn.
    A word that fades goes out while the camera flies. A flag (a data tag) flies
    beside its rule, out from the city's middle, else on its other side, else
    level beside its plaque; a word that avoids keeps clear of the kept parts (the
    landmark, the plaques large enough to read, the app's cards) and inside the
    frame's room */
export function TagLayout({
  tags,
  els,
  flying,
  veil,
  keep = [],
  inset,
  hud,
}: {
  tags: Tag[];
  els: RefObject<Map<string, HTMLElement>>;
  /** the camera's flight, read each frame: a ref, so a flight's start and landing render nothing */
  flying?: { current: boolean };
  veil?: VeilState;
  keep?: Keep[];
  inset?: Inset;
  /** the app's cards over the canvas that the inset does not hold, in the canvas's pixels */
  hud?: RefObject<[number, number, number, number][]>;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const clock = useThree((s) => s.clock);
  const v = useMemo(() => new Vector3(), []);
  const depth = useMemo(() => new Vector3(), []);
  const onScreen = useMemo(() => [0, 0, 0], []);
  const sizes = useRef(new WeakMap<HTMLElement, [number, number]>());
  // a face that comes in late changes the words' widths: they are measured again
  useEffect(() => {
    const fresh = () => (sizes.current = new WeakMap());
    document.fonts.addEventListener("loadingdone", fresh);
    return () => document.fonts.removeEventListener("loadingdone", fresh);
  }, []);
  const mid = useMemo(() => new Vector3(), []);
  // each word's place on screen (null while none fits), how much of it shows as it fades between places, and when it first showed
  const held = useRef(new Map<string, Place | null>());
  // the words that have painted once while the canvas was unseen (so the browser's own pipelines for them stood ready)
  const primed = useRef(new WeakSet<HTMLElement>());
  const shows = useRef(new Map<string, number>());
  const born = useRef(new Map<string, number>());
  // the gesture: whether the reader presses on the city, and the last moment the camera moved or a press began or ended
  const down = useRef(false);
  const active = useRef(-Infinity);
  useEffect(() => {
    const el = gl.domElement;
    const press = () => {
      down.current = true;
      active.current = clock.elapsedTime;
    };
    const release = () => {
      if (!down.current) return;
      down.current = false;
      active.current = clock.elapsedTime;
    };
    el.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", release);
    return () => {
      el.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", release);
    };
  }, [gl, clock]);
  // the camera as it stood last frame
  const last = useRef<Float32Array | null>(null);
  useFrame((state, dt) => {
    const m = camera.matrixWorld.elements;
    const pm = camera.projectionMatrix.elements;
    let moved = !last.current;
    const was = (last.current ??= new Float32Array(32));
    for (let i = 0; i < 16; i++) {
      if (Math.abs(was[i] - m[i]) > 1e-4 || Math.abs(was[16 + i] - pm[i]) > 1e-6) moved = true;
      was[i] = m[i];
      was[16 + i] = pm[i];
    }
    const now = state.clock.elapsedTime;
    if (moved) active.current = now;
    const gesture = down.current || now - active.current < HOLD_S;
    // a fade's step this frame, in the brand's motion: fast at first, then settling
    const k = 1 - Math.pow(2, (-10 * Math.min(dt, 0.1)) / FADE_S);
    const placed: Box[] = [];
    mid.set(0, 0, 0).project(camera);
    const cx = (mid.x * 0.5 + 0.5) * size.width;
    const cy = (-mid.y * 0.5 + 0.5) * size.height;
    // the lens's pixels per unit at a unit's depth, as the plaques' shader reads it
    const focal = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    // the kept parts on screen: each box's corners' bounds, while the whole box is in front of the camera
    const kept: { owner: string; box: Box }[] = [];
    for (const k of keep) {
      if ("plaque" in k) {
        // a plaque on screen, a disc from its top down; one too small to read (the whole city's view) may sit under a word's halo
        if (!plaqueOnScreen(k.at, k.plaque, camera, focal, size.width, size.height, depth, onScreen)) continue;
        const [px, top, r] = onScreen;
        if (r < 9) continue;
        kept.push({ owner: k.owner, box: [px - r - 2, top - 2, px + r + 2, top + 2 * r + 1] });
        continue;
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      let front = true;
      for (let c = 0; c < 8; c++) {
        v.set(c & 1 ? k.max.x : k.min.x, c & 2 ? k.max.y : k.min.y, c & 4 ? k.max.z : k.min.z).project(camera);
        if (v.z > 1) front = false;
        const px = (v.x * 0.5 + 0.5) * size.width;
        const py = (-v.y * 0.5 + 0.5) * size.height;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      if (front) kept.push({ owner: k.owner, box: [x0, y0, x1, y1] });
    }
    for (const box of hud?.current ?? []) kept.push({ owner: "", box });
    // whether two boxes meet, or come within g pixels of each other
    const meets = (a: Box, b: Box, g = 0) => a[0] < b[2] + g && a[2] > b[0] - g && a[1] < b[3] + g && a[3] > b[1] - g;
    // the frame's room, inside the app's bars and panels; the top inset holds a margin under the search's chips, which a word may use
    const room = inset ? [inset.left, inset.top - 16, size.width - inset.right, size.height - inset.bottom] : [0, 0, size.width, size.height];
    const inRoom = (a: Box) => a[0] >= room[0] && a[1] >= room[1] && a[2] <= room[2] && a[3] <= room[3];
    for (const t of tags) {
      const el = els.current?.get(t.key);
      if (!el) continue;
      if (!born.current.has(t.key)) born.current.set(t.key, now);
      v.copy(t.at).project(camera);
      /* on a cold cache a word's first paint compiles the browser's own pipelines for it (its halo, its filter), and held a
         frame at the clock's start: while the canvas is unseen (it stands at 1%), each word paints once as it first shows, on
         the screen, and then waits hidden for its time. It keeps no place, so it still comes in fresh */
      if (WARM.unseen && !primed.current.has(el)) {
        primed.current.add(el);
        const px = Math.min(Math.max(0, (v.x * 0.5 + 0.5) * size.width), size.width - 80);
        const py = Math.min(Math.max(0, (-v.y * 0.5 + 0.5) * size.height), size.height - 24);
        el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
        el.style.visibility = "visible";
        el.style.opacity = "1";
        el.style.filter = "opacity(0.5)";
        continue;
      }
      /* a word waits until the city's clock runs (the warm-up releases it once the plate has painted in: WARM.held starts true and
         stays so until then), so none stands over the sea or the blank plate; one with a `from` waits for that too */
      const due = !WARM.held && (t.from === undefined || TIME.value >= t.from);
      if (v.z > 1 || !due) {
        el.style.visibility = "hidden";
        continue;
      }
      let x = (v.x * 0.5 + 0.5) * size.width;
      let y = (-v.y * 0.5 + 0.5) * size.height;
      // over a plaque, from its top's middle, as the shader stands it; r is its radius on screen
      let r = 0;
      if (t.clear && plaqueOnScreen(t.at, t.clear, camera, focal, size.width, size.height, depth, onScreen)) [x, y, r] = onScreen;
      // its words' size: the element's first child, so a rule of any height is not counted
      let wh = sizes.current.get(el);
      if (!wh || !wh[0]) {
        const words = (el.firstElementChild as HTMLElement | null) ?? el;
        sizes.current.set(el, (wh = [words.offsetWidth, words.offsetHeight]));
      }
      const [w, h] = wh;
      const dx = x - cx;
      const dy = y - cy;
      const shown = held.current.get(t.key);
      // the side of its point it stands on: over it, under it, or out to the left or the right of the city; it keeps its side until its point is clearly past the turn
      const sideOf = (prev: Side | undefined): Side => {
        if (t.below) return "down";
        if (!t.out) return "up";
        const wasVert = prev === "up" || prev === "down";
        const wasFlat = prev === "left" || prev === "right";
        if (t.vertical || Math.abs(dy) > Math.abs(dx) * (wasVert ? 0.35 : wasFlat ? 0.55 : 0.45)) {
          if (wasVert && Math.abs(dy) < FLIP_PX) return prev as Side;
          return dy > 0 ? "down" : "up";
        }
        if (wasFlat && Math.abs(dx) < FLIP_PX) return prev as Side;
        return dx > 0 ? "right" : "left";
      };
      // a flag flies out from the city's middle, else on its other side, else level beside its plaque
      const outward: "right" | "left" = dx >= 0 ? "right" : "left";
      const inward: "right" | "left" = outward === "right" ? "left" : "right";
      const mid = y + r;
      const boxOf = ({ side, spot: { f, l } }: Place): Box => {
        if (f === "right") return [x, y - l - h, x + w, y - l];
        if (f === "left") return [x - w, y - l - h, x, y - l];
        if (f === "beside-right") return [x + r + l, mid - h / 2, x + r + l + w, mid + h / 2];
        if (f === "beside-left") return [x - r - l - w, mid - h / 2, x - r - l, mid + h / 2];
        return side === "up"
          ? [x - w / 2, y - l - h, x + w / 2, y - l]
          : side === "down"
            ? [x - w / 2, y + l, x + w / 2, y + l + h]
            : side === "right"
              ? [x + l, y - h / 2, x + l + w, y + h / 2]
              : [x - l - w, y - h / 2, x - l, y + h / 2];
      };
      // what it covers there: its words' box, and a flag's leader to its point, as a thin box of its own
      const hitsOf = (p: Place): Box[] => {
        const box = boxOf(p);
        const { f, l } = p.spot;
        if (f === "right" || f === "left") return [box, [x - 2, box[3], x + 2, y - 1]];
        if (f === "beside-right") return [box, [x + r, mid - 2, x + r + l, mid + 2]];
        if (f === "beside-left") return [box, [x - r - l, mid - 2, x - r, mid + 2]];
        return [box];
      };
      const fits = (p: Place) =>
        !!t.ghost || hitsOf(p).every((hit) => !placed.some((q) => meets(hit, q, GAP)) && (!t.avoid || (inRoom(hit) && !kept.some((q) => q.owner !== t.key && meets(hit, q.box)))));
      // where it would stand now: the first place clear of the words placed before it and of the kept parts
      const best = (): Place | null => {
        const side = sideOf(shown?.side);
        const spots: Spot[] = t.flag
          ? [
              ...[outward, inward].flatMap((f) => t.lifts.map((l) => ({ f, l }))),
              ...(r > 0 ? ([`beside-${outward}`, `beside-${inward}`] as FlagSide[]).flatMap((f) => BESIDE.map((l) => ({ f, l }))) : []),
            ]
          : t.lifts.map((l) => ({ f: null, l }));
        for (const spot of spots) if (fits({ side, spot })) return { side, spot };
        return null;
      };
      // a fading word waits out a flight, and the moment after it shows, before a flight can start
      const out = !!t.fade && (!!flying?.current || now - born.current.get(t.key)! < 0.35);
      /* a word seen for the first time, or one no one sees (a ghost, or a fading word out for a flight), takes the place it fits
         best at once, so it shows where it belongs; through a gesture every other word holds its place; at rest it goes where
         it fits best */
      const unseen = !!t.ghost || out;
      let place = shown === undefined || unseen ? best() : shown;
      if (shown === undefined || unseen) held.current.set(t.key, place);
      const target = gesture || unseen ? place : best();
      // a word that must move fades out where it stands, and moves once it is out of sight; then it fades in, as a word does when it first shows
      let show = unseen ? 1 : (shows.current.get(t.key) ?? (shown === undefined ? 0 : 1));
      if (!samePlace(target, place) && (show < 0.03 || !place)) {
        place = target;
        held.current.set(t.key, place);
        show = 0;
      }
      // through a gesture, a held word that comes against one placed before it yields: it fades where it stands until it is clear again
      const yields = gesture && !unseen && !!place && hitsOf(place).some((hit) => placed.some((q) => meets(hit, q, GAP)));
      show += ((samePlace(target, place) && !yields ? 1 : 0) - show) * k;
      shows.current.set(t.key, place ? show : 0);
      const standing = gesture ? place : target;
      if (!t.ghost && !yields && standing) placed.push(...hitsOf(standing));
      if (!place) {
        el.style.visibility = "hidden";
        continue;
      }
      const at = boxOf(place);
      el.style.visibility = "visible";
      el.style.transform = `translate(${Math.round(at[0])}px, ${Math.round(at[1])}px)`;
      el.style.setProperty("--lift", `${place.spot.l}px`);
      if (t.rule && el.dataset.side !== place.side) el.dataset.side = place.side;
      if (place.spot.f && el.dataset.flag !== place.spot.f) el.dataset.flag = place.spot.f;
      // a veiled set's name fades with it
      const veiled = t.b !== undefined && veil ? veil.b[t.b] < 0.999 : false;
      el.style.opacity = out ? "0" : veiled ? "0.2" : "1";
      // a move's fade rides on its own filter, so it never waits on a word's own opacity transition
      const filter = show < 0.995 ? `opacity(${show.toFixed(3)})` : "";
      if (el.style.filter !== filter) el.style.filter = filter;
    }
    // a word that left forgets its place, so it places itself afresh when it comes back
    if (held.current.size > tags.length * 2) {
      const keys = new Set(tags.map((t) => t.key));
      for (const k of held.current.keys())
        if (!keys.has(k)) {
          held.current.delete(k);
          shows.current.delete(k);
          born.current.delete(k);
        }
    }
  });
  return null;
}

/* a logo's ink for the mono option: its figure in ink, its ground in the plaque. A logo on its own ground (a disc, a tile: a
   shape that fills most of its bounds, one tone holding its outline and a figure in another) is inked by how far each pixel stands from that tone;
   a mark on no ground by its darkness; either stretched over the logo's own range, and a logo of one tone is its silhouette.
   Read from the color atlas's cell, written as the mono atlas's alpha */
function inkOf(from: CanvasRenderingContext2D, to: CanvasRenderingContext2D, x0: number, y0: number) {
  const img = from.getImageData(x0, y0, CELL, CELL);
  const d = img.data;
  const lum = (p: number) => (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < CELL && y < CELL && d[(y * CELL + x) * 4 + 3] > 60;
  // the logo's bounds, its solid pixels, and the tones along its outline
  let bx0 = CELL;
  let by0 = CELL;
  let bx1 = -1;
  let by1 = -1;
  let count = 0;
  const outline: number[] = [];
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const p = (y * CELL + x) * 4;
      if (d[p + 3] <= 200) continue;
      count++;
      bx0 = Math.min(bx0, x);
      bx1 = Math.max(bx1, x);
      by0 = Math.min(by0, y);
      by1 = Math.max(by1, y);
      if (!solid(x - 3, y) || !solid(x + 3, y) || !solid(x, y - 3) || !solid(x, y + 3)) outline.push(lum(p));
    }
  let ground: number | null = null;
  if (count > 0 && outline.length) {
    outline.sort((a, b) => a - b);
    const tone = outline[outline.length >> 1];
    let held = 0;
    let figure = 0;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3] <= 200) continue;
      const off = Math.abs(lum(p) - tone);
      if (off < 0.08) held++;
      else if (off > 0.3) figure++;
    }
    const fill = count / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
    // a ground holds a figure in a clearly other tone, however thin (a disc's lettering): a shape of one tone (a bold wordmark) is a mark
    if (fill > 0.55 && held > count * 0.3 && figure > count * 0.015) ground = tone;
  }
  const far = (p: number) => (ground === null ? 1 - lum(p) : Math.abs(lum(p) - ground));
  let lo = 1;
  let hi = 0;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 128) continue;
    lo = Math.min(lo, far(p));
    hi = Math.max(hi, far(p));
  }
  // on a ground, the ground itself is no ink; off one, the palest part of the mark is none
  const from0 = ground === null ? lo : 0;
  const flat = hi - from0 < 0.12;
  for (let p = 0; p < d.length; p += 4) {
    const t = flat ? (ground === null ? 1 : 0) : Math.min(1, Math.max(0, ((far(p) - from0) / (hi - from0) - 0.1) / 0.6));
    d[p + 3] = Math.round(d[p + 3] * t);
    d[p] = d[p + 1] = d[p + 2] = 0;
  }
  to.putImageData(img, x0, y0);
}

/* the atlas's cells: a logo on a white disc, cut round, with no shadow (the shader draws the ring) */
const CELL = 128;

/** each chain's logo on its roof: a plaque that stands on the crest facing the camera, faint when another set is lit */
export function Badges({
  model,
  rise,
  alpha,
  theme,
  veil,
  mono = false,
  lit = [-1, -1],
  onPick,
  onHover,
}: {
  model: CityModel;
  rise: Float32Array;
  alpha: Float32Array;
  theme: Theme;
  veil?: VeilState;
  /** the option Owen is shown: logos in the brand's ink at rest, on square plaques, in their own colors only for the lit sets */
  mono?: boolean;
  /** the buildings whose logos keep their colors in the mono option: the hovered and the picked */
  lit?: [number, number];
  /** a plaque is its set's handle, as its tower is: a click picks the set, the cursor on it lights the set */
  onPick?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const list = useMemo(
    () =>
      model.buildings
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => b.n.role !== "hub" && !!b.n.logo),
    [model],
  );
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
  const atlas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = cols * CELL;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    // the mono option's second atlas: each logo's ink, in its alpha
    const mc = mono ? document.createElement("canvas") : null;
    if (mc) mc.width = mc.height = cols * CELL;
    const mt = mc ? new CanvasTexture(mc) : null;
    if (mt) mt.anisotropy = 4;
    return { c, t, mc, mt };
  }, [cols, mono]);
  const mesh = useMemo(() => {
    if (!atlas) return null;
    const m = new InstancedMesh(new PlaneGeometry(1, 1), badgeMaterial(atlas.t, atlas.mt), Math.max(1, list.length));
    m.count = list.length;
    m.frustumCulled = false;
    m.renderOrder = 2;
    const cell = new Float32Array(Math.max(1, list.length) * 4);
    const size = new Float32Array(Math.max(1, list.length));
    const r = new Float32Array(Math.max(1, list.length));
    const M = new Matrix4();
    list.forEach(({ b, i }, k) => {
      const badge = plaqueOf(b);
      // anchored on its roof, at the top of its massing
      const at = plaqueAt(b);
      M.makeTranslation(at.x, at.y, at.z);
      m.setMatrixAt(k, M);
      // the canvas texture is flipped on upload (flipY), so the atlas's row r from the top is v from 1 - (r + 1) / cols
      cell.set([(k % cols) / cols, 1 - (Math.floor(k / cols) + 1) / cols, 1 / cols, 1 / cols], k * 4);
      size[k] = badge;
      r[k] = rise[i] + 0.3;
    });
    m.geometry.setAttribute("aCell", new InstancedBufferAttribute(cell, 4));
    m.geometry.setAttribute("aSize", new InstancedBufferAttribute(size, 1));
    m.geometry.setAttribute("aAlpha", new InstancedBufferAttribute(new Float32Array(Math.max(1, list.length)), 1));
    m.geometry.setAttribute("aRise", new InstancedBufferAttribute(r, 1));
    m.geometry.setAttribute("aTint", new InstancedBufferAttribute(new Float32Array(Math.max(1, list.length)), 1));
    /* a plaque is picked where the shader stands it: a disc of its size facing the eye, capped on screen, lifted by
       half of it and drawn half of it nearer; one not yet risen, or faded out, is not there to pick */
    const disc = new Sphere();
    const at = new Vector3();
    const hit = new Vector3();
    const im = new Matrix4();
    m.raycast = (raycaster: Raycaster, intersects: Intersection[]) => {
      const cam = raycaster.camera as PerspectiveCamera | undefined;
      const u = (m.material as ShaderMaterial).uniforms;
      if (!cam) return;
      const alphaOf = (m.geometry.getAttribute("aAlpha") as InstancedBufferAttribute).array;
      for (let k = 0; k < m.count; k++) {
        if (alphaOf[k] < 0.05 || TIME.value < r[k]) continue;
        m.getMatrixAt(k, im);
        at.setFromMatrixPosition(im).applyMatrix4(m.matrixWorld).applyMatrix4(cam.matrixWorldInverse);
        if (at.z > -1) continue;
        const s = Math.min(size[k], (u.uMaxPx.value * -at.z) / u.uFocal.value);
        at.y += s * 0.5;
        at.z += s * 0.5;
        disc.set(at.applyMatrix4(cam.matrixWorld), s * 0.5);
        if (!raycaster.ray.intersectSphere(disc, hit)) continue;
        intersects.push({ distance: raycaster.ray.origin.distanceTo(hit), point: hit.clone(), object: m, instanceId: k });
      }
    };
    return m;
    // the rise is read once per plan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, list, cols]);
  useEffect(
    () => () => {
      mesh?.dispose();
    },
    [mesh],
  );
  // the lens's pixels per unit of height at a unit's depth, for the logos' largest size on screen
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const u = (mesh?.material as ShaderMaterial | undefined)?.uniforms;
    if (u) u.uFocal.value = size.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
  }, [mesh, camera, size.height]);
  // by night a plaque is a shade under white, so it does not glare over the dark city; the mono option's plaque and ink by theme
  useEffect(() => {
    const u = (mesh?.material as ShaderMaterial | undefined)?.uniforms;
    if (!u) return;
    u.uShade.value = theme === "dark" ? 0.86 : 1;
    (u.uPlaque.value as Color).set(theme === "dark" ? "#2A3236" : "#EBF0FA");
    (u.uInk.value as Color).set(theme === "dark" ? "#A2AFB2" : "#3B484B");
  }, [mesh, theme]);

  // the logos load one by one; each shows once it is in the atlas
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set());
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!atlas) return;
    let live = true;
    const x = atlas.c.getContext("2d")!;
    x.clearRect(0, 0, atlas.c.width, atlas.c.height);
    setLoaded(new Set());
    list.forEach(({ b }, k) => {
      const draw = (img: HTMLImageElement) => {
        if (!live) return;
        const cx = (k % cols) * CELL + CELL / 2;
        const cy = Math.floor(k / cols) * CELL + CELL / 2;
        // a crisp plaque: a white disc to the cell's edge, no shadow (the shader draws its 1 px ring), the logo inside a margin;
        // the mono option's square plaque is the shader's own, so its cell holds the logo alone, in a square
        x.save();
        if (!atlas.mc) {
          x.fillStyle = "#FFFFFF";
          x.beginPath();
          x.arc(cx, cy, CELL / 2 - 0.5, 0, Math.PI * 2);
          x.fill();
        }
        x.restore();
        x.save();
        x.beginPath();
        if (atlas.mc) x.roundRect(cx - CELL / 2 + 12, cy - CELL / 2 + 12, CELL - 24, CELL - 24, 4);
        else x.arc(cx, cy, CELL / 2 - 12, 0, Math.PI * 2);
        x.clip();
        const s = CELL - 24;
        // a mark covers the disc, as the map's slice does; a wordmark (DComm, Watr) fits inside it whole
        const iw = img.naturalWidth || s;
        const ih = img.naturalHeight || s;
        const word = Math.max(iw, ih) / Math.max(1, Math.min(iw, ih)) > 1.3;
        const k2 = word ? Math.min(s / iw, s / ih) * 0.9 : Math.max(s / iw, s / ih);
        x.drawImage(img, cx - (iw * k2) / 2, cy - (ih * k2) / 2, iw * k2, ih * k2);
        x.restore();
        if (atlas.mc && atlas.mt) {
          inkOf(x, atlas.mc.getContext("2d")!, cx - CELL / 2, cy - CELL / 2);
          atlas.mt.needsUpdate = true;
        }
        atlas.t.needsUpdate = true;
        invalidate();
        setLoaded((had) => new Set(had).add(k));
      };
      const src = logoAt(b.n.logo, 128);
      const tryLoad = (url: string, fallback: string | null) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => draw(img);
        img.onerror = () => {
          if (fallback) tryLoad(fallback, null);
        };
        img.src = url;
      };
      // Contentful and the site's own files send their images to a canvas, and the image route takes no SVG; any other host comes through the site's own image route, and as itself if that fails
      const direct = src.startsWith("/") || src.includes("images.ctfassets.net") || /\.svg(\?|$)/i.test(src);
      if (direct) tryLoad(src, null);
      else tryLoad(`/_next/image?url=${encodeURIComponent(b.n.logo)}&w=128&q=75`, src);
    });
    return () => {
      live = false;
    };
  }, [atlas, list, cols, theme, invalidate]);

  // each logo's strength: none until it loads, faint when another set is lit, and a fifth over a veiled building
  const veilSeen = useRef(-1);
  const write = () => {
    if (!mesh) return;
    const a = mesh.geometry.getAttribute("aAlpha") as InstancedBufferAttribute;
    list.forEach(({ i }, k) => (a.array[k] = loaded.has(k) ? (alpha[i] ?? 1) * (veil && veil.b[i] < 0.999 ? 0.2 : 1) : 0));
    a.needsUpdate = true;
    const tint = mesh.geometry.getAttribute("aTint") as InstancedBufferAttribute;
    list.forEach(({ i }, k) => (tint.array[k] = i === lit[0] || i === lit[1] ? 1 : 0));
    tint.needsUpdate = true;
  };
  useEffect(() => {
    write();
    // write reads these, and the veil in its frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, list, loaded, alpha, lit[0], lit[1]]);
  useFrame(() => {
    if (!veil || veil.version === veilSeen.current) return;
    veilSeen.current = veil.version;
    write();
  });

  const idOf = (k: number | undefined) => (k === undefined ? null : (list[k]?.b.id ?? null));
  return mesh ? (
    <primitive
      // keyed by the mesh, so rebuilt plaques still take the cursor (Buildings.tsx)
      key={mesh.uuid}
      object={mesh}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover?.(idOf(e.instanceId));
      }}
      onPointerOut={() => onHover?.(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // a press that slid under a trackpad's slip still picks
        if (e.delta > 12) return;
        e.stopPropagation();
        const id = idOf(e.instanceId);
        if (id) onPick?.(id);
      }}
    />
  ) : null;
}

/** keeps a DOM element over a point of the scene, beside it on the side with more room */
export function Anchor({ at, el, inset }: { at: Vector3 | null; el: RefObject<HTMLDivElement | null>; inset: Inset }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useRef(new Vector3());
  const room = { x0: inset.left, w: Math.max(160, size.width - inset.left - inset.right) };
  useFrame(() => {
    const d = el.current;
    if (!d) return;
    if (!at) {
      d.style.opacity = "0";
      return;
    }
    v.current.copy(at).project(camera);
    const x = (v.current.x * 0.5 + 0.5) * size.width;
    const y = (-v.current.y * 0.5 + 0.5) * size.height;
    // on the building's outer side, unless the frame's edge is too near
    const outer = x > room.x0 + room.w / 2 ? 1 : -1;
    const space = outer > 0 ? room.x0 + room.w - x : x - room.x0;
    const side = space > 260 ? outer : -outer;
    d.style.opacity = v.current.z < 1 ? "1" : "0";
    d.style.transform = side < 0 ? `translate(${Math.round(x - 22)}px, ${Math.round(y)}px) translate(-100%, -50%)` : `translate(${Math.round(x + 22)}px, ${Math.round(y)}px) translate(0, -50%)`;
  });
  return null;
}
