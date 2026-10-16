"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import type { SceneTheme } from "./palette";

/* A box for a WebGL scene that costs nothing until it is near. The scene's
   code loads, and its canvas mounts, only on a screen at least 768 px wide
   that allows motion and has WebGL 2, only after the visitor first scrolls
   (so three.js never joins the page load), and only when the box comes
   within about a screen and a half of the viewport. There the canvas draws its
   first frame off screen, fades in once that frame is down, and runs its
   frame loop only while the box is on screen. When the canvas is ready with
   the box already on screen, its intro plays hidden behind the still and the
   canvas fades in on the settled pose. Everywhere else a still (a render of the same scene)
   stands in: the wide still from 768 px up, the narrow one below. CSS picks
   the still for the theme, so the server's HTML is right before hydration.
   The box holds a fixed aspect ratio, so no path moves the layout. */

export interface SceneProps {
  theme: SceneTheme;
  /** false while the box is off screen: the scene draws on demand only */
  running: boolean;
  /** the scene calls this once its first frame is on the canvas */
  onReady: () => void;
}

export interface Stills {
  light: string;
  dark: string;
}

function useHtmlTheme(): SceneTheme {
  const [theme, setTheme] = useState<SceneTheme>("light");
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** asked once per page view: the media check is cheap, the WebGL check is not */
let capable: boolean | null = null;
function canRunScene(): boolean {
  if (capable !== null) return capable;
  if (!window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)").matches) return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    capable = !!gl && !gl.isContextLost();
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    capable = false;
  }
  return capable;
}

/** how far the page must scroll before a scene may load */
const SCROLLED_PX = 64;
/** how long a scene's intro runs (the stack's drop, the network's rise) before it settles */
const SETTLE_MS = 1800;
/** the canvas fade (duration-700), plus a frame */
const FADE_MS = 750;

const STILL_CLASS = "pointer-events-none absolute inset-0 h-full w-full object-contain";

export function SceneFrame<P extends object>({
  Scene,
  sceneProps,
  still,
  stillNarrow,
  alt,
  aspect,
  aspectNarrow,
  className = "",
  onShown,
}: {
  Scene: ComponentType<P & SceneProps>;
  sceneProps: P;
  /** the still from 768 px up, per theme */
  still: Stills;
  /** the still below 768 px; the wide one when absent */
  stillNarrow?: Stills;
  alt: string;
  /** width / height of the box from 768 px up */
  aspect: number;
  /** width / height below 768 px; the wide ratio when absent */
  aspectNarrow?: number;
  className?: string;
  /** true while the canvas, not the still, is what the box shows */
  onShown?: (scene: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const theme = useHtmlTheme();
  // "still" until the client knows it can run the scene; the server always sends stills
  const [mode, setMode] = useState<"still" | "scene">("still");
  const [mount, setMount] = useState(false);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // the check waits for a quiet moment, so it never joins hydration's long task
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    let near: IntersectionObserver | null = null;
    let seen: IntersectionObserver | null = null;
    let waiting: (() => void) | null = null;
    const watch = () => {
      near = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setMount(true);
          near?.disconnect();
        },
        { rootMargin: "150% 0px" },
      );
      seen = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { rootMargin: "10% 0px" });
      near.observe(box);
      seen.observe(box);
    };
    const handle = idle(() => {
      if (!canRunScene()) return;
      setMode("scene");
      // a reload deep in the page has already scrolled; a fresh visit waits
      // for the reader's first scroll. Only a real distance counts: the
      // browser can move a fresh page by a pixel on its own
      if (window.scrollY > SCROLLED_PX) return watch();
      waiting = () => {
        if (window.scrollY <= SCROLLED_PX) return;
        window.removeEventListener("scroll", waiting!);
        waiting = null;
        watch();
      };
      window.addEventListener("scroll", waiting, { passive: true });
    });
    return () => {
      cancelIdle(handle as number);
      if (waiting) window.removeEventListener("scroll", waiting);
      near?.disconnect();
      seen?.disconnect();
    };
  }, []);

  const onReady = useCallback(() => setReady(true), []);

  // the still hands over to the canvas while the box is off screen, so a
  // reader never sees an empty box or the scene start over. A box that is
  // on screen when its canvas is ready (a fast scroll, a reload) plays the
  // intro hidden behind the still, then fades the canvas in on the settled
  // pose, which is the pose the still shows
  const [swapped, setSwapped] = useState(false);
  useEffect(() => {
    if (!ready || swapped) return;
    if (!running) return setSwapped(true);
    const timer = window.setTimeout(() => setSwapped(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [ready, running, swapped]);
  // the still stays under the canvas until the canvas has faded in over it,
  // so the handover is a crossfade, never a dip
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (!swapped) return setCovered(false);
    const timer = window.setTimeout(() => setCovered(true), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [swapped]);

  // a scene that never reports (a slow first compile, an error in its frame)
  // counts as ready once it has had a moment on screen
  useEffect(() => {
    if (!mount || !running || ready) return;
    const timer = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(timer);
  }, [mount, running, ready]);

  // a lost context leaves a blank canvas: hand the box back to the still
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !mount) return;
    const lost = (event: Event) => {
      if ((event.target as HTMLElement).tagName !== "CANVAS") return;
      setReady(false);
      setSwapped(false);
      setMode("still");
    };
    box.addEventListener("webglcontextlost", lost, true);
    return () => box.removeEventListener("webglcontextlost", lost, true);
  }, [mount]);

  const shown = mode === "scene" && mount && ready && swapped;
  useEffect(() => onShown?.(shown), [shown, onShown]);

  const narrow = stillNarrow ?? still;
  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={alt}
      className={`relative w-full aspect-[var(--scene-an)] md:aspect-[var(--scene-a)] ${className}`}
      style={{ "--scene-a": String(aspect), "--scene-an": String(aspectNarrow ?? aspect) } as CSSProperties}
    >
      {(mode === "still" || !covered) && (
        <>
          <img src={narrow.light} alt="" loading="lazy" decoding="async" className={`${STILL_CLASS} md:hidden dark:hidden`} />
          <img src={narrow.dark} alt="" loading="lazy" decoding="async" className={`${STILL_CLASS} hidden dark:block md:dark:hidden`} />
          <img src={still.light} alt="" loading="lazy" decoding="async" className={`${STILL_CLASS} hidden md:block md:dark:hidden`} />
          <img src={still.dark} alt="" loading="lazy" decoding="async" className={`${STILL_CLASS} hidden md:dark:block`} />
        </>
      )}
      {mode === "scene" && mount && (
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-700 ${ready && swapped ? "opacity-100" : "opacity-0"}`}
        >
          <Scene {...sceneProps} theme={theme} running={running} onReady={onReady} />
        </div>
      )}
    </div>
  );
}
