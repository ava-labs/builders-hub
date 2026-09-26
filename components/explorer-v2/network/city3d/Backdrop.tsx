"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import { PLATE } from "@/components/explorer-v2/network/icm-map";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import type { Theme } from "./palette";
import { TIME } from "./shaders";

/* The backdrop: a cool, still atmosphere round the column, in the brand's
   greys. The sky is a gradient drawn here: by day from the brand's light
   #EBF0FA down to a pale steel haze, by night from its #1F1F1F down to a
   deep blue-black. The haze at the horizon is the fog the sea fades into,
   so the sea runs out into the sky with no edge. Far below lies a sea of
   cold fog: Owen's cloud tile, drained of its color and most of its
   contrast, read twice at two sizes and two turns and mixed by a slow
   noise so the tile never shows its repeat; it drifts very slowly, and the
   plate's shadow lies faint on it. By night the fog is barely there. Until
   the city stands the sea is a plain tile painted here; the image then
   fades in, and where it cannot load the painted tile stays. A sparse,
   slow fall of fine snow may drift across the city, left to right; it is
   off unless asked for, and never shows to a reader who asks for less
   motion. Two draw calls, three with the snow, all round the camera. */

/** the sky's radius round the camera, inside the lens's far plane */
const SKY_R = 11000;
/** the sea's height, far under the plate */
export const SEA_Y = -3400;
/** the sea's reach round the camera; the fog has it all before its edge */
const SEA_R = 13000;
/** one tile of the clouds on the sea, in plan units */
const TILE = 5600;
/** the snow: how many flakes, the box they fall through round the plate, and how fast they fall and drift */
const FLAKES = 700;
const SNOW_BOX = { w: 2400, top: 520, bottom: -900 };
const SNOW_FALL = 9;
const SNOW_WIND = 5;
/** how long the image takes to fade in over the painted tile */
const FADE_S = 1.6;
const SRC: Record<Theme, string> = { light: "/images/city3d/clouds-day.webp", dark: "/images/city3d/clouds-night.webp" };
/** the sun, where the city's light stands (City3D.tsx) */
const SUN = new Vector3(-0.46, 1, 0.18).normalize();
/** the plate's shadow on the sea, along the sun's light */
const SHADOW = new Vector2((-SUN.x * -SEA_Y) / SUN.y, (-SUN.z * -SEA_Y) / SUN.y);

/* each theme's sky and sea: the zenith, the sky, the haze at the horizon
   (the fog); and the clouds' tone: the tile's mean, their contrast round
   it, their color, light and lift into the haze, the plate's shadow, and
   the fog's density */
const LOOK: Record<Theme, { zenith: string; sky: string; haze: string; mean: string; contrast: number; sat: number; tint: number; lift: number; shade: number; fog: number; flake: string; flakeA: number }> = {
  light: { zenith: "#EBF0FA", sky: "#E1E7F0", haze: "#D2D9E2", mean: "#A5B1CF", contrast: 0.32, sat: 0.12, tint: 1.18, lift: 0.42, shade: 0.12, fog: 0.62e-4, flake: "#FFFFFF", flakeA: 0.85 },
  dark: { zenith: "#1F1F1F", sky: "#161A21", haze: "#0D1118", mean: "#2D4A6A", contrast: 0.22, sat: 0.15, tint: 0.26, lift: 0.62, shade: 0.2, fog: 0.9e-4, flake: "#DCE4F0", flakeA: 0.55 },
};

const HASH = /* glsl */ `
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
`;

