import React from "react";

/* ------------------------------------------------------------------ */
/* Use-case diagrams — one instrument per institutional pattern, in    */
/* the PrivacyModelDiagrams drawing language: hairline zinc strokes,   */
/* red reserved for the thing that is alive, and SMIL animation so     */
/* they render without JS and stay hydration-safe.                     */
/* Every coordinate is a pre-rounded literal.                          */
/* ------------------------------------------------------------------ */

const MONO = "fill-zinc-500 font-mono dark:fill-zinc-400";
const FAINT_LABEL = "fill-zinc-400 font-mono dark:fill-zinc-500";
const HAIRLINE = "stroke-zinc-300 dark:stroke-zinc-700";
const STRONG = "stroke-zinc-900 dark:stroke-zinc-100";
const NODE = "fill-zinc-700 dark:fill-zinc-300";
const GLYPH = "fill-zinc-900 font-mono dark:fill-zinc-100";

function frame(label: string) {
  return {
    viewBox: "0 0 420 200",
    className: "w-full max-w-[440px] select-none",
    role: "img" as const,
    "aria-label": label,
  };
}

/* Tokenized Deposits — two issuer ledgers; a deposit token burns on one  */
/* and a distinct token mints on the other, attested across ICM. The      */
/* asset never pools: one liability retires, another is issued.           */
function TokenizedDeposits() {
  return (
    <svg {...frame("A deposit token burned on one issuer's ledger and minted on another, attested over ICM")}>
      {/* issuer A ledger */}
      <rect x={36} y={44} width={128} height={100} rx={12} fill="none" strokeWidth={1.25} className={STRONG} />
      <text x={100} y={62} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>ISSUER A</text>
      <line x1={48} y1={70} x2={152} y2={70} strokeWidth={1} className={HAIRLINE} />

      {/* issuer B ledger */}
      <rect x={256} y={44} width={128} height={100} rx={12} fill="none" strokeWidth={1.25} className={STRONG} />
      <text x={320} y={62} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>ISSUER B</text>
      <line x1={268} y1={70} x2={372} y2={70} strokeWidth={1} className={HAIRLINE} />

      {/* deposit token on A: burns, then returns for the next loop */}
      <g>
        <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.3;0.42;0.9;1" dur="7s" repeatCount="indefinite" />
        <circle cx={100} cy={104} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
        <text x={100} y={108} textAnchor="middle" fontSize={10} className={GLYPH}>$A</text>
      </g>
      <text x={100} y={134} textAnchor="middle" fontSize={8} letterSpacing={1.5} fill="#E6212F" opacity={0}>
        BURN
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.28;0.34;0.46;1" dur="7s" repeatCount="indefinite" />
      </text>

      {/* the ICM attestation crossing between ledgers */}
      <line x1={164} y1={104} x2={256} y2={104} strokeWidth={1} className={HAIRLINE} />
      <text x={210} y={94} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ICM</text>
      <circle cy={104} r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="168;168;252;252" keyTimes="0;0.34;0.58;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.34;0.38;0.54;0.6;1" dur="7s" repeatCount="indefinite" />
      </circle>

      {/* distinct token minted on B */}
      <g opacity={0}>
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.6;0.7;0.9;1" dur="7s" repeatCount="indefinite" />
        <circle cx={320} cy={104} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
        <text x={320} y={108} textAnchor="middle" fontSize={10} className={GLYPH}>$B</text>
      </g>
      <text x={320} y={134} textAnchor="middle" fontSize={8} letterSpacing={1.5} fill="#E6212F" opacity={0}>
        MINT
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.58;0.64;0.76;1" dur="7s" repeatCount="indefinite" />
      </text>

      <text x={100} y={168} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>BANK A LEDGER</text>
      <text x={320} y={168} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>BANK B LEDGER</text>
    </svg>
  );
}

