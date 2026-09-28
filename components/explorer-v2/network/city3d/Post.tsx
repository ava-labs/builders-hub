"use client";

import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Vector2, type Camera, type Material, type Scene, type WebGLRenderer, type WebGLRenderTarget } from "three";
import type { BloomEffect, EffectComposer, EffectMaterial } from "postprocessing";
import type { N8AOPostPass } from "n8ao";
import type { Theme } from "./palette";
import { onCityStood } from "@/components/explorer-v2/network/city-signal";
import { DRAW, OPENING, waitFor } from "./warmup";

/* The scene's finish, on the high tier (?fx=0 turns it off, for a comparison): the frame goes through passes of its own
   on its way to the canvas. The scene draws first into a multisampled target with the very programs it draws the canvas
   with: its tone curve and its color space stay in each material's own shader (Lighting.tsx), so every color it paints
   comes out as it does on the canvas, and what it blends blends the same way. By day, ambient occlusion (N8AO, at half
   the resolution) then shades it softly where the towers stand on the plate, in their setbacks and round the furniture
   on their roofs, as an architect's render does. It comes in over a second once the city stands, never in the rise, and
   at once for a return or a reader who asks for less motion; by night the dark massing hardly shows it, and it would
   dim the lit windows, which give their own light. At night a bloom lets the brightest lights glow a little into the
   dark: the lit windows, the pods' strips, the street lamps and the plaques. It keys on luminance, under which the red
   tower's glass and its aircraft light stay, and not on the sky, whose moon and stars keep their own glow; by day
   nothing blooms. What it uses of its two libraries loads as a chunk of its own (passes.ts), on the high tier alone,
   the passes' programs compile off the main thread, and the canvas shows once the finish has drawn (warmup.tsx). A GPU
   that loses its frame rate keeps the multisampling and drops the shading and the bloom, with the sky's reflections. */

/** the shading: the reach of its rays in world units (a tenth of the city's lot of 46), how soon it lets go of what stands
    behind the surface it shades (a share of its reach), and how deep it shades */
const AO = { radius: 5, falloff: 1, intensity: 1.5 };
/** the bloom, by night: the luminance it starts at on the canvas's scale (the lit windows stand at about 0.85, the red
    tower's glass under 0.56), the width of its soft start, its strength, its spread, and its levels, each half the size of
    the last */
const BLOOM = { threshold: 0.6, smoothing: 0.3, intensity: 1.2, radius: 0.75, levels: 6 };
/** the scene's samples, as many as the canvas's own antialiasing takes */
const SAMPLES = 4;
/** how long the shading takes to come in once the city stands (the ranges come in on the same word, Backdrop.tsx) */
const AO_IN_MS = 1000;

type Libs = typeof import("./passes");

interface Chain {
  composer: EffectComposer;
  ao: N8AOPostPass;
  bloom: BloomEffect;
  /** the bloom draws: at night, on a GPU that keeps its frame rate */
  night: { on: boolean };
}

/* a target three takes for the canvas itself: it reads an XR target's color space off its texture, and keeps the tone
   curve for it. This leans on three's rule that the tone mapping and the output encoding apply to the canvas and to an
   XR target alone (setProgram in WebGLRenderer, getParameters in WebGLPrograms, r180): a three upgrade must check it
   again, with the finish's frame compared to the canvas's with the shading off */
type AsCanvas = WebGLRenderTarget & { isXRRenderTarget?: boolean };