function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uZenith: { value: new Color() }, uSky: { value: new Color() }, uHaze: { value: new Color() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uSky;
      uniform vec3 uHaze;
      varying vec3 vDir;
      ${HASH}
      void main() {
        vec3 d = normalize( vDir );
        // the haze at the horizon, the sky over it, the zenith; under the horizon the haze the sea fades into.
        // A low camera sees a few degrees of sky, so the sky comes in close over the haze
        vec3 c = mix( uHaze, uSky, smoothstep( -0.01, 0.12, d.y ) );
        c = mix( c, uZenith, smoothstep( 0.12, 0.8, d.y ) );
        gl_FragColor = vec4( c, 1.0 );
        #include <colorspace_fragment>
        // a grain under half a level of 8 bits, added after the color space so it stays that small in the dark, so the gradient does not band
        gl_FragColor.rgb += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      }`,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
  });
}

function snowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: TIME, uDpr: { value: 1 }, uColor: { value: new Color() }, uAlpha: { value: 1 }, uFocal: { value: 1000 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aPhase;
      uniform float uTime;
      uniform float uDpr;
      uniform float uFocal;
      varying float vAlpha;
      void main() {
        // each flake falls through the box and comes in at its top again, carried left to right, swaying a little
        vec3 p = position;
        float h = ${(SNOW_BOX.top - SNOW_BOX.bottom).toFixed(1)};
        p.y = ${SNOW_BOX.bottom.toFixed(1)} + mod( p.y - ${SNOW_BOX.bottom.toFixed(1)} - uTime * ${SNOW_FALL.toFixed(1)} * ( 0.7 + 0.6 * aPhase ), h );
        p.x = mod( p.x + uTime * ${SNOW_WIND.toFixed(1)} + 6.0 * sin( uTime * 0.3 + aPhase * 6.28 ) + ${(SNOW_BOX.w / 2).toFixed(1)}, ${SNOW_BOX.w.toFixed(1)} ) - ${(SNOW_BOX.w / 2).toFixed(1)};
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        // fine points, a little larger near the camera, never more than a few pixels
        gl_PointSize = clamp( aSize * uFocal / -mv.z, 1.0, 3.2 ) * uDpr;
        // thinning at the box's top and bottom, so no flake pops in or out
        float fade = smoothstep( 0.0, 80.0, p.y - ${SNOW_BOX.bottom.toFixed(1)} ) * smoothstep( 0.0, 80.0, ${SNOW_BOX.top.toFixed(1)} - p.y );
        vAlpha = aAlpha * fade;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vAlpha;
      void main() {
        float a = smoothstep( 0.5, 0.2, length( gl_PointCoord - 0.5 ) ) * vAlpha * uAlpha;
        gl_FragColor = vec4( uColor, a );
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

function seaMaterial(tile: Texture | null): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: tile },
      uNext: { value: tile },
      uMix: { value: 0 },
      uTime: TIME,
      uCam: { value: new Vector3() },
      uHaze: { value: new Color() },
      uMean: { value: new Color() },
      uContrast: { value: 1 },
      uSat: { value: 1 },
      uTint: { value: 1 },
      uLift: { value: 0 },
      uShade: { value: 0 },
      uShadow: { value: SHADOW },
      uDensity: { value: 1e-4 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4( position, 1.0 );
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform sampler2D uNext;
      uniform float uMix;
      uniform float uTime;
      uniform vec3 uCam;
      uniform vec3 uHaze;
      uniform vec3 uMean;
      uniform float uContrast;
      uniform float uSat;
      uniform float uTint;
      uniform float uLift;
      uniform float uShade;
      uniform vec2 uShadow;
      uniform float uDensity;
      varying vec3 vWorld;
      ${HASH}
      float noise( vec2 p ) {
        vec2 i = floor( p );
        vec2 f = fract( p );
        vec2 u = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
      }
      vec3 cloudsOf( sampler2D map, vec2 a, vec2 b, float m ) {
        return mix( texture2D( map, a ).rgb, texture2D( map, b ).rgb, m );
      }
      void main() {
        vec2 p = vWorld.xz;
        vec2 drift = vec2( 3.0, 1.1 ) * uTime;
        // two reads of the tile: the second smaller, turned and slower, mixed by a noise wider than both
        vec2 a = ( p + drift ) / ${TILE.toFixed(1)};
        vec2 b = mat2( 0.799, 0.602, -0.602, 0.799 ) * ( p + drift * 0.55 ) / ${(TILE * 0.61).toFixed(1)} + vec2( 0.37, 0.71 );
        // a narrow blend, so most of the sea reads one sample at full contrast
        float m = smoothstep( 0.42, 0.58, noise( p / ${(TILE * 1.7).toFixed(1)} + 5.3 ) );
        vec3 t = cloudsOf( uMap, a, b, m );
        if ( uMix > 0.0 ) t = mix( t, cloudsOf( uNext, a, b, m ), uMix );
        // toned for the theme: its contrast round the tile's mean, its color, its light, a lift into the haze
        t = uMean + ( t - uMean ) * uContrast;
        t = mix( vec3( dot( t, vec3( 0.2126, 0.7152, 0.0722 ) ) ), t, uSat ) * uTint;
        t = mix( t, uHaze, uLift );
        // the plate's shadow, soft, where the sun's light would fall through it
        t *= 1.0 - uShade * ( 1.0 - smoothstep( ${(PLATE * 0.7).toFixed(1)}, ${(PLATE * 1.3).toFixed(1)}, distance( p, uShadow ) ) );
        // the fog: thicker with distance, and whole before the sea's edge
        float d = distance( vWorld, uCam );
        float f = 1.0 - exp( -d * d * uDensity * uDensity );
        f = max( f, smoothstep( ${(SEA_R * 0.62).toFixed(1)}, ${(SEA_R * 0.9).toFixed(1)}, distance( p, uCam.xz ) ) );
        vec3 c = mix( t, uHaze, f );
        gl_FragColor = vec4( c, 1.0 );
        #include <colorspace_fragment>
        // the same grain as the sky's, after the color space
        gl_FragColor.rgb += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      }`,
    depthWrite: false,
  });
}

