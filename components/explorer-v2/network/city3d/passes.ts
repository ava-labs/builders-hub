/* The parts of its two libraries that the city's finish uses (Post.tsx),
   named one by one: the finish loads this module as a chunk of its own, on
   the high tier alone, and the rest of postprocessing stays out of the
   download. */
export { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";
export { N8AOPostPass } from "n8ao";
