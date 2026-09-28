// Ambient module declaration for n8ao, which ships without TypeScript types. We only declare the subset we use.

declare module "n8ao" {
  import type { Camera, Color, Scene } from "three";
  import { Pass } from "postprocessing";

  /** N8AO's ambient occlusion as a pass of postprocessing's EffectComposer */
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    /** looks for clear materials in the scene on every frame, and turns transparencyAware on when it finds one */
    autoDetectTransparency: boolean;
    configuration: {
      aoSamples: number;
      aoRadius: number;
      denoiseSamples: number;
      denoiseRadius: number;
      denoiseIterations: number;
      distanceFalloff: number;
      intensity: number;
      color: Color;
      gammaCorrection: boolean;
      halfRes: boolean;
      depthAwareUpsampling: boolean;
      screenSpaceRadius: boolean;
      colorMultiply: boolean;
      transparencyAware: boolean;
      accumulate: boolean;
    };
    setDisplayMode(mode: "Combined" | "AO" | "No AO" | "Split" | "Split AO"): void;
  }
}
