"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AddOperation,
  BackSide,
  Color,
  CubeCamera,
  CustomToneMapping,
  HalfFloatType,
  LinearMipmapLinearFilter,
  Mesh,
  MixOperation,
  Scene,
  ShaderChunk,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
  type Material,
  type MeshLambertMaterial,
} from "three";
import type { Theme } from "./palette";

/* The city's light: the sun from the upper left and a little in front, as
   the map's shadows fall, the sky's fill, a tone curve that keeps the
   city's colors, and the sky itself as the one thing the glass reflects.
   The reflections are baked once per theme into a small cube from the
   sky's own gradient, a soft glow round the sun, and a band of haze at
   the horizon; at night a warm glow low on the horizon, the city's light
   in the haze. A material takes the reflection when it asks for it:
   `material.userData.cityEnv = strength` (a share, about a tenth for
   glass), and `cityEnvMode` "add" (the default, a sheen) or "mix". On a
   renderer that cannot carry it, nothing reflects. */

/** the sun's direction, as the map's shadows fall */
export const SUN = new Vector3(-0.46, 1, 0.18).normalize();

/* The tone curve: straight up to a shoulder at 0.85, so every hex the
   city paints stays on it, and a soft roll-off above it, so the night's
   glow and the glass's glints come to white gently instead of clipping.
   Measured on the palette in CIEDE2000 at each curve's best exposure,
   day then night: the district glass 0.00 and 0.45, the Avalanche red
   0.00 and 0.00. The stock curves move the palette: Neutral 2.0 and 1.9
   on the glass, with the night's slate crushed (8.6); ACES 2.3 and 5.3,
   the white massing grey (7.2); AgX 6.4 and 8.9. It is three's own
   custom tone mapping slot, filled once, before any program compiles */
const SHOULDER = 0.85;
ShaderChunk.tonemapping_pars_fragment = ShaderChunk.tonemapping_pars_fragment.replace(
  "vec3 CustomToneMapping( vec3 color ) { return color; }",
  /* glsl */ `vec3 CustomToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	vec3 rolled = ${SHOULDER.toFixed(2)} + ${(1 - SHOULDER).toFixed(2)} * ( 1.0 - exp( -max( color - ${SHOULDER.toFixed(2)}, 0.0 ) / ${(1 - SHOULDER).toFixed(2)} ) );
	return mix( color, rolled, step( ${SHOULDER.toFixed(2)}, color ) );
}`,
);
const EXPOSURE: Record<Theme, number> = { light: 1, dark: 1 };

/* the sky the city reflects, as the Backdrop draws it (the brand's cool
   blue-white by day, its dark by night): its zenith, its sky, the haze at
   its horizon, the city's cool ground under it, the sun's glow, and at
   night the city's own faint light in the haze */
const SKY: Record<Theme, { zenith: string; sky: string; haze: string; ground: string; sun: string; sunK: number; city: string; cityK: number }> = {
  light: { zenith: "#EBF0FA", sky: "#E1E7F0", haze: "#D2D9E2", ground: "#7D8896", sun: "#F5F8FF", sunK: 1.6, city: "#000000", cityK: 0 },
  dark: { zenith: "#1F1F1F", sky: "#161A21", haze: "#0D1118", ground: "#0A0C0F", sun: "#8E9AAE", sunK: 0.3, city: "#D8D2C6", cityK: 0.1 },
};

