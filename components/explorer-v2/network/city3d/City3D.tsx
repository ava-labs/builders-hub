"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { PCFSoftShadowMap, Vector3 } from "three";
import { CX, CY, HUB_ID, Logo, PLATE, PLATE_T, RING_IN, floorsOf, mixTotal, type Glass } from "@/components/explorer-v2/network/icm-map";
import type { CityViewProps } from "@/components/explorer-v2/network/icm-map";
import { PCHAIN_LOGO, PCHAIN_PICK } from "@/components/explorer-v2/network/city-model";
import { groundOf } from "@/components/explorer-v2/network/ground";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import type { District } from "@/components/explorer-v2/network/districts";
import type { Site } from "@/components/explorer-v2/network/newcomers";
import { useStill } from "@/components/explorer-v2/motion";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { ageShort } from "@/components/explorer-v2/format";
import { cn } from "@/lib/utils";
import { BLOCK_H, feetOf, groundTrees, modelOf, outskirtsOf, type CityModel } from "./model";
import { streetsOf } from "./lanes";
import { monoFamily } from "./paint";
import { RISE_S, TIME } from "./shaders";
import type { Theme } from "./palette";
import { Buildings, type BuildingsState } from "./Buildings";
import { cRoofAt, HUB_REACH, HubTower, padAt } from "./HubTower";
import { Helicopters } from "./Helicopters";
import { Ground } from "./Ground";
import { Ledger } from "./Ledger";
import { Traffic } from "./Traffic";
import { Backdrop } from "./Backdrop";
import { Pillar } from "./Pillar";
import { Sites } from "./Sites";
import { Streetlights } from "./Streetlights";
import { FOV, HOME_POLAR, Rig, type Shot } from "./Rig";
import { Anchor, Badges, HALO, PLAQUE_LIFT, plaqueOf, TagLayout, type Keep, type Tag, type VeilState } from "./Labels";
import { Marks } from "./Marks";
import { Lighting } from "./Lighting";

/* The city in 3D: the same plan, towers, streets and traffic as the map
   (icm-map.tsx), drawn in WebGL so the reader can turn it, tilt it and
   fly through it. The app mounts it in the map's place when the view is
   3D, with the map's own props: it lights what the app points at and
   hands every hover and click back to the app, as the map does.
   It opens at the map's view and builds the same way: the towers rise
   from downtown out, the windows come on in a wave once the city stands,
   and then the traffic starts to drive and the floors to flash with each
   set's transactions. For a reader who asks for less motion it stands
   built and lit, and still. */

/** how the scene's words stand: "names" round the city's edge, as the map's; or "rules", each district's name on a 1 px rule
    from its ward's edge and a data tag over each of the eight sets with the most validators, as a presentation model is labelled */
export type LabelStyle = "names" | "rules";

export type City3DProps = CityViewProps & { labels?: LabelStyle };

/** the words' style: the app's, else the page's ?labels= (so the option can be shown by its link), else the names */
function useLabels(prop?: LabelStyle): LabelStyle {
  const [style, setStyle] = useState<LabelStyle>(prop ?? "names");
  useEffect(() => {
    setStyle(prop ?? (new URLSearchParams(window.location.search).get("labels") === "rules" ? "rules" : "names"));
  }, [prop]);
  return style;
}

/* the app's cards over the canvas that its inset does not hold (the key at the top right), in the canvas's pixels, for the
   rules style's words to keep clear of: the app's elements marked data-city-hud that stand open over the city; read once a second */
function useHud(region: { current: HTMLDivElement | null }, on: boolean) {
  const boxes = useRef<[number, number, number, number][]>([]);
  useEffect(() => {
    boxes.current = [];
    if (!on) return;
    const read = () => {
      const el = region.current;
      const root = el?.parentElement;
      if (!el || !root) return;
      const r0 = el.getBoundingClientRect();
      const out: [number, number, number, number][] = [];
      root.querySelectorAll<HTMLElement>("[data-city-hud]").forEach((card) => {
        if (el.contains(card) || card.closest("[aria-hidden='true']")) return;
        const r = card.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(card).opacity === "0") return;
        out.push([r.left - r0.left - 6, r.top - r0.top - 6, r.right - r0.left + 6, r.bottom - r0.top + 6]);
      });
      boxes.current = out;
    };
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [region, on]);
  return boxes;
}

/** the logos' option Owen is shown: ?logos=mono puts them in the brand's ink at rest; the live page keeps their colors */
function useMonoLogos(): boolean {
  const [mono, setMono] = useState(false);
  useEffect(() => setMono(new URLSearchParams(window.location.search).get("logos") === "mono"), []);
  return mono;
}

/** a version's minor line, as the strip names it: 1.15 of v1.15.2 */
const minorOf = (v: string) => /^v?(\d+\.\d+)/.exec(v)?.[1] ?? v;

/** how many sets carry a data tag in the rules style: the most validators first */
const LEADERS = 8;

/* the page's theme, read off <html> and followed as it changes */
function useTheme(): Theme {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark ? "dark" : "light";
}

/* the site's mono face, once the page's fonts are in */
function useMono(): string {
  const [font, setFont] = useState("ui-monospace, monospace");
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => live && setFont(monoFamily()));
    return () => {
      live = false;
    };
  }, []);
  return font;
}

/* how much the page's graphics can carry: a software renderer (no GPU) draws
   the city without antialiasing or shadows, at one pixel to a CSS pixel, and
   still, a frame only when what it shows changes */
