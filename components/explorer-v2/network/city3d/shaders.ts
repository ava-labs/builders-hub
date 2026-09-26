import { AdditiveBlending, Color, MeshDepthMaterial, MeshLambertMaterial, MeshPhongMaterial, RGBADepthPacking, ShaderMaterial, type Texture, type WebGLProgramParametersWithUniforms } from "three";

/* The city's materials: the map's white massing, its glass and its ground,
   each a stock three.js material with a few lines of its own. One clock
   (TIME, in seconds since the city's data came in) drives them all: the
   build-out raises each building from its lot at its turn, the windows
   come on in a wave out from downtown once the city stands, and a set's
   transactions flash its floors. A building's parts share one turn, so
   the massing, its glass and its shadow rise as one. */

/** the city's clock, in seconds since its plan came in; every material reads it */
export const TIME = { value: 0 };
/** how long one building takes to rise, in seconds */
export const RISE_S = 0.7;

type Shader = WebGLProgramParametersWithUniforms;

/** the brand's ease, fast attack and long decay (cubic-bezier(0.16, 1, 0.3, 1) as an exponential), for the shaders' curves */
export const EASE_GLSL = /* glsl */ `
float brandEase( float t ) { return t >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * t ); }
`;

/* the build-out: a vertex's height eases up from under the ground at its building's turn */
const RISE_PARS = /* glsl */ `
uniform float uTime;
#ifdef RISE_ATTR
attribute float aRise;
#else
uniform float uRiseAt;
#endif
float riseOf() {
  #ifdef RISE_ATTR
  float t0 = aRise;
  #else
  float t0 = uRiseAt;
  #endif
  float t = clamp((uTime - t0) / ${RISE_S.toFixed(2)}, 0.0, 1.0);
  return t >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * t );
}
`;
const RISE_PROJECT = /* glsl */ `
vec4 riseWorld = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
riseWorld = instanceMatrix * riseWorld;
#endif
riseWorld.y = mix( -0.6, riseWorld.y, riseOf() );
vec4 mvPosition = modelViewMatrix * riseWorld;
gl_Position = projectionMatrix * mvPosition;
`;
const RISE_WORLDPOS = /* glsl */ `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
vec4 worldPosition = modelMatrix * riseWorld;
#endif
`;

/* stands a material's vertices up with the build-out: by an instance's own turn, or the whole mesh's */
function riseVertex(s: Shader, perInstance: boolean) {
  s.uniforms.uTime = TIME;
  s.vertexShader = s.vertexShader
    .replace("#include <common>", `#include <common>\n${perInstance ? "#define RISE_ATTR\n" : ""}${RISE_PARS}`)
    .replace("#include <project_vertex>", RISE_PROJECT)
    .replace("#include <worldpos_vertex>", RISE_WORLDPOS);
}

/** the shadow a rising building casts: its depth, raised with it */
export function riseDepth(perInstance: boolean, riseAt?: { value: number }): MeshDepthMaterial {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.onBeforeCompile = (s) => {
    riseVertex(s, perInstance);
    if (riseAt) s.uniforms.uRiseAt = riseAt;
  };
  m.customProgramCacheKey = () => `city3d-depth-${perInstance ? "i" : "u"}`;
  return m;
}

/* a building that stands in front of the picked one veils, as the map's
   do at a sixth of their opacity. With multisampling its share of each
   pixel's samples is its opacity (alpha to coverage); without, a fine
   dither of its pixels. Either needs no sorting, and its shadow stays
   whole. aFade is the share it gives up, so a mesh that carries none
   stands whole */
const VEIL_VERTEX = /* glsl */ `
attribute float aFade;
varying float vVeil;
`;
const VEIL_FRAGMENT = /* glsl */ `
varying float vVeil;
`;
const VEIL_DISCARD = /* glsl */ `
#ifdef ALPHA_TO_COVERAGE
diffuseColor.a *= vVeil;
#else
if ( vVeil < 0.999 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) > vVeil ) discard;
#endif
`;
/* reads a veil, where a material draws instances that have one */
function veilOf(s: Shader) {
  s.vertexShader = s.vertexShader.replace("#include <common>", `#include <common>\n${VEIL_VERTEX}`).replace("#include <begin_vertex>", "#include <begin_vertex>\nvVeil = 1.0 - aFade;");
  s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>\n${VEIL_FRAGMENT}`).replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${VEIL_DISCARD}`);
}