function chainOf(lib: Libs, gl: WebGLRenderer, scene: Scene, camera: Camera, shade: boolean, night: boolean): Chain {
  const composer = new lib.EffectComposer(gl, { multisampling: SAMPLES });
  // the composer turns the renderer's own clear off for good; the draw turns it off for the composer's frame alone
  gl.autoClear = true;
  const { inputBuffer, outputBuffer } = composer;
  /* the scene's target stands in for the canvas: the scene's programs are the canvas's (the warm-up's), with its tone curve
     and its encoding, and its 8 bits hold what they write as the canvas's do, with no second encoding over it */
  (inputBuffer as AsCanvas).isXRRenderTarget = true;
  inputBuffer.texture.internalFormat = "RGBA8";
  outputBuffer.texture.internalFormat = "RGBA8";
  // what draws after the scene is one triangle over the frame, which needs no samples
  outputBuffer.samples = 0;

  const scenePass = new lib.RenderPass(scene, camera);
  const ao = new lib.N8AOPostPass(scene, camera, inputBuffer.width, inputBuffer.height);
  /* the clear parts (the haze, the halos, a veil) take the shading of what stands behind them: a pass that set them
     apart would draw the scene twice more */
  ao.autoDetectTransparency = false;
  const c = ao.configuration;
  c.transparencyAware = false;
  c.halfRes = true;
  c.aoRadius = AO.radius;
  c.distanceFalloff = AO.falloff;
  c.intensity = AO.intensity;
  // what it shades is on the canvas's scale already
  c.gammaCorrection = false;
  ao.enabled = shade;

  const on = { on: night };
  const bloom = new lib.BloomEffect({
    blendFunction: lib.BlendFunction.SCREEN,
    mipmapBlur: true,
    luminanceThreshold: BLOOM.threshold,
    luminanceSmoothing: BLOOM.smoothing,
    intensity: BLOOM.intensity,
    radius: BLOOM.radius,
    levels: BLOOM.levels,
  });
  // its key reads half the pixels
  bloom.luminancePass.resolution.scale = 0.5;
  // by day it draws nothing and adds nothing
  const update = bloom.update.bind(bloom);
  bloom.update = (renderer, input, dt) => {
    if (on.on) update(renderer, input, dt);
  };
  bloom.blendMode.opacity.value = night ? 1 : 0;
  const finish = new lib.EffectPass(camera, bloom);
  // what it reads is encoded for the canvas already
  (finish.fullscreenMaterial as EffectMaterial).encodeOutput = false;

  composer.addPass(scenePass);
  composer.addPass(ao);
  composer.addPass(finish);

  /* the scene's own depth, which nothing draws over once the scene has drawn, serves the shading and the bloom's key as it
     stands (the composer's copy of it would cost a pass); the key leaves out the sky, the depth's far end */
  const depth = inputBuffer.depthTexture;
  if (depth) {
    scenePass.needsDepthBlit = false;
    ao.setDepthTexture(depth);
    const key = bloom.luminanceMaterial;
    key.fragmentShader = key.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform highp sampler2D sceneDepth;")
      .replace("float l=luminance(texel.rgb);", "float l=luminance(texel.rgb)*step(texture2D(sceneDepth,vUv).r,0.9999);");
    key.uniforms.sceneDepth = { value: depth };
    key.needsUpdate = true;
  }
  return { composer, ao, bloom, night: on };
}

/* the passes' programs, made off the main thread (KHR_parallel_shader_compile, as three's compileAsync reads it): the
   composer runs once with the renderer's draw turned into a compile, so each pass's programs are made for the target it
   draws into, the shading's by night and the bloom's by day too. The scene's own programs are the warm-up's, and its
   pass sits the run out. It resolves once every program stands */
function compiled(gl: WebGLRenderer, chain: Chain): Promise<void> {
  const made = new Set<Material>();
  const draw = gl.render;
  const [scenePass] = chain.composer.passes;
  const was = { shade: chain.ao.enabled, night: chain.night.on };
  gl.render = (scene, camera) => {
    for (const m of gl.compile(scene, camera)) made.add(m);
  };
  scenePass.enabled = false;
  chain.ao.enabled = true;
  chain.night.on = true;
  try {
    chain.composer.render(0);
  } finally {
    gl.render = draw;
    scenePass.enabled = true;
    chain.ao.enabled = was.shade;
    chain.night.on = was.night;
  }
  return new Promise((resolve) => {
    const look = () => {
      for (const m of made) {
        const p = (gl.properties.get(m) as { currentProgram?: { isReady: () => boolean } }).currentProgram;
        if (!p || p.isReady()) made.delete(m);
      }
      if (made.size) window.setTimeout(look, 10);
      else resolve();
    };
    look();
  });
}

