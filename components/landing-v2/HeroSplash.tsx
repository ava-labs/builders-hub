"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preload } from "react-dom";

/* ------------------------------------------------------------------ */
/* Hero splash: a 4K still with the moving snow laid over it          */
/*                                                                      */
/* The still is painted from SSR as a CSS background (one per theme and */
/* size; the other theme's loads after 2 s, for the toggle). The snow   */
/* is a 60 fps loop of only the region where it moves, cut from the     */
/* same frame and graded the same way, so it sits on the still without  */
/* a seam. It mounts after hydration, plays only while the hero is on a */
/* visible tab, and fades in once frames arrive. Reduced motion,        */
/* Save-Data and touch tablets keep the still. Assets:                  */
/* public/home/splash (generated, then graded and encoded offline; see  */
/* the PR that added them).                                             */
/* ------------------------------------------------------------------ */

const DIR = "/home/splash";
// bump when the files change: a browser that cached the old file asks for
// byte ranges past the new one's end and gets a 416, so the loop never starts
const REV = "2";

// desk: the 21:9 frame (still 3840x1648). phone: a portrait crop (still 1080x1920).
type Size = "desk" | "phone";
type Theme = "dark" | "light";
type Clip = { theme: Theme; size: Size; av1: boolean };

// codecs strings of the encodes
const CODECS: Record<Size, { av1: string; avc: string }> = {
  desk: { av1: "av01.0.12M.08", avc: "avc1.640033" },
  phone: { av1: "av01.0.08M.08", avc: "avc1.64002A" },
};

// Each size: the frame's aspect, how far below center the snow must stay
// clear (copyHalf), and the snow loop's box inside the frame (fractions of
// the frame). Desktop keeps the whole copy clear. On a phone the stacked
// copy fills most of the box, and clearing it would drop the ridge and the
// plume out of view, so only the headline is kept clear: the snow rises
// behind the buttons.
const FRAME: Record<Size, { aspect: number; copyHalf: number; box: [number, number, number, number] }> = {
  desk: { aspect: 3840 / 1648, copyHalf: 108, box: [720 / 3840, 864 / 1648, 3120 / 3840, 784 / 1648] },
  phone: { aspect: 1080 / 1920, copyHalf: 24, box: [0, 864 / 1648, 1, 784 / 1648] },
};

// Ridge placement. The splash box ends at the ecosystem tape's top edge and
// the copy is centered in it. The frame covers the box, sits on that edge,
// and drops only as far as it must for the snow, which starts SPIN of the
// frame height from the top, to clear copyHalf below center by GAP. Tall screens see the whole ridge; short ones lose its foot. The
// still and the loop both read --fx/--fy/--fw/--fh, so they always line up.
// Container units keep this exact at any viewport.
const SPIN = 0.6;
const GAP = 12;
const frameVars = ({ aspect, copyHalf }: (typeof FRAME)[Size]) =>
  `--fh:max(${(100 / aspect).toFixed(4)}cqw,100cqh);--fw:calc(var(--fh) * ${aspect.toFixed(5)});--fx:calc(50cqw - var(--fw) / 2);` +
  `--fy:calc(100cqh - var(--fh) + max(0px, ${(1 - SPIN).toFixed(2)} * var(--fh) - 50cqh + ${copyHalf + GAP}px))`;
const boxStyle = (size: Size) => {
  const [x, y, w, h] = FRAME[size].box;
  return {
    left: `calc(var(--fx) + var(--fw) * ${x.toFixed(6)})`,
    top: `calc(var(--fy) + var(--fh) * ${y.toFixed(6)})`,
    width: `calc(var(--fw) * ${w.toFixed(6)})`,
    height: `calc(var(--fh) * ${h.toFixed(6)})`,
  };
};

// Still per theme and size. The webp line is the fallback for browsers
// without typed image-set().
const poster = (theme: Theme, size: Size) =>
  `background-image: url(${DIR}/${theme}-still-${size}.webp?v=${REV});` +
  `background-image: image-set(url(${DIR}/${theme}-still-${size}.avif?v=${REV}) type("image/avif"), url(${DIR}/${theme}-still-${size}.webp?v=${REV}) type("image/webp"));`;
