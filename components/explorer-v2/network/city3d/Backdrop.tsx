"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Points,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import { PLATE } from "@/components/explorer-v2/network/icm-map";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import { onCityStood } from "@/components/explorer-v2/network/city-signal";
import type { Theme } from "./palette";
import { SUN } from "./Lighting";
import { TIME } from "./shaders";
import { loadTile, whiteTile } from "./tile";
import { OPENING, RISE_DEPTH } from "./warmup";
import { bakePeaks, type PeaksBakeCell, type PeaksBakeOutput, type PeaksBakeRange, type PeaksBakeShape } from "./peaks-bake";

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
   fades in, and where it cannot load the painted tile stays. The sky's
   lights are placed for the picture and for the light: the sun stands on
   the key light's line, from the plate's middle on screen through the key's
   point on the horizon (Lighting.tsx), which is where the shadows on the
   ground spread out from in the frame's perspective, so they fall away from
   it in every view that shows it. It stands a few degrees under the frame's
   top edge, so it stays in the band of haze at the top of the frame however
   the camera tilts, slid along its line toward the plate where the app's
   cards would crowd it or, once the city stands, where a pane that shifts
   the city would push it out of the frame; it is out of the frame when
   that point is behind the eye. It is a soft white disc with a wide, low glow that lights
   the haze on its side. By night the moon stands in its place, pale, with
   a faint glow and its seas on its face, and a sparse field of stars
   stands in the same band, sized by their brightness, a few of them
   twinkling slowly; they fade out down the band before the cloud tops
   show. The sea's fog takes the sun, the moon and the stars wherever the
   clouds show through it, so none of them ever sits over the clouds. A
   theme's switch cross-fades them, the sun dimming into the moon. A sparse, slow fall of fine snow may drift across the
   city, left to right; it is off unless asked for, and never shows to a
   reader who asks for less motion. On the high tier (?peaks=0 turns them
   off) real Himalayan and Karakoram massifs stand out of the cloud
   sea round the column, K2 whole in the home view: their heights from SRTM
   at 30 m (scripts/city3d-peaks.mts), baked in workers the module starts as
   it loads (peaks-bake.ts: the survey cleaned, the summits sharpened against
   the flanks, gullies and ribs down the fall line, the snow where it lies,
   the key's shadow and the sky's reach), each lit by its own low key from
   the sun's side, which rakes the faces the camera sees, in air that is
   bluer and paler with distance and under the sea's own fog at the foot.
   In the opening each rises out of the cloud sea with the column, a stagger apart. Three draw calls, four with the snow, ten with the ranges (one each),
   all round the camera but the ranges, which stand still in the world. */

/** the sky's radius round the camera, inside the lens's far plane */
const SKY_R = 11000;
/** the sea's height, far under the plate */
export const SEA_Y = -3400;
/** the sea's reach round the camera; the fog has it all before its edge */
const SEA_R = 13000;
/** one tile of the clouds on the sea, in plan units */
const TILE = 5600;
/** the clouds' drift across the sea, in plan units a second: a tile's width in about seven minutes, slow enough to read as
    weather under the column (at 3 units a second it did not read as moving at all) */
const DRIFT: [number, number] = [12, 4.4];
/** the snow: how many flakes, the box they fall through round the plate, and how fast they fall and drift */
const FLAKES = 700;
const SNOW_BOX = { w: 2400, top: 520, bottom: -900 };
const SNOW_FALL = 9;
const SNOW_WIND = 5;
/** how long the image takes to fade in over the painted tile */
const FADE_S = 1.6;
const SRC: Record<Theme, string> = { light: "/images/city3d/clouds-day.webp", dark: "/images/city3d/clouds-night.webp" };
/** the plate's shadow on the sea, along the key light (Lighting.tsx), from the plate's height over the sea: at its place, and as the column rises (warmup.tsx) */
const shadowAt = (plateY: number, out: Vector2) => out.set((-SUN.x * (plateY - SEA_Y)) / SUN.y, (-SUN.z * (plateY - SEA_Y)) / SUN.y);
const SHADOW = shadowAt(0, new Vector2());

/* each theme's sky and sea: the zenith, the sky, the haze at the horizon
   (the fog); and the clouds' tone: the tile's mean, their contrast round
   it, their color, light and lift into the haze, the plate's shadow, and
   the fog's density */
const LOOK: Record<Theme, { zenith: string; sky: string; haze: string; mean: string; contrast: number; sat: number; tint: number; lift: number; shade: number; fog: number; flake: string; flakeA: number }> = {
  light: { zenith: "#EBF0FA", sky: "#E1E7F0", haze: "#D2D9E2", mean: "#A5B1CF", contrast: 0.32, sat: 0.12, tint: 1.18, lift: 0.42, shade: 0.12, fog: 0.62e-4, flake: "#FFFFFF", flakeA: 0.85 },
  dark: { zenith: "#1F1F1F", sky: "#161A21", haze: "#0D1118", mean: "#2D4A6A", contrast: 0.22, sat: 0.15, tint: 0.26, lift: 0.62, shade: 0.2, fog: 0.9e-4, flake: "#DCE4F0", flakeA: 0.55 },
};