/* the snow: flakes scattered through the box round the plate, most of them small and faint */
function snowGeometry(): BufferGeometry {
  const roll = diceOf("snow");
  const pos: number[] = [];
  const size: number[] = [];
  const alpha: number[] = [];
  const phase: number[] = [];
  for (let i = 0; i < FLAKES; i++) {
    pos.push((roll() - 0.5) * SNOW_BOX.w, SNOW_BOX.bottom + roll() * (SNOW_BOX.top - SNOW_BOX.bottom), (roll() - 0.5) * SNOW_BOX.w);
    const k = roll();
    size.push(1.1 + 1.4 * k * k);
    alpha.push(0.3 + 0.7 * roll());
    phase.push(roll());
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aSize", new Float32BufferAttribute(size, 1));
  g.setAttribute("aAlpha", new Float32BufferAttribute(alpha, 1));
  g.setAttribute("aPhase", new Float32BufferAttribute(phase, 1));
  return g;
}

/* the sea's painted tile, for the time before the image comes: soft puffs, each drawn again across the edges so the tile wraps */
function paintedTile(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const n = 512;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d");
  if (!x) return null;
  x.fillStyle = "#A5B1CF";
  x.fillRect(0, 0, n, n);
  const roll = diceOf("clouds");
  for (let i = 0; i < 80; i++) {
    const r = n * (0.05 + roll() * 0.13);
    const cx = roll() * n;
    const cy = roll() * n;
    const light = roll() < 0.62;
    for (const ox of [-n, 0, n]) {
      for (const oy of [-n, 0, n]) {
        const px = cx + ox;
        const py = cy + oy;
        if (px + r < 0 || px - r > n || py + r < 0 || py - r > n) continue;
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, light ? "rgba(226,232,246,0.5)" : "rgba(128,142,178,0.32)");
        g.addColorStop(1, light ? "rgba(226,232,246,0)" : "rgba(128,142,178,0)");
        x.fillStyle = g;
        x.fillRect(px - r, py - r, 2 * r, 2 * r);
      }
    }
  }
  return tileOf(new CanvasTexture(c));
}

