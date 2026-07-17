import React from "react";

/* ------------------------------------------------------------------ */
/* StakeGlobe — a rotating wireframe sphere behind the stake figure:   */
/* the validator set, distributed around the planet, with activity.    */
/*                                                                      */
/* Same drawing language as PillarDiagrams: hairline zinc strokes, red  */
/* only for what is alive. Pure SMIL, so it renders without JS and      */
/* stays hydration-safe.                                                */
/*                                                                      */
/* The 3D: orthographic projection, vertical spin axis, slight tilt.    */
/* - Latitude rings are static ellipses (they don't move under a       */
/*   vertical-axis rotation).                                           */
/* - Meridians are vertical ellipses whose rx samples |sin(φ + ωt)| —  */
/*   the projected width of a great circle as it turns.                 */
/* - Validators ride their latitude ring: translate animates through   */
/*   (0,+B) → (A,0) → (0,−B) → (−A,0), i.e. front → right limb → back  */
/*   → left limb, with sine easing; opacity/scale drop on the far side. */
/*   Negative `begin` values phase each validator around the sphere.    */
/* All share one 24s revolution, so the set rotates rigidly together.   */
/* ------------------------------------------------------------------ */

const CX = 450;
const CY = 160;
const R = 150;
const REV = "24s";
// quarter-phase sine easing: x(t)=A·sin(2πt) sampled at quarter turns
const SINE = "0.37 0 0.63 1;0.37 0 0.63 1;0.37 0 0.63 1;0.37 0 0.63 1";
const QUARTERS = "0;0.25;0.5;0.75;1";

// latitude rings: y = CY − 146·sinλ, rx = R·cosλ, ry = 0.22·rx (tilt)
const LATITUDES = [
  { cy: 57, rx: 106, ry: 23 }, // 45°N
  { cy: 122, rx: 145, ry: 32 }, // 15°N
  { cy: 160, rx: 150, ry: 33 }, // equator
  { cy: 210, rx: 141, ry: 31 }, // 20°S
  { cy: 263, rx: 106, ry: 23 }, // 45°S
];

// meridian projected widths |sin(φ0 + ωt)|·R at eighth-turns
const MERIDIANS = [
  "1;106;150;106;1;106;150;106;1", // φ0 = 0°
  "130;145;75;39;130;145;75;39;130", // φ0 = 60°
  "130;39;75;145;130;39;75;145;130", // φ0 = 120°
];
const EIGHTHS = "0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1";

// validators: one per {latitude ring, phase}. A/B are the ring's semi-axes
// (dots sit fractionally inside the surface); begin offsets spread the set
// in longitude; ping staggers the red activity so something is always live.
const VALIDATORS = [
  { y: 57, a: 100, b: 22, begin: "-2s", ping: "0s" },
  { y: 57, a: 100, b: 22, begin: "-14s", ping: "-3.4s" },
  { y: 122, a: 136, b: 30, begin: "-7s", ping: "-1.2s" },
  { y: 122, a: 136, b: 30, begin: "-19s", ping: "-5.1s" },
  { y: 210, a: 133, b: 29, begin: "-4s", ping: "-2.3s" },
  { y: 210, a: 133, b: 29, begin: "-16s", ping: "-6s" },
  { y: 263, a: 100, b: 22, begin: "-10s", ping: "-4.5s" },
];

function orbit(a: number, b: number) {
  return `0 ${b};${a} 0;0 ${-b};${-a} 0;0 ${b}`;
}

export default function StakeGlobe() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-6 right-6 hidden w-[50%] md:block lg:inset-y-8 lg:right-10 [mask-image:linear-gradient(to_left,black_65%,transparent_98%)]"
    >
      <svg
        viewBox="0 0 640 320"
        preserveAspectRatio="xMaxYMid meet"
        className="h-full w-full text-zinc-300 dark:text-zinc-700"
      >
        {/* limb */}
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth={1.25} stroke="currentColor" />

        {/* latitude rings — static under a vertical-axis spin */}
        {LATITUDES.map((lat) => (
          <ellipse
            key={lat.cy}
            cx={CX}
            cy={lat.cy}
            rx={lat.rx}
            ry={lat.ry}
            fill="none"
            strokeWidth={1}
            opacity={0.45}
            stroke="currentColor"
          />
        ))}

        {/* meridians — projected width breathes with the turn */}
        {MERIDIANS.map((values, i) => (
          <ellipse key={i} cx={CX} cy={CY} ry={R} fill="none" strokeWidth={1} opacity={0.4} stroke="currentColor">
            <animate
              attributeName="rx"
              values={values}
              keyTimes={EIGHTHS}
              dur={REV}
              repeatCount="indefinite"
            />
          </ellipse>
        ))}

        {/* the validator set, riding the surface */}
        {VALIDATORS.map((v, i) => (
          <g key={i}>
            {/* one group per validator: position comes from the shared
                revolution, depth from the synchronized opacity fade */}
            <g transform={`translate(${CX} ${v.y})`}>
              <g>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={orbit(v.a, v.b)}
                  keyTimes={QUARTERS}
                  calcMode="spline"
                  keySplines={SINE}
                  dur={REV}
                  begin={v.begin}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0.5;0.25;0.5;0.9"
                  keyTimes={QUARTERS}
                  dur={REV}
                  begin={v.begin}
                  repeatCount="indefinite"
                />
                <circle r={3.5} className="fill-zinc-500 dark:fill-zinc-400" />
                {/* activity: the validator broadcasts as it travels */}
                <circle r={3.5} fill="none" strokeWidth={1} stroke="#E6212F">
                  <animate attributeName="r" values="3.5;16" dur="7s" begin={v.ping} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="7s" begin={v.ping} repeatCount="indefinite" />
                </circle>
              </g>
            </g>
          </g>
        ))}

        {/* a message racing the surface along the equator — faster than the
            revolution, so it visibly overtakes the validators */}
        <g transform={`translate(${CX} 160)`}>
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values={orbit(141, 31)}
              keyTimes={QUARTERS}
              calcMode="spline"
              keySplines={SINE}
              dur="8s"
              repeatCount="indefinite"
            />
            <animate attributeName="opacity" values="1;0.5;0.2;0.5;1" keyTimes={QUARTERS} dur="8s" repeatCount="indefinite" />
            <circle r={2.5} fill="#E6212F" />
          </g>
        </g>
      </svg>
    </div>
  );
}