/** the sun's and the moon's place: on the key light's line (Lighting.tsx), where the city's own view shows it near its upper left; a height a fixed angle under the frame's top edge, and never under the horizon when the frame shows it; and their size, as angles */
const KEY_XZ = new Vector3(SUN.x, 0, SUN.z).normalize();
const DISC_BELOW = (3.2 * Math.PI) / 180;
const DISC_R = (0.7 * Math.PI) / 180;
/** the room the sun or the moon keeps from the app's cards over the city (data-city-chrome, data-city-hud) and, once the city stands, inside the frame's edges, in CSS pixels; and how far along its line toward the plate it may slide to keep it */
const CLEAR_PX = 32;
const SLIDE_MIN = 0.3;
/** the least height over the horizon the sun or the moon keeps once the frame shows a band of sky over it: the top edge's heights the lift comes in over, and how far under the top edge the disc may then come */
const DISC_LIFT = (1 * Math.PI) / 180;
const LIFT_BAND: [number, number] = [(1.5 * Math.PI) / 180, (3.5 * Math.PI) / 180];
const LIFT_ROOM = (2.5 * Math.PI) / 180;
/** the stars' band under the frame's top edge: they stand from its top down, fading out between these two angles */
const STAR_BAND: [number, number] = [(3 * Math.PI) / 180, (5.5 * Math.PI) / 180];
/* the sky's lights: the sun's face and the moon's, and each one's glow on the haze, a color at its strength */
const LIGHTS = { sun: "#FFFFFF", moon: "#D6DEEA", sunGlow: ["#FFFFFF", 0.13] as const, moonGlow: ["#9AA6B8", 0.06] as const };
/** the stars: how many, all round, and their color, a cool white */
const STARS = 260;
const STAR = "#E6ECF5";
/** how fast a theme's switch cross-fades the sky's lights, a share a second */
const FADE_RATE = 4;

const HASH = /* glsl */ `
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
`;

/* the sun or the moon, shared by the sky and the sea so they meet with no seam: a soft glow close round it, a wide, low one along the haze on its side, and its disc */
const LIGHT = /* glsl */ `
uniform vec3 uDisc;
uniform float uDiscR;
uniform vec3 uGlowDay;
uniform vec3 uGlowNight;
uniform vec3 uSunFace;
uniform vec3 uMoonFace;
uniform float uNight;
vec3 glowAt( vec3 d ) {
  float ang = acos( clamp( dot( d, uDisc ), -1.0, 1.0 ) );
  float n = length( d.xz );
  float dAz = n < 1e-5 ? 3.1416 : acos( clamp( dot( d.xz / n, normalize( uDisc.xz ) ), -1.0, 1.0 ) );
  float dEl = asin( clamp( d.y, -1.0, 1.0 ) ) - asin( clamp( uDisc.y, -1.0, 1.0 ) );
  float wide = exp( -dAz * dAz / 0.22 ) * exp( -dEl * dEl / 0.012 );
  return mix( uGlowDay, uGlowNight, uNight ) * ( 1.2 * exp( -ang / 0.045 ) + wide );
}
// the disc's share of a direction, and its face: the sun's white, or the moon's, darker toward its edge, with its seas faint and uneven, the large ones to the upper left
vec4 discAt( vec3 d ) {
  float ang = acos( clamp( dot( d, uDisc ), -1.0, 1.0 ) );
  float k = 1.0 - smoothstep( uDiscR * 0.9, uDiscR, ang );
  if ( k <= 0.0 ) return vec4( 0.0 );
  vec3 r = normalize( cross( vec3( 0.0, 1.0, 0.0 ), uDisc ) );
  vec3 u = cross( uDisc, r );
  vec2 q = vec2( dot( d, r ), dot( d, u ) ) / sin( uDiscR );
  float limb = 1.0 - 0.2 * ( 1.0 - sqrt( max( 0.0, 1.0 - dot( q, q ) ) ) );
  float seas = 1.0
    - 0.09 * smoothstep( 0.55, 0.0, length( ( q - vec2( -0.42, 0.02 ) ) * vec2( 0.8, 1.2 ) ) )
    - 0.08 * smoothstep( 0.34, 0.0, length( q - vec2( -0.14, 0.4 ) ) )
    - 0.07 * smoothstep( 0.3, 0.0, length( q - vec2( 0.24, 0.16 ) ) )
    - 0.06 * smoothstep( 0.18, 0.0, length( q - vec2( 0.6, 0.18 ) ) );
  return vec4( mix( uSunFace, uMoonFace * limb * seas, uNight ), k );
}
`;

/* the sky's lights' uniforms, one set shared by the sky and the sea */
function lightUniforms(night: { value: number }, disc: { value: Vector3 }) {
  return {
    uDisc: disc,
    uDiscR: { value: DISC_R },
    uGlowDay: { value: new Color(LIGHTS.sunGlow[0]).multiplyScalar(LIGHTS.sunGlow[1]) },
    uGlowNight: { value: new Color(LIGHTS.moonGlow[0]).multiplyScalar(LIGHTS.moonGlow[1]) },
    uSunFace: { value: new Color(LIGHTS.sun) },
    uMoonFace: { value: new Color(LIGHTS.moon) },
    uNight: night,
  };
}