function tileOf<T extends Texture>(t: T): T {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

export function Backdrop({
  theme,
  liveAt,
  still,
  snow = false,
}: {
  theme: Theme;
  /** when the city stands, on the city's clock: the image loads after it */
  liveAt: number;
  still: boolean;
  /** a sparse, slow fall of fine snow across the city; never for a reader who asks for less motion */
  snow?: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const painted = useMemo(() => paintedTile(), []);
  const parts = useMemo(() => {
    const sky = new Mesh(new SphereGeometry(SKY_R, 48, 24), skyMaterial());
    const flakes = new Points(snowGeometry(), snowMaterial());
    const sea = new Mesh(new CircleGeometry(SEA_R, 96).rotateX(-Math.PI / 2), seaMaterial(painted));
    // the sky first, under everything; the sea next; the snow with the other clear things, in the city's air
    sky.renderOrder = -20;
    sea.renderOrder = -19;
    flakes.renderOrder = 5;
    for (const o of [sky, flakes, sea]) o.frustumCulled = false;
    return { sky, flakes, sea };
  }, [painted]);
  useEffect(
    () => () => {
      for (const o of [parts.sky, parts.flakes, parts.sea]) {
        o.geometry.dispose();
        (o.material as ShaderMaterial).dispose();
      }
    },
    [parts],
  );
  useEffect(() => () => painted?.dispose(), [painted]);

  // the theme's sky and the sea's tone
  useEffect(() => {
    const k = LOOK[theme];
    const sky = (parts.sky.material as ShaderMaterial).uniforms;
    sky.uZenith.value.set(k.zenith);
    sky.uSky.value.set(k.sky);
    sky.uHaze.value.set(k.haze);
    const sea = (parts.sea.material as ShaderMaterial).uniforms;
    sea.uHaze.value.set(k.haze);
    sea.uMean.value.set(k.mean);
    sea.uContrast.value = k.contrast;
    sea.uSat.value = k.sat;
    sea.uTint.value = k.tint;
    sea.uLift.value = k.lift;
    sea.uShade.value = k.shade;
    sea.uDensity.value = k.fog;
    const f = (parts.flakes.material as ShaderMaterial).uniforms;
    f.uColor.value.set(k.flake);
    f.uAlpha.value = k.flakeA;
    invalidate();
  }, [theme, parts, invalidate]);

  /* the images: each theme's loads once, after the city stands, and fades in over what the sea shows */
  const images = useRef(new Map<Theme, Texture | "missing" | "loading">());
  const fade = useRef<{ from: number } | null>(null);
  // the tile the sea shows or is fading to, so a fade starts once
  const shown = useRef<Texture | null>(null);
  const want = useRef<Theme>(theme);
  want.current = theme;
  const show = (t: Texture) => {
    const u = (parts.sea.material as ShaderMaterial).uniforms;
    if (shown.current === t && (u.uMap.value === t || u.uNext.value === t)) return;
    shown.current = t;
    // a fade under way lands where it was going first
    if (fade.current) u.uMap.value = u.uNext.value;
    u.uNext.value = t;
    u.uMix.value = 0;
    if (still) {
      u.uMap.value = t;
      fade.current = null;
      invalidate();
      return;
    }
    fade.current = { from: performance.now() };
  };
  const request = (t: Theme) => {
    const have = images.current.get(t);
    if (have === "missing" || have === "loading") return;
    if (have) return show(have);
    images.current.set(t, "loading");
    new TextureLoader().load(
      SRC[t],
      (tex) => {
        images.current.set(t, tileOf(tex));
        if (want.current === t) show(tex);
      },
      undefined,
      // no image: the painted tile stays
      () => images.current.set(t, "missing"),
    );
  };

  useFrame(() => {
    parts.sky.position.copy(camera.position);
    parts.sea.position.set(camera.position.x, SEA_Y, camera.position.z);
    // the flakes keep their size in CSS pixels as the pixel ratio steps, and as the lens is set
    const fu = (parts.flakes.material as ShaderMaterial).uniforms;
    fu.uDpr.value = gl.getPixelRatio();
    fu.uFocal.value = gl.domElement.clientHeight / 2 / Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360);
    const u = (parts.sea.material as ShaderMaterial).uniforms;
    u.uCam.value.copy(camera.position);
    if (TIME.value >= liveAt) request(want.current);
    const f = fade.current;
    if (f) {
      const k = Math.min(1, (performance.now() - f.from) / (FADE_S * 1000));
      u.uMix.value = k * k * (3 - 2 * k);
      if (k >= 1) {
        u.uMap.value = u.uNext.value;
        u.uMix.value = 0;
        fade.current = null;
      }
    }
  });

  return (
    <group>
      <primitive object={parts.sky} />
      <primitive object={parts.sea} />
      {snow && !still && <primitive object={parts.flakes} />}
    </group>
  );
}
