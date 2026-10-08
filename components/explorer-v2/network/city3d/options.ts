"use client";

import { useEffect, useRef, useState } from "react";

/* The 3D city's options (City3D.tsx): the words' style, the logos' ink and
   the finish, each from the app or the page's URL, and the app's cards
   that the words keep clear of. */

/** how the scene's words stand: "names" round the city's edge, as the map's; or "rules", each district's name on a 1 px rule
    from its ward's edge and a data tag over each of the eight sets with the most validators, as a presentation model is labelled */
export type LabelStyle = "names" | "rules";

/** the words' style: the app's, else the page's ?labels= (so the option can be shown by its link), else the names */
export function useLabels(prop?: LabelStyle): LabelStyle {
  const [style, setStyle] = useState<LabelStyle>(prop ?? "names");
  useEffect(() => {
    setStyle(prop ?? (new URLSearchParams(window.location.search).get("labels") === "rules" ? "rules" : "names"));
  }, [prop]);
  return style;
}

/* the app's cards over the canvas that its inset does not hold (the key at the top right), in the canvas's pixels, for the
   rules style's words to keep clear of: the app's elements marked data-city-hud that stand open over the city; read once a second */
export function useHud(region: { current: HTMLDivElement | null }, on: boolean) {
  const boxes = useRef<[number, number, number, number][]>([]);
  useEffect(() => {
    boxes.current = [];
    if (!on) return;
    const read = () => {
      const el = region.current;
      const root = el?.parentElement;
      if (!el || !root) return;
      const r0 = el.getBoundingClientRect();
      const out: [number, number, number, number][] = [];
      root.querySelectorAll<HTMLElement>("[data-city-hud]").forEach((card) => {
        if (el.contains(card) || card.closest("[aria-hidden='true']")) return;
        const r = card.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(card).opacity === "0") return;
        out.push([r.left - r0.left - 6, r.top - r0.top - 6, r.right - r0.left + 6, r.bottom - r0.top + 6]);
      });
      boxes.current = out;
    };
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [region, on]);
  return boxes;
}

/** the logos' option Owen is shown: ?logos=mono puts them in the brand's ink at rest; the live page keeps their colors */
export function useMonoLogos(): boolean {
  const [mono, setMono] = useState(false);
  useEffect(() => setMono(new URLSearchParams(window.location.search).get("logos") === "mono"), []);
  return mono;
}

/** the finish: the high tier takes the frame through passes of its own (Post.tsx), and ?fx=0 draws it straight to the
    canvas, for a comparison. Read at the first render, since the canvas's context is made with its antialiasing on or off */
export function useFx(): boolean {
  const [fx] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fx") !== "0");
  return fx;
}
