"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import l1ChainsData from "@/constants/l1-chains.json";

const GLOBE_CENTER = { x: 400, y: 400 };
const GLOBE_RADIUS = 400;
const VIEWBOX = "-1 -1 802 802";

const LATITUDES = [100, 200, 300, 400, 500, 600, 700];
const LONGITUDE_RX = [0, 123.097, 235.355, 328.701, 400];

const getXOnEllipse = (rx: number, y: number) => {
  if (rx === 0) return GLOBE_CENTER.x;
  const ry = GLOBE_RADIUS;
  const cy = GLOBE_CENTER.y;
  const dy = (y - cy) / ry;
  const term = Math.sqrt(Math.max(0, 1 - dy * dy));
  return rx * term;
};

interface GridPoint {
  id: string;
  x: number;
  y: number;
  latY: number;
  longRx: number;
  side: "left" | "right";
  label?: string;
}

const ALL_GRID_POINTS: GridPoint[] = [];
LATITUDES.forEach((y) => {
  LONGITUDE_RX.forEach((rx) => {
    if (rx === 0) {
      ALL_GRID_POINTS.push({
        id: `p-${y}-0`,
        x: GLOBE_CENTER.x,
        y,
        latY: y,
        longRx: 0,
        side: "right",
      });
    } else {
      const xRight = GLOBE_CENTER.x + getXOnEllipse(rx, y);
      ALL_GRID_POINTS.push({
        id: `p-${y}-${rx}-r`,
        x: xRight,
        y,
        latY: y,
        longRx: rx,
        side: "right",
      });
      const xLeft = GLOBE_CENTER.x - getXOnEllipse(rx, y);
      ALL_GRID_POINTS.push({
        id: `p-${y}-${rx}-l`,
        x: xLeft,
        y,
        latY: y,
        longRx: rx,
        side: "left",
      });
    }
  });
});

const VALID_POINTS = ALL_GRID_POINTS.filter((p) => p.longRx < 400);

const CHAIN_POSITIONS: Record<string, string> = {
  "c-chain": "p-400-0",
  henesys: "p-200-235.355-l",
  cx: "p-200-235.355-r",
  coqnet: "p-300-328.701-l",
  dexalot: "p-300-328.701-r",
  numi: "p-400-235.355-l",
  zeroonemainnet: "p-400-235.355-r",
  artery: "p-500-328.701-l",
  plyr: "p-500-328.701-r",
  lamina1: "p-600-235.355-l",
  blaze: "p-600-235.355-r",
  gunzilla: "p-100-123.097-l",
  straitsx: "p-100-123.097-r",
  hashfire: "p-700-123.097-l",
};

const getChainDataBySlug = (slug: string) => {
  return l1ChainsData.find((c) => c.slug === slug);
};

const CHAIN_LOGOS: Record<
  string,
  { logo: string; name: string; position: string; color: string }
> = Object.fromEntries(
  Object.entries(CHAIN_POSITIONS).map(([slug, position]) => {
    const chainData = getChainDataBySlug(slug);
    return [
      slug,
      {
        logo: chainData?.chainLogoURI || "",
        name: chainData?.chainName || slug,
        position,
        color: chainData?.color || "#E84142",
      },
    ];
  })
);

const getChainColorByPosition = (position: string): string => {
  const chain = Object.values(CHAIN_LOGOS).find((c) => c.position === position);
  return chain?.color || "#E84142";
};

interface ChainConnection {
  from: string;
  to: string;
  messageCount: number;
  fromChain: string;
  toChain: string;
}