function useTier(): "high" | "low" | null {
  const [tier, setTier] = useState<"high" | "low" | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    if (gl && !gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
    const low = /swiftshader|llvmpipe|software|basic render/i.test(name);
    if (process.env.NODE_ENV !== "production") console.info(`[city3d] renderer: ${name || "unknown"}, tier: ${low ? "low (built and still)" : "high"}`);
    setTier(low ? "low" : "high");
  }, []);
  return tier;
}

/** the city's clock: seconds since its plan came in; a still reader's city stands done */
function Clock({ t0, still }: { t0: { current: number | null }; still: boolean }) {
  useFrame(() => {
    TIME.value = still ? 1e5 : t0.current === null ? 0 : (performance.now() - t0.current) / 1000;
  }, -2);
  return null;
}

/** the shadows are drawn again only while something that casts one moves: the build-out, a new plan, a new theme */
function Shadows({ until, bump }: { until: number; bump: unknown }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
  }, [bump, gl]);
  useFrame(() => {
    if (TIME.value < until) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

/** the frame rate's watch, from once the city stands: the build-out's first frames compile its programs, and are no measure of the GPU */
function Monitor({ after, still, onDecline, onIncline }: { after: number; still: boolean; onDecline: () => void; onIncline: () => void }) {
  const [on, setOn] = useState(false);
  useFrame(() => {
    if (!on && !still && TIME.value > after) setOn(true);
  });
  return on ? <PerformanceMonitor onDecline={onDecline} onIncline={onIncline} /> : null;
}

/** a still reader's city draws on demand: a frame whenever what it shows changes */
function Redraw({ on }: { on: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    // the list is what the frame shows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, on);
  return null;
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-6 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </p>
  );
}

/* where the flashes fall: a set's transactions light its floors, now here, now there, more floors and more often the busier it is, as the map's */
function flashesOf(model: CityModel, activity: Map<string, number> | null | undefined, still: boolean) {
  const ribbons = new Float32Array(Math.max(1, model.ribbons.length) * 2);
  const bands = new Float32Array(Math.max(1, model.bands.length) * 2);
  if (!activity || still) return { ribbons, bands };
  const top = Math.log10(1 + Math.max(1, ...model.buildings.map((b) => activity.get(b.id) ?? 0)));
  for (const b of model.buildings) {
    const a = activity.get(b.id) ?? 0;
    if (a <= 0 || b.k1 < b.k0) continue;
    const t = Math.log10(1 + a) / top;
    const ms = Math.round(5200 - 3700 * t);
    const roll = diceOf(b.id);
    for (let i = 0, count = 1 + Math.round(t * 5); i < count; i++) {
      const k = b.k0 + Math.floor(roll() * (b.k1 - b.k0 + 1));
      const face = roll() < 0.5 ? 0 : 1;
      const delay = Math.round(roll() * ms);
      const ids = b.shaft.get(k);
      if (!ids?.length) continue;
      // the map lights the two faces it shows; the model lights all four, a storey's pair by turns
      const id = ids[Math.min(ids.length - 1, face + (k % 2) * 2)];
      const [arr, j] = id < 0 ? [bands, -1 - id] : [ribbons, id];
      arr[j * 2] = ms / 1000;
      arr[j * 2 + 1] = delay / 1000;
    }
  }
  return { ribbons, bands };
}

export default function City3D({ data, versions = null, target = "", sizeBy, paint, activity = null, windowLabel, selected, onSelect, focus, onFocus, lit: litSet = null, hovered = null, onHover, inset, cameraRef, labels: labelsProp }: City3DProps) {
  const { nodes, routes, byId, city, pulse, sites } = data;
  const rules = useLabels(labelsProp) === "rules";
  const monoLogos = useMonoLogos();
  const regionRef = useRef<HTMLDivElement>(null);
  const hud = useHud(regionRef, rules);
  const tier = useTier();
  // a reader who asks for less motion, or a renderer with no GPU (6 to 11 fps), sees the city built and still, drawn on demand
  const still = useStill() || tier === "low";
  // a frame rate that keeps falling steps the pixels down, as far as one to a CSS pixel, and back up when it recovers
  const [dpr, setDpr] = useState(2);
  // the sky's reflections and the night's glow, on a GPU that has kept its frame rate; the first sustained fall turns them off for the visit
  const [richOK, setRichOK] = useState(true);
  const rich = tier === "high" && richOK;
  const theme = useTheme();
  const font = useMono();
  const router = useRouter();
  const painted = paint ?? sizeBy === "versions";

  /* the plan, stood up: the buildings, the ground and its trees, the outskirts and the streets */
  const model = useMemo(() => modelOf(nodes), [nodes]);
  const terrain = useMemo(() => groundOf(city, { cx: CX, cy: CY, ringIn: RING_IN }), [city]);
  const outskirts = useMemo(() => outskirtsOf(city, sites, terrain), [city, sites, terrain]);
  const trees = useMemo(() => [...groundTrees(city, terrain), ...outskirts.trees], [city, terrain, outskirts]);
  const streets = useMemo(() => streetsOf(routes, city.lot), [routes, city.lot]);
  const paintInput = useMemo(
    () => ({
      city,
      terrain,
      outskirts,
      streets,
      heats: routes.map((r) => r.heat),
      // the buildings' feet and the outskirts' houses', and the trees on the ground
      feet: [
        ...feetOf(model),
        ...outskirts.masses.map((q) => ({
          poly: [
            [q.x - q.w, q.z],
            [q.x, q.z + q.w],
            [q.x + q.w, q.z],
            [q.x, q.z - q.w],
          ] as [number, number][],
        })),
      ],
      trees: trees.map((t) => ({ x: t.x, z: t.z, r: t.r })),
      // a new L1's lot is fenced half as wide again as its footprint
      sites: model.buildings
        .filter((b) => b.n.newAt !== null)
        .map((b): [number, number][] => {
          const w = b.n.w * 1.5;
          return [
            [b.x - w, b.z],
            [b.x, b.z + w],
            [b.x + w, b.z],
            [b.x, b.z - w],
          ];
        }),
    }),
    [city, terrain, outskirts, streets, routes, model, trees],
  );

  /* the build-out's schedule: each building's turn to rise and its windows' turn to come on,
     kept per building, so a set that joins later rises then and the others stand */
  const t0 = useRef<number | null>(null);
  const sched = useRef(new Map<string, { rise: number; light: number }>());
  const standAt = useRef(0);
  const schedule = useMemo(() => {
    const now = t0.current === null ? 0 : (performance.now() - t0.current) / 1000;
    if (t0.current === null && model.buildings.length) t0.current = performance.now();
    const fresh = model.buildings.filter((b) => !sched.current.has(b.id));
    const first = sched.current.size === 0;
    fresh
      .sort((a, b) => a.rise - b.rise)
      .forEach((b, i) => {
        const rise = first ? 0.15 + b.rise * 0.045 : now + 0.3 + i * 0.045;
        sched.current.set(b.id, { rise, light: rise + RISE_S + 0.1 });
      });
    if (first && fresh.length) {
      // the windows come on in a wave out from downtown once the whole city stands
      standAt.current = Math.max(...fresh.map((b) => sched.current.get(b.id)!.rise));
      for (const b of fresh) sched.current.get(b.id)!.light = standAt.current + b.light / 1000;
    }
    const rise = Float32Array.from(model.buildings, (b) => (still ? -10 : sched.current.get(b.id)!.rise));
    const light = Float32Array.from(model.buildings, (b) => (still ? -10 : sched.current.get(b.id)!.light));
    const until = Math.max(0, ...rise) + RISE_S + 0.2;
    return { rise, light, until, liveAt: standAt.current + 1.4 };
  }, [model, still]);

  /* what is lit: the building under the cursor or the app's list, the picked one, and the sets they talk with; else the app's search or cut */
  const [hover, setHover] = useState<string | null>(null);
  const [hoverDistrict, setHoverDistrict] = useState<District | null>(null);
  const [hoverRim, setHoverRim] = useState(false);
  const [hoverSite, setHoverSite] = useState<Site | null>(null);
  // the route under the cursor, and where on it the cursor found it
  const [hoverRoute, setHoverRoute] = useState<{ key: string; at: Vector3 } | null>(null);
  const onHoverRoute = useCallback((key: string | null, at?: Vector3) => setHoverRoute(key && at ? { key, at } : null), []);
  const [dragging, setDragging] = useState(false);
  /* while the camera flies or the reader drags it, nothing under a still cursor
     lights or opens its tooltip; after a flight, hover returns with the next move */
  const [flying, setFlying] = useState(false);
  const flyingRef = useRef(false);
  const holdHover = useCallback(() => {
    setHover(null);
    setHoverSite(null);
    setHoverRim(false);
    setHoverRoute(null);
  }, []);
  const flyTimer = useRef<number | null>(null);
  const onFlight = useCallback(
    (f: boolean) => {
      flyingRef.current = f;
      setFlying(f);
      if (f) holdHover();
      // a flight that never reports its landing lets hover go after the longest a flight can take
      if (flyTimer.current) window.clearTimeout(flyTimer.current);
      flyTimer.current = f
        ? window.setTimeout(() => {
            flyingRef.current = false;
            setFlying(false);
          }, 5000)
        : null;
    },
    [holdHover],
  );
  const onDrag = useCallback(
    (d: boolean) => {
      setDragging(d);
      if (d) holdHover();
    },
    [holdHover],
  );
  // a drag cannot stay open: a release anywhere (heard in the capture phase), a move with no button held, the window's blur or a hidden tab ends it
  useEffect(() => {
    if (!dragging) return;
    const end = () => setDragging(false);
    const onMove = (e: PointerEvent) => {
      if (e.buttons === 0) end();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") end();
    };
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("blur", end);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("blur", end);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [dragging]);
  const pickedId = selected && byId.has(selected) ? selected : null;
  const closeUp = pickedId === HUB_ID && focus === null;
  const litId = hover ?? hovered ?? pickedId;
  const near = useMemo(() => {
    if (!litId) return null;
    const s = new Set([litId]);
    for (const r of routes) if (r.from === litId || r.to === litId) s.add(r.from).add(r.to);
    return s.size > 1 ? s : null;
  }, [litId, routes]);
  const shown = near ?? litSet;
  // a hover lights the way a pick does, more lightly
  const byHover = !!(hover ?? hovered);
  const faint = near && byHover ? { glass: 0.42, logo: 0.55 } : { glass: 0.18, logo: 0.35 };
  // the routes the lit set drives, when it has any; a set with none lights no road and greys none
  const routesOf = near ? litId : null;
  useEffect(() => {
    onHover?.(hover);
    // the parent's callback identity does not matter, only the building
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);

  /* each building's storeys' glass: its district's tint, the Versions lens's bands, or a new
     L1's calm fresh glass. A picked tower keeps its district's glass, as the map's does: its lot is marked instead */
  const floors = useMemo(
    () =>
      model.buildings.map((b) => {
        const n = b.n;
        const glass: Glass = n.newAt !== null ? "fresh" : "plain";
        const mix = painted ? versions?.get(n.id) ?? null : null;
        const tint: Glass | null = painted ? null : n.role === "hub" ? "downtown" : n.district ?? "frontier";
        return floorsOf(n.h, mix, glass, tint);
      }),
    [model, painted, versions],
  );
  const dim = useMemo(
    () =>
      Float32Array.from(model.buildings, (b) => {
        const away = focus !== null && b.n.role !== "hub" && b.n.district !== focus;
        return away ? 0 : shown !== null && !shown.has(b.id) ? faint.glass : 1;
      }),
    [model, focus, shown, faint.glass],
  );
  const flash = useMemo(() => flashesOf(model, activity, still), [model, activity, still]);
  const hoverAt = hover ?? hovered;
  const state = useMemo<BuildingsState>(
    () => ({
      rise: schedule.rise,
      light: schedule.light,
      floors,
      dim,
      flash,
      hover: hoverAt ? model.byId.get(hoverAt) ?? -1 : -1,
      pick: pickedId ? model.byId.get(pickedId) ?? -1 : -1,
      liveAt: still ? Infinity : schedule.liveAt,
    }),
    [schedule, floors, dim, flash, hoverAt, pickedId, model, still],
  );
  const badgeAlpha = useMemo(
    () =>
      Float32Array.from(model.buildings, (b) => {
        const away = focus !== null && b.n.district !== focus;
        return away ? 0 : shown !== null && !shown.has(b.id) ? faint.logo : 1;
      }),
    [model, focus, shown, faint.logo],
  );
  // the buildings in front of the picked one, which veil; Buildings works it out as the camera moves
  const veil = useMemo<VeilState>(() => ({ b: new Float32Array(model.buildings.length).fill(1), version: 0 }), [model]);

  /* the traffic: each route shown while one of its ends is in what the app shows, blue into the picked set */
  const traffic = useMemo(
    () => ({
      on: routes.map((r) => {
        const mine = !focus || byId.get(r.from)?.district === focus || byId.get(r.to)?.district === focus;
        return mine && (routesOf ? r.from === routesOf || r.to === routesOf : !litSet || litSet.has(r.from) || litSet.has(r.to));
      }),
      blue: routes.map((r) => !!pickedId && (r.from === pickedId || r.to === pickedId)),
      inks: routes.map((r) => byId.get(r.from)?.color ?? null),
    }),
    [routes, focus, byId, routesOf, litSet, pickedId],
  );

  /* a pick, by any id: a building's, or one another part of the city names (the landmark's wings); a second click lets it go */
  const pickId = useCallback((id: string) => onSelect(selected === id ? null : id), [onSelect, selected]);

  /* the camera's shots: the whole city, a district, a building, downtown's close-up */
  const home = useMemo<Shot>(() => {
    const points: Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      points.push(new Vector3(PLATE * Math.cos(a), 0, PLATE * Math.sin(a)), new Vector3(PLATE * Math.cos(a), -PLATE_T, PLATE * Math.sin(a)));
    }
    // room under the rim's front for its words, as the map leaves
    points.push(new Vector3(0, -PLATE_T - 34, PLATE));
    for (const b of model.buildings) points.push(new Vector3(b.x, b.base + b.crest + 14, b.z));
    return { key: "home", points, polar: HOME_POLAR, cap: 0, fill: 0.95 };
  }, [model]);
  const shot = useMemo<Shot>(() => {
    const hub = model.buildings[model.hub];
    if (closeUp && hub) {
      const w = hub.n.w;
      // the landmark from its forecourt up to its spire's light, in the middle of the frame
      const points = [new Vector3(0, hub.n.h + HUB_REACH, 0)];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        points.push(new Vector3(w * 2.3 * Math.cos(a), 0, w * 2.3 * Math.sin(a)));
      }
      return { key: "downtown", points, polar: 1.1, cap: 1 / 3.6, slow: true, fill: 0.86 };
    }
    const one = pickedId ? model.buildings[model.byId.get(pickedId) ?? -1] : null;
    if (one) {
      const e = one.extent + 44;
      const points = [new Vector3(one.x, one.base + one.crest + 28, one.z)];
      for (const [dx, dz] of [
        [-e, 0],
        [e, 0],
        [0, -e],
        [0, e],
      ])
        points.push(new Vector3(one.x + dx, 0, one.z + dz));
      return { key: `pick:${one.id}`, points, cap: 1 / 4 };
    }
    const ward = focus ? city.wards.find((w) => w.district === focus) : null;
    if (ward) {
      const points: Vector3[] = [];
      for (const id of ward.ids) {
        const b = model.buildings[model.byId.get(id) ?? -1];
        if (!b) continue;
        const e = b.extent + 30;
        points.push(new Vector3(b.x - e, 0, b.z), new Vector3(b.x + e, 0, b.z), new Vector3(b.x, 0, b.z - e), new Vector3(b.x, 0, b.z + e), new Vector3(b.x, b.base + b.crest + 22, b.z));
      }
      if (points.length) return { key: `d:${focus}`, points, polar: 1.0, cap: 1 / 2.6, fill: 0.9 };
    }
    return home;
  }, [closeUp, pickedId, focus, model, city, home]);

  /* the tooltip: the building under the cursor, or a ledger tile, beside it on screen */
  const tipEl = useRef<HTMLDivElement>(null);
  const tipNode = hover && !dragging ? byId.get(hover) ?? null : null;
  const tipSite = !tipNode && hoverSite && !dragging ? outskirts.sites.find((x) => x.site.subnetId === hoverSite.subnetId) ?? null : null;
  const tipRoute = !tipNode && !tipSite && hoverRoute && !dragging ? routes.find((r) => r.key === hoverRoute.key) ?? null : null;
  // the P wing under the cursor: the P-Chain's own card, as the C wing has the C-Chain's
  const tipPchain = hover === PCHAIN_PICK && !dragging;
  const anchor = useMemo(() => {
    if (tipPchain) {
      const hubAt = model.buildings[model.hub];
      if (!hubAt) return null;
      const [x, y, z] = padAt(model);
      return new Vector3(x, hubAt.base + (y - hubAt.base) * 0.62, z);
    }
    if (tipSite) return new Vector3(tipSite.x, 12, tipSite.z);
    if (tipRoute && hoverRoute) return hoverRoute.at;
    if (tipNode) {
      const b = model.buildings[model.byId.get(tipNode.id) ?? -1];
      return b ? new Vector3(b.x, b.base + b.crest * 0.62, b.z) : null;
    }
    return null;
  }, [tipPchain, tipNode, tipSite, tipRoute, hoverRoute, model]);

  // a click on the ground steps back: out of a set, then out of a district
  const stepBack = () => (pickedId ? onSelect(null) : focus ? onFocus(null) : undefined);
  const down = useRef<[number, number] | null>(null);
  const wardOn = hoverDistrict ?? focus;
  const sectorWard = wardOn ? city.wards.find((w) => w.district === wardOn) : null;
  const sectorArc: [number, number, number, number] = sectorWard
    ? (() => {
        const side = city.avenue / 2 / Math.max(1, (city.core + sectorWard.r1) / 2);
        return [sectorWard.a0 + side, sectorWard.a1 - side, city.core + city.lot * 0.18, sectorWard.r1 + city.lot * 0.18];
      })()
    : [0, 0, 0, 0];

  /* the words over the scene: each district's name round the city's edge, and in a district every set's name over its roof, the tallest first */
  const tagEls = useRef(new Map<string, HTMLElement>());
  const tagRef = (key: string) => (el: HTMLElement | null) => {
    if (el) tagEls.current.set(key, el);
    else tagEls.current.delete(key);
  };
  const namesOff = focus !== null || closeUp;
  const roofIds = useMemo(() => {
    const ward = focus ? city.wards.find((w) => w.district === focus) : null;
    return (ward?.ids ?? []).filter((id) => model.byId.has(id)).sort((a, b) => (byId.get(b)?.h ?? 0) - (byId.get(a)?.h ?? 0));
  }, [focus, city, model, byId]);
  // the rules style's data tags: the sets with the most validators, the landmark among them
  const leaders = useMemo(
    () =>
      rules
        ? model.buildings
            .map((_, i) => i)
            .sort((a, b) => model.buildings[b].n.validators - model.buildings[a].n.validators)
            .slice(0, LEADERS)
        : [],
    [rules, model],
  );
  const tags = useMemo<Tag[]>(() => {
    const out: Tag[] = city.wards.map((t) => {
      const mid = (t.a0 + t.a1) / 2;
      if (rules) {
        // on a rule from its ward's outer edge, out from the city: under the front wards, over the back ones
        const r = t.r1 + city.lot * 0.2;
        return { key: `d:${t.district}`, at: new Vector3(r * Math.cos(mid), BLOCK_H, r * Math.sin(mid)), lifts: [22, 38, 54, 70, 86], ghost: namesOff, out: true, vertical: true, rule: true, avoid: true };
      }
      const r = t.r1 + city.lot * 0.55;
      return { key: `d:${t.district}`, at: new Vector3(r * Math.cos(mid), BLOCK_H + 1, r * Math.sin(mid)), lifts: [4, 24, 44, 64], ghost: namesOff, out: true };
    });
    // each leader's data on a leader line over its roof (over its plaque, or the landmark's spire), once it has risen; a district's or the close-up's own words take their place
    if (!namesOff)
      for (const i of leaders) {
        const b = model.buildings[i];
        const hub = b.n.role === "hub";
        const at = hub ? new Vector3(b.x, b.base + b.n.h + HUB_REACH, b.z) : new Vector3(b.x, b.base + b.crest + PLAQUE_LIFT, b.z);
        out.push({ key: `t:${b.id}`, at, lifts: [8, 16, 24, 32, 40, 48, 56, 64], fade: true, b: i, rule: true, flag: true, avoid: true, clear: plaqueOf(b), from: schedule.rise[i] + RISE_S });
      }
    // the week's new L1s carry no floating tag: their building sites (fence, scaffolding, crane) and the New chip say it
    for (const id of roofIds) {
      const b = model.buildings[model.byId.get(id)!];
      // on its plaque's top, now the plaques stand on the roofs
      out.push({ key: `r:${id}`, at: new Vector3(b.x, b.base + b.crest + PLAQUE_LIFT, b.z), lifts: [0, 16, 32, 48, 64, 80], fade: true, b: model.byId.get(id), clear: plaqueOf(b) });
    }
    return out;
  }, [city, namesOff, roofIds, model, focus, schedule, rules, leaders]);
  /* what the rules style's words keep clear of: the landmark (its C wing up to the spire's light, and its low wings), whose own tag stands on it, and every roof plaque, whose own set's tag stands on it */
  const keep = useMemo<Keep[]>(() => {
    const hub = model.buildings[model.hub];
    if (!rules || !hub) return [];
    const w = hub.n.w;
    const [cx, top, cz] = cRoofAt(model);
    const owner = `t:${hub.id}`;
    const out: Keep[] = [
      { owner, min: new Vector3(cx - 0.6 * w, hub.base, cz - 0.8 * w), max: new Vector3(cx + 0.6 * w, top + HUB_REACH, cz + 0.4 * w) },
      { owner, min: new Vector3(hub.x - 1.35 * w, hub.base, hub.z - 0.85 * w), max: new Vector3(hub.x + 1.35 * w, hub.base + 0.62 * hub.n.h, hub.z + 0.9 * w) },
    ];
    for (const b of model.buildings) {
      const plaque = plaqueOf(b);
      if (plaque) out.push({ owner: `t:${b.id}`, at: new Vector3(b.x, b.base + b.crest + PLAQUE_LIFT, b.z), plaque });
    }
    return out;
  }, [rules, model]);

  const hub = model.buildings[model.hub];
  const topPartner = (id: string) =>
    [
      ...routes
        .filter((r) => r.from === id || r.to === id)
        .reduce((m, r) => {
          const other = r.from === id ? r.to : r.from;
          m.set(other, (m.get(other) ?? 0) + r.messages);
          return m;
        }, new Map<string, number>())
        .entries(),
    ].sort((a, b) => b[1] - a[1])[0];
  const pointer = !!(hover || hoverRim || hoverDistrict || hoverSite);

  let tip: ReactNode = null;
  if (tipNode) {
    const m = versions?.get(tipNode.id);
    const known = m ? m.on + m.near + m.stale : 0;
    const pct = m && known > 0 ? Math.round((m.on / mixTotal(m)) * 100) : null;
    const partner = topPartner(tipNode.id);
    tip = (
      <TipPlate>
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
          <Logo uri={tipNode.logo} name={tipNode.name} />
          {tipNode.name}
        </p>
        {tipNode.newAt !== null && <TipRow label="Joined the P-Chain" value={`${ageShort(tipNode.newAt)} ago`} />}
        <TipRow label="Validators" value={tipNode.validators.toLocaleString("en-US")} />
        {m && target && (
          <>
            <TipRow label={`On ${target}+`} value={pct === null ? "n/a" : `${m.on} · ${pct}%`} />
            {m.near + m.stale > 0 && <TipRow label="Behind" value={String(m.near + m.stale)} />}
          </>
        )}
        {!tipNode.guest && (
          <>
            <TipRow label="Messages out" value={fmtCompact(tipNode.out)} />
            <TipRow label="Messages in" value={fmtCompact(tipNode.in)} />
          </>
        )}
        {partner && <TipRow label="Most with" value={byId.get(partner[0])?.name ?? partner[0]} />}
        <p className="mt-1 font-mono text-[10px] text-zinc-400">{pickedId === tipNode.id ? "Click to let it go" : "Click to open it"}</p>
      </TipPlate>
    );
  } else if (tipPchain) {
    // the tip: the stats' when they are newer, else the newest tx's block, as the P-Chain's pane reads it
    const s = pulse.stats;
    const head = pulse.txs[0] ?? null;
    const tipHeight = Math.max(s?.tipHeight ?? 0, head?.height ?? 0) || null;
    const tipAt = s && s.tipHeight >= (head?.height ?? 0) ? s.tipTimestamp : (head?.ts ?? null);
    const primary = byId.get(HUB_ID);
    tip = (
      <TipPlate>
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
          <Logo uri={PCHAIN_LOGO} name="P-Chain" />
          P-Chain
        </p>
        {tipHeight !== null && <TipRow label="Block" value={tipHeight.toLocaleString("en-US")} />}
        {tipAt !== null && <TipRow label="Last block" value={`${ageShort(tipAt)} ago`} />}
        {s && <TipRow label="Txs · 24h" value={s.txCount24h.toLocaleString("en-US")} />}
        {primary && <TipRow label="Validators" value={primary.validators.toLocaleString("en-US")} />}
        <p className="mt-1 font-mono text-[10px] text-zinc-400">{selected === PCHAIN_PICK ? "Click to let it go" : "Click to open it"}</p>
      </TipPlate>
    );
  } else if (tipSite) {
    tip = (
      <TipPlate>
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
          <span className="h-2.5 w-1.5 shrink-0 bg-[#A2AFB2]" />
          {tipSite.site.name}
        </p>
        <p className="mb-1 font-mono text-[10px] text-zinc-500">Created on the P-Chain, no validators yet</p>
        <TipRow label="Created" value={`${ageShort(tipSite.site.createdAt)} ago`} />
        <p className="mt-1 font-mono text-[10px] text-zinc-400">Click to open it on the P-Chain</p>
      </TipPlate>
    );
  } else if (tipRoute) {
    const a = byId.get(tipRoute.from);
    const b = byId.get(tipRoute.to);
    tip = (
      <TipPlate>
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
          <Logo uri={a?.logo ?? ""} name={a?.name ?? tipRoute.from} />
          {a?.name ?? tipRoute.from}
          <span className="text-zinc-400">→</span>
          <Logo uri={b?.logo ?? ""} name={b?.name ?? tipRoute.to} />
          {b?.name ?? tipRoute.to}
        </p>
        <TipRow label={`ICM messages · ${windowLabel}`} value={tipRoute.messages.toLocaleString("en-US")} />
      </TipPlate>
    );
  }

  return (
    <div
      ref={regionRef}
      className={cn("absolute inset-0 isolate", dragging ? "cursor-grabbing" : pointer ? "cursor-pointer" : "cursor-grab")}
      onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
      onPointerLeave={() => setHover(null)}
      role="region"
      aria-label="Avalanche L1s as a city in 3D: drag to turn it, scroll to zoom, right-drag to pan"
    >
      {tier && (
      <Canvas
        shadows={tier === "high" ? { enabled: true, type: PCFSoftShadowMap, autoUpdate: false } : false}
        flat
        dpr={tier === "high" ? Math.min(dpr, typeof window === "undefined" ? 2 : window.devicePixelRatio) : 1}
        gl={{ antialias: tier === "high", alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: FOV, near: 4, far: 14000, position: [0, 1400, 2400] }}
        frameloop={still ? "demand" : "always"}
        onPointerMissed={(e) => {
          const d = down.current;
          if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6) return;
          stepBack();
        }}
      >
        <Monitor
          after={schedule.liveAt + 2}
          still={still}
          onDecline={() => {
            setRichOK(false);
            setDpr((d) => Math.max(1, d - 0.5));
          }}
          onIncline={() => setDpr((d) => Math.min(2, d + 0.5))}
        />
        <Clock t0={t0} still={still} />
        <Redraw on={[state, badgeAlpha, traffic, hoverDistrict, hoverRoute, focus, theme, font]} />
        <Shadows until={schedule.until} bump={`${theme}|${model.buildings.length}|${nodes.length}`} />
        <Lighting theme={theme} rich={rich} />
        <Backdrop theme={theme} liveAt={schedule.liveAt} still={still} />
        <Rig shot={shot} home={home} inset={inset} still={still} onDrag={onDrag} onFlight={onFlight} cameraRef={cameraRef} />
        {/* the P-Chain under the city: a Doric column rising out of the clouds */}
        <Pillar theme={theme} />
        <Ground city={city} terrain={terrain} outskirts={outskirts} trees={trees} paint={paintInput} theme={theme} sector={{ arc: sectorArc, on: !!sectorWard }} onGround={stepBack} />
        <Ledger
          pulse={pulse}
          theme={theme}
          font={font}
          onOpenChain={() => router.push("/explorer/mainnet/p-chain")}
          onRim={(r) => {
            if (!flyingRef.current) setHoverRim(r);
          }}
        />
        {model.buildings.length > 0 && (
          <Buildings
            model={model}
            state={state}
            theme={theme}
            onHover={(b) => {
              if (!flyingRef.current) setHover(b === null || b < 0 ? null : model.buildings[b]?.id ?? null);
            }}
            onPick={(b) => {
              const id = model.buildings[b]?.id;
              if (id) pickId(id);
            }}
            veil={veil}
            msaa={tier === "high"}
            glow={rich}
          />
        )}
        {hub && (
          <HubTower
            hub={hub}
            riseAt={schedule.rise[model.hub]}
            lightAt={schedule.light[model.hub]}
            floors={state.floors[model.hub]}
            theme={theme}
            font={font}
            still={still}
            pulse={pulse}
            activity={activity}
            onPick={pickId}
            // its wings hover as the towers do: held while the camera flies
            onHover={(id: string | null) => {
              if (!flyingRef.current) setHover(id);
            }}
          />
        )}
        {model.buildings.length > 0 && <Helicopters model={model} pulse={pulse} theme={theme} still={still} liveAt={schedule.liveAt} />}
        <Streetlights city={city} theme={theme} glow={rich} />
        <Sites
          model={model}
          outskirts={outskirts}
          rise={schedule.rise}
          theme={theme}
          still={still}
          onSite={(site) => {
            if (!flyingRef.current) setHoverSite(site);
          }}
          onOpenSite={(site) => router.push(`/explorer/mainnet/p-chain/chain/${site.blockchainId}`)}
        />
        <Traffic routes={routes} streets={streets} city={city} inks={traffic.inks} on={traffic.on} blue={traffic.blue} theme={theme} still={still} liveAt={schedule.liveAt} hovered={hoverRoute?.key ?? null} onHoverRoute={onHoverRoute} frozen={flyingRef} />
        <Marks model={model} city={city} hover={state.hover} pick={state.pick} focus={focus} theme={theme} still={still} />
        <Badges model={model} rise={schedule.rise} alpha={badgeAlpha} theme={theme} veil={veil} mono={monoLogos} lit={[state.hover, state.pick]} />
        <TagLayout tags={tags} els={tagEls} flying={flying} veil={veil} keep={keep} inset={inset} hud={hud} />
        <Anchor at={anchor} el={tipEl} inset={inset} />
      </Canvas>
      )}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {city.wards.map((t) => {
          const on = hoverDistrict === t.district;
          if (rules)
            return (
              // the name in the brand's caps, its count in block gray, on a 1 px rule down (or up) to its ward's edge
              <div key={t.district} ref={tagRef(`d:${t.district}`)} className="group absolute left-0 top-0" style={{ visibility: "hidden" }}>
                <button
                  type="button"
                  tabIndex={namesOff ? -1 : 0}
                  aria-label={`${t.label}: ${t.ids.length} L1s. Open the district`}
                  onPointerEnter={() => setHoverDistrict(t.district)}
                  onPointerLeave={() => setHoverDistrict(null)}
                  onFocus={() => setHoverDistrict(t.district)}
                  onBlur={() => setHoverDistrict(null)}
                  onClick={() => onFocus(t.district)}
                  className={cn(
                    "cursor-pointer select-none whitespace-nowrap px-1 py-0.5 text-[12px] font-black uppercase leading-none tracking-[0.14em] outline-none transition-[opacity,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] [font-family:Aeonik,var(--font-sans),sans-serif]",
                    HALO,
                    on ? "text-[#0061E2] dark:text-[#5f9dff]" : "text-[#121212] dark:text-[#EBF0FA]",
                    namesOff ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100",
                  )}
                >
                  {t.label}
                  <span className={cn("ml-1.5 font-medium tracking-[0.04em]", on ? "" : "text-[#A2AFB2]")}>{t.ids.length}</span>
                </button>
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-full w-px transition-[opacity,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[side=down]:top-auto group-data-[side=down]:bottom-full",
                    on ? "bg-[#0061E2] dark:bg-[#5f9dff]" : "bg-[#A2AFB2] dark:bg-[#A2AFB2]/60",
                    namesOff ? "opacity-0" : "opacity-100",
                  )}
                  style={{ height: "var(--lift, 0px)" }}
                />
              </div>
            );
          return (
            <div key={t.district} ref={tagRef(`d:${t.district}`)} className="absolute left-0 top-0" style={{ visibility: "hidden" }}>
              <button
                type="button"
                tabIndex={namesOff ? -1 : 0}
                aria-label={`${t.label}: ${t.ids.length} L1s. Open the district`}
                onPointerEnter={() => setHoverDistrict(t.district)}
                onPointerLeave={() => setHoverDistrict(null)}
                onFocus={() => setHoverDistrict(t.district)}
                onBlur={() => setHoverDistrict(null)}
                onClick={() => onFocus(t.district)}
                className={cn(
                  "cursor-pointer select-none whitespace-nowrap px-1.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] outline-none transition-[opacity,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  HALO,
                  on ? "text-[#0061E2] dark:text-[#5f9dff]" : "text-zinc-800 dark:text-zinc-100",
                  namesOff ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100",
                )}
              >
                {t.label}
                <span className={cn("font-normal tracking-[0.04em]", on ? "" : "text-zinc-400 dark:text-zinc-500")}> {t.ids.length}</span>
                <span aria-hidden className={cn("mt-0.5 block h-[1.5px] w-5 bg-[#0061E2] transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-[#5f9dff]", on ? "opacity-100" : "opacity-0")} />
              </button>
            </div>
          );
        })}
        {/* a district's or the close-up's own words take the data tags' place: they leave the page, as the roof names do */}
        {!namesOff &&
          leaders.map((i) => {
            const b = model.buildings[i];
            const n = b.n;
            const m = versions?.get(n.id);
            const known = m ? m.on + m.near + m.stale : 0;
            const pct = m && target && known > 0 ? Math.round((m.on / mixTotal(m)) * 100) : null;
            const name = n.id === HUB_ID ? "C-Chain" : n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name;
            return (
              // a leader's figures in the page's mono, flown as a flag on a 1 px leader line from its plaque, out from the city's middle
              <div key={n.id} ref={tagRef(`t:${n.id}`)} className="group absolute left-0 top-0 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ visibility: "hidden", opacity: 0 }}>
                <span
                  className={cn(
                    "block select-none whitespace-nowrap pl-1.5 font-mono text-[10px] uppercase leading-[1.25] tracking-[0.06em] tabular-nums group-data-[flag=beside-left]:pl-0 group-data-[flag=beside-left]:pr-1.5 group-data-[flag=beside-left]:text-right group-data-[flag=left]:pl-0 group-data-[flag=left]:pr-1.5 group-data-[flag=left]:text-right",
                    HALO,
                  )}
                >
                  <span className="block font-semibold text-[#121212] dark:text-[#EBF0FA]">{name}</span>
                  <span className="block text-[#3B484B] dark:text-[#A2AFB2]">
                    {`${n.validators.toLocaleString("en-US")} VAL`}
                    {pct !== null && ` · ${pct}% ON ${minorOf(target)}`}
                  </span>
                </span>
                {/* its leader: a pole down its near edge to the plaque, or level from beside the plaque to its words */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 w-px bg-[#A2AFB2] group-data-[flag=beside-left]:hidden group-data-[flag=beside-right]:hidden group-data-[flag=left]:left-auto group-data-[flag=left]:right-0 dark:bg-[#A2AFB2]/60"
                  style={{ height: "calc(100% + var(--lift, 0px))" }}
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 hidden h-px bg-[#A2AFB2] group-data-[flag=beside-left]:left-full group-data-[flag=beside-left]:block group-data-[flag=beside-right]:right-full group-data-[flag=beside-right]:block dark:bg-[#A2AFB2]/60"
                  style={{ width: "var(--lift, 0px)" }}
                />
              </div>
            );
          })}
        {roofIds.map((id) => {
          const n = byId.get(id);
          if (!n) return null;
          const name = n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name;
          return (
            <div key={id} ref={tagRef(`r:${id}`)} className="absolute left-0 top-0 transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ visibility: "hidden", opacity: 0 }}>
              <span
                className={cn(
                  "block select-none whitespace-nowrap font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
                  HALO,
                  pickedId === id ? "text-[#0061E2] dark:text-[#5f9dff]" : hover === id ? "text-[#0061E2]/80 dark:text-[#5f9dff]/80" : "text-zinc-900 dark:text-zinc-50",
                )}
              >
                {name}
              </span>
              <span aria-hidden className="mx-auto block w-px bg-zinc-400/70 dark:bg-zinc-600" style={{ height: "var(--lift, 0px)" }} />
            </div>
          );
        })}
      </div>
      <div ref={tipEl} className="pointer-events-none absolute left-0 top-0 z-20 transition-opacity duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ opacity: 0 }}>
        {tip}
      </div>
    </div>
  );
}