export function Post({ theme, rich, still = false }: { theme: Theme; rich: boolean; still?: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const [chain, setChain] = useState<Chain | null>(null);
  const look = useRef({ theme, rich, still });
  look.current = { theme, rich, still };

  /* the finish, once its libraries are in and its programs stand: the frame goes through it (warmup.tsx), and the canvas,
     which waits for it, shows once the GPU has done its first frames, its targets made and its programs used */
  useEffect(() => {
    let live = true;
    let made: Chain | null = null;
    let stand = () => {};
    waitFor(new Promise<void>((resolve) => (stand = resolve)));
    const css = new Vector2();
    const px = new Vector2();
    let frames = 0;
    // the GPU's word that it has done the unseen frames
    let done: WebGLSync | null = null;
    /* the shading comes in once the city stands, over AO_IN_MS, so the rise draws without it; a return in this tab and a
       reader who asks for less motion get it at once */
    let inAt: number | null = look.current.still || OPENING.returning ? 0 : null;
    const unstood = onCityStood(() => {
      inAt ??= performance.now();
      invalidate();
    });
    const shadeIn = () => {
      if (inAt === null) return 0;
      const k = Math.min(1, (performance.now() - inAt) / AO_IN_MS);
      if (k < 1) invalidate();
      return k * k * (3 - 2 * k);
    };
    const draw = () => {
      if (!made) return;
      const { composer, ao } = made;
      // its targets follow the canvas's size and pixel ratio
      gl.getDrawingBufferSize(px);
      if (px.x !== composer.inputBuffer.width || px.y !== composer.inputBuffer.height) {
        gl.getSize(css);
        composer.setSize(css.x, css.y, false);
      }
      /* the shading draws in the first two frames whatever the theme, while the canvas does not show them, so its programs,
         pipelines and targets are all made before the show; after them it is on by day alone, as it comes in */
      const { theme: t, rich: r } = look.current;
      const k = frames < 2 ? 1 : r && t !== "dark" ? shadeIn() : 0;
      ao.enabled = k > 0;
      if (k > 0 && ao.configuration.intensity !== AO.intensity * k) ao.configuration.intensity = AO.intensity * k;
      gl.autoClear = false;
      try {
        composer.render(0);
      } finally {
        gl.autoClear = true;
      }
      /* the canvas shows once the GPU has done the first three frames, two with the shading and one as the rise draws, so
         the pipelines of both are made unseen and neither falls on the frame that shows it */
      const ctx = gl.getContext();
      if (++frames === 3) {
        if ("fenceSync" in ctx) {
          done = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
          ctx.flush();
        }
        if (!done) stand();
      } else if (done && "getSyncParameter" in ctx && ctx.getSyncParameter(done, ctx.SYNC_STATUS) === ctx.SIGNALED) {
        ctx.deleteSync(done);
        done = null;
        stand();
      }
    };
    void import("./passes")
      .then((lib) => {
        if (!live) return;
        const { theme: t, rich: r } = look.current;
        made = chainOf(lib, gl, scene, camera, r && t !== "dark", r && t === "dark");
        return compiled(gl, made);
      })
      .then(() => {
        if (!live || !made) return;
        DRAW.fn = draw;
        setChain(made);
        invalidate();
      })
      .catch((e: unknown) => {
        console.error("[city3d] the finish did not stand", e);
        stand();
      });
    return () => {
      live = false;
      unstood();
      const ctx = gl.getContext();
      if (done && "deleteSync" in ctx) ctx.deleteSync(done);
      stand();
      if (DRAW.fn === draw) DRAW.fn = null;
      made?.composer.dispose();
    };
  }, [gl, scene, camera, invalidate]);

  // the bloom by night, on a GPU that keeps its frame rate; the shading follows the theme in the frame's draw
  useEffect(() => {
    if (!chain) return;
    const night = rich && theme === "dark";
    chain.night.on = night;
    chain.bloom.blendMode.opacity.value = night ? 1 : 0;
    invalidate();
  }, [chain, theme, rich, invalidate]);

  // in development only, the tuning probes read the passes
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && chain) (window as unknown as { __cityFx?: Chain }).__cityFx = chain;
  }, [chain]);

  return null;
}