function skyMaterial(night: { value: number }, disc: { value: Vector3 }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color() },
      uSky: { value: new Color() },
      uHaze: { value: new Color() },
      ...lightUniforms(night, disc),
    },
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
      ${LIGHT}
      void main() {
        vec3 d = normalize( vDir );
        // the haze at the horizon, the sky over it, the zenith; under the horizon the haze the sea fades into.
        // A low camera sees a few degrees of sky, so the sky comes in close over the haze
        vec3 c = mix( uHaze, uSky, smoothstep( -0.01, 0.12, d.y ) );
        c = mix( c, uZenith, smoothstep( 0.12, 0.8, d.y ) );
        // the sun or the moon, and its glow on the haze
        c += glowAt( d );
        vec4 disc = discAt( d );
        c = mix( c, disc.rgb, disc.a );
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

function starMaterial(night: { value: number }, disc: { value: Vector3 }, top: { value: number }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: TIME,
      uDpr: { value: 1 },
      uNight: night,
      uColor: { value: new Color(STAR) },
      uRadius: { value: SKY_R * 0.96 },
      uDisc: disc,
      uDiscR: { value: DISC_R },
      uTop: top,
      uBand: { value: new Vector2(...STAR_BAND) },
      uCam: { value: new Vector3() },
      uDensity: { value: 1e-4 },
      uSkyBand: { value: new Vector2(...LIFT_BAND) },
    },
    vertexShader: /* glsl */ `
      attribute float aAz;
      attribute float aBelow;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aTwinkle;
      attribute float aPhase;
      uniform float uTime;
      uniform float uDpr;
      uniform float uNight;
      uniform float uRadius;
      uniform vec3 uDisc;
      uniform float uDiscR;
      uniform float uTop;
      uniform vec2 uBand;
      uniform vec3 uCam;
      uniform float uDensity;
      uniform vec2 uSkyBand;
      varying float vAlpha;
      void main() {
        // its bearing fixed in the world, its height a fixed angle under the frame's top edge
        float e = uTop - aBelow;
        vec3 d = vec3( sin( aAz ) * cos( e ), sin( e ), cos( aAz ) * cos( e ) );
        gl_Position = projectionMatrix * viewMatrix * vec4( uCam + d * uRadius, 1.0 );
        gl_PointSize = aSize * uDpr;
        // where it would stand over the sea, the sea's fog there: none over the clouds
        float f = 1.0;
        if ( d.y < 0.0 ) {
          float t = ( ${SEA_Y.toFixed(1)} - uCam.y ) / d.y;
          vec3 hit = uCam + d * t;
          f = 1.0 - exp( -t * t * uDensity * uDensity );
          f = max( f, smoothstep( ${(SEA_R * 0.62).toFixed(1)}, ${(SEA_R * 0.9).toFixed(1)}, length( hit.xz - uCam.xz ) ) );
        }
        // none in front of the moon, and fewer in its glow
        float fromDisc = acos( clamp( dot( d, uDisc ), -1.0, 1.0 ) );
        // the few that twinkle, slowly and a little
        float twinkle = 1.0 - 0.18 * aTwinkle * ( 0.5 + 0.5 * sin( uTime * 0.5 + aPhase * 6.2832 ) );
        // when the frame shows the horizon, none under it
        float over = mix( 1.0, smoothstep( -0.004, 0.012, d.y ), smoothstep( uSkyBand.x, uSkyBand.y, uTop ) );
        vAlpha = aAlpha * twinkle * uNight * over * ( 1.0 - smoothstep( uBand.x, uBand.y, aBelow ) ) * smoothstep( 0.9, 1.0, f ) * smoothstep( uDiscR * 1.2, uDiscR * 4.0, fromDisc );
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float a = smoothstep( 0.5, 0.18, length( gl_PointCoord - 0.5 ) ) * vAlpha;
        if ( a < 0.01 ) discard;
        gl_FragColor = vec4( uColor, a );
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/* the stars: all round, each on a bearing and at an angle under the frame's top edge, in the band, and each a magnitude, which sets its size and light; the brightest few twinkle */
function starGeometry(): BufferGeometry {
  const roll = diceOf("stars");
  const az: number[] = [];
  const below: number[] = [];
  const size: number[] = [];
  const alpha: number[] = [];
  const twinkle: number[] = [];
  const phase: number[] = [];
  for (let i = 0; i < STARS; i++) {
    az.push(roll() * Math.PI * 2);
    below.push(((0.3 + roll() * 5) * Math.PI) / 180);
    // magnitude 0 to 4, most of them faint; its light, as a star's is, 10^(-0.4 m)
    const m = 4 * Math.sqrt(roll());
    const light = Math.pow(10, -0.4 * m);
    size.push(1 + 1.8 * Math.sqrt(light));
    alpha.push(0.24 + 0.7 * Math.pow(light, 0.35));
    twinkle.push(light > 0.3 ? 1 : 0);
    phase.push(roll());
  }
  const g = new BufferGeometry();
  // the positions are worked out in the shader; three wants one to count the points by
  g.setAttribute("position", new Float32BufferAttribute(new Float32Array(STARS * 3), 3));
  g.setAttribute("aAz", new Float32BufferAttribute(az, 1));
  g.setAttribute("aBelow", new Float32BufferAttribute(below, 1));
  g.setAttribute("aSize", new Float32BufferAttribute(size, 1));
  g.setAttribute("aAlpha", new Float32BufferAttribute(alpha, 1));
  g.setAttribute("aTwinkle", new Float32BufferAttribute(twinkle, 1));
  g.setAttribute("aPhase", new Float32BufferAttribute(phase, 1));
  return g;
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

function seaMaterial(tile: Texture | null, night: { value: number }, disc: { value: Vector3 }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...lightUniforms(night, disc),
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
      ${LIGHT}
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
        vec2 drift = vec2( ${DRIFT[0].toFixed(1)}, ${DRIFT[1].toFixed(1)} ) * uTime;
        // two reads of the tile: the second smaller, turned and slower, mixed by a noise wider than both
        vec2 a = ( p + drift ) / ${TILE.toFixed(1)};
        vec2 b = mat2( 0.799, 0.602, -0.602, 0.799 ) * ( p + drift * 0.55 ) / ${(TILE * 0.61).toFixed(1)} + vec2( 0.37, 0.71 );
        // a narrow blend, so most of the sea reads one sample at full contrast
        // the blend drifts with the clouds, so no still seam shows under them
        float m = smoothstep( 0.42, 0.58, noise( ( p + drift * 0.8 ) / ${(TILE * 1.7).toFixed(1)} + 5.3 ) );
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
        // the sun or the moon over the far fog, as the sky shows it, and none of it where the clouds show through
        vec3 v = normalize( vWorld - uCam );
        c += glowAt( v ) * f;
        vec4 disc = discAt( v );
        c = mix( c, disc.rgb, disc.a * smoothstep( 0.8, 1.0, f ) );
        gl_FragColor = vec4( c, 1.0 );
        #include <colorspace_fragment>
        // the same grain as the sky's, after the color space
        gl_FragColor.rgb += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      }`,
    depthWrite: false,
  });
}

/* the far ranges: real Himalayan and Karakoram massifs (SRTM heights, public domain, from AWS Terrain Tiles; see
   scripts/city3d-peaks.mts), one to a range, round the column: each on a bearing from the city's middle (degrees clockwise
   from the home view's forward, -z), at a distance, with the real height the cloud sea stands at for it. K2 stands whole in
   the home view's frame, right of the city and clear of the map key and the sun; the others show as the camera turns */