// this is a placeholder for the actual chain connections (will be replaced with actual data from api)
const CHAIN_CONNECTIONS: ChainConnection[] = [
  {
    from: "p-400-0",
    to: "p-300-328.701-r",
    messageCount: 15000,
    fromChain: "C-Chain",
    toChain: "Dexalot",
  },
  {
    from: "p-300-328.701-r",
    to: "p-400-0",
    messageCount: 14000,
    fromChain: "Dexalot",
    toChain: "C-Chain",
  },
  {
    from: "p-400-0",
    to: "p-300-328.701-l",
    messageCount: 12000,
    fromChain: "C-Chain",
    toChain: "Coqnet",
  },
  {
    from: "p-300-328.701-l",
    to: "p-400-0",
    messageCount: 11000,
    fromChain: "Coqnet",
    toChain: "C-Chain",
  },
  {
    from: "p-400-0",
    to: "p-200-235.355-r",
    messageCount: 10000,
    fromChain: "C-Chain",
    toChain: "CX",
  },
  {
    from: "p-200-235.355-r",
    to: "p-400-0",
    messageCount: 9500,
    fromChain: "CX",
    toChain: "C-Chain",
  },
  {
    from: "p-400-0",
    to: "p-200-235.355-l",
    messageCount: 9000,
    fromChain: "C-Chain",
    toChain: "Henesys",
  },
  {
    from: "p-200-235.355-l",
    to: "p-400-0",
    messageCount: 8500,
    fromChain: "Henesys",
    toChain: "C-Chain",
  },
  {
    from: "p-400-0",
    to: "p-500-328.701-l",
    messageCount: 7000,
    fromChain: "C-Chain",
    toChain: "Artery",
  },
  {
    from: "p-500-328.701-l",
    to: "p-400-0",
    messageCount: 6500,
    fromChain: "Artery",
    toChain: "C-Chain",
  },
  {
    from: "p-400-0",
    to: "p-100-123.097-l",
    messageCount: 5500,
    fromChain: "C-Chain",
    toChain: "Gunzilla",
  },
  {
    from: "p-100-123.097-l",
    to: "p-400-0",
    messageCount: 5000,
    fromChain: "Gunzilla",
    toChain: "C-Chain",
  },
  {
    from: "p-400-0",
    to: "p-600-235.355-l",
    messageCount: 4500,
    fromChain: "C-Chain",
    toChain: "Lamina1",
  },
  {
    from: "p-600-235.355-l",
    to: "p-400-0",
    messageCount: 4000,
    fromChain: "Lamina1",
    toChain: "C-Chain",
  },
];

