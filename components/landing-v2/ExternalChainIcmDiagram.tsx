import React from "react";

/* ------------------------------------------------------------------ */
/* External-chain ICM attestor pattern — the page's centrepiece.        */
/*                                                                      */
/* Same drawing language as PillarDiagrams / UseCaseDiagrams: hairline  */
/* zinc strokes, red reserved for the thing that is alive (here, the    */
/* message in flight), SMIL animation so the drawing runs without JS    */
/* and stays in sync with server-rendered markup, and every coordinate  */
/* a pre-rounded literal (computed values hydrate differently).         */
/*                                                                      */
/* Two deliberate restraints, both honesty rather than taste:           */
/*                                                                      */
/*  - No link is drawn between the two registries. Registry             */
/*    synchronisation is an undesigned component of this pattern, and   */
/*    drawing an arrow between them would assert a mechanism that does  */
/*    not exist. The mirroring is stated by cross-labelling instead:    */
/*    each registry is captioned with whose signers it lists.           */
/*  - Weights are drawn as bars of differing length, never as numerals. */
/*    No weight, threshold, or timing figure on this page is measured,  */
/*    so none is rendered as a number.                                  */
/* ------------------------------------------------------------------ */

const MONO_LABEL = "fill-zinc-500 font-mono dark:fill-[#A2AFB2]";
const FAINT_LABEL = "fill-zinc-400 font-mono dark:fill-zinc-500";
const STRONG_LABEL = "fill-zinc-900 font-mono dark:fill-zinc-100";
const HAIRLINE = "stroke-zinc-300 dark:stroke-zinc-500";
const STRONG = "stroke-zinc-900 dark:stroke-zinc-100";
/* One step stronger than HAIRLINE in both themes, so the carrier reads the
   same weight relative to the message lanes in light and dark alike
   (dark:stroke-zinc-400 is brighter than the lanes' dark:stroke-zinc-500). */
const UNTRUSTED = "stroke-zinc-400 dark:stroke-zinc-400";
const NODE_FILL = "fill-zinc-700 dark:fill-zinc-300";
const BAR_FILL = "fill-zinc-300 dark:fill-zinc-600";
const PANEL_FILL = "fill-white dark:fill-zinc-950";

/* Panel A spans x 32..272, panel B x 488..728; B is A offset by +456.
   Rows sit at y 174/194/214/234 inside a registry box of 106..248. */
const ROW_Y = [174, 194, 214, 234];
/* Bar lengths carry "each signature has a weight" without inventing a
   number. Max bar (140) still clears the registry's right inset. */
const WEIGHTS_A = [116, 88, 140, 72];
const WEIGHTS_B = [96, 132, 78, 110];

function ChainPanel({
  x,
  title,
  registryCaption,
  weights,
}: {
  /** left edge of the solid chain panel */
  x: number;
  title: string;
  registryCaption: string;
  weights: number[];
}) {
  const cx = x + 120; // panel is 240 wide
  const inset = x + 16; // registry box left edge
  const nodeX = x + 36;
  const barX = x + 56;
  return (
    <g>
      <rect x={x} y={56} width={240} height={236} rx={2} strokeWidth={1.25} className={`${PANEL_FILL} ${STRONG}`} />
      <text x={cx} y={80} textAnchor="middle" fontSize={10} letterSpacing={1.6} className={STRONG_LABEL}>
        {title}
      </text>
      <line x1={inset} y1={92} x2={inset + 208} y2={92} strokeWidth={1} className={HAIRLINE} />

      {/* the registry: this chain's own list of who may sign for the other side */}
      <rect x={inset} y={106} width={208} height={142} fill="none" strokeWidth={1} className={HAIRLINE} />
      <text x={cx} y={124} textAnchor="middle" fontSize={9} letterSpacing={1.8} className={MONO_LABEL}>
        REGISTRY
      </text>
      <text x={cx} y={138} textAnchor="middle" fontSize={7} letterSpacing={0.8} className={FAINT_LABEL}>
        {registryCaption}
      </text>
      <text x={nodeX} y={157} textAnchor="middle" fontSize={6.5} letterSpacing={0.8} className={FAINT_LABEL}>
        SIGNER
      </text>
      <text x={barX} y={157} fontSize={6.5} letterSpacing={0.8} className={FAINT_LABEL}>
        WEIGHT
      </text>
      {ROW_Y.map((y, i) => (
        <g key={y}>
          <circle cx={nodeX} cy={y} r={4.5} className={NODE_FILL} />
          <rect x={barX} y={y - 3.5} width={weights[i]} height={7} className={BAR_FILL} />
        </g>
      ))}

      <text x={cx} y={272} textAnchor="middle" fontSize={7.5} letterSpacing={0.9} className={MONO_LABEL}>
        THRESHOLD CHECKED ON ARRIVAL
      </text>
    </g>
  );
}