// As a CSS background, the still is found late (after the stylesheet, and
// on a slow phone behind the scripts), yet it is the hero's largest paint.
// So each size preloads it, and it paints without a fade: it is ready in the
// first frame. The theme follows the system until the reader picks one, so
// the color-scheme query picks the still most readers see.
const preloadStills = () => {
  for (const size of ["desk", "phone"] as const)
    for (const theme of ["dark", "light"] as const)
      preload(`${DIR}/${theme}-still-${size}.avif?v=${REV}`, {
        as: "image",
        type: "image/avif",
        fetchPriority: "high",
        media: `(${size === "desk" ? "min-width: 768px" : "max-width: 767px"}) and (prefers-color-scheme: ${theme})`,
      });
};

// A loop shows once it plays, only while its theme and size match the page,
// and only once its theme's still is decoded: a loop over a still that is
// still loading shows as a box.
const loopOn = (size: Size) =>
  `html:not(.dark) .v2-hero-splash[data-stills~=light] .v2-hero-splash-loop[data-ready][data-theme=light][data-size=${size}],` +
  `.dark .v2-hero-splash[data-stills~=dark] .v2-hero-splash-loop[data-ready][data-theme=dark][data-size=${size}]{opacity:1}`;

// Loads a still into the HTTP cache and decodes it: AVIF, the format the
// image-set above picks, or WebP where AVIF fails.
const loadStill = (theme: Theme, size: Size) => {
  const img = new Image();
  const url = (ext: string) => `${DIR}/${theme}-still-${size}.${ext}?v=${REV}`;
  img.src = url("avif");
  return img.decode().catch(() => {
    img.src = url("webp");
    return img.decode();
  });
};
const STYLE =
  // light: the sky runs up to the navbar. dark: it melts into the
  // near-black page, so the box edge never shows
  `.v2-hero-splash{${frameVars(FRAME.desk)}}` +
  `.dark .v2-hero-splash{-webkit-mask-image:linear-gradient(transparent,#000 140px);mask-image:linear-gradient(transparent,#000 140px)}` +
  // the frame drops below the box top on short screens: the gap takes the
  // sky's top color, and the mask above fades both into the page
  `.v2-hero-splash-poster{background-color:#e7ebef;background-repeat:no-repeat;background-size:var(--fw) var(--fh);background-position:var(--fx) var(--fy);${poster("light", "desk")}}` +
  `.dark .v2-hero-splash-poster{background-color:#0c111b;${poster("dark", "desk")}}` +
  // the loop's edges hold only still pixels: feathering them hides any
  // subpixel offset between the two layers
  `.v2-hero-splash-loop{opacity:0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 1.5%),linear-gradient(transparent,#000 5%);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent,#000 1.5%),linear-gradient(transparent,#000 5%);mask-composite:intersect}` +
  `@media (min-width: 768px){${loopOn("desk")}}@media (max-width: 767px){${loopOn("phone")}}` +
  // the first frames fade in over the still; theme swaps are instant
  `@media (prefers-reduced-motion: no-preference){.v2-hero-splash-loop[data-ready]{animation:v2-hero-splash-in 0.5s ease-out}}` +
  `@media (max-width: 767px){.v2-hero-splash{${frameVars(FRAME.phone)}}` +
  `.v2-hero-splash-poster{${poster("light", "phone")}}.dark .v2-hero-splash-poster{${poster("dark", "phone")}}}` +
  `@keyframes v2-hero-splash-in{from{opacity:0}}`;

const AV1_FIRST = ["av1", "avc"] as const;
const AVC_FIRST = ["avc", "av1"] as const;

const clipKey = (c: Clip) => `${c.theme}-${c.size}${c.av1 ? "-av1" : ""}`;