/* the massing's foot darkens toward its lot, as a model's walls do where they meet the ground */
const FOOT_PARS = /* glsl */ `
varying float vFootY;
uniform float uFoot;
`;

/* a model's crisp edges: a hairline where two faces of a box meet, or round a
   drum's rims, a steel line by day and a lit one by night, never thinner on
   screen than most of a pixel. A face's size comes from its instance's scale */
const EDGE_VERTEX = /* glsl */ `
varying vec2 vEdgeUv;
varying vec2 vEdgeSize;
`;
const EDGE_BEGIN = /* glsl */ `
{
  vec3 sc = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
  vec3 an = abs( objectNormal );
  #ifdef MASS_RIMS
  vEdgeSize = an.y > 0.5 ? vec2( 1e4 ) : vec2( 1e4, sc.y );
  #else
  vEdgeSize = an.x > 0.5 ? sc.zy : an.y > 0.5 ? sc.xz : sc.xy;
  #endif
  vEdgeUv = uv * vEdgeSize;
}
`;
const EDGE_FRAGMENT = /* glsl */ `
varying vec2 vEdgeUv;
varying vec2 vEdgeSize;
uniform vec3 uEdgeColor;
uniform float uEdgeK;
uniform float uEdgeW;
`;
const EDGE_COLOR = /* glsl */ `
{
  vec2 dd = min( vEdgeUv, vEdgeSize - vEdgeUv );
  float de = min( dd.x, dd.y );
  float fe = fwidth( de );
  float w = max( uEdgeW, fe * 0.8 );
  float line = 1.0 - smoothstep( w - fe, w + fe, de );
  diffuseColor.rgb = mix( diffuseColor.rgb, uEdgeColor, line * uEdgeK );
}
`;

/** the edges' look, which the theme sets */
export const EDGE_U = { uEdgeColor: { value: new Color("#8C98A6") }, uEdgeK: { value: 0.35 }, uEdgeW: { value: 0.1 } };

/** the white massing: lit by the sun, darker at its foot, raised with the build-out; with `veil`, its instances may carry aFade; with `edges`, a box's or a drum's crisp edges */
export function massMaterial(opts: { perInstance?: boolean; riseAt?: { value: number }; foot?: number; key: string; veil?: boolean; edges?: "box" | "rims" }): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color: 0xffffff });
  const foot = { value: opts.foot ?? 0.8 };
  m.onBeforeCompile = (s) => {
    if (opts.veil) veilOf(s);
    riseVertex(s, opts.perInstance ?? true);
    if (opts.riseAt) s.uniforms.uRiseAt = opts.riseAt;
    s.uniforms.uFoot = foot;
    s.vertexShader = s.vertexShader.replace("#include <common>", `#include <common>\nvarying float vFootY;`).replace("gl_Position = projectionMatrix * mvPosition;", "gl_Position = projectionMatrix * mvPosition;\nvFootY = riseWorld.y;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\n${FOOT_PARS}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix( uFoot, 1.0, smoothstep( 1.0, 11.0, vFootY ) );");
    if (opts.edges) {
      Object.assign(s.uniforms, EDGE_U);
      s.vertexShader = s.vertexShader
        .replace("#include <common>", `#include <common>\n${opts.edges === "rims" ? "#define MASS_RIMS\n" : ""}${EDGE_VERTEX}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${EDGE_BEGIN}`);
      s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>\n${EDGE_FRAGMENT}`).replace("#include <emissivemap_fragment>", `${EDGE_COLOR}\n#include <emissivemap_fragment>`);
    }
  };
  m.customProgramCacheKey = () => `city3d-mass-${opts.key}${opts.veil ? "-veil" : ""}${opts.edges ? `-edges-${opts.edges}` : ""}`;
  m.userData.foot = foot;
  return m;
}