function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new Color() },
      uSky: { value: new Color() },
      uHaze: { value: new Color() },
      uGround: { value: new Color() },
      uSun: { value: new Color() },
      uSunK: { value: 1 },
      uCity: { value: new Color() },
      uCityK: { value: 0 },
      uSunDir: { value: SUN.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uSky, uHaze, uGround, uSun, uCity, uSunDir;
      uniform float uSunK, uCityK;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        float h = d.y;
        // the sky from its zenith down to the haze at the horizon; under it the ground, darker as it goes down
        vec3 c = h > 0.0 ? mix( uHaze, mix( uSky, uZenith, smoothstep( 0.25, 1.0, h ) ), smoothstep( 0.0, 0.25, h ) ) : mix( uHaze, uGround, smoothstep( 0.0, 0.18, -h ) );
        // a soft glow round the sun, and a tight core in it for the glass's glints
        float s = max( 0.0, dot( d, uSunDir ) );
        c += uSun * uSunK * ( 0.12 * pow( s, 8.0 ) + 0.6 * pow( s, 180.0 ) );
        // at night, the city's light in the haze, low on the horizon
        c += uCity * uCityK * exp( -abs( h ) * 14.0 );
        gl_FragColor = vec4( c, 1.0 );
      }`,
  });
}

export function Lighting({ theme, rich }: { theme: Theme; rich: boolean }) {
  const dark = theme === "dark";
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);

  // the tone curve and each theme's exposure
  useEffect(() => {
    gl.toneMapping = CustomToneMapping;
    gl.toneMappingExposure = EXPOSURE[theme];
    invalidate();
  }, [gl, theme, invalidate]);

  // the sky's cube: baked once per theme, where the renderer carries it
  const bake = useMemo(() => {
    const target = new WebGLCubeRenderTarget(128, { type: HalfFloatType, generateMipmaps: true, minFilter: LinearMipmapLinearFilter });
    const sky = new Scene();
    const material = skyMaterial();
    sky.add(new Mesh(new SphereGeometry(10, 48, 24), material));
    return { target, sky, material, camera: new CubeCamera(0.1, 100, target) };
  }, []);
  useEffect(
    () => () => {
      bake.target.dispose();
      bake.material.dispose();
    },
    [bake],
  );
  useEffect(() => {
    if (!rich) return;
    const k = SKY[theme];
    const u = bake.material.uniforms;
    u.uZenith.value.set(k.zenith);
    u.uSky.value.set(k.sky);
    u.uHaze.value.set(k.haze);
    u.uGround.value.set(k.ground);
    u.uSun.value.set(k.sun);
    u.uSunK.value = k.sunK;
    u.uCity.value.set(k.city);
    u.uCityK.value = k.cityK;
    bake.camera.update(gl, bake.sky);
    invalidate();
  }, [bake, gl, theme, rich, invalidate]);

  /* the materials that ask for the reflection take it, and give it back when the
     renderer cannot carry it; a look every half second finds the ones that mount later */
  const tick = useRef(0);
  useFrame(() => {
    if (tick.current++ % 30) return;
    const env = rich ? bake.target.texture : null;
    scene.traverse((o) => {
      const mats = (o as Mesh).material as Material | Material[] | undefined;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        const k = m.userData?.cityEnv as number | undefined;
        if (k === undefined) continue;
        const phong = m as MeshLambertMaterial;
        if (phong.envMap === env && phong.reflectivity === k) continue;
        phong.envMap = env;
        phong.reflectivity = k;
        phong.combine = m.userData.cityEnvMode === "mix" ? MixOperation : AddOperation;
        phong.needsUpdate = true;
      }
    });
  });

  return (
    <>
      {/* the sky's cool fill, steel from the ground below; the sun a cool white, the night's moon a steel blue */}
      <hemisphereLight args={[dark ? "#9AA6B8" : "#FFFFFF", dark ? "#3B484B" : "#C9D3DF", dark ? 2.5 : 2.3]} />
      <directionalLight
        position={SUN.clone().multiplyScalar(1500)}
        color={dark ? "#BCC8DC" : "#F5F8FF"}
        intensity={dark ? 1.7 : 1.05}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-640}
        shadow-camera-right={640}
        shadow-camera-top={640}
        shadow-camera-bottom={-640}
        shadow-camera-near={300}
        shadow-camera-far={2800}
        shadow-bias={-0.0006}
        shadow-normalBias={0.45}
        shadow-radius={3}
      />
    </>
  );
}
