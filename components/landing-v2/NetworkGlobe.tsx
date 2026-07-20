"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import l1ChainsData from "@/constants/l1-chains.json";

/* ------------------------------------------------------------------ */
/* NetworkGlobe — the stats ICM globe, adapted for the homepage stats  */
/* chapter and set spinning. Orthographic projection, vertical axis:   */
/* latitude chords hold still, meridian ellipses breathe with the      */
/* turn, and the L1 markers ride their latitude circles with a depth   */
/* fade as they round the far side. The C-Chain holds the center and   */
/* ICM beams track the moving chains in their brand colors.            */
/*                                                                      */
/* One requestAnimationFrame clock drives rotation, spawning, and      */
/* beam flight, so nothing can drift out of sync. Initial state is     */
/* deterministic (theta 0, no beams), so hydration is safe.            */
/* ------------------------------------------------------------------ */

const C = 400;
const R = 400;
const REV_MS = 40_000; // one revolution
const BEAM_MS = 1_500; // one beam's flight
const SPAWN_MS = 900; // cadence of new beams
const LATITUDES = [100, 200, 300, 400, 500, 600, 700];
const MERIDIAN_PHASES = [0, Math.PI / 3, (2 * Math.PI) / 3];

// the cast: C-Chain pinned at the center, the ecosystem orbiting it,
// each seat a latitude (y) and a starting longitude (phi)
const SEATS: { slug: string; y: number; phi: number }[] = [
  { slug: "gunzilla", y: 130, phi: 0.3 },
  { slug: "straitsx", y: 190, phi: 2.4 },
  { slug: "henesys", y: 250, phi: 4.6 },
  { slug: "cx", y: 310, phi: 1.5 },
  { slug: "dexalot", y: 370, phi: 3.6 },
  { slug: "beam", y: 430, phi: 5.5 },
  { slug: "lamina1", y: 490, phi: 0.9 },
  { slug: "blaze", y: 550, phi: 3.0 },
  { slug: "hashfire", y: 610, phi: 5.0 },
];

const chainBySlug = (slug: string) => l1ChainsData.find((c) => c.slug === slug);

const SPOKES = SEATS.map((seat) => ({
  ...seat,
  rLat: Math.sqrt(Math.max(0, R * R - (seat.y - C) * (seat.y - C))),
  logo: chainBySlug(seat.slug)?.chainLogoURI || "",
  color: chainBySlug(seat.slug)?.color || "#E6212F",
}));

const HUB = {
  logo: chainBySlug("c-chain")?.chainLogoURI || "",
  color: chainBySlug("c-chain")?.color || "#E6212F",
};

interface Beam {
  spoke: number;
  born: number;
  outbound: boolean;
}

function spokeAt(spoke: (typeof SPOKES)[number], theta: number) {
  const a = spoke.phi + theta;
  const x = C + spoke.rLat * Math.sin(a);
  const depth = Math.cos(a); // 1 front, -1 back
  return { x, y: spoke.y, depth };
}

