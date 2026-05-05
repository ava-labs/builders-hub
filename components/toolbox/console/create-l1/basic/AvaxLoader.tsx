'use client';

import { cn } from '@/lib/utils';

/**
 * Signal loader — bidirectional call-and-response between the two halves
 * of the Avalanche mark.
 *
 * One full cycle (2s) has two packets in flight:
 *   1. Triangle winds up + SEND pulses (big), emitting a ring
 *   2. Spark A arcs from triangle to mountain
 *   3. Mountain RECEIVE pulses (small) with a subtle ring
 *   4. Mountain winds up + SEND pulses (big), emitting a ring
 *   5. Spark B arcs from mountain to triangle (along a different arc)
 *   6. Triangle RECEIVE pulses (small) with a subtle ring
 *   7. Loop seamlessly
 *
 * Send pulses are big (scale 1.18–1.22) with a triple-stacked glow bloom;
 * receive pulses are small (scale 1.08) with a single-layer glow. This
 * asymmetry makes the "who's sending now" readable at a glance.
 *
 * The two arcs (T→M and M→T) use mirrored control points so their peaks
 * don't overlap — the eye can track each direction's journey independently.
 */

const AVAX_BIG_PATH =
  'M95.2 163.4h-43c-4.5 0-6.7 0-8-1a5.7 5.7 0 0 1-2.2-4.6c.1-1.6 1.3-3.5 3.5-7.3l62.7-110c2.3-3.9 3.4-5.8 4.8-6.5a5.7 5.7 0 0 1 5 0c1.4.7 2.6 2.6 4.9 6.5l12.9 22.5.1.1c2.5 4.3 3.7 6.5 4.3 8.8a19 19 0 0 1 0 9.3c-.6 2.3-1.8 4.5-4.3 9l-33 57.8-.1.2c-2.4 4.3-3.7 6.5-5.4 8.2a19 19 0 0 1-8 4.8c-2.2.8-4.7.8-9.7.8Z';

const AVAX_SMALL_PATH =
  'M157.6 163.4h31.2c4.5 0 6.7 0 8-1a5.7 5.7 0 0 0 2.2-4.6c-.1-1.6-1.2-3.5-3.5-7.2l-15.7-27.2c-2.2-3.8-3.4-5.7-4.8-6.4a5.7 5.7 0 0 0-5 0c-1.3.7-2.5 2.6-4.8 6.4L149.6 151l-.1.2c-2.3 3.8-3.4 5.7-3.4 7.3a5.7 5.7 0 0 0 2.2 4.5c1.3 1 3.6 1 8 1Z';

const MOUNTAIN_CX = 97;
const MOUNTAIN_CY = 99;
const TRIANGLE_CX = 172;
const TRIANGLE_CY = 139;

// Two Bezier arcs — T→M flies higher and to the left; M→T flies a little
// lower and to the right. The offset keeps the two flight paths visually
// distinct so they read as distinct routes, not the same line traversed twice.
const PATH_T_TO_M = `M ${TRIANGLE_CX} ${TRIANGLE_CY} Q 126 18 ${MOUNTAIN_CX} ${MOUNTAIN_CY}`;
const PATH_M_TO_T = `M ${MOUNTAIN_CX} ${MOUNTAIN_CY} Q 142 36 ${TRIANGLE_CX} ${TRIANGLE_CY}`;

const BASE_DUR_MS = 2000;