export function ICMGlobe() {
  const id = useId();
  const [mounted, setMounted] = useState(false);
  const [activeBeams, setActiveBeams] = useState<
    { start: string; end: string; id: number; connection: ChainConnection }[]
  >([]);
  const [markers, setMarkers] = useState<GridPoint[]>([]);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const selectedMarkers: GridPoint[] = [];
    Object.entries(CHAIN_LOGOS).forEach(([slug, chainData]) => {
      const point = VALID_POINTS.find((p) => p.id === chainData.position);
      if (point) {
        selectedMarkers.push({
          ...point,
          label: chainData.name,
        });
      }
    });

    setMarkers(selectedMarkers);

    const totalMessages = CHAIN_CONNECTIONS.reduce(
      (sum, c) => sum + c.messageCount,
      0
    );

    const interval = setInterval(() => {
      const rand = Math.random() * totalMessages;
      let cumulative = 0;
      let selectedConnection: ChainConnection | undefined;

      for (const conn of CHAIN_CONNECTIONS) {
        cumulative += conn.messageCount;
        if (rand <= cumulative) {
          selectedConnection = conn;
          break;
        }
      }

      if (selectedConnection) {
        setActiveBeams((prev) => [
          ...prev.slice(-5),
          {
            start: selectedConnection.from,
            end: selectedConnection.to,
            id: Date.now(),
            connection: selectedConnection,
          },
        ]);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  const getGridPath = (startId: string, endId: string) => {
    const start = VALID_POINTS.find((p) => p.id === startId);
    const end = VALID_POINTS.find((p) => p.id === endId);
    if (!start || !end) return "";

    let path = `M ${start.x} ${start.y} `;

    const intermediateXOffset = getXOnEllipse(start.longRx, end.y);
    const intermediateX =
      start.side === "right"
        ? GLOBE_CENTER.x + intermediateXOffset
        : start.side === "left"
        ? GLOBE_CENTER.x - intermediateXOffset
        : GLOBE_CENTER.x;

    if (start.longRx === 0) {
      path += `L ${GLOBE_CENTER.x} ${end.y} `;
    } else {
      const rx = start.longRx;
      const ry = GLOBE_RADIUS;
      const movingDown = end.y > start.y;
      const largeArc = Math.abs(end.y - start.y) > GLOBE_RADIUS ? 1 : 0;

      let sweep = 0;
      if (start.side === "right") {
        sweep = movingDown ? 1 : 0;
      } else {
        sweep = movingDown ? 0 : 1;
      }

      path += `A ${rx} ${ry} 0 ${largeArc} ${sweep} ${intermediateX} ${end.y} `;
    }

    path += `L ${end.x} ${end.y}`;

    return path;
  };

  if (!mounted) return null;

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      <svg viewBox={VIEWBOX} className="w-full h-full">
        <g
          className="stroke-neutral-300 dark:stroke-neutral-700/60"
          fill="none"
          strokeWidth="1"
        >
          <circle
            cx="400"
            cy="400"
            r="400"
            className="stroke-neutral-300 dark:stroke-neutral-700/40"
          />

          {LONGITUDE_RX.map((rx, idx) =>
            rx > 0 ? (
              <g key={`long-${idx}`}>
                <path
                  d={`M 400 800 A ${rx} 400 0 0 0 400 0`}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={`M 400 0 A ${rx} 400 0 0 0 400 800`}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : (
              <path
                key={`long-center`}
                d="M 400 800 L 400 0"
                vectorEffect="non-scaling-stroke"
              />
            )
          )}

          {LATITUDES.map((y) => {
            const dy = Math.abs(y - 400);
            const dx = Math.sqrt(400 * 400 - dy * dy);
            return (
              <path
                key={`lat-${y}`}
                d={`M ${400 - dx} ${y} h ${2 * dx}`}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {activeBeams.map((beam) => {
          const d = getGridPath(beam.start, beam.end);
          if (!d) return null;

          const sourceColor = getChainColorByPosition(beam.start);

          return (
            <g key={beam.id}>
              <motion.path
                d={d}
                fill="none"
                stroke={sourceColor}
                strokeWidth="3"
                strokeOpacity="0.4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  times: [0, 0.1, 0.9, 1],
                }}
              />
              <motion.path
                d={d}
                fill="none"
                stroke={sourceColor}
                strokeWidth="1.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  times: [0, 0.1, 0.9, 1],
                }}
              />
            </g>
          );
        })}

        {markers.map((point) => {
          const chainEntry = Object.entries(CHAIN_LOGOS).find(
            ([_, data]) => data.position === point.id
          );
          const chainSlug = chainEntry?.[0];
          const chainLogo = chainEntry?.[1]?.logo;

          return (
            <g
              key={point.id}
              transform={`translate(${point.x}, ${point.y})`}
              className="cursor-pointer transition-transform"
              onMouseEnter={() => setHoveredMarker(point.id)}
              onMouseLeave={() => setHoveredMarker(null)}
            >
              <motion.circle
                r="25"
                className="fill-white/90 stroke-neutral-300 dark:fill-neutral-900/90 dark:stroke-neutral-600"
                strokeWidth="2"
                animate={{
                  scale: hoveredMarker === point.id ? 1.15 : 1,
                }}
                transition={{ duration: 0.2 }}
              />

              {chainLogo ? (
                <foreignObject x="-20" y="-20" width="40" height="40">
                  <div className="w-full h-full flex items-center justify-center">
                    <Image
                      src={chainLogo}
                      alt={point.label || "Chain"}
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                </foreignObject>
              ) : (
                <circle r="14" className="fill-[#E84142]" />
              )}

              {hoveredMarker === point.id && (
                <motion.circle
                  r="30"
                  className="fill-none stroke-[#E84142]"
                  strokeWidth="2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}

              {hoveredMarker === point.id && point.label && (
                <motion.g
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <rect
                    x="-80"
                    y="-60"
                    width="160"
                    height="40"
                    rx="8"
                    className="fill-neutral-900 dark:fill-neutral-100"
                    fillOpacity="0.95"
                  />
                  <text
                    x="0"
                    y="-33"
                    textAnchor="middle"
                    className="fill-white dark:fill-neutral-900 text-[16px] font-semibold"
                  >
                    {point.label}
                  </text>
                </motion.g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
