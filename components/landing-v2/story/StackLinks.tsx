"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import type { StackLayer, StackPoint } from "./three/StackScene";
import { stackAreas } from "./three/stackLayout";

/* The stack drawing's links, laid over it: each layer, each label and the
   plate open their docs. They are drawn from the scene's own layout, so
   they sit on the still at the size it was shot at and on the canvas at the
   box's size. Over the still they take the pointer; over the canvas the
   scene takes it, and these serve the keyboard and screen readers. The tab
   stops are the labels, top first as they read, then the plate. */

// the box sizes the stills were shot at, in CSS px: the wide one on the page at 1440 px, the narrow one in a 390 px box
const STILL = { width: 706, height: 630 };
const STILL_NARROW = { width: 390, height: 360 };

const RED = "#E6212F";

type Target = Exclude<StackPoint, null>;

interface Handlers {
  /** the pointer is on a part, or on none */
  onPoint: (point: StackPoint) => void;
  /** a link has the keyboard's focus on a part, or none has */
  onFocusPoint: (point: StackPoint) => void;
  onSelect: (point: Target, newTab: boolean) => void;
}

export function StackLinks({
  layers,
  plate,
  scene,
  active,
  rings,
  ...handlers
}: {
  layers: StackLayer[];
  plate: { label: string; href: string };
  /** true while the canvas shows: the scene takes the pointer */
  scene: boolean;
  /** what the pointer or the keyboard's focus is on */
  active: StackPoint;
  /** false hides the focus rings: the canvas stack is not open, so the parts are not where the rings are drawn */
  rings: boolean;
} & Handlers) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shared = { layers, plate, active, rings, ...handlers };
  return (
    <div ref={ref} className={`absolute inset-0 ${scene ? "pointer-events-none" : ""}`}>
      {scene ? (
        // the canvas draws the labeled stack at every width, framed for the box,
        // with the layer the scene lights lifted (the validator set at rest)
        <Areas
          {...shared}
          box={size ?? STILL}
          labels
          lifted={active === null ? 0 : active === "plate" ? null : active}
          scene
          className=""
        />
      ) : (
        <>
          {/* the stills show the validator set lit, so lifted */}
          <Areas {...shared} box={STILL} labels lifted={0} scene={false} className="hidden md:block" />
          {/* under 768 px the narrow still has no labels: the list under the drawing holds the layers' links */}
          <Areas {...shared} box={STILL_NARROW} labels={false} lifted={0} scene={false} className="md:hidden" />
        </>
      )}
    </div>
  );
}

function Areas({
  box,
  labels,
  lifted,
  layers,
  plate,
  scene,
  active,
  rings,
  onPoint,
  onFocusPoint,
  onSelect,
  className,
}: {
  box: { width: number; height: number };
  labels: boolean;
  /** the layer drawn lifted */
  lifted: number | null;
  layers: StackLayer[];
  plate: { label: string; href: string };
  scene: boolean;
  active: StackPoint;
  rings: boolean;
  className: string;
} & Handlers) {
  const areas = stackAreas(box.width, box.height, layers.length, labels, lifted);
  // useId's colons or guillemets would break a url(#id) reference
  const id = useId().replace(/[^\w-]/g, "");
  const above = (i: number) => `${id}-above-${i}`;
  const open = (point: Target) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onSelect(point, e.metaKey || e.ctrlKey || e.shiftKey);
  };
  // the parts that take the pointer only: a click, a middle click (a new tab, as on a link), and the hover
  const pointerOnly = (point: Target) => ({
    className: "cursor-pointer",
    onClick: open(point),
    onAuxClick: (e: MouseEvent) => {
      if (e.button === 1) onSelect(point, true);
    },
    onPointerEnter: () => onPoint(point),
    onPointerLeave: () => onPoint(null),
  });
  const focus = (point: Target) => ({
    onFocus: () => onFocusPoint(point),
    onBlur: () => onFocusPoint(null),
  });
  const ring = rings ? "group-focus-visible:stroke-[#E6212F]" : "";
  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      className={`absolute inset-0 h-full w-full overflow-visible ${className}`}
      // with labels the links form a group; the narrow drawing has the plate's link only
      {...(labels ? { role: "group", "aria-label": "Docs for each part of the drawing" } : { role: "none" })}
    >
      {/* each part's face as drawn, less what stands over it: a layer's mask
          hides the layers above it, the plate's hides them all */}
      <defs>
        {[...areas.layers.keys(), areas.layers.length].map((i) => (
          <mask key={i} id={above(i)} maskUnits="userSpaceOnUse" x={0} y={0} width={box.width} height={box.height}>
            <rect width={box.width} height={box.height} fill="white" />
            {areas.layers.slice(i === areas.layers.length ? 0 : i + 1).map((points, j) => (
              <polygon key={j} points={points} fill="black" />
            ))}
          </mask>
        ))}
      </defs>
      {/* over the still, the part the reader points at or focuses takes a red tint; over the canvas the scene lights it */}
      {!scene && active !== null && (
        <polygon
          points={active === "plate" ? areas.plate : areas.layers[active]}
          mask={`url(#${above(active === "plate" ? areas.layers.length : active)})`}
          fill={RED}
          pointerEvents="none"
          className="[fill-opacity:0.14] dark:[fill-opacity:0.3]"
        />
      )}
      {/* the pointer's targets over the still, as drawn: the plate, then each layer over it */}
      <polygon points={areas.plate} fill="transparent" {...pointerOnly("plate")} />
      {areas.layers.map((points, i) => (
        <polygon key={layers[i].key} points={points} fill="transparent" {...pointerOnly(i)} />
      ))}
      {/* the labels' text, top first as they read */}
      {[...areas.labels.keys()].reverse().map((i) => {
        const area = areas.labels[i];
        return (
          <a
            key={layers[i].key}
            href={layers[i].href}
            aria-label={`${layers[i].label}: ${layers[i].line}`}
            className="group outline-none"
            onClick={open(i)}
            onPointerEnter={() => onPoint(i)}
            onPointerLeave={() => onPoint(null)}
            {...focus(i)}
          >
            <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="transparent" />
            {/* the ring stands clear of the text */}
            <rect
              x={area.x - 8}
              y={area.y - 5}
              width={area.width + 12}
              height={area.height + 10}
              rx={4}
              fill="none"
              stroke="transparent"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              className={ring}
            />
          </a>
        );
      })}
      {/* the plate's link for the keyboard and screen readers, last as the
          drawing reads top down. Its ring runs on the plate's visible edges */}
      <a href={plate.href} aria-label={`${plate.label} docs`} className="group outline-none" onClick={open("plate")} {...focus("plate")}>
        <polygon
          points={areas.plate}
          mask={`url(#${above(areas.layers.length)})`}
          fill="none"
          stroke="transparent"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          className={ring}
        />
      </a>
    </svg>
  );
}
