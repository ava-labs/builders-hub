"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Matrix4,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type InstancedBufferAttribute,
} from "three";
import type { Glass } from "@/components/explorer-v2/network/icm-map";
import { GLASS3, GLASS_BASE, GROUND, HUB3, MASS3, ROOF, type Theme } from "./palette";
import type { CityModel } from "./model";
import type { VeilState } from "./Labels";
import { EDGE_U, glassMaterial, glassUniforms, haloMaterial, lampGlowMaterial, massMaterial, RISE_S, TIME, type GlassUniforms } from "./shaders";
import { instanced, paintAll, perInstance, treesOf, placeAll } from "./instancing";
import { standingBox, standingDrum } from "./geometry";

/* The city's buildings as a handful of instanced meshes: the massing's
   boxes and drums, the ribbons of glass on their faces and round their
   drums, the roofs' furniture, the warning lights, and a clear box round
   each building that the cursor catches. The massing is the model's white
   (the night's slate), lit by the sun; the glass is each storey's, lit in
   the wave out from downtown, faint when another set is lit, flashing
   with the set's transactions. */

export interface BuildingsState {
  /** each building's turn in the build-out, and when its windows come on, in the city's seconds */
  rise: Float32Array;
  light: Float32Array;
  /** each building's storeys' glass */
  floors: Glass[][];
  /** each building's glass: 1 lit, low while another set is lit, 0 as plain massing */
  dim: Float32Array;
  /** a flash per window, its beat and its offset in seconds; a beat of 0 does not flash */
  flash: { ribbons: Float32Array; bands: Float32Array };
  /** the building under the cursor, and the picked one, or -1 */
  hover: number;
  pick: number;
  /** when the city moves, in its seconds: the floors flash from then; never for a still reader */
  liveAt: number;
}

const PLANE = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
const BOX = standingBox();
const DRUM = standingDrum(40);
const BAND = standingDrum(40, true);
const CAP = (() => {
  // a hipped roof: four flat slopes up to a point, its corners on the square's
  const g = new ConeGeometry(1, 1, 4, 1).translate(0, 0.5, 0).toNonIndexed();
  g.computeVertexNormals();
  return g;
})();
const DOME = new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const TANK_CONE = new ConeGeometry(1, 1, 16, 1).translate(0, 0.5, 0);
const DISC = new CircleGeometry(1, 36).rotateX(-Math.PI / 2);
const LAMP = new SphereGeometry(1, 12, 8);

const c3 = (hex: string) => new Color(hex);
/** a warning light's flash, some seconds into its beat: on in 0.08 s, then a long fall */
const flashOf = (dt: number) => (dt < 0.08 ? dt / 0.08 : Math.exp(-(dt - 0.08) / 0.38));

/** what a veiled building keeps of itself, as the map's veil keeps a sixth */
const VEIL = 0.2;