/** the glass's uniforms, which the theme and the city's state set */
export interface GlassUniforms {
  /** the glass before its colors come in */
  uPlain: { value: Color };
  /** the wall a faint window fades to */
  uWall: { value: Color };
  /** the curtain wall's own glass, which a district's hue tints, and its frame */
  uGlassBase: { value: Color };
  uFrame: { value: Color };
  /** the mullions' spacing and half-width, in the plan's units */
  uMull: { value: number };
  uMullW: { value: number };
  /** how much the glass lights itself: a little by day, a glow at night */
  uGlow: { value: number };
  uFlashColor: { value: Color };
  uFlashGlow: { value: number };
  /** the city moves: flashes run once it stands */
  uLive: { value: number };
}

export function glassUniforms(): GlassUniforms {
  return {
    uPlain: { value: new Color("#B5C6DA") },
    uWall: { value: new Color("#EDEFF4") },
    uGlassBase: { value: new Color("#8C9BAC") },
    uFrame: { value: new Color("#DCE3EC") },
    uMull: { value: 2.2 },
    uMullW: { value: 0.09 },
    uGlow: { value: 0.12 },
    uFlashColor: { value: new Color("#FFCB52") },
    uFlashGlow: { value: 0.8 },
    uLive: { value: 0 },
  };
}

/* a window: a band of curtain wall, a storey at a time. Its glass is the
   curtain wall's own, tinted by its district's calmed hue (aHue is the
   share of the hue it takes; downtown's red and the Versions lens's colors
   take it whole), framed by fine mullions and a transom, lit in its
   building's turn of the wave, flashing white on its floor with the set's
   transactions, and faint when another set is lit. A flash rises fast and
   dies slow, as every motion of the city does */
const GLASS_VERTEX_PARS = /* glsl */ `
attribute float aLight;
attribute vec2 aFlash;
attribute float aDim;
attribute float aHue;
uniform float uLive;
uniform float uMull;
varying float vLit;
varying float vFlash;
varying float vDim;
varying float vHue;
varying vec2 vPane;
varying float vBandH;
`;
const GLASS_BEGIN = /* glsl */ `
#include <begin_vertex>
float flash = 0.0;
if ( aFlash.x > 0.0 ) {
  float p = fract( ( uTime + aFlash.y ) / aFlash.x );
  flash = ( p < 0.03 ? p / 0.03 : exp( -( p - 0.03 ) * 14.0 ) ) * uLive;
}
vFlash = flash;
float lit = clamp( ( uTime - aLight ) / 1.1, 0.0, 1.0 );
vLit = lit >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * lit );
vDim = aDim;
vHue = aHue;
{
  float sx = length( instanceMatrix[ 0 ].xyz );
  vBandH = length( instanceMatrix[ 1 ].xyz );
  #ifdef GLASS_BAND
  vPane = vec2( uv.x * 6.2831853 * sx / uMull, uv.y );
  #else
  vPane = vec2( uv.x * sx / uMull, uv.y );
  #endif
}
`;
const GLASS_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uPlain;
uniform vec3 uWall;
uniform vec3 uGlassBase;
uniform vec3 uFrame;
uniform float uMull;
uniform float uMullW;
uniform float uGlow;
uniform vec3 uFlashColor;
uniform float uFlashGlow;
varying float vLit;
varying float vFlash;
varying float vDim;
varying float vHue;
varying vec2 vPane;
varying float vBandH;
`;
const GLASS_COLOR = /* glsl */ `
// the frame: a mullion every uMull across the band, and a transom two thirds up it, crisp at any distance
float fm = fract( vPane.x );
float dm = min( fm, 1.0 - fm ) * uMull;
float fwm = fwidth( vPane.x ) * uMull;
float mullion = 1.0 - smoothstep( max( uMullW, fwm * 0.6 ) - fwm, max( uMullW, fwm * 0.6 ) + fwm, dm );
float dt = abs( vPane.y - 0.66 ) * vBandH;
float fwt = fwidth( vPane.y ) * vBandH;
float transom = 1.0 - smoothstep( max( uMullW * 0.7, fwt * 0.6 ) - fwt, max( uMullW * 0.7, fwt * 0.6 ) + fwt, dt );
float frame = max( mullion, transom * 0.8 );
// the glass: the curtain wall's own, tinted by the district's hue as it lights, lighter at its head where it takes the sky
vec3 tint = mix( uPlain, vColor, vLit );
vec3 glassTone = mix( uGlassBase, tint, vHue ) * mix( 0.93, 1.05, vPane.y );
glassTone = mix( glassTone, uFlashColor, vFlash );
diffuseColor.rgb *= mix( uWall, mix( glassTone, uFrame, frame ), vDim );
`;
const GLASS_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += ( glassTone * uGlow + uFlashColor * vFlash * uFlashGlow ) * vDim * ( 1.0 - frame );
`;
/* the sky in the glass, as glass takes it (Schlick's Fresnel, 4% face on):
   a face that looks at the eye keeps its tint (a CIEDE2000 shift of 1.4 at
   45 degrees, 2.3 at 60), and one turned away takes the sky; a faint window
   takes less */