/* DvP Settlement — the asset leg and the cash leg travel toward each      */
/* other, hold at the settlement line, and release together on one red     */
/* pulse: both legs settle, or neither does.                               */
function DvpSettlement() {
  return (
    <svg {...frame("An asset leg and a cash leg exchanged atomically at a single settlement point")}>
      {/* counterparties */}
      <circle cx={64} cy={100} r={15} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={64} y={104} textAnchor="middle" fontSize={12} className={GLYPH}>A</text>
      <text x={64} y={136} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>SELLER</text>

      <circle cx={356} cy={100} r={15} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={356} y={104} textAnchor="middle" fontSize={12} className={GLYPH}>B</text>
      <text x={356} y={136} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>BUYER</text>

      {/* the two legs: asset lane above, cash lane below */}
      <line x1={88} y1={84} x2={332} y2={84} strokeWidth={1} className={HAIRLINE} />
      <line x1={88} y1={116} x2={332} y2={116} strokeWidth={1} className={HAIRLINE} />
      <text x={110} y={74} fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ASSET</text>
      <text x={310} y={132} textAnchor="end" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>CASH</text>

      {/* the settlement line both legs must cross together */}
      <line x1={210} y1={64} x2={210} y2={136} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />

      {/* asset leg: a square marker, seller to buyer */}
      <rect y={80} width={8} height={8} rx={1.5} className={NODE}>
        <animate attributeName="x" values="92;92;202;202;320;320" keyTimes="0;0.08;0.38;0.52;0.78;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;1;0;0" keyTimes="0;0.08;0.52;0.82;0.9;1" dur="6s" repeatCount="indefinite" />
      </rect>

      {/* cash leg: a round marker, buyer to seller */}
      <circle cy={116} r={4.5} className={NODE}>
        <animate attributeName="cx" values="324;324;214;214;96;96" keyTimes="0;0.08;0.38;0.52;0.78;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;1;0;0" keyTimes="0;0.08;0.52;0.82;0.9;1" dur="6s" repeatCount="indefinite" />
      </circle>

      {/* the atomic moment: one pulse releases both legs */}
      <circle cx={210} cy={100} r={3} fill="none" strokeWidth={1.25} stroke="#E6212F">
        <animate attributeName="r" values="3;3;20;20" keyTimes="0;0.4;0.55;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.4;0.42;0.58;1" dur="6s" repeatCount="indefinite" />
      </circle>
      <text x={210} y={52} textAnchor="middle" fontSize={9} letterSpacing={2} className={MONO} opacity={0}>
        [ ATOMIC ]
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.38;0.44;0.56;0.62;1" dur="6s" repeatCount="indefinite" />
      </text>

      <text x={210} y={178} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>BOTH LEGS OR NEITHER</text>
    </svg>
  );
}

