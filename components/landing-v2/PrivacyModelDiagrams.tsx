import React from "react";

/* ------------------------------------------------------------------ */
/* Privacy architecture diagrams — one instrument per model, adapted   */
/* from Alejandro's originals into the PillarDiagrams drawing language: */
/* hairline zinc strokes, red reserved for the thing that is alive, and */
/* SMIL animation so they render without JS and stay hydration-safe.    */
/* Every coordinate is a pre-rounded literal.                           */
/* ------------------------------------------------------------------ */

const MONO = "fill-zinc-500 font-mono dark:fill-zinc-400";
const FAINT_LABEL = "fill-zinc-400 font-mono dark:fill-zinc-500";
const HAIRLINE = "stroke-zinc-300 dark:stroke-zinc-700";
const STRONG = "stroke-zinc-900 dark:stroke-zinc-100";
const NODE = "fill-zinc-700 dark:fill-zinc-300";
const PANEL = "fill-white dark:fill-zinc-950";
const GLYPH = "fill-zinc-900 font-mono dark:fill-zinc-100";

function frame(label: string) {
  return {
    viewBox: "0 0 420 200",
    className: "w-full max-w-[440px] select-none",
    role: "img" as const,
    "aria-label": label,
  };
}

/* Walled Garden — a sealed enclosure with one gate: approved participants  */
/* pass through, the unknown one is stopped at the line.                    */
function WalledGarden() {
  const inside: [number, number][] = [
    [300, 70],
    [340, 102],
    [320, 146],
    [268, 142],
    [256, 92],
  ];
  return (
    <svg {...frame("A permissioned network admitting approved participants and blocking the unknown")}>
      {/* the wall — a sealed rounded enclosure, doubled at the edge */}
      <rect x={232} y={44} width={168} height={116} rx={14} fill="none" strokeWidth={1.5} className={STRONG} />
      <rect x={226} y={38} width={180} height={128} rx={18} fill="none" strokeWidth={1} opacity={0.4} className={STRONG} />

      {/* gate notch on the left edge: mask the wall stroke, add two posts */}
      <rect x={228} y={92} width={10} height={24} className={PANEL} />
      <line x1={232} y1={92} x2={232} y2={99} strokeWidth={1.5} className={STRONG} />
      <line x1={232} y1={109} x2={232} y2={116} strokeWidth={1.5} className={STRONG} />

      {/* core + approved cluster inside */}
      {inside.map(([x, y], i) => (
        <g key={i}>
          <line x1={296} y1={104} x2={x} y2={y} strokeWidth={1} className={HAIRLINE} />
          <circle cx={x} cy={y} r={5} className={NODE} />
        </g>
      ))}
      <circle cx={296} cy={104} r={13} fill="none" strokeWidth={1.5} className={STRONG} />
      <circle cx={296} cy={104} r={4} fill="#E6212F">
        <animate attributeName="opacity" values="1;0.4;1" dur="2.5s" repeatCount="indefinite" />
      </circle>

      {/* approach lane into the gate */}
      <line x1={30} y1={104} x2={224} y2={104} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />

      {/* approved participant: passes the gate and joins */}
      <circle cy={104} r={5} className={NODE}>
        <animate attributeName="cx" values="40;272;272;40" keyTimes="0;0.4;0.95;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0;0;0" keyTimes="0;0.06;0.42;0.5;0.95;1" dur="6s" repeatCount="indefinite" />
      </circle>

      {/* unknown participant: stopped at the gate, refused */}
      <circle cy={104} r={5} fill="none" strokeWidth={1.25} className="stroke-zinc-400 dark:stroke-zinc-500">
        <animate attributeName="cx" values="40;40;214;214;40" keyTimes="0;0.5;0.72;0.95;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.5;0.56;0.9;0.96;1" dur="6s" repeatCount="indefinite" />
      </circle>
      <g opacity={0} className="stroke-zinc-500 dark:stroke-zinc-400">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.72;0.78;0.9;1" dur="6s" repeatCount="indefinite" />
        <line x1={209} y1={99} x2={219} y2={109} strokeWidth={1.25} />
        <line x1={209} y1={109} x2={219} y2={99} strokeWidth={1.25} />
      </g>

      <text x={44} y={130} fontSize={10} letterSpacing={2} className={MONO}>REQUESTS</text>
      <text x={316} y={186} textAnchor="middle" fontSize={10} letterSpacing={2} className={MONO}>PRIVATE L1</text>
    </svg>
  );
}