export default function HeroSplash() {
  preloadStills();
  const rootRef = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  // set once the first choice is made: the root then reads data-motion
  // "loop" or "still" (the e2e checks read it)
  const [chosen, setChosen] = useState(false);
  // themes whose still is decoded at the current size
  const [stills, setStills] = useState<Theme[]>([]);
  // Video layers, each a mounted <video>. CSS shows a layer once it plays
  // and only while its theme and size match the page, so a theme toggle
  // swaps the loop in the same frame as the still (a lagging loop showed
  // as a box of the other theme). The toggle never restarts the snow: the
  // other theme's layer joins at the same moment of the loop, and it warms
  // up while the pointer is on the toggle, so the click swaps at once.
  const [layers, setLayers] = useState<{ key: string; clip: Clip; at: number; t0: number }[]>([]);
  const shownRef = useRef<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const ready = useRef(new Set<string>());
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const dropTimer = useRef(0);

  // Pick the clip: theme from the <html> class, size from the viewport,
  // codec from the decoder. Null keeps the poster and fetches nothing.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 767px)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let av1 = false;
    let probed = false;
    let alive = true;

    // nothing is chosen before the codec probe settles: a choice made
    // earlier (next-themes sets the class on mount) would load the H.264
    // file and then the AV1 file too
    const choose = () => {
      if (!probed) return;
      // phones get the portrait crop; touch tablets keep the poster
      const size: Size | null =
        reduced.matches || conn?.saveData ? null : narrow.matches ? "phone" : coarse.matches ? null : "desk";
      const theme: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      const next = size ? { theme, size, av1 } : null;
      setClip((prev) => (prev && next && clipKey(prev) === clipKey(next) ? prev : next));
      setChosen(true);
    };

    // AV1 first only where it decodes in hardware: in software it costs more
    // CPU than H.264 for about the same bytes
    const caps = navigator.mediaCapabilities;
    const probe = caps
      ? caps
          .decodingInfo({
            type: "file",
            video: {
              contentType: `video/mp4; codecs="${CODECS.desk.av1}"`,
              width: 3120,
              height: 784,
              bitrate: 2_000_000,
              framerate: 60,
            },
          })
          .then((r) => r.supported && r.powerEfficient)
          .catch(() => false)
      : Promise.resolve(false);
    probe.then((ok) => {
      if (!alive) return;
      av1 = ok;
      probed = true;
      choose();
    });

    // follow the theme toggle (next-themes flips the class on <html>)
    const mo = new MutationObserver(choose);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    narrow.addEventListener("change", choose);
    coarse.addEventListener("change", choose);
    reduced.addEventListener("change", choose);
    return () => {
      alive = false;
      mo.disconnect();
      narrow.removeEventListener("change", choose);
      coarse.removeEventListener("change", choose);
      reduced.removeEventListener("change", choose);
    };
  }, []);

  // Mount a layer for a clip, starting where the shown loop is now.
  const mount = useCallback((c: Clip) => {
    const key = clipKey(c);
    const live = rootRef.current?.querySelector<HTMLVideoElement>(`video[data-key="${shownRef.current}"]`);
    const at = live && !Number.isNaN(live.currentTime) ? live.currentTime : 0;
    setLayers((prev) => (prev.some((l) => l.key === key) ? prev : [...prev, { key, clip: c, at, t0: performance.now() }]));
  }, []);

  // Free the other layers once toggling stops, so only one loop decodes.
  // The shown layer stays, and so does the active one: it may not have
  // played yet (paused off screen), and nothing would mount it again.
  const dropLater = useCallback(() => {
    window.clearTimeout(dropTimer.current);
    dropTimer.current = window.setTimeout(() => {
      const keep = (key: string) => key === shownRef.current || key === activeRef.current;
      for (const l of layersRef.current) if (!keep(l.key)) ready.current.delete(l.key);
      setLayers((ls) => ls.filter((l) => keep(l.key)));
    }, 4000);
  }, []);

  // Make a ready layer the shown one, and free the rest later: also when it
  // was shown already, as a layer mounted for an abandoned choice (a resize
  // back across the breakpoint) would otherwise keep decoding.
  const show = useCallback(
    (key: string) => {
      shownRef.current = key;
      dropLater();
    },
    [dropLater],
  );

  useEffect(() => {
    activeRef.current = clip ? clipKey(clip) : null;
    if (!clip) {
      setLayers([]);
      return;
    }
    const key = clipKey(clip);
    const mounted = layersRef.current.some((l) => l.key === key);
    if (mounted && ready.current.has(key)) show(key);
    else {
      ready.current.delete(key);
      mount(clip);
    }
  }, [clip, mount, show]);

  // Decode the stills a loop sits on: the shown theme's now (the page has
  // it already), the other theme's when the page is idle or the pointer
  // reaches the toggle, so a theme switch never waits on the network.
  const size = clip?.size;
  const stillsRef = useRef(new Set<string>());
  const wantStill = useCallback(
    (theme: Theme) => {
      if (!size) return;
      const key = `${theme}-${size}`;
      if (stillsRef.current.has(key)) return;
      stillsRef.current.add(key);
      loadStill(theme, size)
        .then(() => setStills((ts) => (ts.includes(theme) ? ts : [...ts, theme])))
        .catch(() => stillsRef.current.delete(key));
    },
    [size],
  );
  useEffect(() => {
    if (!size) return;
    stillsRef.current.clear();
    setStills([]);
  }, [size]);
  useEffect(() => {
    if (!clip) return;
    wantStill(clip.theme);
    const other: Theme = clip.theme === "dark" ? "light" : "dark";
    const idle = window.setTimeout(() => wantStill(other), 2000);
    return () => window.clearTimeout(idle);
  }, [clip, wantStill]);

  // Warm the other theme while the pointer or focus is on the theme toggle.
  useEffect(() => {
    if (!clip) return;
    const other: Clip = { ...clip, theme: clip.theme === "dark" ? "light" : "dark" };
    const onEnter = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.("[data-theme-toggle]")) return;
      window.clearTimeout(dropTimer.current);
      wantStill(other.theme);
      mount(other);
    };
    const onLeave = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.("[data-theme-toggle]")) return;
      dropLater();
    };
    document.addEventListener("pointerover", onEnter);
    document.addEventListener("focusin", onEnter);
    document.addEventListener("pointerout", onLeave);
    document.addEventListener("focusout", onLeave);
    return () => {
      document.removeEventListener("pointerover", onEnter);
      document.removeEventListener("focusin", onEnter);
      document.removeEventListener("pointerout", onLeave);
      document.removeEventListener("focusout", onLeave);
    };
  }, [clip, mount, dropLater, wantStill]);

  useEffect(() => () => window.clearTimeout(dropTimer.current), []);

  // Play only while the hero is on screen and the tab is visible; pause
  // otherwise, so nothing decodes in the background.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || layers.length === 0) return;
    const videos = () => Array.from(root.querySelectorAll("video"));
    for (const video of videos()) {
      video.muted = true;
      video.defaultMuted = true;
    }
    let inView = false;
    const sync = () => {
      for (const video of videos()) {
        if (inView && !document.hidden) video.play().catch(() => {});
        else video.pause();
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [layers]);

  // Fills the hero's copy area, above the ecosystem tape. That area is a z-10
  // stacking context, so -z-10 sits under the copy and over the sheet
  // backdrop; the page color under everything keeps the backdrop hidden.
  // The box ends at the tape's top border, and the ridge stands on it.
  return (
    <div
      ref={rootRef}
      aria-hidden
      data-motion={chosen ? (clip ? "loop" : "still") : undefined}
      data-stills={stills.join(" ") || undefined}
      className="v2-hero-splash pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-white [container-type:size] dark:bg-zinc-950"
    >
      <style>{STYLE}</style>
      <div className="v2-hero-splash-poster absolute inset-0" />
      {layers.map(({ key, clip: c, at, t0 }) => {
        const base = `${DIR}/${c.theme}-${c.size === "desk" ? "crop" : "phone"}`;
        return (
          <video
            key={key}
            data-key={key}
            data-theme={c.theme}
            data-size={c.size}
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              // seek to where the shown loop is now, not where it was
              const now = at + (performance.now() - t0) / 1000;
              if (at > 0 && v.duration > 0) v.currentTime = now % v.duration;
            }}
            onPlaying={(e) => {
              e.currentTarget.dataset.ready = "";
              ready.current.add(key);
              if (activeRef.current === key) show(key);
            }}
            style={boxStyle(c.size)}
            className="v2-hero-splash-loop absolute object-fill"
          >
            {/* the browser plays the first source it can: a browser without
                H.264 still gets the loop */}
            {(c.av1 ? AV1_FIRST : AVC_FIRST).map((codec) => (
              <source
                key={codec}
                src={`${base}.${codec === "av1" ? "av1" : "h264"}.mp4?v=${REV}`}
                type={`video/mp4; codecs="${CODECS[c.size][codec]}"`}
              />
            ))}
          </video>
        );
      })}
    </div>
  );
}