const GLASS_ENV = /* glsl */ `
#ifdef USE_ENVMAP
specularStrength *= ( 0.04 + 0.96 * pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 5.0 ) ) * vDim;
#endif
#include <envmap_fragment>
`;

/** the windows' glass: a band of curtain wall, flat on a box's face or round a drum (`band`); its instances may carry aFade */
export function glassMaterial(u: GlassUniforms, key: string, band = false): MeshPhongMaterial {
  const m = new MeshPhongMaterial({ color: 0xffffff, specular: new Color("#5A6070"), shininess: 90 });
  m.onBeforeCompile = (s) => {
    veilOf(s);
    riseVertex(s, true);
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace("#include <common>", `#include <common>\n${band ? "#define GLASS_BAND\n" : ""}${GLASS_VERTEX_PARS}`).replace("#include <begin_vertex>", GLASS_BEGIN);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLASS_FRAGMENT_PARS}`)
      .replace("#include <color_fragment>", GLASS_COLOR)
      .replace("#include <emissivemap_fragment>", GLASS_EMISSIVE)
      .replace("#include <envmap_fragment>", GLASS_ENV);
  };
  m.customProgramCacheKey = () => `city3d-glass-${key}${band ? "-band" : ""}`;
  // the sky's reflection (Lighting.tsx), at half of what the Fresnel term gives
  m.userData.cityEnv = 0.5;
  return m;
}

/** a district's light on the ground: the ward under the cursor or the camera, in the plan's polar frame */
export interface SectorUniforms {
  /** its arc: from angle, to angle, inner radius, outer radius */
  uSector: { value: [number, number, number, number] };
  uSectorColor: { value: Color };
  uSectorAlpha: { value: number };
}
export function sectorUniforms(): SectorUniforms {
  return { uSector: { value: [0, 0, 0, 0] }, uSectorColor: { value: new Color("#0061E2") }, uSectorAlpha: { value: 0 } };
}

/** the ground's paint on the plate and on the blocks' tops, lit, shaded, and lit again under a district's light */
export function groundMaterial(map: Texture, sector: SectorUniforms, key: string): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color: 0xffffff, map });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, sector);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vPlan;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvPlan = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vPlan;\nuniform vec4 uSector;\nuniform vec3 uSectorColor;\nuniform float uSectorAlpha;")
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
if ( uSectorAlpha > 0.0 ) {
  float r = length( vPlan );
  float d = mod( atan( vPlan.y, vPlan.x ) - uSector.x, 6.2831853 );
  float inside = step( d, uSector.y - uSector.x ) * step( uSector.z, r ) * step( r, uSector.w );
  // mixed as the page mixes a tint over its paint, near its sRGB, so a dark ground takes it as lightly as a pale one
  vec3 g = mix( sqrt( diffuseColor.rgb ), sqrt( uSectorColor ), inside * uSectorAlpha );
  diffuseColor.rgb = g * g;
}`,
      );
  };
  m.customProgramCacheKey = () => `city3d-ground-${key}`;
  return m;
}

/** a roof plaque's largest size on screen, in CSS pixels: the words that stand on a plaque read it too */
export const PLAQUE_MAX_PX = 40;

/** the roofs' logos: crisp plaques that stand on their roofs facing the eye, cut from one atlas, each with a 1 px ring in the brand's block gray, faint when another set is lit.
    Given a second atlas of each logo's ink (the option Owen is shown: logos monochrome at rest), each plaque is a square with 2 px corners in uPlaque, its logo
    in uInk, and the hovered or picked set's (aTint 1) in its own colors on white */