/* the helipad: a graphite disc, a fine pale ring and a slim H, in the roof's frame, drawn fine enough to stay crisp near */
function helipadTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const x = cv.getContext("2d")!;
  x.fillStyle = "#4F5B66";
  x.beginPath();
  x.arc(128, 128, 127, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = "rgba(235,240,250,0.7)";
  x.lineWidth = 3;
  x.beginPath();
  x.arc(128, 128, 106, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "rgba(235,240,250,0.8)";
  const u = 256 * 0.1 * 0.5 * 1.25;
  x.fillRect(128 - 1.5 * u, 128 - 1.8 * u, 0.42 * u, 3.6 * u);
  x.fillRect(128 + 1.08 * u, 128 - 1.8 * u, 0.42 * u, 3.6 * u);
  x.fillRect(128 - 1.08 * u, 128 - 0.21 * u, 2.16 * u, 0.42 * u);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function Buildings({
  model,
  state,
  theme,
  onHover,
  onPick,
  veil,
  msaa = false,
  glow = false,
}: {
  model: CityModel;
  state: BuildingsState;
  theme: Theme;
  onHover: (b: number | null) => void;
  onPick: (b: number) => void;
  /** each building's veil, which this writes and the logos and names read */
  veil?: VeilState;
  /** the canvas multisamples, so a veil can be its share of each pixel */
  msaa?: boolean;
  /** the windows and lamps glow at night: off on a renderer that cannot carry it */
  glow?: boolean;
}) {
  const dark = theme === "dark";
  const glassU = useMemo<GlassUniforms>(() => glassUniforms(), []);
  const mats = useMemo(
    () => ({
      mass: massMaterial({ key: "mass", veil: true }),
      massBox: massMaterial({ key: "mass", veil: true, edges: "box" }),
      massDrum: massMaterial({ key: "mass", veil: true, edges: "rims" }),
      cap: massMaterial({ key: "cap", veil: true }),
      green: massMaterial({ key: "green", foot: 1, veil: true }),
      timber: massMaterial({ key: "timber", foot: 1, veil: true }),
      cone: massMaterial({ key: "cone", foot: 1, veil: true }),
      steel: massMaterial({ key: "steel", foot: 1, veil: true }),
      glass: glassMaterial(glassU, "ribbon"),
      glassBand: glassMaterial(glassU, "ribbon", true),
      pad: Object.assign(massMaterial({ key: "pad", foot: 1, veil: true }), { map: helipadTexture() }),
      solar: massMaterial({ key: "solar", foot: 1, veil: true }),
      tree: massMaterial({ key: "roof-tree", foot: 1, veil: true }),
      trunk: massMaterial({ key: "roof-trunk", foot: 1, veil: true }),
      lamp: new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      pick: new MeshBasicMaterial({ visible: false }),
    }),
    [glassU],
  );

  // a veil is its share of each pixel's samples where the canvas multisamples
  useEffect(() => {
    for (const m of [mats.mass, mats.massBox, mats.massDrum, mats.cap, mats.green, mats.timber, mats.cone, mats.steel, mats.glass, mats.glassBand, mats.pad, mats.solar, mats.tree, mats.trunk]) {
      m.alphaToCoverage = msaa;
      m.needsUpdate = true;
    }
  }, [mats, msaa]);

  // the meshes, made again only when the plan changes
  const { meshes, veiled } = useMemo(() => {
    const r = state.rise;
    const boxes = instanced(BOX, mats.massBox, model.boxes, r, { cast: true, color: true });
    const drums = instanced(DRUM, mats.massDrum, model.drums, r, { cast: true, color: true });
    const ribbons = instanced(PLANE, mats.glass, model.ribbons, r, { color: true });
    const bands = instanced(BAND, mats.glassBand, model.bands, r, { color: true });
    for (const m of [ribbons, bands]) {
      perInstance(m, "aLight", 1, 0);
      perInstance(m, "aFlash", 2, 0);
      perInstance(m, "aDim", 1, 1);
      perInstance(m, "aHue", 1, 0.45);
    }
    const caps = instanced(CAP, mats.cap, model.caps, r, { cast: true });
    const domes = instanced(DOME, mats.mass, model.domes, r, { cast: true });
    const greens = instanced(BOX, mats.green, model.greens, r);
    const tanks = instanced(DRUM, mats.timber, model.tanks, r, { cast: true });
    const cones = instanced(TANK_CONE, mats.cone, model.cones, r, { cast: true });
    const steel = instanced(BOX, mats.steel, model.steel, r, { cast: true });
    const pads = instanced(DISC, mats.pad, model.pads, r);
    const solar = instanced(BOX, mats.solar, model.solar, r, { cast: true });
    const [crowns, trunks] = treesOf(model.trees, r, mats.tree, mats.trunk);
    const lamps = new InstancedMesh(LAMP, mats.lamp, Math.max(1, model.lamps.length));
    lamps.count = model.lamps.length;
    lamps.frustumCulled = false;
    placeAll(
      lamps,
      model.lamps.map((l) => ({ b: l.b, x: l.x, y: l.y, z: l.z, sx: l.r, sy: l.r, sz: l.r, yaw: 0 })),
    );
    lamps.setColorAt(0, new Color(1, 1, 1));
    // a clear box round each building that the cursor catches, so a low tower is as easy to reach as a tall one
    const pick = instanced(
      BOX,
      mats.pick,
      model.buildings.map((b, i) => {
        const w = Math.max(15, b.extent * 1.5);
        // the hub picks by its wings (HubTower), so its own box folds away
        const hub = b.n.role === "hub";
        return { b: i, x: b.x, y: b.base, z: b.z, sx: hub ? 0 : w, sy: hub ? 0 : b.crest + 16, sz: hub ? 0 : w, yaw: -Math.PI / 4 };
      }),
      r,
      { receive: false },
    );
    pick.visible = true;
    // each part that veils: its mesh, and the building of each of its instances
    const veiled: [InstancedMesh, number[]][] = [
      [boxes, model.boxes.map((it) => it.b)],
      [drums, model.drums.map((it) => it.b)],
      [ribbons, model.ribbons.map((it) => it.b)],
      [bands, model.bands.map((it) => it.b)],
      [caps, model.caps.map((it) => it.b)],
      [domes, model.domes.map((it) => it.b)],
      [greens, model.greens.map((it) => it.b)],
      [tanks, model.tanks.map((it) => it.b)],
      [cones, model.cones.map((it) => it.b)],
      [steel, model.steel.map((it) => it.b)],
      [pads, model.pads.map((it) => it.b)],
      [solar, model.solar.map((it) => it.b)],
      [crowns, model.trees.map((t) => t.b ?? -1)],
      [trunks, model.trees.map((t) => t.b ?? -1)],
    ];
    for (const [m] of veiled) perInstance(m, "aFade", 1, 0);
    // the night's glow: a halo round every window, reading the window's own instances, and a disc round every lamp (shaders.ts)
    const halo = (src: InstancedMesh, geo: BufferGeometry, band: boolean) => {
      const g = geo.clone();
      for (const name of ["aRise", "aLight", "aFlash", "aDim", "aFade", "aHue"]) g.setAttribute(name, src.geometry.getAttribute(name));
      const h = new InstancedMesh(g, haloMaterial(band, glassU.uPlain, glassU.uGlassBase), Math.max(1, src.count));
      h.count = src.count;
      h.instanceMatrix = src.instanceMatrix;
      h.instanceColor = src.instanceColor;
      h.frustumCulled = false;
      h.visible = false;
      return h;
    };
    const glowRibbons = halo(ribbons, PLANE, false);
    const glowBands = halo(bands, BAND, true);
    const glowLamps = new InstancedMesh(new PlaneGeometry(1, 1), lampGlowMaterial(3.6, 0.36), Math.max(1, model.lamps.length));
    glowLamps.count = model.lamps.length;
    glowLamps.instanceMatrix = lamps.instanceMatrix;
    glowLamps.instanceColor = lamps.instanceColor;
    glowLamps.frustumCulled = false;
    glowLamps.visible = false;
    return { meshes: { boxes, drums, ribbons, bands, caps, domes, greens, tanks, cones, steel, pads, solar, crowns, trunks, lamps, pick, glowRibbons, glowBands, glowLamps }, veiled };
    // the rise changes with the plan, or for a reader who asks for less motion
  }, [model, mats, state.rise]);
  useEffect(
    () => () => {
      for (const m of Object.values(meshes)) {
        m.geometry.dispose();
        m.dispose();
      }
      // the glow's materials are the meshes' own
      for (const m of [meshes.glowRibbons, meshes.glowBands, meshes.glowLamps]) (m.material as Material).dispose();
    },
    [meshes],
  );
  // the glow is the night's, where the renderer carries it
  useEffect(() => {
    for (const m of [meshes.glowRibbons, meshes.glowBands, meshes.glowLamps]) m.visible = glow && dark;
  }, [meshes, glow, dark]);

  // each building's instances, for the light the cursor throws on it
  const partsOf = useMemo(() => {
    const boxes = model.buildings.map(() => [] as number[]);
    const drums = model.buildings.map(() => [] as number[]);
    model.boxes.forEach((it, i) => it.b >= 0 && boxes[it.b].push(i));
    model.drums.forEach((it, i) => it.b >= 0 && drums[it.b].push(i));
    return { boxes, drums };
  }, [model]);

  // the theme: the white model by day, graphite by night, crisp edges, and the curtain walls' glass and its light
  useEffect(() => {
    const t = theme;
    for (const m of [mats.mass, mats.massBox, mats.massDrum]) m.color.set(MASS3.wall[t]);
    EDGE_U.uEdgeColor.value.set(MASS3.edge[t]);
    EDGE_U.uEdgeK.value = dark ? 0.45 : 0.32;
    mats.cap.color.set(ROOF.cap[t]);
    mats.green.color.set(GROUND.roofGarden[t]);
    mats.timber.color.set(ROOF.timber[t]);
    mats.cone.color.set(ROOF.cone[t]);
    mats.steel.color.set(ROOF.steel[t]);
    mats.pad.color.set(dark ? "#9AA0AE" : "#FFFFFF");
    mats.solar.color.set(ROOF.solar[t]);
    mats.tree.color.set(GROUND.roofTree[t]);
    mats.trunk.color.set(GROUND.trunk[t]);
    for (const m of [mats.mass, mats.massBox, mats.massDrum]) (m.userData.foot as { value: number }).value = dark ? 0.72 : 0.86;
    (mats.cap.userData.foot as { value: number }).value = 1;
    glassU.uPlain.value.set(GLASS3.plain[t]);
    glassU.uWall.value.set(MASS3.wall[t]);
    glassU.uGlassBase.value.set(GLASS_BASE[t]);
    glassU.uFrame.value.set(MASS3.frame[t]);
    // by night a lit room's calm white, at seven tenths; by day the glass barely lights itself
    glassU.uGlow.value = dark ? 0.62 : 0.05;
    // a transaction lights its floor in white, in either theme
    glassU.uFlashColor.value.set("#FFFFFF");
    glassU.uFlashGlow.value = dark ? 0.9 : 0.6;
  }, [theme, dark, mats, glassU]);

  /* the glass: each window's storey's color, and how much of it the curtain wall takes.
     A district's calmed hue tints the glass (by day under half, by night a trace in a lit
     room's white); downtown's red, the Versions lens's colors and the lit strips keep theirs */
  useEffect(() => {
    const t = theme;
    const white = c3(HUB3.strip[t]);
    const lobby = c3(dark ? "#EBF0FA" : "#F4F6F9");
    const crownOf = c3(MASS3.wall[t]).lerp(c3("#FFFFFF"), 0.62);
    const cache = new Map<Glass, Color>();
    const glassOf = (g: Glass) => cache.get(g) ?? cache.set(g, c3(GLASS3[g][t])).get(g)!;
    const district = dark ? 0.2 : 0.5;
    const whole = new Set<Glass>(["downtown", "on", "near", "stale", "unknown"]);
    const glassAt = (b: number, k: number, tone: string): Glass | null => {
      const fl = state.floors[b];
      if (tone === "white" || tone === "lobby" || tone === "crown") return null;
      if (!fl?.length) return "plain";
      return tone === "top" || k < 0 ? fl[fl.length - 1] : fl[Math.min(k, fl.length - 1)];
    };
    const toneOf = (b: number, k: number, tone: string) => {
      if (tone === "white") return white;
      if (tone === "lobby") return lobby;
      if (tone === "crown") return crownOf;
      return glassOf(glassAt(b, k, tone)!);
    };
    const hueOf = (b: number, k: number, tone: string) => {
      const g = glassAt(b, k, tone);
      return g === null || whole.has(g) ? 1 : district;
    };
    for (const [mesh, list] of [
      [meshes.ribbons, model.ribbons],
      [meshes.bands, model.bands],
    ] as const) {
      paintAll(mesh, list, (it) => toneOf(it.b, it.k, it.tone));
      const a = mesh.geometry.getAttribute("aHue") as InstancedBufferAttribute;
      list.forEach((it, i) => (a.array[i] = hueOf(it.b, it.k, it.tone)));
      a.needsUpdate = true;
    }
  }, [theme, dark, meshes, model, state.floors]);
  // the glass's turn in the wave, and its strength: each written only when it changes, so a pick costs no more than its own
  const perBuilding = (name: string, of: Float32Array, none: number) => {
    for (const [mesh, list] of [
      [meshes.ribbons, model.ribbons],
      [meshes.bands, model.bands],
    ] as const) {
      const a = mesh.geometry.getAttribute(name) as InstancedBufferAttribute;
      list.forEach((it, i) => (a.array[i] = of[it.b] ?? none));
      a.needsUpdate = true;
    }
  };
  useEffect(() => perBuilding("aLight", state.light, 0), [meshes, model, state.light]);
  useEffect(() => perBuilding("aDim", state.dim, 1), [meshes, model, state.dim]);
  useEffect(() => {
    const a = meshes.ribbons.geometry.getAttribute("aFlash") as InstancedBufferAttribute;
    (a.array as Float32Array).set(state.flash.ribbons.subarray(0, a.array.length));
    a.needsUpdate = true;
    const b = meshes.bands.geometry.getAttribute("aFlash") as InstancedBufferAttribute;
    (b.array as Float32Array).set(state.flash.bands.subarray(0, b.array.length));
    b.needsUpdate = true;
  }, [meshes, state.flash]);

  // the cursor's building takes a shade of the explorer's blue: a cool cast on the white model, a lift on the graphite
  const lastHover = useRef(-1);
  useEffect(() => {
    const tint = dark ? new Color(1.25, 1.36, 1.6) : new Color(0.9, 0.94, 1);
    const plain = new Color(1, 1, 1);
    const set = (b: number, c: Color) => {
      if (b < 0) return;
      for (const i of partsOf.boxes[b] ?? []) meshes.boxes.setColorAt(i, c);
      for (const i of partsOf.drums[b] ?? []) meshes.drums.setColorAt(i, c);
    };
    set(lastHover.current, plain);
    set(state.hover, tint);
    lastHover.current = state.hover;
    if (meshes.boxes.instanceColor) meshes.boxes.instanceColor.needsUpdate = true;
    if (meshes.drums.instanceColor) meshes.drums.instanceColor.needsUpdate = true;
  }, [state.hover, meshes, partsOf, dark]);

  // the warning lights flash, the landmarks' white, downtown's in turn: each flash comes on at once and dies away long, as the brand's motion does
  const lampColors = useMemo(() => model.lamps.map((l) => c3(l.white ? "#FFFFFF" : ROOF.warn[theme])), [model, theme]);
  const tmp = useMemo(() => new Color(), []);
  const lampM = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    const t = TIME.value;
    glassU.uLive.value = Math.min(1, Math.max(0, t - state.liveAt));
    model.lamps.forEach((l, i) => {
      const s = flashOf((((t + l.phase) % l.beat) + l.beat) % l.beat);
      const k = (0.3 + 0.7 * s) * (dark ? 1.6 : 1.1);
      meshes.lamps.setColorAt(i, tmp.copy(lampColors[i]).multiplyScalar(k));
      // a light comes on its roof once the building has risen to it
      const up = t > (state.rise[l.b] ?? 0) + RISE_S ? l.r : 0;
      meshes.lamps.setMatrixAt(i, lampM.makeScale(up, up, up).setPosition(l.x, l.y, l.z));
    });
    if (meshes.lamps.instanceColor) meshes.lamps.instanceColor.needsUpdate = true;
    meshes.lamps.instanceMatrix.needsUpdate = true;
  });

  /* the veil: while a set is picked, the buildings that stand between the camera and
     it, over it on the screen, stand as ghosts, so it can be seen whole, as the map
     veils them. Worked out as the camera moves; written only when the set changes */
  const corners = useMemo(
    () =>
      model.buildings.map((b) => {
        const e = b.extent;
        const top = b.base + b.crest + (b.n.role === "hub" ? 34 : 16);
        const out: Vector3[] = [];
        for (const y of [b.base, top]) for (const [dx, dz] of [[e, 0], [-e, 0], [0, e], [0, -e]]) out.push(new Vector3(b.x + dx, y, b.z + dz));
        return out;
      }),
    [model],
  );
  const v = useMemo(() => new Vector3(), []);
  const veilWas = useRef("");
  useFrame(({ camera }) => {
    if (!veil) return;
    const p = state.pick;
    const rect = (b: number): [number, number, number, number] => {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const c of corners[b]) {
        v.copy(c).project(camera);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      return [x0, y0, x1, y1];
    };
    const ahead: number[] = [];
    if (p >= 0 && corners[p]) {
      const [l, bt, r, tp] = rect(p);
      const bp = model.buildings[p];
      const dp = Math.hypot(bp.x - camera.position.x, bp.z - camera.position.z);
      model.buildings.forEach((m, i) => {
        if (i === p || Math.hypot(m.x - camera.position.x, m.z - camera.position.z) >= dp - bp.extent * 0.5) return;
        const [ml, mb, mr, mt] = rect(i);
        if (ml < r && mr > l && mb < tp && mt > bt) ahead.push(i);
      });
    }
    const key = ahead.join(",");
    if (key === veilWas.current) return;
    veilWas.current = key;
    veil.b.fill(1);
    for (const i of ahead) veil.b[i] = VEIL;
    veil.version++;
    for (const [m, of] of veiled) {
      const a = m.geometry.getAttribute("aFade") as InstancedBufferAttribute;
      of.forEach((b, i) => (a.array[i] = b >= 0 ? 1 - (veil.b[b] ?? 1) : 0));
      a.needsUpdate = true;
    }
  });

  const at = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? -1 : e.instanceId);
  return (
    <group>
      {Object.entries(meshes).map(([key, m]) =>
        key === "pick" ? (
          <primitive
            key={key}
            object={m}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onHover(at(e));
            }}
            onPointerOut={() => onHover(null)}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (e.delta > 6) return;
              e.stopPropagation();
              if (at(e) >= 0) onPick(at(e));
            }}
          />
        ) : (
          <primitive key={key} object={m} />
        ),
      )}
    </group>
  );
}