export default function ExternalChainIcmDiagram() {
  return (
    <svg
      viewBox="0 0 760 358"
      role="img"
      aria-label="Two chains side by side, an Avalanche C-Chain and a permissioned EVM network. Each holds its own registry listing the signers authorised on the other chain and the weight each signature carries. Messages travel in both directions through a carrier that sits outside the trust boundary drawn around each chain."
      className="h-auto w-full select-none"
    >
      {/* SMIL ignores prefers-reduced-motion, so the moving dots are swapped
          for parked ones under the media query — still, not gone. Same
          approach SheetBackdrop uses for its blips. */}
      <style>{`
        .icm-flow-static { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .icm-flow-live { display: none; }
          .icm-flow-static { display: inline; }
        }
      `}</style>

      {/* trust boundaries: one around each chain and its registry. The
          corridor between them is deliberately outside both. */}
      <text x={24} y={34} fontSize={7} letterSpacing={1} className={FAINT_LABEL}>
        TRUST BOUNDARY
      </text>
      <text x={736} y={34} textAnchor="end" fontSize={7} letterSpacing={1} className={FAINT_LABEL}>
        TRUST BOUNDARY
      </text>
      <rect x={16} y={40} width={272} height={268} fill="none" strokeWidth={1.25} strokeDasharray="5 7" className={STRONG} />
      <rect x={472} y={40} width={272} height={268} fill="none" strokeWidth={1.25} strokeDasharray="5 7" className={STRONG} />

      <ChainPanel x={32} title="AVALANCHE C-CHAIN" registryCaption="PERMISSIONED-NETWORK SIGNERS" weights={WEIGHTS_A} />
      <ChainPanel x={488} title="PERMISSIONED EVM NETWORK" registryCaption="AVALANCHE SIGNERS" weights={WEIGHTS_B} />

      {/* message lanes: outbound on top, inbound below, both crossing the
          boundary and passing through the carrier */}
      <line x1={272} y1={160} x2={364} y2={160} strokeWidth={1} className={HAIRLINE} />
      <line x1={396} y1={160} x2={488} y2={160} strokeWidth={1} className={HAIRLINE} />
      <polyline points="482,156 488,160 482,164" fill="none" strokeWidth={1.25} className={HAIRLINE} />
      <line x1={396} y1={190} x2={488} y2={190} strokeWidth={1} className={HAIRLINE} />
      <line x1={272} y1={190} x2={364} y2={190} strokeWidth={1} className={HAIRLINE} />
      <polyline points="278,186 272,190 278,194" fill="none" strokeWidth={1.25} className={HAIRLINE} />

      {/* the carrier: a real component, drawn in a lighter stroke than the
          chains because nothing is trusted to it */}
      <rect x={364} y={140} width={32} height={70} rx={2} strokeWidth={1.25} className={`${PANEL_FILL} ${UNTRUSTED}`} />

      {/* the one moving thing: a message in flight, each direction in turn */}
      <circle className="icm-flow-live" cy={160} r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="272;488;488" keyTimes="0;0.42;1" dur="5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.04;0.38;0.44;1" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle className="icm-flow-live" cy={190} r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="488;488;272;272" keyTimes="0;0.5;0.92;1" dur="5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.5;0.54;0.88;0.94;1" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle className="icm-flow-static" cx={330} cy={160} r={4.5} fill="#E6212F" />
      <circle className="icm-flow-static" cx={430} cy={190} r={4.5} fill="#E6212F" />

      <text x={380} y={228} textAnchor="middle" fontSize={8.5} letterSpacing={1.6} className={MONO_LABEL}>
        CARRIER
      </text>
      <text x={380} y={241} textAnchor="middle" fontSize={7} letterSpacing={0.8} className={FAINT_LABEL}>
        OUTSIDE THE
      </text>
      <text x={380} y={252} textAnchor="middle" fontSize={7} letterSpacing={0.8} className={FAINT_LABEL}>
        TRUST BOUNDARY
      </text>
      <text x={380} y={286} textAnchor="middle" fontSize={7.5} letterSpacing={0.9} className={MONO_LABEL}>
        ONLY AVAILABLE FAILURE:
      </text>
      <text x={380} y={297} textAnchor="middle" fontSize={7.5} letterSpacing={0.9} className={MONO_LABEL}>
        NON-DELIVERY
      </text>

      {/* legend, kept inside the frame so it travels with the drawing */}
      <line x1={16} y1={320} x2={744} y2={320} strokeWidth={1} className={HAIRLINE} />
      <line x1={136} y1={337} x2={164} y2={337} strokeWidth={1.25} strokeDasharray="5 7" className={STRONG} />
      <text x={172} y={340} fontSize={7.5} letterSpacing={0.9} className={FAINT_LABEL}>
        TRUST BOUNDARY
      </text>
      <circle cx={262} cy={337} r={4.5} fill="#E6212F" />
      <text x={274} y={340} fontSize={7.5} letterSpacing={0.9} className={FAINT_LABEL}>
        MESSAGE IN FLIGHT
      </text>
      <rect x={378} y={331} width={12} height={12} rx={2} strokeWidth={1.25} className={`${PANEL_FILL} ${UNTRUSTED}`} />
      <text x={398} y={340} fontSize={7.5} letterSpacing={0.9} className={FAINT_LABEL}>
        CARRIER, UNTRUSTED
      </text>
      <circle cx={506} cy={337} r={4.5} className={NODE_FILL} />
      <rect x={516} y={333.5} width={22} height={7} className={BAR_FILL} />
      <text x={546} y={340} fontSize={7.5} letterSpacing={0.9} className={FAINT_LABEL}>
        SIGNER AND WEIGHT
      </text>
    </svg>
  );
}
