"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/* ------------------------------------------------------------------ */
/* Plate video: a silent loop that behaves like a photograph            */
/*                                                                      */
/* The poster renders first (next/image, so it is optimized and paints  */
/* with the page). The video loads only as the plate nears the screen,  */
/* plays only while on it, and fades in over the poster once frames     */
/* arrive, so there is never a black flash. Reduced motion keeps the    */
/* poster and never fetches the video.                                  */
/* ------------------------------------------------------------------ */

export interface PlateVideoSpec {
  mp4: string;
  webm: string;
  poster: string;
}

export default function PlateVideo({ video, priority = false }: { video: PlateVideoSpec; priority?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const visible = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduce Motion, read live (framer's useReducedMotion keeps the value the
    // page loaded with): on from the start, the video never loads; switched
    // on mid-session, the loop stops (the element stays mounted) and the
    // poster shows again
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    // load a screen ahead; play and pause on actual visibility
    const loader = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    const player = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (e.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.2 },
    );
    const onReduce = () => {
      if (!reduce.matches) return;
      loader.disconnect();
      player.disconnect();
      el.pause();
      setPlaying(false);
    };
    reduce.addEventListener("change", onReduce);
    loader.observe(el);
    player.observe(el);
    return () => {
      reduce.removeEventListener("change", onReduce);
      loader.disconnect();
      player.disconnect();
    };
  }, []);

  // sources mount once the plate is near: load them, and start at once if
  // the plate is already on screen
  useEffect(() => {
    const el = ref.current;
    if (!el || !near) return;
    el.load();
    if (visible.current) el.play().catch(() => {});
  }, [near]);

  return (
    <>
      <Image src={video.poster} alt="" fill priority={priority} sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      {/* rendered either way, so the first render is the one the server sent;
          under Reduce Motion it never gets its sources and stays clear */}
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload={near ? "auto" : "none"}
        aria-hidden
        onPlaying={() => setPlaying(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      >
        {near && (
          <>
            <source src={video.webm} type="video/webm" />
            <source src={video.mp4} type="video/mp4" />
          </>
        )}
      </video>
    </>
  );
}