const KEYFRAMES = `
/* Triangle: SEND (big) at 14% · RECEIVE (small) at 85% */
@keyframes avaxTrianglePulse {
  0%, 4%, 26%, 78%, 100% { transform: scale(1); }
  8%                     { transform: scale(0.95); }
  14%                    { transform: scale(1.22); }
  20%                    { transform: scale(1.05); }
  82%                    { transform: scale(0.97); }
  85%                    { transform: scale(1.08); }
  90%                    { transform: scale(1.02); }
}
@keyframes avaxTriangleGlow {
  0%, 4%, 26%, 78%, 100% { filter: drop-shadow(0 0 5px rgba(232,65,66,0.3)); }
  14%                    { filter: drop-shadow(0 0 4px rgba(232,65,66,1))
                                    drop-shadow(0 0 14px rgba(232,65,66,0.9))
                                    drop-shadow(0 0 24px rgba(232,65,66,0.4)); }
  85%                    { filter: drop-shadow(0 0 4px rgba(232,65,66,0.85))
                                    drop-shadow(0 0 12px rgba(232,65,66,0.5)); }
}

/* Mountain: RECEIVE (small) at 35% · SEND (big) at 64% */
@keyframes avaxMountainPulse {
  0%, 28%, 45%, 76%, 100% { transform: scale(1); }
  32%                     { transform: scale(0.97); }
  35%                     { transform: scale(1.08); }
  40%                     { transform: scale(1.02); }
  58%                     { transform: scale(0.95); }
  64%                     { transform: scale(1.18); }
  70%                     { transform: scale(1.04); }
}
@keyframes avaxMountainGlow {
  0%, 28%, 45%, 76%, 100% { filter: drop-shadow(0 0 5px rgba(232,65,66,0.3)); }
  35%                     { filter: drop-shadow(0 0 4px rgba(232,65,66,0.85))
                                     drop-shadow(0 0 12px rgba(232,65,66,0.55)); }
  64%                     { filter: drop-shadow(0 0 4px rgba(232,65,66,1))
                                     drop-shadow(0 0 14px rgba(232,65,66,0.9))
                                     drop-shadow(0 0 24px rgba(232,65,66,0.4)); }
}

@media (prefers-reduced-motion: reduce) {
  [data-avax-loader] * {
    animation-duration: 0s !important;
    animation-iteration-count: 1 !important;
  }
}
`;

