"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { HoverReadout, HoverRow } from "@/components/explorer-v2/network/stablecoin-hover";

/* The coverage map: every country a stablecoin on Avalanche answers to,
   in the brand red on a quiet gray world. Countries are keyed by ISO
   3166-1 numeric id to match the vendored world-atlas topology
   (public/geo/countries-110m.json, world-atlas@2). Microstates the 110m
   resolution drops (Singapore, Liechtenstein, Malta) render as dots. */

export interface CoveredCountry {
  name: string;
  flag: string;
  tokens: { symbol: string; logo?: string; usd: number }[];
  usd: number;
}

/* projected dot positions for covered countries with no 110m polygon */
const MICROSTATE_POS: Record<string, [number, number]> = {
  "702": [103.85, 1.29], // Singapore
  "438": [9.55, 47.14], // Liechtenstein
  "470": [14.45, 35.9], // Malta
};

const VIEW_W = 960;
const VIEW_H = 480;

interface CountryShape {
  id: string;
  d: string;
}

/* one fetch per session: the topology is static and ~100kB */
let topologyPromise: Promise<Topology<{ countries: GeometryCollection }>> | null = null;
function loadTopology() {
  topologyPromise ??= fetch("/geo/countries-110m.json").then((res) => {
    if (!res.ok) throw new Error(`topology HTTP ${res.status}`);
    return res.json();
  });
  return topologyPromise;
}

const usdCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function StablecoinMap({ coverage }: { coverage: Map<string, CoveredCountry> }) {
  const [shapes, setShapes] = useState<CountryShape[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitExtent(
        [
          [0, 0],
          [VIEW_W, VIEW_H],
        ],
        { type: "Sphere" } as GeoPermissibleObjects,
      ),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadTopology()
      .then((world) => {
        if (cancelled) return;
        const path = geoPath(projection);
        const countries = feature(world, world.objects.countries).features;
        setShapes(
          countries
            .map((f) => ({
              id: String(f.id ?? "").padStart(3, "0"),
              d: path(f) ?? "",
            }))
            .filter((s) => s.d),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projection]);

  /* covered countries the topology has no polygon for become dots */
  const dots = useMemo(() => {
    if (!shapes) return [];
    const drawn = new Set(shapes.map((s) => s.id));
    return [...coverage.keys()]
      .filter((id) => !drawn.has(id) || MICROSTATE_POS[id])
      .map((id) => {
        const pos = MICROSTATE_POS[id];
        if (!pos) return null;
        const xy = projection(pos);
        return xy ? { id, x: xy[0], y: xy[1] } : null;
      })
      .filter((d): d is { id: string; x: number; y: number } => d !== null);
  }, [shapes, coverage, projection]);

  const onMove = (id: string) => (e: React.MouseEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !coverage.has(id)) return;
    setTip({ id, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (failed) {
    return (
      <p className="flex h-64 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        Map unavailable
      </p>
    );
  }
  if (!shapes) {
    return <div className="h-64 animate-pulse bg-zinc-100 dark:bg-zinc-900" />;
  }

  const tipData = tip ? coverage.get(tip.id) : null;

  return (
    <div ref={frameRef} className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block w-full"
        role="img"
        aria-label="Countries covered by stablecoins on Avalanche"
        onMouseLeave={() => setTip(null)}
      >
        {shapes.map((s, i) => {
          const covered = coverage.has(s.id);
          return (
            <path
              // world-atlas reuses id "-99" for disputed territories, so
              // the id alone is not a safe key
              key={`${s.id}-${i}`}
              d={s.d}
              className={
                covered
                  ? "cursor-pointer fill-[#E6212F] stroke-white transition-opacity hover:opacity-80 dark:stroke-zinc-950"
                  : "fill-zinc-200/80 stroke-white dark:fill-zinc-800/80 dark:stroke-zinc-950"
              }
              strokeWidth={0.5}
              onMouseMove={covered ? onMove(s.id) : undefined}
              onMouseEnter={covered ? onMove(s.id) : undefined}
            />
          );
        })}
        {dots.map((d) => (
          <circle
            key={d.id}
            cx={d.x}
            cy={d.y}
            r={4.5}
            className="cursor-pointer fill-[#E6212F] stroke-white transition-opacity hover:opacity-80 dark:stroke-zinc-950"
            strokeWidth={1}
            onMouseMove={onMove(d.id)}
            onMouseEnter={onMove(d.id)}
          />
        ))}
      </svg>
      {tip && tipData && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2"
          style={{ left: tip.x, top: tip.y + 14 }}
        >
          <HoverReadout
            label={`${tipData.flag} ${tipData.name}`}
            value={`$${usdCompact.format(tipData.usd)}`}
          >
            {[...tipData.tokens]
              .sort((a, b) => b.usd - a.usd)
              .slice(0, 5)
              .map((t) => (
                <HoverRow
                  key={t.symbol}
                  logo={t.logo}
                  label={t.symbol}
                  value={`$${usdCompact.format(t.usd)}`}
                  share={
                    tipData.usd > 0 ? `${((t.usd / tipData.usd) * 100).toFixed(1)}%` : undefined
                  }
                />
              ))}
            {tipData.tokens.length > 5 && (
              <HoverRow
                label={`+${tipData.tokens.length - 5} more`}
                value={`$${usdCompact.format(
                  [...tipData.tokens]
                    .sort((a, b) => b.usd - a.usd)
                    .slice(5)
                    .reduce((sum, t) => sum + t.usd, 0),
                )}`}
              />
            )}
          </HoverReadout>
        </div>
      )}
    </div>
  );
}