const PEAKS: PeaksBakeRange[] = [
  { at: 12, r: 8600, cloud: 6300 },
  { at: 70, r: 7200, cloud: 6600 },
  { at: 125, r: 7600, cloud: 6400 },
  { at: 180, r: 7300, cloud: 6400 },
  { at: -105, r: 6800, cloud: 5200 },
  { at: -150, r: 7800, cloud: 6500 },
];
/** the heights' atlas (a cell of 368 x 276 samples 30 m apart to a range, stacked), and a cell's rows */
const PEAK_DEM = "/images/city3d/peaks-dem.webp";
const PEAK_ROWS = 276;
/** how the bake shapes them (peaks-bake.ts): world units to a metre, the samples' spacing, the textures at twice their grid and
    the mesh at every other sample; some of the survey's detail taken back, the summits sharpened against the flanks and the
    relief lifted a quarter, most of the steep faces' own bumps smoothed, a sharp penumbra, and the snow's offset, which leaves
    about two thirds of each upper massif under snow and the rock in ribs down its steep faces */
const PEAK_SHAPE: PeaksBakeShape = { scale: 0.36, step: 30, up: 2, stride: 2, sharpen: 0.8, sigma: 2, relief: 1.6, lift: 1.25, smoothFaces: 0.85, hard: 40, snow: 0.3 };
/** each range's key: low, from the sun's side of the range (Lighting.tsx), this far off its line from the city's middle, so it
    rakes the faces the camera sees rather than lighting them flat from behind the camera or leaving them all in shade */
const PEAK_KEY = { off: 100, up: 22 };
/** the ranges' look by theme: the snow's and the rock's albedo, the key's color at its strength (warm by day, the moon's cool
    by night) and the sky's, so the lit snow is a warm white and its shade a clear blue; and the air's color with distance */
const PEAK_LOOK: Record<Theme, { snow: string; rock: string; key: [string, number]; sky: [string, number]; air: string }> = {
  light: { snow: "#F6F8FC", rock: "#4E463F", key: ["#FFE0B8", 1.6], sky: ["#8DAAE0", 1.05], air: "#C3D0E3" },
  dark: { snow: "#F6F8FC", rock: "#4E463F", key: ["#B8C6E6", 0.42], sky: ["#2E3F66", 0.16], air: "#1B2640" },
};
/** the air they stand in: how much of its color a massif takes, near and far by the camera's distance, so the nearest stands
    crisp and the farthest bluer and paler; and how much of the sea's fog they shed over their foot, from where to where */
const PEAK_AIR = { near: 0.04, far: 0.16, from: 8500, to: 13500, shed: 0.8, over: [60, 400] };
/** Owen's rock tile (a seamless grey alpine face, cliffs upright), laid along each range and up its height, this many world units
    to a tile: a bump for the closest camera, full on the rock and faint on the snow, gone between these distances */
const PEAK_SRC = "/images/city3d/peaks.webp";
const PEAK_TILE = 600;
const PEAK_BUMP = 3;
const PEAK_NEAR = [6500, 9500];
/** the rise out of the cloud sea in the opening, as the column rises: how deep they start, how long each takes, and the stagger between them */
const PEAK_RISE = { depth: 1300, ms: 1300, stagger: 60 };
const PEAK_DETAIL_MS = 1200;

