/* What the browser's graphics can carry, asked once: whether it makes a
   WebGL 2 context, and the renderer behind it (a software renderer has no
   GPU, and gets the city built and still). The city app and the 3D city
   both ask; one throwaway context answers both, and the answer is kept
   for the tab and, when it is a yes, for the next visit, so a reload or a
   return makes no context at all. A cold GPU process took 400 ms and more
   to make each one. */

export interface WebGLProbe {
  webgl2: boolean;
  /** the unmasked renderer, "" when the browser does not say */
  renderer: string;
  /** a software renderer: no GPU */
  low: boolean;
}

const KEY = "city3d-webgl";
let kept: WebGLProbe | null = null;

const lowOf = (renderer: string) => /swiftshader|llvmpipe|software|basic render/i.test(renderer);

export function webglProbe(): WebGLProbe {
  if (kept) return kept;
  if (typeof window === "undefined") return { webgl2: false, renderer: "", low: false };
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as { ua?: string; renderer?: string } | null;
    if (saved && saved.ua === navigator.userAgent && typeof saved.renderer === "string") {
      kept = { webgl2: true, renderer: saved.renderer, low: lowOf(saved.renderer) };
      return kept;
    }
  } catch {
    /* no storage: ask the browser */
  }
  let renderer = "";
  let webgl2 = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2 = !!gl && !gl.isContextLost();
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  kept = { webgl2, renderer, low: lowOf(renderer) };
  // a no is not kept past the tab: a GPU that failed once may not fail again
  if (webgl2) keep(renderer);
  return kept;
}

function keep(renderer: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ua: navigator.userAgent, renderer }));
  } catch {
    /* no storage: the tab keeps it */
  }
}

/** what the city's own context says, once its canvas has one: a kept yes from a GPU that has since gone (a driver crash, or
    hardware acceleration turned off) shows here as a software renderer, and the answer is kept anew */
export function webglSeen(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGLProbe {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : (kept?.renderer ?? "");
  kept = { webgl2: true, renderer, low: lowOf(renderer) };
  keep(renderer);
  return kept;
}

/** the city could not stand (no context, or its scene threw): the next load asks the browser again */
export function webglForget() {
  kept = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no storage: nothing kept */
  }
}