export function AvaxLoader({
  size = 84,
  className,
}: {
  /** Width/height of the SVG in px. */
  size?: number;
  className?: string;
}) {
  const dur = `${BASE_DUR_MS}ms`;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <svg
        viewBox="38 28 158 142"
        width={size}
        height={size}
        data-avax-loader
        className={cn('text-red-500 dark:text-red-400', className)}
        style={{ overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Faint "signal highways" — tells the eye where each direction flies
            before the sparks actually traverse. Two mirrored arcs. */}
        <path
          d={PATH_T_TO_M}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
          strokeDasharray="2 3"
          opacity="0.13"
        />
        <path d={PATH_M_TO_T} fill="none" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.1" />

        {/* Triangle SEND ring — emanates at 14% when triangle fires spark A */}
        <circle cx={TRIANGLE_CX} cy={TRIANGLE_CY} r="0" fill="none" stroke="currentColor" strokeWidth="1.2">
          <animate
            attributeName="r"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.04; 0.16; 0.3; 1"
            values="0; 0; 6; 30; 30"
            calcMode="spline"
            keySplines="0 0 1 1; 0.25 0.1 0.25 1; 0 0 1 1; 0 0 1 1"
          />
          <animate
            attributeName="opacity"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.04; 0.16; 0.3; 1"
            values="0; 0; 0.55; 0; 0"
          />
        </circle>

        {/* Mountain RECEIVE ring — small, at 35%, marks arrival of spark A */}
        <circle cx={MOUNTAIN_CX} cy={MOUNTAIN_CY} r="0" fill="none" stroke="currentColor" strokeWidth="1">
          <animate
            attributeName="r"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.28; 0.37; 0.5; 1"
            values="0; 0; 8; 30; 30"
            calcMode="spline"
            keySplines="0 0 1 1; 0.22 0.1 0.25 1; 0 0 1 1; 0 0 1 1"
          />
          <animate
            attributeName="opacity"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.28; 0.37; 0.5; 1"
            values="0; 0; 0.35; 0; 0"
          />
        </circle>

        {/* Mountain SEND ring — big, at 64% when mountain fires spark B */}
        <circle cx={MOUNTAIN_CX} cy={MOUNTAIN_CY} r="0" fill="none" stroke="currentColor" strokeWidth="1.4">
          <animate
            attributeName="r"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.54; 0.66; 0.8; 1"
            values="0; 0; 10; 50; 50"
            calcMode="spline"
            keySplines="0 0 1 1; 0.22 0.1 0.25 1; 0 0 1 1; 0 0 1 1"
          />
          <animate
            attributeName="opacity"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.54; 0.66; 0.8; 1"
            values="0; 0; 0.6; 0; 0"
          />
        </circle>

        {/* Triangle RECEIVE ring — small, at 85%, marks arrival of spark B */}
        <circle cx={TRIANGLE_CX} cy={TRIANGLE_CY} r="0" fill="none" stroke="currentColor" strokeWidth="1">
          <animate
            attributeName="r"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.78; 0.87; 1"
            values="0; 0; 6; 24"
            calcMode="spline"
            keySplines="0 0 1 1; 0.22 0.1 0.25 1; 0 0 1 1"
          />
          <animate
            attributeName="opacity"
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.78; 0.87; 1"
            values="0; 0; 0.4; 0"
          />
        </circle>

        {/* Big mountain — anchor; receives at 35%, sends at 64% */}
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animation: `avaxMountainPulse ${dur} cubic-bezier(0.34, 1.4, 0.64, 1) infinite, avaxMountainGlow ${dur} ease-in-out infinite`,
          }}
        >
          <path d={AVAX_BIG_PATH} fill="currentColor" />
        </g>

        {/* Small triangle — sender/receiver; sends at 14%, receives at 85% */}
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animation: `avaxTrianglePulse ${dur} cubic-bezier(0.34, 1.56, 0.64, 1) infinite, avaxTriangleGlow ${dur} ease-in-out infinite`,
          }}
        >
          <path d={AVAX_SMALL_PATH} fill="currentColor" />
        </g>

        {/* Spark A: triangle → mountain, travels 10–30% of cycle */}
        <g style={{ filter: 'drop-shadow(0 0 3px rgba(232,65,66,0.9))' }}>
          <animateMotion
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.1; 0.3; 1"
            keyPoints="0; 0; 1; 1"
            calcMode="spline"
            keySplines="0 0 1 1; 0.42 0 0.58 1; 0 0 1 1"
            path={PATH_T_TO_M}
          />
          <circle cx="0" cy="0" r="0" fill="currentColor" opacity="0.28">
            <animate
              attributeName="r"
              dur={dur}
              repeatCount="indefinite"
              keyTimes="0; 0.1; 0.12; 0.28; 0.32; 1"
              values="0; 0; 7; 7; 0; 0"
            />
          </circle>
          <circle cx="0" cy="0" r="0" fill="currentColor">
            <animate
              attributeName="r"
              dur={dur}
              repeatCount="indefinite"
              keyTimes="0; 0.1; 0.12; 0.28; 0.32; 1"
              values="0; 0; 2.8; 2.8; 0; 0"
            />
          </circle>
        </g>

        {/* Spark B: mountain → triangle, travels 62–82% of cycle. Slightly
            smaller than Spark A since its pulse origin (mountain SEND) is
            the secondary beat in the narrative. */}
        <g style={{ filter: 'drop-shadow(0 0 3px rgba(232,65,66,0.9))' }}>
          <animateMotion
            dur={dur}
            repeatCount="indefinite"
            keyTimes="0; 0.62; 0.82; 1"
            keyPoints="0; 0; 1; 1"
            calcMode="spline"
            keySplines="0 0 1 1; 0.42 0 0.58 1; 0 0 1 1"
            path={PATH_M_TO_T}
          />
          <circle cx="0" cy="0" r="0" fill="currentColor" opacity="0.26">
            <animate
              attributeName="r"
              dur={dur}
              repeatCount="indefinite"
              keyTimes="0; 0.62; 0.64; 0.8; 0.84; 1"
              values="0; 0; 6; 6; 0; 0"
            />
          </circle>
          <circle cx="0" cy="0" r="0" fill="currentColor">
            <animate
              attributeName="r"
              dur={dur}
              repeatCount="indefinite"
              keyTimes="0; 0.62; 0.64; 0.8; 0.84; 1"
              values="0; 0; 2.4; 2.4; 0; 0"
            />
          </circle>
        </g>
      </svg>
    </>
  );
}