/* the brand's ease, cubic-bezier(0.16, 1, 0.3, 1), solved for the curve's x */
function brandEase(x: number): number {
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

/* a worker the bake runs in: the heights' image decoded exactly (no color conversion), then peaks-bake.ts's bakePeaks, whose
   own source it carries; what it makes comes back as transferred buffers */
function peaksWorker(): Worker {
  const src = `const bakePeaks = ${bakePeaks.toString()};
self.onmessage = async (e) => {
  try {
    const { blob, ...rest } = e.data;
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const out = bakePeaks({ rgba: g.getImageData(0, 0, bmp.width, bmp.height).data, width: bmp.width, ...rest });
    self.postMessage(out, out.cells.flatMap((m) => [m.position.buffer, m.uv.buffer, m.along.buffer, m.index.buffer, m.light.buffer, m.sky.buffer]));
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};`;
  return new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
}

/* unless ?peaks=0, the bake starts as this module loads, alongside the city's own data, so it is done before the scene can show:
   the heights come down once, and a few workers (one to two cores, three at most) share the ranges. The canvas never waits
   for it */
const PEAKS_ON = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("peaks") !== "0";
/** each range's key light (PEAK_KEY), toward the light */
const PEAK_KEYS: [number, number, number][] = PEAKS.map(({ at }) => {
  const sun = MathUtils.radToDeg(Math.atan2(SUN.x, -SUN.z));
  const side = MathUtils.euclideanModulo(sun - at + 180, 360) - 180 < 0 ? -1 : 1;
  const b = MathUtils.degToRad(at + side * PEAK_KEY.off);
  const e = MathUtils.degToRad(PEAK_KEY.up);
  return [Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)];
});
const PEAKS_BAKE: Promise<PeaksBakeOutput | null> | null = PEAKS_ON
  ? fetch(PEAK_DEM)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`heights ${res.status}`))))
      .then((blob) => {
        const t0 = performance.now();
        const n = Math.max(1, Math.min(3, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
        const jobs = Array.from({ length: n }, (_, w) => PEAKS.map((_, k) => k).filter((k) => k % n === w));
        const one = (cells: number[]) =>
          new Promise<PeaksBakeOutput>((done, fail) => {
            const w = peaksWorker();
            w.onmessage = (e: MessageEvent<PeaksBakeOutput | { error: string }>) => {
              w.terminate();
              if ("error" in e.data) fail(new Error(e.data.error));
              else done(e.data);
            };
            w.onerror = (e) => {
              w.terminate();
              fail(e);
            };
            w.postMessage({ blob, rows: PEAK_ROWS, cells, ranges: PEAKS, seaY: SEA_Y, keys: PEAK_KEYS, ...PEAK_SHAPE });
          });
        return Promise.all(jobs.map(one)).then((outs) => ({ cells: outs.flatMap((o) => o.cells).sort((a, b) => a.k - b.k), ms: performance.now() - t0 }));
      })
      .catch(() => null)
  : null;

/* the ranges' look, from the bake: the fine normal against the range's own key, the key's baked shadow, and the sky's reach.
   Shade = albedo x (key x shadow x N.L + sky x reach): a warm white where the key falls, a clear blue in its shade, the rock
   dark and banded by height. The snow lies where the bake's score is over its middle, its edge a pixel wide at any distance,
   so its streaks down the faces stay crisp. The closest camera takes Owen's rock tile as a bump. At the foot the clouds' own
   tone, then the air, bluer and paler with distance, and the sea's fog: whole at the foot, so each shore meets the sea as the
   sea shows there, and mostly shed above it. The finish's shading (N8AO, a reach of 5 units at half resolution) adds nothing
   at their distance, and the night bloom's key sits over the moonlit snow: their depth is the bake's. The rise lifts each
   range from under the cloud tops, under which nothing draws. The uniforms all six share, then each range's own material */
function peaksLook(sea: ShaderMaterial, night: { value: number }, disc: { value: Vector3 }, tile: Texture) {
  const u = sea.uniforms;
  return {
    ...lightUniforms(night, disc),
    uCam: u.uCam,
    uHaze: u.uHaze,
    uMean: u.uMean,
    uSat: u.uSat,
    uTint: u.uTint,
    uLift: u.uLift,
    uDensity: u.uDensity,
    uSnow: { value: new Color() },
    uRockAlbedo: { value: new Color() },
    uKeyLight: { value: new Color() },
    uSkyLight: { value: new Color() },
    uAir: { value: new Color() },
    uRock: { value: tile },
    uDetail: { value: 0 },
    uRiseDepth: { value: PEAK_RISE.depth },
  };
}
type PeaksLook = ReturnType<typeof peaksLook>;
function peakMaterial(look: PeaksLook, cell: PeaksBakeCell): ShaderMaterial {
  const b = MathUtils.degToRad(PEAKS[cell.k].at);
  const tex = (data: Uint8Array, red: boolean) => {
    const t = red ? new DataTexture(data, cell.width, cell.height, RedFormat) : new DataTexture(data, cell.width, cell.height);
    t.magFilter = LinearFilter;
    t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  return new ShaderMaterial({
    uniforms: {
      ...look,
      uKey: { value: new Vector3(...PEAK_KEYS[cell.k]) },
      uRight: { value: new Vector3(Math.cos(b), 0, Math.sin(b)) },
      uLight: { value: tex(cell.light, false) },
      uSky: { value: tex(cell.sky, true) },
      uRise: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlong;
      uniform float uRise;
      uniform float uRiseDepth;
      varying vec3 vWorld;
      varying vec2 vUv;
      varying float vAlong;
      void main() {
        vec3 p = position;
        p.y -= uRiseDepth * ( 1.0 - uRise );
        vec4 w = modelMatrix * vec4( p, 1.0 );
        vWorld = w.xyz;
        vUv = uv;
        vAlong = aAlong;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam;
      uniform vec3 uHaze;
      uniform vec3 uMean;
      uniform float uSat;
      uniform float uTint;
      uniform float uLift;
      uniform float uDensity;
      uniform vec3 uKey;
      uniform vec3 uRight;
      uniform vec3 uSnow;
      uniform vec3 uRockAlbedo;
      uniform vec3 uKeyLight;
      uniform vec3 uSkyLight;
      uniform vec3 uAir;
      uniform sampler2D uLight;
      uniform sampler2D uSky;
      uniform sampler2D uRock;
      uniform float uDetail;
      varying vec3 vWorld;
      varying vec2 vUv;
      varying float vAlong;
      ${HASH}
      ${LIGHT}
      float grainOf( vec2 p ) {
        return dot( texture2D( uRock, p ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
      }
      void main() {
        if ( vWorld.y < ${SEA_Y.toFixed(1)} ) discard;
        vec4 L = texture2D( uLight, vUv );
        float reach = texture2D( uSky, vUv ).r;
        vec2 q = L.rg * 2.0 - 1.0;
        vec3 n = vec3( q.x, sqrt( max( 0.0, 1.0 - dot( q, q ) ) ), q.y );
        // the snow where the score is over its middle, its edge a pixel wide at any distance
        float e = max( fwidth( L.a ), 1.0 / 255.0 );
        float snow = smoothstep( 0.5 - e, 0.5 + e, L.a );
        // the closest camera: Owen's rock tile as a bump along the range and up its height, full on the rock, faint on the snow
        float d = distance( vWorld, uCam );
        float near = uDetail * ( 1.0 - smoothstep( ${PEAK_NEAR[0].toFixed(1)}, ${PEAK_NEAR[1].toFixed(1)}, d ) );
        if ( near > 0.0 ) {
          vec2 t = vec2( vAlong, vWorld.y ) / ${PEAK_TILE.toFixed(1)};
          float g0 = grainOf( t );
          vec2 g = vec2( grainOf( t + vec2( 1.0 / 512.0, 0.0 ) ) - g0, grainOf( t + vec2( 0.0, 1.0 / 512.0 ) ) - g0 );
          g *= near * mix( ${PEAK_BUMP.toFixed(1)}, ${(PEAK_BUMP * 0.25).toFixed(2)}, snow );
          n = normalize( n - g.x * uRight - vec3( 0.0, g.y, 0.0 ) );
        }
        float ndl = max( dot( n, uKey ), 0.0 );
        // the rock's strata: bands by height, broken along the range
        float band = 0.5 + 0.5 * sin( ( vWorld.y - ${SEA_Y.toFixed(1)} ) / 38.0 + sin( vAlong / 260.0 ) * 1.3 );
        vec3 albedo = mix( uRockAlbedo * ( 0.825 + 0.35 * band ), uSnow, snow );
        vec3 c = albedo * ( uKeyLight * L.b * ndl + uSkyLight * reach );
        // the foot in the clouds' own tone
        vec3 mean = mix( vec3( dot( uMean, vec3( 0.2126, 0.7152, 0.0722 ) ) ), uMean, uSat ) * uTint;
        mean = mix( mean, uHaze, uLift );
        float foot = 1.0 - smoothstep( ${SEA_Y.toFixed(1)}, ${(SEA_Y + 260).toFixed(1)}, vWorld.y );
        c = mix( c, mean, foot * foot * ( 3.0 - 2.0 * foot ) );
        // the air, bluer and paler with distance; then the sea's fog, whole at the foot and mostly shed above it
        c = mix( c, uAir, mix( ${PEAK_AIR.near.toFixed(2)}, ${PEAK_AIR.far.toFixed(2)}, smoothstep( ${PEAK_AIR.from.toFixed(1)}, ${PEAK_AIR.to.toFixed(1)}, d ) ) );
        float f = 1.0 - exp( -d * d * uDensity * uDensity );
        float shore = max( f, smoothstep( ${(SEA_R * 0.62).toFixed(1)}, ${(SEA_R * 0.9).toFixed(1)}, distance( vWorld.xz, uCam.xz ) ) );
        f = mix( shore, f * ${(1 - PEAK_AIR.shed).toFixed(2)}, smoothstep( ${(SEA_Y + PEAK_AIR.over[0]).toFixed(1)}, ${(SEA_Y + PEAK_AIR.over[1]).toFixed(1)}, vWorld.y ) );
        c = mix( c, uHaze, f );
        c += glowAt( normalize( vWorld - uCam ) ) * f;
        gl_FragColor = vec4( c, 1.0 );
        #include <colorspace_fragment>
        gl_FragColor.rgb += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      }`,
    side: DoubleSide,
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
  ranges = true,
  snow = false,
}: {
  theme: Theme;
  /** when the city stands, on the city's clock: the image loads after it */
  liveAt: number;
  still: boolean;
  /** the far ranges draw: the high tier's alone, as the finish is (City3D) */
  ranges?: boolean;
  /** a sparse, slow fall of fine snow across the city; never for a reader who asks for less motion */
  snow?: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const painted = useMemo(() => paintedTile(), []);
  // how far the sky's lights stand toward the night's: the sun at 0, the moon and the stars at 1
  const night = useMemo(() => ({ value: theme === "dark" ? 1 : 0 }), []);
  // the sun's or the moon's direction, and the frame's top edge's height, both worked out each frame from the camera
  const disc = useMemo(() => ({ value: new Vector3(0, 0, -1) }), []);
  const top = useMemo(() => ({ value: 0 }), []);
  const parts = useMemo(() => {
    const sky = new Mesh(new SphereGeometry(SKY_R, 64, 32), skyMaterial(night, disc));
    const stars = new Points(starGeometry(), starMaterial(night, disc, top));
    const flakes = new Points(snowGeometry(), snowMaterial());
    const sea = new Mesh(new CircleGeometry(SEA_R, 96).rotateX(-Math.PI / 2), seaMaterial(painted, night, disc));
    // the sky first, under everything; the sea next; the stars and the snow with the other clear things, the stars behind all of it
    sky.renderOrder = -20;
    sea.renderOrder = -19;
    stars.renderOrder = -18;
    flakes.renderOrder = 5;
    for (const o of [sky, stars, flakes, sea]) o.frustumCulled = false;
    return { sky, stars, flakes, sea };
  }, [painted, night, disc, top]);
  useEffect(
    () => () => {
      for (const o of [parts.sky, parts.stars, parts.flakes, parts.sea]) {
        o.geometry.dispose();
        (o.material as ShaderMaterial).dispose();
      }
    },
    [parts],
  );
  useEffect(() => () => painted?.dispose(), [painted]);
  // the far ranges, on the high tier unless ?peaks=0; the uniforms they share, read as the scene mounts
  const look = useMemo(
    () => (PEAKS_ON && ranges ? peaksLook(parts.sea.material as ShaderMaterial, night, disc, whiteTile()) : null),
    [parts, night, disc, ranges],
  );
  const [peaks, setPeaks] = useState<Mesh[] | null>(null);
  const peakRise = useRef<{ at: number | null; from: number | null; hurry: number | null; asked: boolean; detail: number | null; stood: boolean }>({ at: null, from: null, hurry: null, asked: false, detail: null, stood: false });
  /* the bake's result, from the workers the module started: each range's mesh, its light's textures and its own material; the
     rise waits until the warm-up has drawn them all. The bake's time lands in peaksBakeMs, for the load checks */
  useEffect(() => {
    if (!look || !PEAKS_BAKE) return;
    let live = true;
    void PEAKS_BAKE.then((o) => {
      if (!live || !o) return;
      const drawn = new Set<number>();
      const meshes = o.cells.map((cell) => {
        const g = new BufferGeometry();
        g.setAttribute("position", new Float32BufferAttribute(cell.position, 3));
        g.setAttribute("uv", new Float32BufferAttribute(cell.uv, 2));
        g.setAttribute("aAlong", new Float32BufferAttribute(cell.along, 1));
        g.setIndex(new Uint16BufferAttribute(cell.index, 1));
        const m = new Mesh(g, peakMaterial(look, cell));
        // after the sea, before the stars, which they hide; drawn in every view (the rise sinks them past their bounds), so each
        // takes its textures up in the opening, not as the camera first turns to it
        m.renderOrder = -18.5;
        m.frustumCulled = false;
        m.onAfterRender = () => {
          if (drawn.has(cell.k)) return;
          drawn.add(cell.k);
          if (drawn.size === o.cells.length) {
            peakRise.current.at = performance.now();
            invalidate();
          }
        };
        return m;
      });
      (window as unknown as { peaksBakeMs?: number }).peaksBakeMs = Math.round(o.ms);
      setPeaks(meshes);
      invalidate();
    });
    return () => {
      live = false;
    };
  }, [look, invalidate]);
  useEffect(() => () => (look?.uRock.value as Texture | undefined)?.dispose(), [look]);
  useEffect(
    () => () => {
      for (const m of peaks ?? []) {
        const u = (m.material as ShaderMaterial).uniforms;
        (u.uLight.value as Texture).dispose();
        (u.uSky.value as Texture).dispose();
        (m.material as ShaderMaterial).dispose();
        m.geometry.dispose();
      }
    },
    [peaks],
  );
  useEffect(() => {
    if (!look) return;
    const k = PEAK_LOOK[theme];
    look.uSnow.value.set(k.snow);
    look.uRockAlbedo.value.set(k.rock);
    look.uKeyLight.value.set(k.key[0]).multiplyScalar(k.key[1]);
    look.uSkyLight.value.set(k.sky[0]).multiplyScalar(k.sky[1]);
    look.uAir.value.set(k.air);
    invalidate();
  }, [look, theme, invalidate]);
  /* the rise: each range out of the cloud sea as the column rises, on the brand's curve, a stagger apart, landing just after
     it; a return and a reader who asks for less motion see them in place. The rock tile loads once the sea's clouds are in */
  useEffect(() => {
    if (!look) return;
    if (still || OPENING.returning) peakRise.current.stood = true;
    return onCityStood(() => {
      peakRise.current.stood = true;
      invalidate();
    });
  }, [look, still, invalidate]);

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
    (parts.stars.material as ShaderMaterial).uniforms.uDensity.value = k.fog;
    const f = (parts.flakes.material as ShaderMaterial).uniforms;
    f.uColor.value.set(k.flake);
    f.uAlpha.value = k.flakeA;
    // for a reader who asks for less motion the sky's lights change at once
    if (still) night.value = theme === "dark" ? 1 : 0;
    invalidate();
  }, [theme, parts, night, still, invalidate]);

  /* the images: each theme's loads once and fades in over what the sea shows once the city stands; the theme's own loads
     as the city mounts, a bitmap decoded off the main thread and on the GPU in its own task (tile.ts), so no frame waits on it */
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
    // a reader who asks for less motion, and a return to the page, which opens standing and lit, take the image at once
    if (still || OPENING.returning) {
      u.uMap.value = t;
      fade.current = null;
      invalidate();
      return;
    }
    fade.current = { from: performance.now() };
  };
  const request = (t: Theme, showIt = true) => {
    const have = images.current.get(t);
    if (have === "missing" || have === "loading") return;
    if (have) return showIt ? show(have) : undefined;
    images.current.set(t, "loading");
    // no image: the painted tile stays; a frame after the city stands shows the one that came
    void loadTile(gl, SRC[t], 4).then((tex) => {
      images.current.set(t, tex ?? "missing");
      invalidate();
    });
  };
  useEffect(() => request(theme, false));
  // the other theme's image comes up in an idle slot once the city stands, so a flip uploads nothing
  useEffect(() => {
    let idle = 0;
    const off = onCityStood(() => {
      const other = () => request(want.current === "dark" ? "light" : "dark", false);
      idle = window.requestIdleCallback ? window.requestIdleCallback(other, { timeout: 4000 }) : window.setTimeout(other, 1000);
    });
    return () => {
      off();
      if (idle) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const kept = images.current;
    return () => kept.forEach((t) => typeof t !== "string" && t.dispose());
  }, []);

  const edge = useMemo(() => new Vector3(), []);
  const aim = useMemo(() => ({ fwd: new Vector3(), band: new Vector3(), key: new Vector3(), at: new Vector3(), slide: 1 }), []);
  // the app's cards over the canvas, in its CSS pixels, read twice a second: the sun and the moon keep clear of them
  const cards = useRef<[number, number, number, number][]>([]);
  useEffect(() => {
    const read = () => {
      const c = gl.domElement;
      const root = c.closest("[data-city-app]");
      if (!root) return;
      const r0 = c.getBoundingClientRect();
      const out: [number, number, number, number][] = [];
      root.querySelectorAll<HTMLElement>("[data-city-chrome], [data-city-hud]").forEach((el) => {
        if (el.closest("[aria-hidden='true']")) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).opacity === "0") return;
        out.push([r.left - r0.left, r.top - r0.top, r.right - r0.left, r.bottom - r0.top]);
      });
      cards.current = out;
    };
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, [gl]);
  useFrame((state, dt) => {
    // the canvas's CSS size as R3F keeps it (its resize observer): a read of the canvas's own size here would lay the page out mid-frame
    const { width: w, height: h } = state.size;
    parts.sky.position.copy(camera.position);
    /* the frame's top edge in the middle of the frame, as the lens and the rig's shift of it for the app's panels show it; the sun or the moon
       a fixed angle under it, on its bearing, and lifted over the horizon as the frame comes to show it */
    edge.set(0, 1, 0.5).unproject(camera).sub(camera.position).normalize();
    top.value = Math.asin(Math.max(-1, Math.min(1, edge.y)));
    const under = top.value - DISC_BELOW;
    const lift = MathUtils.smoothstep(top.value, LIFT_BAND[0], LIFT_BAND[1]);
    const e = under + (Math.max(under, Math.min(DISC_LIFT, top.value - LIFT_ROOM)) - under) * lift;
    /* on the key light's line: from the plate's middle on screen through the key's point on the horizon, to the band's height straight ahead,
       then slid back toward the plate as far as the app's cards ask, eased, so it never jumps, and once the city stands kept inside the frame's
       edges. Where the point is behind the eye, or under the plate, the disc goes behind the eye */
    camera.getWorldDirection(aim.fwd).setY(0).normalize();
    aim.band.set(aim.fwd.x * Math.cos(e), Math.sin(e), aim.fwd.z * Math.cos(e)).multiplyScalar(1000).add(camera.position).project(camera);
    aim.key.copy(KEY_XZ).multiplyScalar(1e5).add(camera.position).project(camera);
    aim.at.set(0, -RISE_DEPTH * (1 - OPENING.column.value), 0).project(camera);
    if (KEY_XZ.dot(aim.fwd) > 0.05 && aim.key.y > aim.at.y + 0.02) {
      const s = (aim.band.y - aim.at.y) / (aim.key.y - aim.at.y);
      const nx = s * (aim.key.x - aim.at.x);
      const ny = aim.band.y - aim.at.y;
      const r = (Math.tan(DISC_R) / Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360)) * (h / 2) + CLEAR_PX;
      const cxOf = (t: number) => ((aim.at.x + nx * t + 1) / 2) * w;
      const cyOf = (t: number) => ((1 - aim.at.y - ny * t) / 2) * h;
      // once the column stands, the frame's edges keep it in as the cards keep it off, so a pane that shifts the city (the answer, the live pane) cannot push it out of the frame; through the opening it enters with the push
      const edges = OPENING.column.value >= 1;
      const out = (t: number) => edges && (cxOf(t) < r || cxOf(t) > w - r || cyOf(t) < r);
      const crowded = (t: number) => {
        if (out(t)) return true;
        const cx = cxOf(t);
        const cy = cyOf(t);
        return cards.current.some(([l, tp, rt, b]) => Math.hypot(cx - Math.max(l, Math.min(cx, rt)), cy - Math.max(tp, Math.min(cy, b))) < r);
      };
      let t = 1;
      while (t > SLIDE_MIN && crowded(t)) t -= 0.01;
      aim.slide += (t - aim.slide) * Math.min(1, dt * 8);
      // the edges hold at once, not eased: as a pane's shift of the lens eases in, the disc goes with the frame and never leaves it
      while (aim.slide > SLIDE_MIN && out(aim.slide)) aim.slide -= 0.01;
      disc.value.set(aim.at.x + nx * aim.slide, aim.at.y + ny * aim.slide, 0.5).unproject(camera).sub(camera.position).normalize();
    } else disc.value.set(-aim.fwd.x, 0, -aim.fwd.z);
    (parts.stars.material as ShaderMaterial).uniforms.uCam.value.copy(camera.position);
    parts.sea.position.set(camera.position.x, SEA_Y, camera.position.z);
    // the sky's lights cross-fade to the theme's
    const to = want.current === "dark" ? 1 : 0;
    if (night.value !== to) {
      night.value += (to - night.value) * Math.min(1, dt * FADE_RATE);
      if (Math.abs(to - night.value) < 0.002) night.value = to;
      invalidate();
    }
    parts.stars.visible = night.value > 0.01;
    (parts.stars.material as ShaderMaterial).uniforms.uDpr.value = gl.getPixelRatio();
    // the flakes keep their size in CSS pixels as the pixel ratio steps, and as the lens is set
    const fu = (parts.flakes.material as ShaderMaterial).uniforms;
    fu.uDpr.value = gl.getPixelRatio();
    fu.uFocal.value = h / 2 / Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360);
    const u = (parts.sea.material as ShaderMaterial).uniforms;
    u.uCam.value.copy(camera.position);
    // the plate's shadow comes out from under it as the column rises
    shadowAt(-RISE_DEPTH * (1 - OPENING.column.value), u.uShadow.value);
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
    // the ranges rise with the column; the rock tile loads once the sea's image is in (or 3 s after the city stands)
    if (look) {
      const pk = peakRise.current;
      const now = performance.now();
      if (peaks) {
        const set = (m: Mesh, v: number) => {
          const r = (m.material as ShaderMaterial).uniforms.uRise;
          if (r.value === v) return;
          r.value = v;
          invalidate();
        };
        if (still || OPENING.returning || (pk.stood && pk.from === null)) for (const m of peaks) set(m, 1);
        else {
          // the rise starts with the column's, or once the warm-up has drawn every range if that is later
          if (pk.from === null && OPENING.column.value > 0) pk.from = now;
          if (pk.from !== null && pk.at !== null && pk.at > pk.from) pk.from = pk.at;
          const from = pk.at === null ? null : pk.from;
          if (pk.hurry === null && from !== null && OPENING.column.value >= 1 && now - from < PEAK_RISE.ms + PEAK_RISE.stagger * PEAKS.length) pk.hurry = now;
          peaks.forEach((m, k) => {
            let v = from === null ? 0 : brandEase((now - from - PEAK_RISE.stagger * k) / PEAK_RISE.ms);
            // the reader asked for something: what is left of the rise goes in 300 ms, as the column's does
            if (pk.hurry !== null) v = Math.max(v, Math.min(1, (now - pk.hurry) / 300));
            set(m, v);
          });
        }
      }
      if (pk.stood && !pk.asked && ((!fade.current && shown.current) || still || OPENING.returning)) {
        pk.asked = true;
        void loadTile(gl, PEAK_SRC, 4).then((tex) => {
          if (!tex) return;
          (look.uRock.value as Texture).dispose();
          look.uRock.value = tex;
          pk.detail = performance.now();
          invalidate();
        });
      }
      if (pk.detail !== null && look.uDetail.value < 1) {
        look.uDetail.value = Math.min(1, (now - pk.detail) / PEAK_DETAIL_MS);
        invalidate();
      }
    }
  });

  return (
    <group>
      <primitive object={parts.sky} />
      <primitive object={parts.sea} />
      <primitive object={parts.stars} />
      {peaks?.map((m) => <primitive key={m.uuid} object={m} />)}
      {snow && !still && <primitive object={parts.flakes} />}
    </group>
  );
}