export function badgeMaterial(atlas: Texture, mono: Texture | null = null): ShaderMaterial {
  return new ShaderMaterial({
    // a plaque never grows past uMaxPx on screen, however near the camera comes; uFocal is the lens's pixels per unit at a unit's depth
    uniforms: {
      uAtlas: { value: atlas },
      uMonoAtlas: { value: mono ?? atlas },
      uMono: { value: mono ? 1 : 0 },
      uTime: TIME,
      uMaxPx: { value: PLAQUE_MAX_PX },
      uFocal: { value: 1000 },
      uRing: { value: new Color("#A2AFB2") },
      uShade: { value: 1 },
      uPlaque: { value: new Color("#EBF0FA") },
      uInk: { value: new Color("#3B484B") },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aCell;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aRise;
      attribute float aTint;
      uniform float uTime;
      uniform float uMaxPx;
      uniform float uFocal;
      varying vec2 vUv;
      varying vec2 vLocal;
      varying float vRadPx;
      varying float vAlpha;
      varying float vTint;
      void main() {
        // the anchor is the roof: the plaque stands on it, a hair nearer the eye than the roof's edge
        vec4 c = modelViewMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        float t = clamp( ( uTime - aRise ) / 0.45, 0.0, 1.0 );
        t = t >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * t );
        float size = min( aSize, uMaxPx * -c.z / uFocal ) * t;
        c.y += size * 0.5;
        c.z += size * 0.5;
        c.xy += position.xy * size;
        gl_Position = projectionMatrix * c;
        vUv = aCell.xy + uv * aCell.zw;
        vLocal = position.xy * 2.0;
        vRadPx = 0.5 * size * uFocal / max( 1.0, -c.z );
        vAlpha = aAlpha * t;
        vTint = aTint;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform sampler2D uMonoAtlas;
      uniform float uMono;
      uniform vec3 uRing;
      uniform float uShade;
      uniform vec3 uPlaque;
      uniform vec3 uInk;
      varying vec2 vUv;
      varying vec2 vLocal;
      varying float vRadPx;
      varying float vAlpha;
      varying float vTint;
      void main() {
        // one CSS pixel, in the plaque's half-widths
        float px = 1.0 / max( vRadPx, 1.0 );
        // the plaque's edge, 0 on it and less inside: a disc, or the square with 2 px corners
        float d;
        if ( uMono > 0.5 ) {
          float rc = 2.0 * px;
          vec2 q = abs( vLocal ) - ( 1.0 - rc );
          d = length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - rc;
        } else {
          d = length( vLocal ) - 1.0;
        }
        // one device pixel, likewise
        float dev = max( fwidth( d ), 1e-4 );
        if ( d > 0.0 ) discard;
        vec4 logo = texture2D( uAtlas, vUv );
        // the ring: one pixel wide, just inside the edge, its edges cut to a device pixel
        float ring = 1.0 - smoothstep( 0.5 * ( px - dev ), 0.5 * ( px + dev ), abs( d + dev + 0.5 * px ) );
        vec3 face = logo.rgb * uShade;
        float cover = logo.a;
        if ( uMono > 0.5 ) {
          // at rest the logo's ink on the plaque; lit, its own colors on white
          float ink = texture2D( uMonoAtlas, vUv ).a;
          vec3 fill = mix( uPlaque, vec3( uShade ), vTint );
          face = mix( fill, mix( uInk, logo.rgb, vTint ), mix( ink, logo.a, vTint ) );
          cover = 1.0;
        }
        vec3 col = mix( face, uRing, ring );
        float a = max( cover, ring ) * vAlpha * ( 1.0 - smoothstep( -dev, 0.0, d ) );
        if ( a < 0.02 ) discard;
        gl_FragColor = vec4( col, a );
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/* The night's glow, without a bloom pass: each lit window throws a soft
   halo onto its wall, and each lamp a soft disc round its light. A
   window's halo is its own ribbon grown by a pad each way, a hair in front
   of the glass, added to what is behind it, brightest at the window's
   edge and gone at the pad's; on the glass itself it is light, so the
   window keeps its color. It reads the ribbon's own instances (its place,
   its glass, its turn in the wave, its strength, its flashes), so it
   costs one draw for every window in the city. */
export function haloMaterial(band: boolean, plain: { value: Color }, base: { value: Color }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: TIME,
      uPlain: plain,
      uGlassBase: base,
      uPad: { value: [1.3, 1.1] },
      uCore: { value: 0.25 },
      uStrength: { value: 0.2 },
      uFlashK: { value: 0.7 },
      uWarm: { value: new Color("#EBF0FA") },
    },
    vertexShader: /* glsl */ `
      #define RISE_ATTR
      ${RISE_PARS}
      attribute float aLight;
      attribute vec2 aFlash;
      attribute float aDim;
      attribute float aFade;
      attribute float aHue;
      uniform vec2 uPad;
      uniform vec3 uPlain;
      uniform vec3 uGlassBase;
      varying vec2 vQ;
      varying vec2 vHalf;
      varying vec3 vTone;
      varying float vK;
      varying float vFlash;
      void main() {
        float sx = length( instanceMatrix[ 0 ].xyz );
        float sy = length( instanceMatrix[ 1 ].xyz );
        vec3 p = position;
        ${band ? "p.xz *= ( sx + uPad.x ) / sx;" : "p.x *= ( sx + 2.0 * uPad.x ) / sx;"}
        p.y = 0.5 + ( p.y - 0.5 ) * ( sy + 2.0 * uPad.y ) / sy;
        // where the fragment is round the window's middle, in the plan's units, and the window's half size
        vQ = vec2( ${band ? "0.0" : "p.x * sx"}, ( p.y - 0.5 ) * sy );
        vHalf = vec2( 0.5 * sx, 0.5 * sy );
        vec4 w = modelMatrix * instanceMatrix * vec4( p, 1.0 );
        w.y = mix( -0.6, w.y, riseOf() );
        vec4 mv = viewMatrix * w;
        // a hair nearer the eye than the glass, so the two never fight for a pixel
        mv.z += 0.3;
        gl_Position = projectionMatrix * mv;
        float lit = clamp( ( uTime - aLight ) / 1.1, 0.0, 1.0 );
        lit = lit >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * lit );
        vTone = mix( uGlassBase, mix( uPlain, instanceColor, lit ), aHue );
        vK = lit * aDim * ( 1.0 - aFade );
        float flash = 0.0;
        if ( aFlash.x > 0.0 ) {
          float f = fract( ( uTime + aFlash.y ) / aFlash.x );
          flash = f < 0.03 ? f / 0.03 : exp( -( f - 0.03 ) * 14.0 );
        }
        vFlash = flash * aDim * ( 1.0 - aFade );
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uPad;
      uniform float uCore;
      uniform float uStrength;
      uniform float uFlashK;
      uniform vec3 uWarm;
      varying vec2 vQ;
      varying vec2 vHalf;
      varying vec3 vTone;
      varying float vK;
      varying float vFlash;
      void main() {
        vec2 d = max( abs( vQ ) - vHalf, 0.0 ) / uPad;
        float a = ( 1.0 - smoothstep( 0.0, 1.0, d.x ) ) * ( 1.0 - smoothstep( 0.0, 1.0, d.y ) );
        a *= mix( 1.0, uCore, step( d.x + d.y, 0.0 ) );
        a *= a;
        vec3 c = mix( vTone, uWarm, 0.35 ) * ( vK * uStrength + vFlash * uFlashK );
        gl_FragColor = vec4( c * a, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

/** a soft disc of light round each lamp, facing the eye: `size` is its radius over the lamp's, its color the lamp's times `color` */
export function lampGlowMaterial(size: number, strength: number, color = "#FFFFFF"): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uSize: { value: size }, uStrength: { value: strength }, uColor: { value: new Color(color) } },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vTone;
      void main() {
        vec4 c = viewMatrix * modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        float r = length( instanceMatrix[ 0 ].xyz ) * uSize;
        c.xy += position.xy * 2.0 * r;
        c.z += r * 0.5;
        gl_Position = projectionMatrix * c;
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
        vTone = instanceColor * uColor;
        #else
        vTone = uColor;
        #endif
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec2 vUv;
      varying vec3 vTone;
      void main() {
        float d = length( vUv * 2.0 - 1.0 );
        float a = pow( max( 0.0, 1.0 - d ), 2.4 );
        gl_FragColor = vec4( vTone * a * uStrength, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}