export default function NetworkGlobe() {
  const [now, setNow] = useState(0);
  const beamsRef = useRef<Beam[]>([]);
  const lastSpawnRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedRef.current) {
      setNow(REV_MS * 0.12); // a still frame partway into the turn
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = t - start;
      if (elapsed - lastSpawnRef.current > SPAWN_MS) {
        lastSpawnRef.current = elapsed;
        beamsRef.current = [
          ...beamsRef.current.filter((b) => elapsed - b.born < BEAM_MS),
          {
            spoke: Math.floor(Math.random() * SPOKES.length),
            born: elapsed,
            outbound: Math.random() < 0.5,
          },
        ];
      }
      setNow(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const theta = (now / REV_MS) * 2 * Math.PI;

  // back-to-front paint order so near markers pass in front of far ones
  const placed = SPOKES.map((spoke, i) => ({ spoke, i, ...spokeAt(spoke, theta) })).sort(
    (a, b) => a.depth - b.depth
  );

  return (
    <div aria-hidden className="pointer-events-none hidden items-center justify-end md:mr-10 md:flex lg:mr-24 xl:mr-36">
      <svg viewBox="-1 -21 802 842" className="h-40 w-auto lg:h-48">
        {/* the desk-globe tilt: an orthographic sphere rotated in-plane is
            still a sphere, so every orbit stays consistent under it */}
        <g transform={`rotate(18 ${C} ${C})`}>
        {/* the axis it spins on, pinned at the poles */}
        <g strokeWidth={1.25} className="stroke-zinc-400 dark:stroke-zinc-600">
          <path d={`M ${C} -32 L ${C} 4`} vectorEffect="non-scaling-stroke" />
          <path d={`M ${C} 796 L ${C} 832`} vectorEffect="non-scaling-stroke" />
        </g>
        {/* the wireframe: limb and still latitude chords */}
        <g fill="none" strokeWidth={1} className="stroke-zinc-300 dark:stroke-zinc-700/60">
          <circle cx={C} cy={C} r={R} className="stroke-zinc-400 dark:stroke-zinc-600" vectorEffect="non-scaling-stroke" />
          {LATITUDES.map((y) => {
            const dx = Math.sqrt(R * R - (y - C) * (y - C));
            return <path key={y} d={`M ${C - dx} ${y} h ${2 * dx}`} vectorEffect="non-scaling-stroke" />;
          })}
          {/* meridians: projected width breathes as the sphere turns */}
          {MERIDIAN_PHASES.map((phase, i) => {
            const rx = Math.abs(Math.sin(phase + theta)) * R;
            return rx < 1 ? (
              <path key={i} d={`M ${C} 0 L ${C} 800`} vectorEffect="non-scaling-stroke" />
            ) : (
              <ellipse key={i} cx={C} cy={C} rx={rx} ry={R} vectorEffect="non-scaling-stroke" />
            );
          })}
        </g>

        {/* ICM traffic: comets between the hub and the moving chains */}
        {beamsRef.current.map((beam) => {
          const p = (now - beam.born) / BEAM_MS;
          if (p < 0 || p >= 1) return null;
          const spoke = SPOKES[beam.spoke];
          const pos = spokeAt(spoke, theta);
          const [fx, fy, tx, ty] = beam.outbound ? [C, C, pos.x, pos.y] : [pos.x, pos.y, C, C];
          const head = Math.min(1, p * 1.3);
          const tail = Math.max(0, p * 1.3 - 0.35);
          const color = beam.outbound ? HUB.color : spoke.color;
          const depthDim = 0.45 + 0.55 * (pos.depth + 1) / 2;
          return (
            <line
              key={`${beam.spoke}-${beam.born}`}
              x1={fx + (tx - fx) * tail}
              y1={fy + (ty - fy) * tail}
              x2={fx + (tx - fx) * head}
              y2={fy + (ty - fy) * head}
              stroke={color}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={(1 - p * 0.5) * depthDim}
            />
          );
        })}

        {/* the ecosystem, riding the surface */}
        {placed.map(({ spoke, x, y, depth }) => {
          const near = (depth + 1) / 2; // 0 far, 1 near
          const scale = 0.68 + 0.32 * near;
          const opacity = 0.3 + 0.7 * near;
          return (
            <g key={spoke.slug} transform={`translate(${x}, ${y}) scale(${scale}) rotate(-18)`} opacity={opacity}>
              <circle r={32} strokeWidth={2} className="fill-white stroke-zinc-300 dark:fill-zinc-950 dark:stroke-zinc-700" />
              {spoke.logo ? (
                <foreignObject x={-24} y={-24} width={48} height={48}>
                  <div className="flex h-full w-full items-center justify-center">
                    <Image src={spoke.logo} alt="" width={44} height={44} className="rounded-full object-cover" />
                  </div>
                </foreignObject>
              ) : (
                <circle r={14} fill="#E6212F" />
              )}
            </g>
          );
        })}

        {/* the C-Chain, holding the center */}
        <g transform={`translate(${C}, ${C}) rotate(-18)`}>
          <circle r={38} strokeWidth={2} className="fill-white stroke-zinc-400 dark:fill-zinc-950 dark:stroke-zinc-600" />
          {HUB.logo ? (
            <foreignObject x={-28} y={-28} width={56} height={56}>
              <div className="flex h-full w-full items-center justify-center">
                <Image src={HUB.logo} alt="" width={52} height={52} className="rounded-full object-cover" />
              </div>
            </foreignObject>
          ) : (
            <circle r={16} fill="#E6212F" />
          )}
        </g>
        </g>
      </svg>
    </div>
  );
}
