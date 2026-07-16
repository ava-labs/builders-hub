import React from "react";

/* ------------------------------------------------------------------ */
/* Design-pattern hero diagrams — one instrument per pattern, in the   */
/* PillarDiagrams drawing language: hairline zinc, red for the thing    */
/* that is alive (a burn, a mint, a proof in flight), SMIL so it renders */
/* without JS. Coordinates are pre-rounded literals.                    */
/* ------------------------------------------------------------------ */

const MONO = "fill-zinc-500 font-mono dark:fill-zinc-400";
const FAINT = "fill-zinc-400 font-mono dark:fill-zinc-500";
const HAIRLINE = "stroke-zinc-300 dark:stroke-zinc-700";
const STRONG = "stroke-zinc-900 dark:stroke-zinc-100";
const GLYPH = "fill-zinc-900 font-mono dark:fill-zinc-100";

function frame(label: string) {
  return {
    viewBox: "0 0 440 240",
    className: "w-full max-w-[460px] select-none",
    role: "img" as const,
    "aria-label": label,
  };
}

/* Interbank clearing — a claim is burned on Bank A's L1, the burn proof  */
/* travels over ICM, Bank B mints, and the clearing chain records the     */
/* obligation without seeing either ledger.                               */
function BurnMint() {
  return (
    <svg {...frame("A transfer as coordinated burn-and-mint verified between two sovereign L1s over ICM")}>
      {/* Bank A — sovereign L1 */}
      <rect x={24} y={40} width={150} height={64} rx={6} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={36} y={60} fontSize={10} letterSpacing={1.5} className={MONO}>BANK A · L1</text>
      <text x={36} y={94} fontSize={9} letterSpacing={1} className={FAINT}>burn</text>
      {/* A core + burn pulse */}
      <circle cx={148} cy={72} r={4} fill="#E84142">
        <animate attributeName="opacity" values="1;0.4;1" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={148} cy={72} r={6} fill="none" strokeWidth={1} className="stroke-[#E84142]">
        <animate attributeName="r" values="6;16" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="1.6s" repeatCount="indefinite" />
      </circle>

      {/* Bank B — sovereign L1 */}
      <rect x={266} y={40} width={150} height={64} rx={6} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={278} y={60} fontSize={10} letterSpacing={1.5} className={MONO}>BANK B · L1</text>
      <text x={278} y={94} fontSize={9} letterSpacing={1} className={FAINT}>mint</text>
      {/* B core + mint pulse (offset so it reads as arriving after the burn) */}
      <circle cx={292} cy={72} r={4} fill="#E84142">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" begin="0.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={292} cy={72} r={6} fill="none" strokeWidth={1} className="stroke-[#E84142]">
        <animate attributeName="r" values="6;16" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
      </circle>

      {/* ICM channel */}
      <text x={220} y={34} textAnchor="middle" fontSize={9} letterSpacing={2} className={MONO}>ICM</text>
      <line x1={174} y1={72} x2={266} y2={72} strokeDasharray="4 4" strokeWidth={1} className={HAIRLINE} />
      {/* burn proof travelling A → B */}
      <circle r={4.5} cy={72} fill="#E84142">
        <animate attributeName="cx" values="174;174;266;266" keyTimes="0;0.15;0.5;1" dur="4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.15;0.17;0.5;0.52;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <text x={220} y={90} textAnchor="middle" fontSize={8} className={FAINT}>burn proof</text>

      {/* obligation-status lines down to the clearing chain */}
      <line x1={99} y1={104} x2={168} y2={168} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />
      <line x1={341} y1={104} x2={272} y2={168} strokeDasharray="2 5" strokeWidth={1} className={HAIRLINE} />

      {/* clearing chain */}
      <rect x={120} y={168} width={200} height={50} rx={6} fill="none" strokeWidth={1.5} className={STRONG} />
      <text x={220} y={190} textAnchor="middle" fontSize={10} letterSpacing={1.5} className={GLYPH}>CLEARING ENTITY</text>
      <text x={220} y={206} textAnchor="middle" fontSize={8} className={FAINT}>nets · settles · never sees ledgers</text>
    </svg>
  );
}

export default function PatternDiagram({ id }: { id: string }) {
  switch (id) {
    case "burn-mint":
      return <BurnMint />;
    default:
      return null;
  }
}