/* Public Liquidity — a sealed business chain messages straight into       */
/* public C-Chain liquidity; the custodial detour it would otherwise take  */
/* sits crossed out above the direct path.                                 */
function PublicLiquidity() {
  const mesh: [number, number][] = [
    [300, 74],
    [336, 64],
    [362, 92],
    [344, 124],
    [306, 122],
  ];
  return (
    <svg {...frame("A permissioned chain settling into public liquidity over ICM with no custodian in the path")}>
      {/* the business L1: sealed, with its own small validator cluster */}
      <rect x={36} y={62} width={112} height={76} rx={10} fill="none" strokeWidth={1.25} className={STRONG} />
      <line x1={70} y1={92} x2={96} y2={86} strokeWidth={1} className={HAIRLINE} />
      <line x1={96} y1={86} x2={84} y2={112} strokeWidth={1} className={HAIRLINE} />
      <line x1={84} y1={112} x2={70} y2={92} strokeWidth={1} className={HAIRLINE} />
      <circle cx={70} cy={92} r={4} className={NODE} />
      <circle cx={96} cy={86} r={4} className={NODE} />
      <circle cx={84} cy={112} r={4} className={NODE} />
      <text x={92} y={158} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>BUSINESS L1</text>

      {/* the C-Chain: an open mesh around its entry node */}
      {mesh.map(([x, y], i) => (
        <g key={i}>
          <line x1={326} y1={96} x2={x} y2={y} strokeWidth={1} className={HAIRLINE} />
          <circle cx={x} cy={y} r={4.5} className={NODE} />
        </g>
      ))}
      <circle cx={326} cy={96} r={5} className={NODE} />
      <text x={330} y={158} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>C-CHAIN LIQUIDITY</text>

      {/* the custodial detour that never happens */}
      <path d="M152,94 Q218,28 284,94" fill="none" strokeDasharray="2 5" strokeWidth={1} opacity={0.7} className={HAIRLINE} />
      <circle cx={218} cy={46} r={11} fill="none" strokeDasharray="2 4" strokeWidth={1} className="stroke-zinc-400 dark:stroke-zinc-600" />
      <g className="stroke-zinc-400 dark:stroke-zinc-600">
        <line x1={214} y1={42} x2={222} y2={50} strokeWidth={1.25} />
        <line x1={214} y1={50} x2={222} y2={42} strokeWidth={1.25} />
      </g>
      <text x={218} y={24} textAnchor="middle" fontSize={8} letterSpacing={1.5} className={FAINT_LABEL}>NO CUSTODIAN</text>

      {/* the direct path, and the settlement taking it */}
      <line x1={148} y1={100} x2={296} y2={100} strokeWidth={1} className={HAIRLINE} />
      <text x={222} y={116} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ICM</text>
      <circle cy={100} r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="152;152;290;290" keyTimes="0;0.12;0.5;1" dur="5.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.12;0.18;0.48;0.56;1" dur="5.5s" repeatCount="indefinite" />
      </circle>
      {/* arrival: liquidity acknowledges */}
      <circle cx={326} cy={96} r={4} fill="none" strokeWidth={1.25} stroke="#E6212F">
        <animate attributeName="r" values="4;4;16;16" keyTimes="0;0.5;0.66;1" dur="5.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0.8;0;0" keyTimes="0;0.5;0.52;0.68;1" dur="5.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* Structured Credit — loan payments converge and cascade down the         */
/* waterfall: the senior tranche is paid first, then mezzanine, then       */
/* junior, in strict order.                                                */
function StructuredCredit() {
  const loans = [44, 74, 104, 134];
  const tranches: { y: number; label: string }[] = [
    { y: 48, label: "SENIOR" },
    { y: 86, label: "MEZZANINE" },
    { y: 124, label: "JUNIOR" },
  ];
  return (
    <svg {...frame("Loan payments cascading through a waterfall: senior tranche first, then mezzanine, then junior")}>
      {/* the loan book */}
      {loans.map((y) => (
        <g key={y}>
          <rect x={40} y={y} width={60} height={20} rx={3} fill="none" strokeWidth={1} className={HAIRLINE} />
          <line x1={48} y1={y + 10} x2={78} y2={y + 10} strokeWidth={1} opacity={0.6} className={HAIRLINE} />
          <line x1={100} y1={y + 10} x2={150} y2={100} strokeWidth={1} opacity={0.6} className={HAIRLINE} />
        </g>
      ))}
      <text x={70} y={180} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>LOANS</text>

      {/* payments trickling in from the book */}
      <circle r={2.5} className={NODE}>
        <animate attributeName="cx" values="100;150" keyTimes="0;1" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="cy" values="54;100" keyTimes="0;1" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.8;0" keyTimes="0;0.5;1" dur="2.6s" repeatCount="indefinite" />
      </circle>

      {/* the spill rail the waterfall drops along */}
      <line x1={216} y1={61} x2={216} y2={137} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />

      {/* the tranches, senior on top */}
      {tranches.map((t, i) => (
        <g key={t.label}>
          <rect x={232} y={t.y} width={136} height={26} rx={4} fill="none" strokeWidth={i === 0 ? 1.25 : 1} className={i === 0 ? STRONG : HAIRLINE} />
          <text x={300} y={t.y + 17} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>{t.label}</text>
        </g>
      ))}
      <text x={300} y={180} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>PAYMENT WATERFALL</text>

      {/* the payment, cascading in strict order */}
      <circle r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="150;150;216;216" keyTimes="0;0.06;0.2;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="cy" values="100;100;61;61;99;99;137;137" keyTimes="0;0.06;0.2;0.3;0.42;0.5;0.62;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.06;0.12;0.66;0.74;1" dur="7s" repeatCount="indefinite" />
      </circle>

      {/* each tranche acknowledges as it is paid */}
      <circle cx={228} cy={61} r={3} fill="none" strokeWidth={1.25} stroke="#E6212F">
        <animate attributeName="r" values="3;3;14;14" keyTimes="0;0.2;0.34;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.2;0.24;0.36;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <circle cx={228} cy={99} r={3} fill="none" strokeWidth={1.25} stroke="#E6212F">
        <animate attributeName="r" values="3;3;14;14" keyTimes="0;0.42;0.56;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.42;0.46;0.58;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <circle cx={228} cy={137} r={3} fill="none" strokeWidth={1.25} stroke="#E6212F">
        <animate attributeName="r" values="3;3;14;14" keyTimes="0;0.62;0.76;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.62;0.66;0.78;1" dur="7s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* Token Issuance — one home contract with the issuer; ICTT carries        */
/* attested transfers out to native remotes on each destination chain.     */
/* No wrapped versions, supply anchored at home.                           */
function TokenIssuance() {
  return (
    <svg {...frame("A home token contract sending attested transfers to native remotes on two destination chains")}>
      {/* the home contract, where supply lives */}
      <rect x={40} y={70} width={110} height={60} rx={10} fill="none" strokeWidth={1.25} className={STRONG} />
      <text x={95} y={90} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>HOME</text>
      <circle cx={95} cy={110} r={10} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={95} y={114} textAnchor="middle" fontSize={9} className={GLYPH}>$</text>
      <text x={95} y={152} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ISSUER</text>

      {/* destination chains */}
      <rect x={290} y={36} width={100} height={52} rx={10} fill="none" strokeWidth={1} className={STRONG} />
      <text x={340} y={56} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>L1 A</text>
      <rect x={290} y={112} width={100} height={52} rx={10} fill="none" strokeWidth={1} className={STRONG} />
      <text x={340} y={132} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>L1 B</text>

      {/* transfer paths */}
      <line x1={150} y1={100} x2={290} y2={62} strokeWidth={1} className={HAIRLINE} />
      <line x1={150} y1={100} x2={290} y2={138} strokeWidth={1} className={HAIRLINE} />
      <text x={220} y={94} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ICTT</text>

      {/* transfer to A, and the native token it mints */}
      <circle r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="154;154;286;286" keyTimes="0;0.08;0.3;1" dur="8s" repeatCount="indefinite" />
        <animate attributeName="cy" values="100;100;62;62" keyTimes="0;0.08;0.3;1" dur="8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.08;0.12;0.28;0.34;1" dur="8s" repeatCount="indefinite" />
      </circle>
      <g opacity={0}>
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.3;0.36;0.92;1" dur="8s" repeatCount="indefinite" />
        <circle cx={340} cy={72} r={9} fill="none" strokeWidth={1.5} className={STRONG} />
        <text x={340} y={76} textAnchor="middle" fontSize={9} className={GLYPH}>$</text>
      </g>

      {/* transfer to B */}
      <circle r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="154;154;286;286" keyTimes="0;0.48;0.7;1" dur="8s" repeatCount="indefinite" />
        <animate attributeName="cy" values="100;100;138;138" keyTimes="0;0.48;0.7;1" dur="8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.48;0.52;0.68;0.74;1" dur="8s" repeatCount="indefinite" />
      </circle>
      <g opacity={0}>
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.7;0.76;0.92;1" dur="8s" repeatCount="indefinite" />
        <circle cx={340} cy={148} r={9} fill="none" strokeWidth={1.5} className={STRONG} />
        <text x={340} y={152} textAnchor="middle" fontSize={9} className={GLYPH}>$</text>
      </g>

      <text x={210} y={188} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ONE ISSUER, NATIVE EVERYWHERE</text>
    </svg>
  );
}

/* Cross-Border Payments — the correspondent rail crawls hop to hop while  */
/* the C-Chain lane below it settles the same corridor in under a second,  */
/* over and over.                                                          */
function CrossBorderPayments() {
  return (
    <svg {...frame("A correspondent banking rail pausing at intermediaries while C-Chain transfers cross the same border in under a second")}>
      {/* the border both rails cross */}
      <line x1={210} y1={40} x2={210} y2={160} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />
      <text x={210} y={30} textAnchor="middle" fontSize={9} letterSpacing={2} className={FAINT_LABEL}>BORDER</text>

      {/* correspondent rail: intermediaries, pauses, days */}
      <text x={60} y={62} fontSize={9} letterSpacing={1.5} className={MONO}>CORRESPONDENT RAIL</text>
      <line x1={60} y1={76} x2={360} y2={76} strokeWidth={1} className={HAIRLINE} />
      <circle cx={60} cy={76} r={4} className={NODE} />
      <circle cx={150} cy={76} r={5} fill="none" strokeWidth={1.25} className={HAIRLINE} />
      <circle cx={270} cy={76} r={5} fill="none" strokeWidth={1.25} className={HAIRLINE} />
      <circle cx={360} cy={76} r={4} className={NODE} />
      <text x={360} y={62} textAnchor="end" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>DAYS</text>
      <circle cy={76} r={4} className={NODE}>
        <animate attributeName="cx" values="64;146;146;266;266;352" keyTimes="0;0.22;0.42;0.64;0.84;1" dur="12s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.95;1" dur="12s" repeatCount="indefinite" />
      </circle>

      {/* the C-Chain lane: same corridor, settled in under a second */}
      <text x={60} y={148} fontSize={9} letterSpacing={1.5} className={MONO}>C-CHAIN</text>
      <line x1={60} y1={124} x2={360} y2={124} strokeWidth={1} className={HAIRLINE} />
      <circle cx={60} cy={124} r={4} className={NODE} />
      <circle cx={360} cy={124} r={4} className={NODE} />
      <text x={360} y={148} textAnchor="end" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>UNDER A SECOND</text>
      <circle cy={124} r={4.5} fill="#E6212F">
        <animate attributeName="cx" values="64;356" keyTimes="0;1" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* Bilateral Repo — four desks, two isolated bilateral ledgers. Proofs     */
/* move inside each pair; across the partition there is nothing to see.    */
function BilateralRepo() {
  return (
    <svg {...frame("Two bilateral repo ledgers running in isolation, each pair blind to the other")}>
      {/* pair A and B on their own ledger */}
      <line x1={106} y1={70} x2={314} y2={70} strokeWidth={1} className={HAIRLINE} />
      <circle cx={90} cy={70} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={90} y={74} textAnchor="middle" fontSize={11} className={GLYPH}>A</text>
      <circle cx={330} cy={70} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={330} y={74} textAnchor="middle" fontSize={11} className={GLYPH}>B</text>
      <text x={210} y={56} textAnchor="middle" fontSize={8} letterSpacing={1.5} className={MONO}>[ PRIVATE ]</text>
      <circle cy={70} r={4} fill="#E6212F">
        <animate attributeName="cx" values="108;312;108" keyTimes="0;0.5;1" dur="3.6s" repeatCount="indefinite" />
      </circle>

      {/* the partition between relationships */}
      <line x1={40} y1={110} x2={380} y2={110} strokeDasharray="4 6" strokeWidth={1} className={HAIRLINE} />

      {/* pair C and D on theirs */}
      <line x1={106} y1={150} x2={314} y2={150} strokeWidth={1} className={HAIRLINE} />
      <circle cx={90} cy={150} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={90} y={154} textAnchor="middle" fontSize={11} className={GLYPH}>C</text>
      <circle cx={330} cy={150} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={330} y={154} textAnchor="middle" fontSize={11} className={GLYPH}>D</text>
      <text x={210} y={136} textAnchor="middle" fontSize={8} letterSpacing={1.5} className={MONO}>[ PRIVATE ]</text>
      <circle cy={150} r={4} fill="#E6212F">
        <animate attributeName="cx" values="108;312;108" keyTimes="0;0.5;1" dur="4.4s" begin="-1.6s" repeatCount="indefinite" />
      </circle>

      {/* B's line of sight into the other pair, stopped at the partition */}
      <line x1={356} y1={82} x2={356} y2={138} strokeDasharray="2 5" strokeWidth={1} className="stroke-zinc-400 dark:stroke-zinc-600" />
      <g className="stroke-zinc-400 dark:stroke-zinc-600">
        <line x1={351} y1={105} x2={361} y2={115} strokeWidth={1.25} />
        <line x1={351} y1={115} x2={361} y2={105} strokeWidth={1.25} />
      </g>

      <text x={210} y={188} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>EACH PAIR, ITS OWN LEDGER</text>
    </svg>
  );
}

/* Permissioned Venue — transactions pass the allowlist on their way into  */
/* the block: the approved wallet lands as a block cell, the unknown one   */
/* is refused at the gate.                                                 */
function PermissionedVenue() {
  return (
    <svg {...frame("An allowlist admitting an approved wallet's transaction into the block and refusing an unknown one")}>
      {/* the lane from wallets to the block */}
      <line x1={56} y1={100} x2={300} y2={100} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />
      <text x={56} y={130} fontSize={9} letterSpacing={1.5} className={MONO}>WALLETS</text>

      {/* the allowlist gate: two posts with a checked opening */}
      <text x={210} y={54} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>TX ALLOWLIST</text>
      <line x1={210} y1={62} x2={210} y2={90} strokeWidth={1.5} className={STRONG} />
      <line x1={210} y1={110} x2={210} y2={138} strokeWidth={1.5} className={STRONG} />

      {/* the block being built */}
      <rect x={300} y={72} width={76} height={56} rx={6} fill="none" strokeWidth={1.25} className={STRONG} />
      <text x={338} y={62} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>BLOCK</text>
      {/* cells already included, and the two slots this loop decides */}
      <rect x={310} y={82} width={14} height={14} rx={2} className={NODE} opacity={0.35} />
      <rect x={330} y={82} width={14} height={14} rx={2} className={NODE} opacity={0.35} />
      <rect x={310} y={104} width={14} height={14} rx={2} fill="none" strokeWidth={1} className={HAIRLINE} />
      <rect x={330} y={104} width={14} height={14} rx={2} fill="none" strokeWidth={1} className={HAIRLINE} />

      {/* approved: passes the gate and lands in the block */}
      <circle cy={100} r={5} className={NODE}>
        <animate attributeName="cx" values="60;60;290;290" keyTimes="0;0.05;0.35;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.35;0.4;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <rect x={310} y={104} width={14} height={14} rx={2} className={NODE} opacity={0}>
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.36;0.4;0.94;1" dur="7s" repeatCount="indefinite" />
      </rect>

      {/* unknown: stopped at the gate */}
      <circle cy={100} r={5} fill="none" strokeWidth={1.25} className="stroke-zinc-400 dark:stroke-zinc-500">
        <animate attributeName="cx" values="60;60;196;196" keyTimes="0;0.5;0.68;1" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.5;0.55;0.85;0.92;1" dur="7s" repeatCount="indefinite" />
      </circle>
      <g opacity={0} className="stroke-zinc-500 dark:stroke-zinc-400">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.68;0.73;0.85;1" dur="7s" repeatCount="indefinite" />
        <line x1={191} y1={95} x2={201} y2={105} strokeWidth={1.25} />
        <line x1={191} y1={105} x2={201} y2={95} strokeWidth={1.25} />
      </g>

      <text x={210} y={182} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>ENFORCED AT EXECUTION</text>
    </svg>
  );
}

export default function UseCaseDiagram({ id }: { id: string }) {
  switch (id) {
    case "tokenized-deposits":
      return <TokenizedDeposits />;
    case "dvp-settlement":
      return <DvpSettlement />;
    case "public-liquidity":
      return <PublicLiquidity />;
    case "token-issuance":
      return <TokenIssuance />;
    case "cross-border-payments":
      return <CrossBorderPayments />;
    case "bilateral-repo":
      return <BilateralRepo />;
    case "permissioned-venue":
      return <PermissionedVenue />;
    case "structured-credit":
      return <StructuredCredit />;
    default:
      return null;
  }
}