/* Partitioned Ledger — a private bilateral channel between two parties; a  */
/* third party sits behind the partition and cannot see it exists.          */
function PartitionedLedger() {
  return (
    <svg {...frame("A private bilateral ledger between two parties, invisible to a third")}>
      {/* A and B share a private channel */}
      <line x1={96} y1={92} x2={214} y2={92} strokeWidth={1} className={HAIRLINE} />

      <circle cx={80} cy={92} r={15} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={80} y={96} textAnchor="middle" fontSize={12} className={GLYPH}>A</text>
      <text x={80} y={128} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>BANK A</text>

      <circle cx={230} cy={92} r={15} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={230} y={96} textAnchor="middle" fontSize={12} className={GLYPH}>B</text>
      <text x={230} y={128} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>BANK B</text>

      {/* settlement proof travels back and forth */}
      <circle r={4.5} cy={92} fill="#E6212F">
        <animate attributeName="cx" values="98;212;98" keyTimes="0;0.5;1" dur="3.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;1;1;1;0.3" keyTimes="0;0.15;0.5;0.85;1" dur="3.4s" repeatCount="indefinite" />
      </circle>
      <text x={155} y={74} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={MONO}>[ PRIVATE ]</text>

      {/* partition separating the non-party */}
      <line x1={300} y1={34} x2={300} y2={168} strokeDasharray="4 6" strokeWidth={1} className={HAIRLINE} />

      {/* Bank C — behind the partition, cannot see the channel */}
      <circle cx={362} cy={92} r={15} fill="none" strokeWidth={1.25} className="stroke-zinc-400 dark:stroke-zinc-600" />
      <text x={362} y={96} textAnchor="middle" fontSize={12} className="fill-zinc-400 font-mono dark:fill-zinc-600">C</text>
      <text x={362} y={128} textAnchor="middle" fontSize={9} letterSpacing={1.5} className={FAINT_LABEL}>NON-PARTY</text>

      {/* C's line of sight, stopped at the partition */}
      <line x1={346} y1={92} x2={310} y2={92} strokeDasharray="2 5" strokeWidth={1} className="stroke-zinc-400 dark:stroke-zinc-600" />
      <g className="stroke-zinc-400 dark:stroke-zinc-600">
        <line x1={295} y1={87} x2={305} y2={97} strokeWidth={1.25} />
        <line x1={295} y1={97} x2={305} y2={87} strokeWidth={1.25} />
      </g>
    </svg>
  );
}

/* Encrypted Settlement — encrypted cells on a shared ledger; a public       */
/* observer sees validity only, while an auditor's key reveals one value.    */
function EncryptedSettlement() {
  const cells = [60, 170, 280];
  return (
    <svg {...frame("Encrypted balances on a shared ledger, revealed only to an auditor key")}>
      <text x={40} y={38} fontSize={9} letterSpacing={1.5} className={MONO}>SHARED LEDGER</text>
      <line x1={40} y1={48} x2={392} y2={48} strokeWidth={1} className={HAIRLINE} />

      {cells.map((x, i) => (
        <g key={i}>
          <rect x={x} y={54} width={80} height={28} rx={5} fill="none" strokeWidth={1.25} className={i === 1 ? STRONG : HAIRLINE} />
          {i === 1 ? (
            <>
              {/* middle cell: padlock and revealed value cross-fade */}
              <g>
                <animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;0.45;0.55;0.8;0.9;1" dur="5s" repeatCount="indefinite" />
                <rect x={x + 32} y={64} width={16} height={11} rx={2} fill="none" strokeWidth={1} className={HAIRLINE} />
                <path d={`M${x + 35},64 a5,5 0 0 1 10,0`} fill="none" strokeWidth={1} className={HAIRLINE} />
              </g>
              <text x={x + 40} y={73} textAnchor="middle" fontSize={11} opacity={0} className={GLYPH}>
                $840M
                <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.45;0.55;0.8;0.9;1" dur="5s" repeatCount="indefinite" />
              </text>
            </>
          ) : (
            <>
              <rect x={x + 32} y={64} width={16} height={11} rx={2} fill="none" strokeWidth={1} className={HAIRLINE} />
              <path d={`M${x + 35},64 a5,5 0 0 1 10,0`} fill="none" strokeWidth={1} className={HAIRLINE} />
            </>
          )}
        </g>
      ))}

      {/* public observer — validity only */}
      <circle cx={104} cy={150} r={4} className={NODE} />
      <text x={116} y={146} fontSize={9} letterSpacing={1} className={MONO}>PUBLIC</text>
      <text x={116} y={159} fontSize={8} className={FAINT_LABEL}>sees: valid</text>

      {/* auditor — key reveals the value */}
      <circle cx={268} cy={150} r={4} fill="#E6212F">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <text x={280} y={146} fontSize={9} letterSpacing={1} className={MONO}>AUDITOR</text>
      <text x={280} y={159} fontSize={8} className={FAINT_LABEL}>key reveals value</text>

      {/* the key travels from auditor up to the middle cell */}
      <circle r={3} fill="#E6212F">
        <animate attributeName="cx" values="268;210;210;268" keyTimes="0;0.45;0.55;1" dur="5s" repeatCount="indefinite" />
        <animate attributeName="cy" values="150;82;82;150" keyTimes="0;0.45;0.55;1" dur="5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.2;0.55;0.6;1" dur="5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export default function PrivacyModelDiagram({ id }: { id: string }) {
  switch (id) {
    case "walled-garden":
      return <WalledGarden />;
    case "partitioned-ledger":
      return <PartitionedLedger />;
    case "encrypted-settlement":
      return <EncryptedSettlement />;
    default:
      return null;
  }
}
